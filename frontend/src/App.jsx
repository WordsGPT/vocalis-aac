import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommunicationBoard } from './components/CommunicationBoard';
import { SettingsModal } from './components/SettingsModal';
import { AAC_VOCABULARY, CORE_STRIP, QUICK_PHRASES } from './components/vocabulary';
import { personalForm } from './utils/spanish';

import { useTTS } from './hooks/useTTS';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { getSmartSuggestions, fetchCuratedVoices, checkHealth } from './services/api';

const DEFAULT_SETTINGS = {
  grammaticalForm: 'masculine',
  speakTiles: true,
  pictogramSize: 100,
  ttsMode: 'browser', // 'edge-tts' | 'pocket' | 'browser'
  edgeVoiceId: 'Puck',
  qwenEngine: 'standard', // 'streaming' | 'standard'
  browserVoiceURI: '',
  speechRate: 1.0,
  speechPitch: 1.0,
  preferredEngine: 'groq', // 'groq' | 'gemini' | 'heuristic'
  tone: 'natural',
  sttMode: 'whisper', // 'whisper' (Groq transcription) | 'browser'
  sttLang: 'es-ES',
  suggestionCount: 6,
  autoTriggerDelay: 1500
};

function preparationPhrases(form) {
  let quick = QUICK_PHRASES;
  let saved = [];
  try {
    const stored = JSON.parse(localStorage.getItem('vocalis_quick_phrases'));
    if (Array.isArray(stored)) quick = stored.filter(item => typeof item?.text === 'string');
  } catch { /* Use the built-in quick phrases. */ }
  try {
    const stored = JSON.parse(localStorage.getItem('vocalis_saved_phrases'));
    if (Array.isArray(stored)) saved = stored.filter(text => typeof text === 'string' && text.trim());
  } catch { /* No saved phrases yet. */ }
  const frequent = [...new Set([
    ...quick.map(item => item.text),
    ...CORE_STRIP.map(item => item.text),
    ...AAC_VOCABULARY.needs.slice(0, 4).map(item => item.text),
    ...AAC_VOCABULARY.social.slice(0, 4).map(item => item.text),
  ].map(text => personalForm(text, form)))];
  const all = [...new Set([
    ...frequent,
    ...Object.values(AAC_VOCABULARY).flat().map(item => personalForm(item.text, form)),
    ...saved,
  ])];
  return { frequent, all };
}

