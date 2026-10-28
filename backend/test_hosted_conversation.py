"""Exercise conversation and serverless endpoints through the deployed API entry point."""
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from api.index import app


class HostedConversationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_public_automatic_and_topic_requests_forward_context(self):
        result = {"suggestions": ["Volviendo al mercado."], "topics": ["Mercado"],
                  "should_suggest": True, "engine": "groq-conversation"}
        with patch('api.index.conversation_suggestions', return_value=result) as generate:
            for extra in ({"automatic": True}, {"focus_topic": "Mercado"}):
                response = self.client.post('/api/suggest', json={
                    "text": "Hola", "user_context": "Me llamo Clara.", **extra})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), result)
                self.assertEqual(generate.call_args.args[6], "Me llamo Clara.")
                self.assertEqual(generate.call_args.args[7], extra.get("focus_topic"))

    def test_manual_suggestions_forward_personal_context(self):
        with patch('api.index.get_smart_suggestions', return_value={"suggestions": []}) as generate:
            response = self.client.post('/api/suggest', json={
                "text": "Hola", "user_context": "Me llamo Clara."})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.kwargs['user_context'], "Me llamo Clara.")

    def test_gemini_still_requires_login(self):
        with patch('api.index.valid_session', return_value=False), \
             patch('api.index.conversation_suggestions') as generate:
            response = self.client.post('/api/suggest', json={
                "text": "Hola", "preferred_engine": "gemini", "automatic": True})
        self.assertEqual(response.status_code, 401)
        generate.assert_not_called()

    def test_public_transcription_has_explicit_unknown_speaker(self):
        upstream = Mock()
        upstream.json.return_value = {"text": " Hola "}
        with patch('api.index.get_server_groq_api_key', return_value='test'), \
             patch('api.index.httpx.AsyncClient') as client:
            client.return_value.__aenter__.return_value.post = AsyncMock(return_value=upstream)
            response = self.client.post('/api/transcribe',
                data={"session_id": "conversation-1", "language": "es-ES"},
                files={"file": ("audio.webm", b'audio', 'audio/webm')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['diarization'], 'unavailable')
        self.assertEqual(response.json()['turns'], [{"text": "Hola", "speaker": None,
                                                   "speaker_label": "Voz sin identificar"}])

    def test_transcription_filters_whisper_noise_hallucination(self):
        upstream = Mock()
        upstream.json.return_value = {
            "text": " Gracias. ",
            "segments": [{"no_speech_prob": 0.48, "avg_logprob": -0.88}]
        }
        with patch('api.index.get_server_groq_api_key', return_value='test'), \
             patch('api.index.httpx.AsyncClient') as client:
            client.return_value.__aenter__.return_value.post = AsyncMock(return_value=upstream)
            response = self.client.post('/api/transcribe',
                data={"session_id": "conversation-1", "language": "es-ES"},
                files={"file": ("audio.webm", b'audio', 'audio/webm')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['text'], "")
        self.assertEqual(response.json()['turns'], [])

    def test_health_indicates_vercel_and_gemini_tts(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("platform"), "vercel")
        self.assertEqual(data.get("tts"), "gemini")
        self.assertFalse(data.get("cuda"))
        self.assertFalse(data.get("qwen_voice", {}).get("available"))

    def test_voices_returns_gemini_catalog(self):
        response = self.client.get('/api/voices')
        self.assertEqual(response.status_code, 200)
        voices = response.json()
        voice_ids = [v["id"] for v in voices]
        self.assertIn("Puck", voice_ids)
        self.assertIn("Kore", voice_ids)
        self.assertIn("Aoede", voice_ids)

    def test_plan_generate_storyboard_and_continuations(self):
        storyboard_mock = {"stages": [{"id": "apertura", "title": "1. Saludo", "options": ["Hola"]}], "engine": "test"}
        with patch('api.index.generate_guided_storyboard', return_value=storyboard_mock):
            res = self.client.post('/api/plan/generate', json={"type": "storyboard", "recipient": "medico", "goal": "Dolor"})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json(), storyboard_mock)

        continuations_mock = {"suggestions": ["Necesito ayuda."], "engine": "test"}
        with patch('api.index.generate_plan_continuations', return_value=continuations_mock):
            res = self.client.post('/api/plan/generate', json={"type": "continuations", "recipient": "familia", "pictograms": ["casa"]})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json(), continuations_mock)

    def test_audit_endpoints_on_vercel_api(self):
        import tempfile
        import shutil
        temp_dir = tempfile.mkdtemp(prefix="vocalis_hosted_audit_")
        try:
            with patch("backend.audit.AUDIT_LOG_DIR", Path(temp_dir)):
                # Log a turn
                res = self.client.post('/api/audit/log', json={"sender": "user", "text": "Hola mundo", "speaker_label": "Yo"},
                                       headers={"X-Vocalis-Client": "test-device"})
                self.assertEqual(res.status_code, 200)

                # Retrieve logs
                res = self.client.get('/api/audit/logs', headers={"X-Vocalis-Client": "test-device"})
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res.json().get("status"), "success")

                # Export logs
                res = self.client.get('/api/audit/export', headers={"X-Vocalis-Client": "test-device"})
                self.assertEqual(res.status_code, 200)
                self.assertIn("text/plain", res.headers.get("content-type", ""))

                # Clear logs
                res = self.client.delete('/api/audit/logs', headers={"X-Vocalis-Client": "test-device"})
                self.assertEqual(res.status_code, 200)
                self.assertTrue(res.json().get("deleted"))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_agent_endpoints_on_vercel_api(self):
        res = self.client.get('/api/agent/state')
        self.assertEqual(res.status_code, 200)
        state = res.json()
        self.assertIn("light", state)
        self.assertIn("calendar_events", state)

        # Test light control
        res = self.client.post('/api/agent/light', json={"state": "on", "color": "green", "brightness": 100})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "success")


if __name__ == '__main__':
    unittest.main()
