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
        self.assertEqual(response.headers.get("content-type"), "audio/mpeg")
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

if __name__ == "__main__":
    unittest.main()
