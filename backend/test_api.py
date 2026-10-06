import unittest
import io
import wave
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app import app

class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("cuda", data)

    def test_voices(self):
        response = self.client.get("/api/voices")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        self.assertIn("id", data[0])

    def test_suggest_basic(self):
        response = self.client.post("/api/suggest", json={
            "text": "What do you want for lunch?",
            "tone": "casual"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("suggestions", data)
        self.assertIn("engine", data)
        self.assertEqual(len(data["suggestions"]), 6)
        for s in data["suggestions"]:
            self.assertIsInstance(s, str)
            self.assertTrue(len(s) > 0)

        # Test with custom count
        res4 = self.client.post("/api/suggest", json={
            "text": "¿Cómo estás?",
            "count": 4
        })
        self.assertEqual(res4.status_code, 200)
        self.assertEqual(len(res4.json()["suggestions"]), 4)

    def test_tts(self):
        response = self.client.post("/api/tts", json={
            "text": "Hello, this is a test.",
            "voice": "en-US-GuyNeural"
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn(response.headers.get("content-type"), ["audio/mpeg", "audio/wav"])
        self.assertTrue(len(response.content) > 1000)

    def test_voice_sample_duration_and_shared_profile(self):
        def sample(seconds):
            output = io.BytesIO()
            with wave.open(output, "wb") as recording:
                recording.setnchannels(1)
                recording.setsampwidth(2)
                recording.setframerate(24000)
                recording.writeframes(b"\x00\x00" * 24000 * seconds)
            return output.getvalue()

        headers = {"X-Vocalis-Client": "test-device"}
        with patch("backend.app.qwen_voice.clone_from_audio") as clone:
            short = self.client.post("/api/voice/clone", headers=headers,
                files={"file": ("sample.wav", sample(3), "audio/wav")})
            self.assertEqual(short.status_code, 400)
            clone.assert_not_called()

            valid = self.client.post("/api/voice/clone", headers=headers,
                files={"file": ("sample.wav", sample(8), "audio/wav")})
            self.assertEqual(valid.status_code, 200)
            self.assertIn("rápido y estándar", valid.json()["message"])
            clone.assert_called_once()

    def test_audit_endpoints(self):
        headers = {"X-Vocalis-Client": "test-audit-device"}
        # Log a turn
        post_res = self.client.post("/api/audit/log", headers=headers, json={
            "sender": "user",
            "text": "Hola, esto es una auditoría.",
            "speaker_label": "Tú",
            "mode": "speak"
        })
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.json()["status"], "recorded")

        # Get logs
        get_res = self.client.get("/api/audit/logs", headers=headers)
        self.assertEqual(get_res.status_code, 200)
        entries = get_res.json()["entries"]
        self.assertTrue(len(entries) >= 1)
        self.assertEqual(entries[-1]["text"], "Hola, esto es una auditoría.")

        # Export transcript
        export_res = self.client.get("/api/audit/export", headers=headers)
        self.assertEqual(export_res.status_code, 200)
        self.assertIn("Hola, esto es una auditoría.", export_res.text)

        # Clear logs
        del_res = self.client.delete("/api/audit/logs", headers=headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "cleared")

    def test_agent_endpoints(self):
        # 1. Get state
        state_res = self.client.get("/api/agent/state")
        self.assertEqual(state_res.status_code, 200)
        self.assertIn("light", state_res.json())

        # 2. Control light directly
        light_res = self.client.post("/api/agent/light", json={"state": "on", "color": "green"})
        self.assertEqual(light_res.status_code, 200)
        self.assertEqual(light_res.json()["light"]["state"], "on")
        self.assertEqual(light_res.json()["light"]["color"], "green")

        # 3. Add calendar event directly
        cal_res = self.client.post("/api/agent/calendar", json={
            "title": "Cita médica",
            "date": "2026-10-10",
            "time": "15:00",
            "description": "Revisión anual"
        })
        self.assertEqual(cal_res.status_code, 200)
        evt_id = cal_res.json()["event"]["id"]

        # Delete calendar event
        del_cal = self.client.delete(f"/api/agent/calendar/{evt_id}")
        self.assertEqual(del_cal.status_code, 200)
        self.assertEqual(del_cal.json()["status"], "success")

        # 4. Suggest endpoint with tool calling ("turn the light on" triggers light green)
        sug_res = self.client.post("/api/suggest", json={
            "text": "turn the light on",
            "count": 4,
            "mode": "reply"
        })
        self.assertEqual(sug_res.status_code, 200)
        sug_json = sug_res.json()
        self.assertIn("tool_calls", sug_json)
        self.assertEqual(sug_json["tool_calls"][0]["tool"], "control_light")
        self.assertEqual(sug_json["tool_calls"][0]["result"]["light"]["state"], "on")
        self.assertEqual(sug_json["tool_calls"][0]["result"]["light"]["color"], "green")

if __name__ == "__main__":
    unittest.main()

