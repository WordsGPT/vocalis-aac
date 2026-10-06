"""
Conversation Audit Logging Module for Vocalis AAC.

Provides secure, opt-in server-side persistence of conversation logs
(both user vocalizations and interlocutor transcriptions) for clinical,
educational, or personal auditing later.
"""

from __future__ import annotations

import os
import re
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Default audit directory in project workspace
DEFAULT_AUDIT_DIR = Path(__file__).resolve().parent.parent / "data" / "audit_logs"
AUDIT_LOG_DIR = Path(os.environ.get("VOCALIS_AUDIT_LOG_DIR", str(DEFAULT_AUDIT_DIR))).expanduser()


def get_audit_dir() -> Path:
    """Ensure the audit log directory exists with safe permissions."""
    AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    return AUDIT_LOG_DIR


def sanitize_client_id(client_id: Optional[str]) -> str:
    """Sanitize client identifier to prevent directory traversal."""
    if not client_id or not client_id.strip():
        return "anonymous_client"
    # Keep only alphanumeric, hyphen, underscore
    clean = re.sub(r"[^a-zA-Z0-9_\-]", "_", client_id.strip())
    # Cap length to 100 characters
    return clean[:100] if clean else "anonymous_client"


def log_conversation_turn(
    client_id: str,
    sender: str,
    text: str,
    speaker_label: Optional[str] = None,
    time_str: Optional[str] = None,
    mode: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Appends a conversation turn to the server-side audit logs.
    Saves in structured JSON Lines format and appends to a readable transcript.
    """
    text_clean = (text or "").strip()
    if not text_clean:
        return {"status": "ignored", "reason": "empty_text"}

    now_utc = datetime.now(timezone.utc)
    iso_timestamp = now_utc.isoformat()
    readable_date = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")

    safe_client = sanitize_client_id(client_id)
    audit_dir = get_audit_dir()

    label = speaker_label or ("Tú" if sender == "user" else "Interlocutor")
    display_time = time_str or now_utc.strftime("%H:%M:%S")

    entry: Dict[str, Any] = {
        "id": hashlib.sha256(f"{safe_client}:{iso_timestamp}:{text_clean}".encode("utf-8")).hexdigest()[:16],
        "client_id": safe_client,
        "timestamp": iso_timestamp,
        "time": display_time,
        "sender": sender,
        "speaker_label": label,
        "text": text_clean,
        "mode": mode or ("speak" if sender == "user" else None),
        "metadata": metadata or {},
    }

    # 1. Append to client-specific JSONL file
    client_jsonl = audit_dir / f"{safe_client}.jsonl"
    with open(client_jsonl, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # 2. Append to client-specific readable text transcript
    client_txt = audit_dir / f"{safe_client}_transcript.txt"
    mode_tag = f" [Modo: {mode}]" if mode else ""
    with open(client_txt, "a", encoding="utf-8") as f:
        f.write(f"[{readable_date}] [{label}{mode_tag}]: {text_clean}\n")

    # 3. Append to global audit log for administrative overview
    global_jsonl = audit_dir / "all_conversations.jsonl"
    with open(global_jsonl, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    return {"status": "recorded", "entry": entry}


def get_audit_logs(client_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieve the most recent audit log entries for a client or overall."""
    audit_dir = get_audit_dir()
    if client_id:
        target_file = audit_dir / f"{sanitize_client_id(client_id)}.jsonl"
    else:
        target_file = audit_dir / "all_conversations.jsonl"

    if not target_file.is_file():
        return []

    entries: List[Dict[str, Any]] = []
    try:
        with open(target_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if line_str:
                    try:
                        entries.append(json.loads(line_str))
                    except json.JSONDecodeError:
                        continue
    except OSError:
        return []

    return entries[-limit:] if limit > 0 else entries


def list_audit_sessions() -> List[Dict[str, Any]]:
    """Lists all clients/sessions that currently have audit logs."""
    audit_dir = get_audit_dir()
    sessions = []
    for path in sorted(audit_dir.glob("*.jsonl")):
        if path.name == "all_conversations.jsonl":
            continue
        client_name = path.stem
        try:
            with open(path, "r", encoding="utf-8") as f:
                line_count = sum(1 for line in f if line.strip())
            stat = path.stat()
            sessions.append({
                "client_id": client_name,
                "turns_count": line_count,
                "file_size_bytes": stat.st_size,
                "last_modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            })
        except OSError:
            continue
    return sessions


def export_audit_transcript(client_id: str) -> str:
    """Exports the human-readable text transcript for a client."""
    audit_dir = get_audit_dir()
    safe_client = sanitize_client_id(client_id)
    transcript_file = audit_dir / f"{safe_client}_transcript.txt"
    if transcript_file.is_file():
        return transcript_file.read_text(encoding="utf-8")
    return f"No hay registros de auditoría para el cliente: {safe_client}\n"


def clear_client_audit_logs(client_id: str) -> bool:
    """Clears audit files for a specific client upon request."""
    audit_dir = get_audit_dir()
    safe_client = sanitize_client_id(client_id)
    deleted = False
    for ext in (".jsonl", "_transcript.txt"):
        target = audit_dir / f"{safe_client}{ext}"
        if target.is_file():
            try:
                target.unlink()
                deleted = True
            except OSError:
                pass
    return deleted
