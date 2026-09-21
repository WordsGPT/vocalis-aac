import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommunicationBoard } from './components/CommunicationBoard';
import { SettingsModal } from './components/SettingsModal';

import { useTTS } from './hooks/useTTS';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { getSmartSuggestions, fetchCuratedVoices } from './services/api';

const DEFAULT_SETTINGS = {
  ttsMode: 'edge-tts', // 'edge-tts' | 'browser'
  edgeVoiceId: 'qwen-clone',
  qwenEngine: 'standard', // 'standard' | 'streaming'
  browserVoiceURI: '',
  speechRate: 1.0,
  speechPitch: 1.0,
  preferredEngine: 'groq', // 'groq' | 'ollama' | 'gemini' | 'heuristic'
  groqApiKey: '',
  tone: 'natural',
  geminiApiKey: '',
  sttMode: 'whisper', // 'whisper' (automatic server transcription) | 'browser'
  sttLang: 'es-ES',
  suggestionCount: 6,
  autoTriggerDelay: 1500
};

export function App() {
  // Load saved settings or defaults
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalis_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const [edgeVoices, setEdgeVoices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const suggestionRequest = useRef(0);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiEngine, setAiEngine] = useState('groq');

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
  const tts = useTTS(settings);

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
        count: settings.suggestionCount || 6,
        geminiApiKey: settings.geminiApiKey,
        groqApiKey: settings.groqApiKey,
        preferredEngine: settings.preferredEngine
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
  }, [history, settings.tone, settings.suggestionCount, settings.geminiApiKey, settings.groqApiKey, settings.preferredEngine]);

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
    sttMode: settings.sttMode || 'whisper',
    sttLang: settings.sttLang || 'es-ES'
  });

  // Action: User picks a response (or types) to speak aloud
  const handleSelectAndSpeak = useCallback((text) => {
    if (!text || !text.trim()) return;
    if (stt.isListening) stt.stopListening();
    tts.speak(text.trim());
    addToHistory('user', text.trim());
  }, [tts, addToHistory, stt]);

  const handleTestVoice = () => {
    tts.speak("Hola, esta es una prueba de mi voz en español.");
  };

  return (
    <div className="vocalis-redesign">
      <CommunicationBoard
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
        voiceLabel={settings.ttsMode === 'browser' ? 'Voz del navegador' : settings.edgeVoiceId === 'qwen-clone' ? 'Mi voz personal' : 'Voz seleccionada'}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        browserVoices={tts.browserVoices}
        edgeVoices={edgeVoices}
        onTestVoice={handleTestVoice}
        onVoiceCloned={(voiceId) => handleUpdateSettings({
          ttsMode: 'edge-tts',
          edgeVoiceId: voiceId || 'qwen-clone'
        })}
      />
    </div>
  );
}

export default App;
