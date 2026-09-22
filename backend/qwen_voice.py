"""Lazy Qwen3-TTS voice-clone provider for the Vocalis API."""

from __future__ import annotations

import io
import hashlib
import importlib.util
import os
import tempfile
import threading
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np


MODEL_ALIASES = {
    "fast": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "0.6b": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "quality": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    "1.7b": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
}
_configured_model = os.environ.get("QWEN_TTS_MODEL", "fast").strip()
MODEL_ID = MODEL_ALIASES.get(_configured_model.lower(), _configured_model)
ATTENTION_MODE = os.environ.get("QWEN_TTS_ATTENTION", "auto").strip().lower()
MAX_NEW_TOKENS = int(os.environ.get("QWEN_TTS_MAX_NEW_TOKENS", "256"))
DEFAULT_PROFILE = Path(__file__).resolve().parents[2] / "qwen3-tts-runtime" / "saved_voice.pt"
PROFILE_PATH = Path(os.environ.get("QWEN_VOICE_PROFILE", str(DEFAULT_PROFILE))).expanduser()
PROFILE_DIRECTORY = Path(os.environ.get(
    "QWEN_VOICE_PROFILE_DIRECTORY",
    str(DEFAULT_PROFILE.parent / "voice_profiles"),
)).expanduser()


@dataclass(frozen=True)
class VoiceStatus:
    available: bool
    loaded: bool
    profile: str
    model: str
    attention: str | None = None
    error: str | None = None


