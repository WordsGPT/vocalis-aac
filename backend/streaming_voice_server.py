"""Isolated low-latency Qwen worker.

This process runs in the faster-qwen3-tts virtual environment so its newer
Transformers dependency cannot affect the existing buffered Qwen engine.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import queue
import threading
from pathlib import Path
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from faster_qwen3_tts import FasterQwen3TTS


logger = logging.getLogger("vocalis_streaming_tts")
logging.basicConfig(level=logging.INFO)

MODEL_ALIASES = {
    "fast": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "0.6b": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "quality": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    "1.7b": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
}
_configured_model = os.environ.get("QWEN_TTS_MODEL", "fast").strip()
MODEL_ID = MODEL_ALIASES.get(_configured_model.lower(), _configured_model)
PROFILE_DIRECTORY = Path(os.environ.get(
    "QWEN_VOICE_PROFILE_DIRECTORY",
    Path(__file__).resolve().parents[2] / "qwen3-tts-runtime" / "voice_profiles",
)).expanduser()
CHUNK_SIZE = max(1, int(os.environ.get("QWEN_STREAM_CHUNK_SIZE", "4")))

app = FastAPI(title="Vocalis streaming Qwen worker")
model: FasterQwen3TTS | None = None
model_error: str | None = None
model_loading = False
generation_lock = threading.Lock()
prompt_cache: dict[str, tuple[int, dict[str, Any]]] = {}


class StreamRequest(BaseModel):
    text: str
    language: str = "Spanish"


def profile_path(client_id: str) -> Path:
    if not client_id or len(client_id) > 200:
        raise ValueError("Invalid client ID")
    key = hashlib.sha256(client_id.encode("utf-8")).hexdigest()
    return PROFILE_DIRECTORY / f"{key}.pt"


def load_prompt(client_id: str) -> dict[str, Any]:
    path = profile_path(client_id)
    if not path.is_file():
        raise FileNotFoundError("No voice has been cloned on this device yet")
    modified = path.stat().st_mtime_ns
    cached = prompt_cache.get(client_id)
    if cached and cached[0] == modified:
        return cached[1]

    payload = torch.load(path, map_location="cpu", weights_only=True)
    items = payload.get("items", [])
    if not items:
        raise ValueError("The saved voice profile is empty")
    item = items[0]
    x_vector_only = bool(item.get("x_vector_only_mode", True))
    prompt = {
        "ref_code": [item.get("ref_code")],
        "ref_spk_embedding": [item["ref_spk_embedding"].to("cuda:0")],
        "x_vector_only_mode": [x_vector_only],
        "icl_mode": [bool(item.get("icl_mode", not x_vector_only))],
    }
    prompt_cache[client_id] = (modified, prompt)
    return prompt


def load_model() -> None:
    global model, model_error, model_loading
    model_loading = True
    try:
        logger.info("Loading streaming model %s", MODEL_ID)
        loaded = FasterQwen3TTS.from_pretrained(
            MODEL_ID,
            device="cuda",
            dtype=torch.bfloat16,
            attn_implementation="sdpa",
        )
        loaded.warmup(prefill_len=128)
        model = loaded
        model_error = None
        logger.info("Streaming Qwen model is ready (chunk_size=%s)", CHUNK_SIZE)
    except Exception as exc:
        model_error = f"{type(exc).__name__}: {exc}"
        logger.exception("Could not initialize streaming Qwen")
    finally:
        model_loading = False


@app.on_event("startup")
async def start_model_load():
    asyncio.create_task(asyncio.to_thread(load_model))


@app.get("/health")
async def health():
    return {
        "status": "ready" if model is not None else "loading" if model_loading else "error",
        "model": MODEL_ID,
        "chunk_size": CHUNK_SIZE,
        "sample_rate": 24000,
        "error": model_error,
    }


def pcm16_bytes(audio: np.ndarray) -> bytes:
    samples = np.asarray(audio, dtype=np.float32).reshape(-1)
    return (np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()


@app.post("/synthesize")
async def synthesize(
    request: StreamRequest,
    x_vocalis_client: str = Header(..., alias="X-Vocalis-Client"),
):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if model is None:
        raise HTTPException(status_code=503, detail="La voz rápida todavía se está preparando.")
    try:
        prompt = load_prompt(x_vocalis_client)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    chunks: queue.Queue[Any] = queue.Queue(maxsize=3)
    done = object()
    cancelled = threading.Event()

    def put(item: Any) -> bool:
        while not cancelled.is_set():
            try:
                chunks.put(item, timeout=0.1)
                return True
            except queue.Full:
                continue
        return False

    def produce() -> None:
        try:
            with generation_lock:
                generator = model.generate_voice_clone_streaming(
                    text=text,
                    language=request.language or "Spanish",
                    voice_clone_prompt=prompt,
                    chunk_size=CHUNK_SIZE,
                    max_new_tokens=min(512, max(96, len(text) * 3)),
                    non_streaming_mode=False,
                )
                for audio, sample_rate, timing in generator:
                    if cancelled.is_set() or not put(pcm16_bytes(audio)):
                        generator.close()
                        break
                    logger.debug("Streaming chunk timing: %s", timing)
                put(done)
        except Exception as exc:
            logger.exception("Streaming synthesis failed")
            put(exc)
            put(done)

    thread = threading.Thread(target=produce, daemon=True)
    thread.start()

    async def audio_stream():
        try:
            while True:
                item = await asyncio.to_thread(chunks.get)
                if item is done:
                    break
                if isinstance(item, Exception):
                    raise item
                yield item
        finally:
            cancelled.set()

    return StreamingResponse(
        audio_stream(),
        media_type="audio/pcm",
        headers={
            "X-Audio-Sample-Rate": "24000",
            "X-Audio-Channels": "1",
            "Cache-Control": "no-store",
        },
    )
