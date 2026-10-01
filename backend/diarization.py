"""Anonymous, session-scoped speaker matching. Audio and embeddings stay in memory.

Resemblyzer's overlapping voice embeddings are aligned to Whisper word timestamps.
Labels are estimates, not identities; insufficient or ambiguous audio is left unknown.
"""
import logging
import subprocess
import threading
import time
from collections import OrderedDict

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import pdist

logger = logging.getLogger(__name__)
SAMPLE_RATE = 16000


class SpeakerSession:
    def __init__(self):
        self.profiles = []
        self.updated = time.monotonic()

    def match(self, embedding):
        vector = np.asarray(embedding, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if not np.isfinite(norm) or norm < 1e-6:
            return None
        vector = vector / norm
        scores = np.array([float(vector @ profile) for profile in self.profiles])
        if not len(scores) or scores.max() < 0.65:
            if len(self.profiles) >= 8:
                return None
            self.profiles.append(vector)
            return f"speaker_{len(self.profiles)}"
        best = int(scores.argmax())
        if len(scores) > 1 and scores[best] - np.partition(scores, -2)[-2] < 0.04:
            return None
        if scores[best] < 0.72:
            return None
        # Only clear matches update the reference, limiting drift at speaker changes.
        if scores[best] >= 0.8:
            mean = self.profiles[best] * 0.95 + vector * 0.05
            self.profiles[best] = mean / np.linalg.norm(mean)
        return f"speaker_{best + 1}"


def speaker_label(speaker):
    return f"Persona {speaker.split('_')[-1]}" if speaker else "Voz sin identificar"


def align_words(words, windows):
    turns = []
    for word in words:
        text = (word.get("word") or word.get("text") or "").strip()
        if not text:
            continue
        start, end = float(word.get("start", 0)), float(word.get("end", 0))
        midpoint = (start + end) / 2
        candidates = [window for window in windows if window[0] <= midpoint <= window[1]]
        closest = min(candidates, key=lambda window: abs((window[0] + window[1]) / 2 - midpoint)) if candidates else None
        speaker = closest[2] if closest else None
        if turns and turns[-1]["speaker"] == speaker and start - turns[-1]["end"] < 1.5:
            turns[-1]["text"] += " " + text
            turns[-1]["end"] = end
        else:
            turns.append({"speaker": speaker, "speaker_label": speaker_label(speaker),
                          "text": text, "start": start, "end": end})
    return turns


def label_windows(session, embeddings, spans, words, sample_count):
    """Pool similar windows before matching: one phonetic change is not a new person."""
    windows = []
    eligible = []
    for index, span in enumerate(spans):
        start = span.start / SAMPLE_RATE
        end = min(span.stop, sample_count) / SAMPLE_RATE
        speech = sum(max(0, min(end, float(word['end'])) - max(start, float(word['start']))) for word in words)
        windows.append([start, end, None])
        if speech >= 0.65:
            eligible.append(index)
    if len(eligible) < 2:
        return windows
    vectors = np.asarray([embeddings[index] for index in eligible])
    distances = np.clip(pdist(vectors, metric='cosine'), 0, 2)
    clusters = fcluster(linkage(distances, method='average'), t=0.35, criterion='distance')
    # Cluster ids themselves are arbitrary; create session labels chronologically.
    for cluster in dict.fromkeys(clusters):
        members = [eligible[i] for i, value in enumerate(clusters) if value == cluster]
        if len(members) < 2:
            continue
        embedding = np.mean([embeddings[index] for index in members], axis=0)
        speaker = session.match(embedding)
        for index in members:
            windows[index][2] = speaker
    return windows


class Diarizer:
    def __init__(self):
        self.encoder = None
        self.sessions = OrderedDict()
        self.lock = threading.Lock()

    def annotate(self, path, transcription, session_id):
        text = (transcription.get("text") or "").strip()
        fallback = [{"speaker": None, "speaker_label": speaker_label(None), "text": text}] if text else []
        if not text:
            return {"turns": [], "diarization": "unknown"}
        if not session_id:
            return {"turns": fallback, "diarization": "unavailable"}
        try:
            decoded = subprocess.run(
                ["ffmpeg", "-v", "error", "-i", str(path), "-t", "30", "-f", "f32le",
                 "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1"],
                capture_output=True, check=True, timeout=20,
            )
            wav = np.frombuffer(decoded.stdout, dtype=np.float32).copy()
            if len(wav) < SAMPLE_RATE * 0.7:
                return {"turns": fallback, "diarization": "unknown"}
            words = transcription.get("words") or [word for segment in transcription.get("segments", []) for word in segment.get("words", [])]
            if not words:
                # Never assign a whole multi-speaker sentence using one guessed label.
                return {"turns": fallback, "diarization": "unknown"}
            with self.lock:
                from resemblyzer import VoiceEncoder, normalize_volume
                from resemblyzer.hparams import audio_norm_target_dBFS
                if self.encoder is None:
                    self.encoder = VoiceEncoder(device="cpu", verbose=False)
                now = time.monotonic()
                for key in list(self.sessions):
                    if now - self.sessions[key].updated > 1800:
                        del self.sessions[key]
                session = self.sessions.setdefault(session_id, SpeakerSession())
                session.updated = now
                self.sessions.move_to_end(session_id)
                while len(self.sessions) > 100:
                    self.sessions.popitem(last=False)
                # Keep the original time axis: trimming silence would misalign words.
                if np.max(np.abs(wav)) < 1e-5:
                    return {"turns": fallback, "diarization": "unknown"}
                wav = normalize_volume(wav, audio_norm_target_dBFS, increase_only=True)
                _, embeddings, slices = self.encoder.embed_utterance(wav, return_partials=True, rate=2.5)
                windows = label_windows(session, embeddings, slices, words, len(wav))
                turns = align_words(words, windows)
            return {"turns": turns or fallback, "diarization": "estimated"}
        except Exception:
            logger.exception("Speaker matching unavailable; keeping transcription without speaker labels")
            return {"turns": fallback, "diarization": "unavailable"}


diarizer = Diarizer()
