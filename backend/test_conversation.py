import unittest
from unittest.mock import Mock, patch

import numpy as np
from fastapi.testclient import TestClient

from backend.app import app
from backend.conversation import conversation_suggestions
from backend.diarization import Diarizer, SpeakerSession, align_words, label_windows


class SpeakerTests(unittest.TestCase):
    def test_stable_anonymous_labels_and_separate_sessions(self):
        session = SpeakerSession()
        self.assertEqual(session.match([1, 0, 0]), 'speaker_1')
        self.assertEqual(session.match([0.99, 0.1, 0]), 'speaker_1')
        self.assertEqual(session.match([0, 0, 1]), 'speaker_2')
        self.assertEqual(session.match([1, 0, 0]), 'speaker_1')
        self.assertEqual(SpeakerSession().match([0, 0, 1]), 'speaker_1')

    def test_ambiguous_and_invalid_embeddings_are_unknown(self):
        session = SpeakerSession()
        session.match([1, 0])
        session.match([0, 1])
        self.assertIsNone(session.match([1, 1]))
        self.assertIsNone(session.match([0, 0]))
        self.assertIsNone(session.match([np.nan, 1]))

    def test_word_alignment_preserves_changes_and_unknown_voice(self):
        words = [dict(word='Hola', start=0, end=0.5), dict(word='amigo.', start=0.5, end=1),
                 dict(word='¿Cómo', start=2, end=2.5), dict(word='estás?', start=2.5, end=3),
                 dict(word='Bien.', start=4, end=4.3)]
        turns = align_words(words, [(0, 1, 'speaker_1'), (2, 3, 'speaker_2')])
        self.assertEqual([turn['speaker'] for turn in turns], ['speaker_1', 'speaker_2', None])
        self.assertEqual([turn['text'] for turn in turns], ['Hola amigo.', '¿Cómo estás?', 'Bien.'])

    def test_missing_session_does_not_invent_speaker(self):
        result = Diarizer().annotate('unused', {'text': 'Hola'}, '')
        self.assertEqual(result['diarization'], 'unavailable')
        self.assertIsNone(result['turns'][0]['speaker'])

    def test_pooling_phonetic_variation_does_not_create_extra_people(self):
        angles = np.deg2rad([0, 20, 40, 50])
        vectors = np.array([[np.cos(angle), np.sin(angle), 0] for angle in angles] + [[0, 0, 1], [0, 0, 1]])
        spans = [slice(i * 6400, i * 6400 + 25600) for i in range(6)]
        windows = label_windows(SpeakerSession(), vectors, spans, [{'start': 0, 'end': 4}], 64000)
        self.assertEqual([item[2] for item in windows], ['speaker_1'] * 4 + ['speaker_2'] * 2)

    def test_single_short_window_remains_unidentified(self):
        windows = label_windows(SpeakerSession(), np.array([[1, 0]]), [slice(0, 25600)],
                                [{'start': 0, 'end': 0.8}], 12800)
        self.assertIsNone(windows[0][2])


class ConversationTests(unittest.TestCase):
    def decision(self, result):
        response = Mock()
        response.json.return_value = {'choices': [{'message': {'content': result}}]}
        return patch('backend.conversation.requests.post', return_value=response)

    def test_suggestions_provided_for_statements(self):
        with self.decision('{"should_suggest": true, "reason": "natural_opening", "suggestions": ["¡Qué bien!", "¿A qué hora?"]}'):
            result = conversation_suggestions('Yo voy al cine mañana.', api_key='test')
        self.assertTrue(result['should_suggest'])
        self.assertEqual(len(result['suggestions']), 2)

    def test_context_preserves_aac_user_and_distinct_speakers(self):
        history = [{'role': 'partner', 'content': '¿Vienes?', 'speaker_label': 'Persona 1'},
                   {'role': 'partner', 'content': 'Yo voy.', 'speaker_label': 'Persona 2'},
                   {'role': 'user', 'content': 'Voy también.'}]
        with self.decision('{"should_suggest": true, "reason": "natural_opening", "suggestions": ["Me alegro."]}') as request:
            result = conversation_suggestions('Yo voy.', history=history, api_key='test')
        prompt = request.call_args.kwargs['json']['messages'][1]['content']
        self.assertIn('Persona 1', prompt)
        self.assertIn('Persona 2', prompt)
        self.assertIn('"Yo"', prompt)
        self.assertTrue(result['should_suggest'])

    def test_opening_preserves_relevant_replies_and_grammatical_form(self):
        with self.decision('{"should_suggest": true, "reason": "direct_question", "suggestions": ["Estoy cansado.", "Estoy bien, gracias."]}'):
            result = conversation_suggestions('¿Cómo estás?', grammatical_form='feminine', api_key='test')
        self.assertTrue(result['should_suggest'])
        self.assertEqual(result['suggestions'][0], 'Estoy cansada.')

    def test_invalid_or_missing_service_falls_back_to_smart_suggestions(self):
        with patch('backend.conversation.get_server_groq_api_key', return_value=''), \
             patch('backend.conversation.get_smart_suggestions', return_value={'suggestions': ['De acuerdo.'], 'engine': 'heuristic'}):
            result = conversation_suggestions('Hola')
            self.assertTrue(result['should_suggest'])
            self.assertEqual(result['suggestions'], ['De acuerdo.'])

    def test_user_context_injected_into_prompt(self):
        with self.decision('{"should_suggest": true, "reason": "natural_opening", "suggestions": ["Me llamo Clara."]}') as request:
            result = conversation_suggestions('¿Cómo te llamas?', api_key='test', user_context='Me llamo Clara.')
        prompt = request.call_args.kwargs['json']['messages'][0]['content']
        self.assertIn('Me llamo Clara.', prompt)
        self.assertTrue(result['should_suggest'])

    def test_api_automatic_calls_conversation_suggestions(self):
        with patch('backend.app.conversation_suggestions', return_value={
            'should_suggest': True, 'reason': 'natural_opening', 'suggestions': ['Sí.'], 'engine': 'test'
        }) as mock_conv:
            response = TestClient(app).post('/api/suggest', json={'text': 'Hola', 'automatic': True, 'user_context': 'Vivo en Madrid'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['suggestions'], ['Sí.'])
        self.assertEqual(mock_conv.call_args[0][6], 'Vivo en Madrid')


if __name__ == '__main__':
    unittest.main()
