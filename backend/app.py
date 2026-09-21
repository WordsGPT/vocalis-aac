import os
import io
import tempfile
import logging
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import edge_tts
import torch
import whisper

from backend.engine import get_smart_suggestions, OLLAMA_URL

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

# Lazy-loaded Whisper model
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
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

CURATED_VOICES = [
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
    
    return {
        "status": "healthy",
        "cuda": cuda_available,
        "ollama": ollama_ok,
        "groq_ready": True,
        "whisper_ready": _whisper_model is not None,
        "tts": "edge-tts ready"
    }

@app.get("/api/voices")
async def list_voices():
    return CURATED_VOICES

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
    """Streams synthesized MP3 audio from Edge-TTS."""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    voice = req.voice or "en-US-GuyNeural"
    rate = req.rate or "+0%"
    pitch = req.pitch or "+0Hz"

    try:
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
