#!/usr/bin/env python3
"""Unit tests for backend/audit.py."""

import unittest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

from backend.audit import (
    sanitize_client_id,
    log_conversation_turn,
    get_audit_logs,
    list_audit_sessions,
    export_audit_transcript,
    clear_client_audit_logs,
)


class TestAuditLogging(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="vocalis_audit_test_")
        self.patcher = patch("backend.audit.AUDIT_LOG_DIR", Path(self.temp_dir))
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_sanitize_client_id(self):
        self.assertEqual(sanitize_client_id("device-123_abc"), "device-123_abc")
        self.assertEqual(sanitize_client_id("../../etc/passwd"), "______etc_passwd")
        self.assertEqual(sanitize_client_id(""), "anonymous_client")
        self.assertEqual(sanitize_client_id(None), "anonymous_client")

    def test_log_conversation_turn_and_retrieval(self):
        client = "device-test-1"
        res1 = log_conversation_turn(
            client_id=client,
            sender="partner",
            text="¿Quieres un café o un té?",
            speaker_label="Interlocutor",
            time_str="10:00:00",
            mode="reply"
        )
        self.assertEqual(res1["status"], "recorded")

        res2 = log_conversation_turn(
            client_id=client,
            sender="user",
            text="Prefiero un café con leche, por favor.",
            speaker_label="Tú",
            time_str="10:00:15",
            mode="speak"
        )
        self.assertEqual(res2["status"], "recorded")

        logs = get_audit_logs(client_id=client)
        self.assertEqual(len(logs), 2)
        self.assertEqual(logs[0]["sender"], "partner")
        self.assertEqual(logs[0]["text"], "¿Quieres un café o un té?")
        self.assertEqual(logs[1]["sender"], "user")
        self.assertEqual(logs[1]["text"], "Prefiero un café con leche, por favor.")
        self.assertEqual(logs[1]["mode"], "speak")

    def test_transcript_export_and_sessions(self):
        client = "client-session-2"
        log_conversation_turn(client, "user", "Hola a todos.", "Tú", "11:00:00")
        sessions = list_audit_sessions()
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["client_id"], client)
        self.assertEqual(sessions[0]["turns_count"], 1)

        transcript = export_audit_transcript(client)
        self.assertIn("Hola a todos.", transcript)
        self.assertIn("[Tú", transcript)

    def test_clear_audit_logs(self):
        client = "client-to-clear"
        log_conversation_turn(client, "user", "Mensaje temporal", "Tú")
        self.assertTrue(len(get_audit_logs(client)) == 1)
        cleared = clear_client_audit_logs(client)
        self.assertTrue(cleared)
        self.assertEqual(len(get_audit_logs(client)), 0)

    def test_empty_text_ignored(self):
        res = log_conversation_turn("client", "user", "   ")
        self.assertEqual(res["status"], "ignored")


if __name__ == "__main__":
    unittest.main()
