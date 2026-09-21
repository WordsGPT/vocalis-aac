import os
import io
import asyncio
import subprocess
import tempfile
import logging
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import torch

try:
    import edge_tts
except ImportError:  # Optional when Vocalis runs in the Qwen runtime.
    edge_tts = None

try:
    import whisper
except ImportError:  # Browser recognition remains available without local Whisper.
    whisper = None

from backend.engine import get_smart_suggestions, OLLAMA_URL
from backend.qwen_voice import qwen_voice

logger = logging.getLogger("echo_flow_api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Assistive Voice AAC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_qwen_preload_task = None


@app.on_event("startup")
async def preload_qwen_voice():
    """Move model/profile setup off the first press of the Speak button."""
    global _qwen_preload_task
    enabled = os.environ.get("QWEN_TTS_PRELOAD", "true").lower() in {"1", "true", "yes", "on"}
    if not enabled or not qwen_voice.status().available:
        return

    async def load_in_background():
        try:
            await asyncio.to_thread(qwen_voice.load)
            warmup = os.environ.get("QWEN_TTS_WARMUP", "true").lower() in {"1", "true", "yes", "on"}
            if warmup:
                await asyncio.to_thread(qwen_voice.synthesize, "Hola.", "Spanish")
            status = qwen_voice.status()
            logger.info("Qwen voice ready: model=%s attention=%s", status.model, status.attention)
        except Exception:
            logger.exception("Could not preload the Qwen voice; other TTS voices remain available")

    _qwen_preload_task = asyncio.create_task(load_in_background())

# Lazy-loaded Whisper model
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        if whisper is None:
            raise RuntimeError("Local Whisper is not installed; use browser speech recognition")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Loading Whisper tiny on {device}...")
        _whisper_model = whisper.load_model("tiny", device=device)
        logger.info("Whisper model loaded!")
    return _whisper_model

class SuggestRequest(BaseModel):
    text: str
    history: Optional[List[Dict[str, str]]] = None
    tone: Optional[str] = "natural"
    count: Optional[int] = 6
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    preferred_engine: Optional[str] = "groq"

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "es-ES-AlvaroNeural"
    rate: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"
    language: Optional[str] = "Spanish"

CURATED_VOICES = [
    {"id": "qwen-clone", "name": "Mi voz clonada (Qwen3-TTS)", "gender": "Custom", "lang": "es-ES"},
    {"id": "es-ES-AlvaroNeural", "name": "Álvaro (España, Natural)", "gender": "Male", "lang": "es-ES"},
    {"id": "es-ES-ElviraNeural", "name": "Elvira (España, Cálida)", "gender": "Female", "lang": "es-ES"},
    {"id": "es-MX-DaliaNeural", "name": "Dalia (México, Expresiva)", "gender": "Female", "lang": "es-MX"},
    {"id": "es-MX-JorgeNeural", "name": "Jorge (México, Amigable)", "gender": "Male", "lang": "es-MX"},
    {"id": "es-US-PalomaNeural", "name": "Paloma (EE.UU., Clara)", "gender": "Female", "lang": "es-US"},
    {"id": "es-US-AlonsoNeural", "name": "Alonso (EE.UU., Cercano)", "gender": "Male", "lang": "es-US"},
    {"id": "en-US-GuyNeural", "name": "Guy (US Male, Natural)", "gender": "Male", "lang": "en-US"},
    {"id": "en-US-JennyNeural", "name": "Jenny (US Female, Clear)", "gender": "Female", "lang": "en-US"},
    {"id": "en-US-AriaNeural", "name": "Aria (US Female, Expressive)", "gender": "Female", "lang": "en-US"},
    {"id": "fr-FR-HenriNeural", "name": "Henri (French Male)", "gender": "Male", "lang": "fr-FR"}
]

@app.get("/api/health")
async def health():
    cuda_available = torch.cuda.is_available()
    ollama_ok = False
    try:
        import requests
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=1.5)
        ollama_ok = (r.status_code == 200)
    except Exception:
        pass
    
    clone_status = qwen_voice.status()
    return {
        "status": "healthy",
        "cuda": cuda_available,
        "ollama": ollama_ok,
        "groq_ready": True,
        "whisper_ready": _whisper_model is not None,
        "tts": "qwen-clone ready" if clone_status.available else "edge-tts ready",
        "qwen_voice": clone_status.__dict__,
    }

@app.get("/api/voices")
async def list_voices():
    return CURATED_VOICES

@app.post("/api/voice/clone")
async def clone_voice(file: UploadFile = File(...)):
    """Build a Qwen speaker profile from a short recording; no transcript required."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="La grabación está vacía")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La grabación no puede superar 20 MB")

    input_suffix = os.path.splitext(file.filename or "voice.webm")[1] or ".webm"
    input_path = None
    wav_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=input_suffix) as uploaded:
            uploaded.write(content)
            input_path = uploaded.name
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as converted:
            wav_path = converted.name

        conversion = await asyncio.to_thread(
            subprocess.run,
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", input_path,
                "-ac", "1", "-ar", "24000", wav_path,
            ],
            capture_output=True,
            text=True,
        )
        if conversion.returncode != 0:
            raise ValueError(conversion.stderr.strip() or "Formato de audio no compatible")

        await asyncio.to_thread(qwen_voice.clone_from_audio, wav_path)
        return {
            "status": "ready",
            "message": "Voz clonada y lista para usar.",
            "voice_id": "qwen-clone",
        }
    except Exception as exc:
        logger.error(f"Voice cloning error: {exc}")
        raise HTTPException(status_code=500, detail=f"No se pudo clonar la voz: {exc}")
    finally:
        for path in (input_path, wav_path):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass

@app.post("/api/suggest")
async def suggest(req: SuggestRequest):
    res = get_smart_suggestions(
        partner_text=req.text,
        history=req.history,
        tone=req.tone or "natural",
        count=req.count or 6,
        gemini_api_key=req.gemini_api_key,
        groq_api_key=req.groq_api_key,
        preferred_engine=req.preferred_engine or "groq"
    )
    return res

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribes an uploaded audio blob (webm, wav, ogg) using Whisper."""
    try:
        suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)
        
        model = get_whisper_model()
        result = model.transcribe(tmp_path, fp16=torch.cuda.is_available())
        text = result.get("text", "").strip()
        
        try:
            os.remove(tmp_path)
        except OSError:
            pass
            
        return {"text": text}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/api/tts")
async def generate_tts(req: TTSRequest):
    """Synthesizes speech with the saved Qwen clone or an Edge-TTS voice."""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    voice = req.voice or "en-US-GuyNeural"
    rate = req.rate or "+0%"
    pitch = req.pitch or "+0Hz"

    try:
        if voice == "qwen-clone":
            audio = await asyncio.to_thread(
                qwen_voice.synthesize,
                text,
                req.language or "Spanish",
            )
            return StreamingResponse(
                io.BytesIO(audio),
                media_type="audio/wav",
                headers={"Content-Disposition": "inline; filename=cloned-speech.wav"},
            )

        if edge_tts is None:
            raise RuntimeError("Edge-TTS is not installed in this Python environment")
        comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        
        async def audio_generator():
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(
            audio_generator(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

# If frontend build exists, serve it
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
