"""Exercise conversation integration through the deployed API entry point."""
import unittest
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


if __name__ == '__main__':
    unittest.main()