export function App({ voiceAuthenticated, onVoiceLogin, onLogout }) {
  // Load saved settings or defaults
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalis_settings');
      if (!saved) return DEFAULT_SETTINGS;
      const stored = JSON.parse(saved);
      delete stored.geminiApiKey;
      delete stored.groqApiKey;
      return { ...DEFAULT_SETTINGS, ...stored,
        edgeVoiceId: stored.edgeVoiceId?.startsWith('voice_') ? stored.edgeVoiceId : 'Puck', qwenEngine: 'standard' };
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });
  const [pocketReady, setPocketReady] = useState(false);
  useEffect(() => { checkHealth().then(health => setPocketReady(!!health.pocket_ready)); }, []);
  const activeSettings = voiceAuthenticated ? {
    ...settings, ttsMode: settings.ttsMode === 'pocket' && !pocketReady ? 'browser' : settings.ttsMode,
  } : {
    ...settings, ttsMode: settings.ttsMode === 'pocket' && pocketReady ? 'pocket' : 'browser',
    preferredEngine: settings.preferredEngine === 'gemini' ? 'groq' : settings.preferredEngine,
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const [edgeVoices, setEdgeVoices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const suggestionRequest = useRef(0);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiEngine, setAiEngine] = useState('client-offline');

  // Conversation history: chronological order [oldest, ..., newest]
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalis_history');
      const data = saved ? JSON.parse(saved) : [];
      return Array.isArray(data) ? data.filter(item => item && typeof item.text === 'string') : [];
    } catch (_) {
      return [];
    }
  });

  // Save settings on update
  const handleUpdateSettings = (newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      delete updated.geminiApiKey;
      delete updated.groqApiKey;
      try {
        localStorage.setItem('vocalis_settings', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  // Add message in chronological order [oldest, ..., newest]
  const addToHistory = useCallback((sender, text) => {
    const entry = {
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setHistory((prev) => {
      const updated = [...prev, entry].slice(-50);
      try {
        localStorage.setItem('vocalis_history', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('vocalis_history');
    } catch (_) {}
  };

  // TTS Hook
  const tts = useTTS(activeSettings);
  const phrasesToPrepare = preparationPhrases(settings.grammaticalForm);

  // Fetch Server Edge-TTS voices on mount
  useEffect(() => {
    fetchCuratedVoices().then((voices) => {
      if (voices && voices.length > 0) {
        setEdgeVoices(voices);
      }
    });
  }, []);

  // Fetch Smart Suggestions from backend with full conversation thread
  const fetchSuggestions = useCallback(async (heardSpeech) => {
    if (!heardSpeech || !heardSpeech.trim()) return;
    const requestId = ++suggestionRequest.current;
    setIsLoadingSuggestions(true);

    try {
      // Pass recent chronological conversation context (both what was heard and spoken)
      const contextHistory = history.slice(-8).map((h) => ({
        role: h.sender,
        content: h.text
      }));

      const res = await getSmartSuggestions({
        text: heardSpeech,
        history: contextHistory,
        tone: settings.tone,
        grammaticalForm: settings.grammaticalForm,
        count: settings.suggestionCount || 6,
        preferredEngine: activeSettings.preferredEngine
      });

      if (requestId === suggestionRequest.current && res && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setAiEngine(res.engine || 'groq');
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      if (requestId === suggestionRequest.current) setIsLoadingSuggestions(false);
    }
  }, [history, settings.grammaticalForm, settings.tone, settings.suggestionCount, activeSettings.preferredEngine]);

  // Handle incoming speech recognized from partner
  const handleSpeechCompleted = useCallback((heardText) => {
    if (!heardText || !heardText.trim()) return;
    addToHistory('partner', heardText.trim());
    fetchSuggestions(heardText.trim());
  }, [addToHistory, fetchSuggestions]);

  // STT Hook
  const stt = useSpeechRecognition({
    onSpeechCompleted: handleSpeechCompleted,
    autoTriggerDelay: settings.autoTriggerDelay || 1500,
    sttMode: activeSettings.sttMode || 'browser',
    sttLang: settings.sttLang || 'es-ES'
  });

  // Action: User picks a response (or types) to speak aloud
  const handleSelectAndSpeak = useCallback((text, options) => {
    if (!text || !text.trim()) return;
    if (stt.isListening) stt.stopListening();
    tts.speak(text.trim(), options);
    addToHistory('user', text.trim());
  }, [tts, addToHistory, stt]);

  const handleTestVoice = () => {
    tts.speak("Hola, esta es una prueba de mi voz en español.");
  };

  return (
    <div className="vocalis-redesign">
      <CommunicationBoard
        settings={activeSettings}
        tts={tts}
        stt={stt}
        suggestions={suggestions}
        loading={isLoadingSuggestions}
        onSpeak={handleSelectAndSpeak}
        onSettings={() => setIsSettingsOpen(true)}
        onRegenerate={fetchSuggestions}
        history={history}
        onClearHistory={handleClearHistory}
        engine={aiEngine}
        voiceLabel={activeSettings.ttsMode === 'browser' ? 'Voz del navegador' : activeSettings.ttsMode === 'pocket' ? 'Mi voz Pocket TTS' : settings.edgeVoiceId?.startsWith('voice_') ? 'Mi voz personal' : 'Voz seleccionada'}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        voiceAuthenticated={voiceAuthenticated}
        pocketReady={pocketReady}
        onVoiceLogin={onVoiceLogin}
        onLogout={onLogout}
        settings={activeSettings}
        onUpdateSettings={handleUpdateSettings}
        browserVoices={tts.browserVoices}
        edgeVoices={edgeVoices}
        onTestVoice={handleTestVoice}
        preparationCounts={{ frequent: phrasesToPrepare.frequent.length, all: phrasesToPrepare.all.length }}
        onPreparePhrases={(scope, onProgress) => tts.preparePhrases(phrasesToPrepare[scope], onProgress)}
        onCancelPreparation={tts.cancelPreparation}
        onVoiceCloned={(voiceId) => {
          tts.clearCache();
          handleUpdateSettings({
            ttsMode: 'edge-tts',
            edgeVoiceId: voiceId || 'Puck',
            voiceRevision: String(Date.now())
          });
        }}
        onPocketSelected={() => {
          tts.clearCache();
          handleUpdateSettings({ ttsMode: pocketReady ? 'pocket' : 'browser', voiceRevision: String(Date.now()) });
        }}
        onPocketRemoved={() => {
          tts.clearCache();
          handleUpdateSettings({ ttsMode: 'browser', voiceRevision: String(Date.now()) });
        }}
      />
    </div>
  );
}

export default App;
