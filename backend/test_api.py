import unittest
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
        self.assertEqual(len(data["suggestions"]), 3)
        for s in data["suggestions"]:
            self.assertIsInstance(s, str)
            self.assertTrue(len(s) > 0)

    def test_tts(self):
        response = self.client.post("/api/tts", json={
            "text": "Hello, this is a test.",
            "voice": "en-US-GuyNeural"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-type"), "audio/mpeg")
        self.assertTrue(len(response.content) > 1000)

if __name__ == "__main__":
    unittest.main()
