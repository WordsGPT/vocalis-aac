"""Private Pocket TTS worker called by Vocalis's public Vercel proxy."""
import io
import os
import secrets
import tempfile
import wave
from functools import lru_cache
from threading import Lock

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_model_lock = Lock()


@lru_cache(maxsize=1)
def model():
    from pocket_tts import TTSModel
    return TTSModel.load_model(language="spanish")


@app.get("/health")
def health():
    return {"status": "healthy"}


def render_audio(audio_bytes: bytes, text: str) -> bytes:
    # A model instance is reused, while generation is serialized to bound RAM use.
    with _model_lock, tempfile.NamedTemporaryFile(suffix=".wav") as sample:
        sample.write(audio_bytes)
        sample.flush()
        tts = model()
        voice = tts.get_state_for_audio_prompt(sample.name)
        samples = tts.generate_audio(voice, text).detach().cpu().numpy()
    import numpy as np
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(tts.sample_rate)
        wav.writeframes(pcm.tobytes())
    if output.tell() > 4_000_000:
        raise HTTPException(502, "Generated audio is too large")
    return output.getvalue()


@app.post("/synthesize")
async def synthesize(
    reference: UploadFile = File(...),
    text: str = Form(...),
    authorization: str = Header(""),
):
    worker_secret = os.environ.get("POCKET_TTS_SECRET", "")
    if not worker_secret or not secrets.compare_digest(authorization, f"Bearer {worker_secret}"):
        raise HTTPException(401, "Unauthorized")
    if not 1 <= len(text.strip()) <= 500:
        raise HTTPException(400, "Text must be 1–500 characters")
    audio_bytes = await reference.read(2_000_001)
    if len(audio_bytes) > 2_000_000:
        raise HTTPException(413, "Reference audio is too large")
    try:
        with wave.open(io.BytesIO(audio_bytes)) as wav:
            duration = wav.getnframes() / wav.getframerate()
            if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 24000) or not 5 <= duration <= 30:
                raise ValueError
    except (wave.Error, ValueError, ZeroDivisionError):
        raise HTTPException(400, "Reference must be 5–30 seconds of 24 kHz mono 16-bit WAV") from None

    # The reference file exists only for this request; the worker stores no voice profile.
    output = await run_in_threadpool(render_audio, audio_bytes, text.strip())
    return Response(output, media_type="audio/wav")
