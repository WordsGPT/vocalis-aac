"""Small, stateless Vercel API for Vocalis."""
import base64
import hashlib
import hmac
import io
import os
import re
import secrets
import time
import wave
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.engine import get_smart_suggestions, get_server_groq_api_key

API = "https://generativelanguage.googleapis.com/v1beta"
VOICE_MODEL = "gemini-3.8-flash-tts"
COOKIE = "vocalis_session"
SESSION_SECONDS = 60 * 60 * 24 * 7
app = FastAPI(title="Vocalis API", docs_url=None, redoc_url=None, openapi_url=None)


def config(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise HTTPException(503, f"Falta configurar {name} en el servidor.")
    return value


def signature(value: str) -> str:
    # Derive the signing key from both secrets so changing the login password
    # also revokes every previously issued session.
    signing_key = hmac.new(config("AUTH_SECRET").encode(),
                           config("AUTH_PASSWORD").encode(), hashlib.sha256).digest()
    return hmac.new(signing_key, value.encode(), hashlib.sha256).hexdigest()


def valid_session(token: str) -> bool:
    try:
        expiry, mac = token.split(":", 1)
        expected = signature(f"{config('AUTH_USERNAME')}:{expiry}")
        return int(expiry) > time.time() and hmac.compare_digest(mac, expected)
    except (ValueError, TypeError):
        return False


@app.middleware("http")
async def protect_api(request: Request, call_next):
    path = request.url.path
    if path in {"/api/tts", "/api/voice/clone"}:
        if not valid_session(request.cookies.get(COOKIE, "")):
            return JSONResponse({"detail": "Inicia sesión para continuar."}, status_code=401,
                                headers={"Cache-Control": "no-store"})
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        scheme = "https" if os.environ.get("VERCEL") == "1" else request.url.scheme
        if origin and origin != f"{scheme}://{request.headers.get('host')}":
            return JSONResponse({"detail": "Origen no permitido."}, status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


@app.post("/api/login")
async def login(body: Login, response: Response):
    username = config("AUTH_USERNAME")
    password = config("AUTH_PASSWORD")
    good_user = secrets.compare_digest(body.username, username)
    good_password = secrets.compare_digest(body.password, password)
    if not (good_user and good_password):
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    expiry = str(int(time.time()) + SESSION_SECONDS)
    value = f"{username}:{expiry}"
    response.set_cookie(COOKIE, f"{expiry}:{signature(value)}", max_age=SESSION_SECONDS,
                        httponly=True, secure=os.environ.get("VERCEL") == "1",
                        samesite="strict", path="/")
    return {"ok": True}


@app.get("/api/session")
async def session(request: Request):
    return {"authenticated": valid_session(request.cookies.get(COOKIE, ""))}


@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


class Suggest(BaseModel):
    text: str = Field(max_length=2000)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    grammatical_form: str = "masculine"
    tone: str = "natural"
    count: int = Field(default=6, ge=3, le=8)
    preferred_engine: str = "groq"


@app.post("/api/suggest")
async def suggest(body: Suggest, request: Request):
    engine = body.preferred_engine if body.preferred_engine in {"groq", "gemini", "heuristic"} else "groq"
    if engine == "gemini" and not valid_session(request.cookies.get(COOKIE, "")):
        raise HTTPException(401, "Inicia sesión para usar Gemini.")
    return get_smart_suggestions(body.text, body.history, body.tone, body.count,
                                 gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
                                 groq_api_key=get_server_groq_api_key(), preferred_engine=engine,
                                 grammatical_form=body.grammatical_form)


@app.get("/api/health")
async def health():
    return {"status": "healthy", "groq_ready": bool(get_server_groq_api_key()),
            "gemini_ready": bool(os.environ.get("GEMINI_API_KEY"))}


@app.get("/api/voices")
async def voices():
    return [{"id": "Puck", "name": "Puck (Gemini)", "lang": "es-ES"},
            {"id": "Kore", "name": "Kore (Gemini)", "lang": "es-ES"},
            {"id": "Aoede", "name": "Aoede (Gemini)", "lang": "es-ES"}]


async def google_post(path: str, payload: dict, timeout: float = 45) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            result = await client.post(f"{API}/{path}", json=payload,
                                       headers={"x-goog-api-key": config("GEMINI_API_KEY")})
            result.raise_for_status()
            return result.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Gemini rechazó la solicitud ({exc.response.status_code}).") from None
        except httpx.RequestError:
            raise HTTPException(502, "No se pudo conectar con Gemini.") from None


def wav_duration(data: bytes, lower: float, upper: float) -> None:
    try:
        with wave.open(io.BytesIO(data)) as audio:
            duration = audio.getnframes() / audio.getframerate()
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or not lower <= duration <= upper:
                raise ValueError()
    except (wave.Error, ZeroDivisionError, ValueError):
        raise HTTPException(400, f"El audio debe ser WAV mono de 16 bits y durar entre {lower:g} y {upper:g} segundos.") from None


@app.post("/api/voice/clone")
async def clone_voice(reference: UploadFile = File(...), consent: UploadFile = File(...)):
    source = await reference.read(2_000_001)
    permission = await consent.read(2_000_001)
    if len(source) > 2_000_000 or len(permission) > 2_000_000:
        raise HTTPException(413, "Los audios son demasiado grandes.")
    wav_duration(source, 10, 30)
    wav_duration(permission, 2, 30)
    result = await google_post("voices", {"store": True, "voice": {
        "model": VOICE_MODEL, "type": "replicated", "display_name": "Vocalis personal",
        "replicated": {
            "source_audio": {"mime_type": "audio/wav", "data": base64.b64encode(source).decode()},
            "consent_audio": {"mime_type": "audio/wav", "data": base64.b64encode(permission).decode()},
        }}}, timeout=90)
    voice_id = result.get("id", "")
    if not re.fullmatch(r"voice_[A-Za-z0-9_-]+", voice_id):
        raise HTTPException(502, "Gemini no devolvió un identificador de voz válido.")
    return {"status": "ready", "voice_id": voice_id, "message": "Voz creada y guardada en Gemini."}


class TTS(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice: str = "Puck"


@app.post("/api/tts")
async def tts(body: TTS, request: Request):
    if not re.fullmatch(r"voice_[A-Za-z0-9_-]+|Puck|Kore|Aoede", body.voice):
        raise HTTPException(400, "Voz no válida.")
    if body.voice.startswith("voice_") and not valid_session(request.cookies.get(COOKIE, "")):
        raise HTTPException(401, "Inicia sesión para usar la voz personal.")
    result = await google_post("interactions", {
        "model": VOICE_MODEL,
        "input": [{"type": "user_input", "content": [{"type": "text", "text": body.text,
            "annotations": [{"type": "speech_metadata", "style": "natural, clear Spanish"}]}]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": body.voice}]},
    }, timeout=90)
    output = result.get("output_audio") or next((part for step in result.get("steps", [])
        if step.get("type") == "model_output" for part in step.get("content", [])
        if part.get("type") == "audio"), None)
    if not output or not output.get("data"):
        raise HTTPException(502, "Gemini no devolvió audio.")
    audio = base64.b64decode(output["data"])
    if len(audio) > 4_000_000:
        raise HTTPException(502, "El audio generado supera el límite de entrega.")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...), language: str = Form("es")):
    data = await file.read(3_000_001)
    if not data or len(data) > 3_000_000:
        raise HTTPException(413, "El audio debe ocupar menos de 3 MB.")
    mime = (file.content_type or "").split(";")[0]
    if mime not in {"audio/webm", "audio/mp4", "audio/ogg", "audio/wav"}:
        raise HTTPException(400, "Formato de audio no compatible.")
    groq_key = get_server_groq_api_key()
    if not groq_key:
        raise HTTPException(503, "Falta configurar GROQ_API_KEY para la transcripción.")
    async with httpx.AsyncClient(timeout=45) as client:
        try:
            result = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                data={"model": "whisper-large-v3-turbo", "language": language.split("-")[0].lower()},
                files={"file": (file.filename or "recording.webm", data, mime)},
            )
            result.raise_for_status()
            return {"text": result.json().get("text", "").strip(), "engine": "groq-whisper"}
        except (httpx.HTTPStatusError, httpx.RequestError):
            raise HTTPException(502, "No se pudo transcribir el audio con Groq.") from None


# Serve the built app if Vercel routes the root path to this FastAPI function.
public_dir = Path(__file__).resolve().parents[1] / "public"
if public_dir.is_dir():
    app.mount("/", StaticFiles(directory=public_dir, html=True), name="frontend")