class QwenVoiceClone:
    """Loads the large model only when the cloned voice is first requested."""

    def __init__(self) -> None:
        self._model: Any = None
        self._prompts: dict[str, Any] = {}
        self._error: str | None = None
        self._attention: str | None = None
        self._lock = threading.Lock()

    @staticmethod
    def _profile_key(client_id: str) -> str:
        if not client_id or len(client_id) > 200:
            raise ValueError("A valid client ID is required")
        return hashlib.sha256(client_id.encode("utf-8")).hexdigest()

    def profile_path(self, client_id: str) -> Path:
        return PROFILE_DIRECTORY / f"{self._profile_key(client_id)}.pt"

    def status(self, client_id: str | None = None) -> VoiceStatus:
        profile_path = self.profile_path(client_id) if client_id else PROFILE_PATH
        key = self._profile_key(client_id) if client_id else "legacy"
        return VoiceStatus(
            available=profile_path.is_file(),
            loaded=self._model is not None and key in self._prompts,
            profile=str(profile_path),
            model=MODEL_ID,
            attention=self._attention,
            error=self._error,
        )

    @staticmethod
    def _attention_implementation(cuda_available: bool) -> str | None:
        if ATTENTION_MODE in {"none", "eager"}:
            return None if ATTENTION_MODE == "none" else "eager"
        if ATTENTION_MODE not in {"", "auto"}:
            return ATTENTION_MODE
        if cuda_available and importlib.util.find_spec("flash_attn") is not None:
            return "flash_attention_2"
        # The Qwen wrapper's eager path is substantially faster than SDPA for
        # token-by-token generation in the current runtime.
        return None

    @staticmethod
    def _speaker_embedding_size(model: Any) -> int | None:
        config = getattr(getattr(model, "model", None), "config", None)
        speaker_config = getattr(config, "speaker_encoder_config", None)
        if isinstance(speaker_config, dict):
            return speaker_config.get("enc_dim")
        return getattr(speaker_config, "enc_dim", None)

    def _profile_item(self, item: dict[str, Any], VoiceClonePromptItem: Any) -> Any:
        """Make a saved prompt compatible with the selected model size.

        The 1.7B and 0.6B checkpoints share speech-code geometry, but their
        speaker encoders emit different embedding sizes. When necessary, decode
        the saved reference codes and re-extract the embedding with this model.
        """
        embedding = item["ref_spk_embedding"]
        expected_size = self._speaker_embedding_size(self._model)
        actual_size = int(embedding.numel())
        if expected_size is not None and actual_size != expected_size:
            ref_code = item.get("ref_code")
            if ref_code is None:
                raise RuntimeError(
                    f"Voice profile embedding has {actual_size} values, but {MODEL_ID} "
                    f"expects {expected_size}; reference speech codes are unavailable"
                )
            wavs, sample_rate = self._model.model.speech_tokenizer.decode(
                [{"audio_codes": ref_code}]
            )
            rebuilt = self._model.create_voice_clone_prompt(
                ref_audio=(wavs[0], sample_rate),
                ref_text=item.get("ref_text"),
                x_vector_only_mode=bool(item.get("x_vector_only_mode", False)),
            )
            if not rebuilt:
                raise RuntimeError("Could not adapt the saved voice profile")
            return rebuilt[0]

        return VoiceClonePromptItem(
            ref_code=item.get("ref_code"),
            ref_spk_embedding=embedding,
            x_vector_only_mode=bool(item.get("x_vector_only_mode", False)),
            icl_mode=bool(item.get("icl_mode", True)),
            ref_text=item.get("ref_text"),
        )

    def _load_model(self) -> None:
        if self._model is not None:
            return

        import torch
        from qwen_tts import Qwen3TTSModel

        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        self._attention = self._attention_implementation(torch.cuda.is_available())
        self._model = Qwen3TTSModel.from_pretrained(
            MODEL_ID,
            device_map=device,
            dtype=dtype,
            attn_implementation=self._attention,
        )

    def _load(self, client_id: str) -> None:
        key = self._profile_key(client_id)
        if self._model is not None and key in self._prompts:
            return
        profile_path = self.profile_path(client_id)
        if not profile_path.is_file():
            raise RuntimeError("No voice has been cloned on this device yet")

        import torch
        from qwen_tts import VoiceClonePromptItem

        self._load_model()

        payload = torch.load(profile_path, map_location="cpu", weights_only=True)
        items = [
            self._profile_item(item, VoiceClonePromptItem)
            for item in payload.get("items", [])
        ]
        if not items:
            raise RuntimeError("The saved voice profile contains no prompt data")
        self._prompts[key] = items

    def clone_from_audio(self, audio_path: str, client_id: str) -> None:
        """Create and persist a transcript-free speaker-embedding profile."""
        import torch

        with self._lock:
            try:
                key = self._profile_key(client_id)
                profile_path = self.profile_path(client_id)
                self._load_model()
                prompt = self._model.create_voice_clone_prompt(
                    ref_audio=audio_path,
                    ref_text=None,
                    x_vector_only_mode=True,
                )
                if not prompt:
                    raise RuntimeError("Qwen did not create a voice profile")

                profile_path.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(
                    dir=profile_path.parent,
                    prefix=".voice-",
                    suffix=".pt",
                    delete=False,
                ) as temporary:
                    temporary_path = Path(temporary.name)
                try:
                    torch.save({"items": [asdict(item) for item in prompt]}, temporary_path)
                    temporary_path.chmod(0o600)
                    temporary_path.replace(profile_path)
                finally:
                    temporary_path.unlink(missing_ok=True)

                self._prompts[key] = prompt
                self._error = None
            except Exception as exc:
                self._error = f"{type(exc).__name__}: {exc}"
                raise

    def preload_model(self) -> None:
        """Load the shared model without loading any user's voice profile."""
        with self._lock:
            try:
                self._load_model()
                self._error = None
            except Exception as exc:
                self._error = f"{type(exc).__name__}: {exc}"
                raise

    @staticmethod
    def _wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
        samples = np.asarray(audio, dtype=np.float32).squeeze()
        samples = np.clip(samples, -1.0, 1.0)
        pcm = (samples * 32767.0).astype("<i2")
        output = io.BytesIO()
        with wave.open(output, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(int(sample_rate))
            wav_file.writeframes(pcm.tobytes())
        return output.getvalue()

    def synthesize(self, text: str, language: str, client_id: str) -> bytes:
        with self._lock:
            try:
                key = self._profile_key(client_id)
                self._load(client_id)
                wavs, sample_rate = self._model.generate_voice_clone(
                    text=text,
                    language=language,
                    voice_clone_prompt=self._prompts[key],
                    # Protect interactive use from a rare missed end token. The
                    # text-relative cap remains generous for normal speech.
                    max_new_tokens=min(MAX_NEW_TOKENS, max(64, len(text) * 2)),
                )
                self._error = None
                return self._wav_bytes(wavs[0], sample_rate)
            except Exception as exc:
                self._error = f"{type(exc).__name__}: {exc}"
                raise


qwen_voice = QwenVoiceClone()
