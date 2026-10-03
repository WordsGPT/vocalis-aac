import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommunicationBoard } from './components/CommunicationBoard';
import { SettingsModal } from './components/SettingsModal';
import { ContextModal } from './components/ContextModal';
import { AAC_VOCABULARY, CORE_STRIP, QUICK_PHRASES, findTopicPictogram } from './components/vocabulary';
import { personalForm } from './utils/spanish';

import { useTTS } from './hooks/useTTS';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { getSmartSuggestions, fetchCuratedVoices } from './services/api';

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
  autoTriggerDelay: 1000,
  userContext: ''
};

const speakerLabels = import.meta.env.VITE_SPEAKER_LABELS !== 'false';

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
      if (stored.autoTriggerDelay === 1500 || stored.autoTriggerDelay === 1800) {
        stored.autoTriggerDelay = 1000;
      }
      return { ...DEFAULT_SETTINGS, ...stored,
        edgeVoiceId: stored.edgeVoiceId?.startsWith('voice_') ? stored.edgeVoiceId : 'Puck', qwenEngine: 'standard' };
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });
  const pocketReady = typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
  const activeSettings = voiceAuthenticated ? {
    ...settings, ttsMode: settings.ttsMode === 'pocket' && !pocketReady ? 'browser' : settings.ttsMode,
  } : {
    ...settings, ttsMode: settings.ttsMode === 'pocket' && pocketReady ? 'pocket' : 'browser',
    preferredEngine: settings.preferredEngine === 'gemini' ? 'groq' : settings.preferredEngine,
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [view, setView] = useState('conversation');
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const closeContext = useCallback(() => setIsContextOpen(false), []);
  const [edgeVoices, setEdgeVoices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const suggestionRequest = useRef(0);
  const suggestionAbort = useRef(null);
  const [conversationStatus, setConversationStatus] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiEngine, setAiEngine] = useState('client-offline');
  const [conversationTopics, setConversationTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState(null);

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

  const historyRef = useRef(history);
  const conversationStart = useRef(history.length);

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
  const addToHistory = useCallback((sender, text, turns = []) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entries = (turns.length ? turns : [{ text }]).map(turn => ({
      sender, text: turn.text, speaker: turn.speaker || null,
      speaker_label: sender === 'user' ? 'Tú' : turn.speaker_label || 'Voz sin identificar', time,
    }));
    const all = [...historyRef.current, ...entries];
    conversationStart.current = Math.max(0, conversationStart.current - Math.max(0, all.length - 50));
    const updated = all.slice(-50);
    historyRef.current = updated;
    setHistory(updated);
    try { localStorage.setItem('vocalis_history', JSON.stringify(updated)); } catch { /* Storage may be full. */ }
  }, []);

  const abortPendingSuggestions = useCallback(() => {
    suggestionRequest.current += 1;
    suggestionAbort.current?.abort();
    setIsLoadingSuggestions(false);
  }, []);

  const clearSuggestions = useCallback(() => {
    abortPendingSuggestions();
    setSuggestions([]);
  }, [abortPendingSuggestions]);

  const handleClearHistory = () => {
    clearSuggestions();
    setConversationTopics([]);
    setActiveTopic(null);
    historyRef.current = [];
    conversationStart.current = 0;
    setHistory([]);
    setConversationStatus('');
    stt.resetConversation();
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
  const fetchSuggestions = useCallback(async (heardSpeech, automatic = false, focusTopic = null, userContext = settings.userContext) => {
    if (!heardSpeech || !heardSpeech.trim()) return;
    const requestId = ++suggestionRequest.current;
    suggestionAbort.current?.abort();
    const controller = new AbortController();
    suggestionAbort.current = controller;
    setIsLoadingSuggestions(true);

    try {
      // Pass recent chronological conversation context (both what was heard and spoken)
      const contextHistory = historyRef.current.slice(conversationStart.current).slice(-16).map((h) => ({
        role: h.sender,
        content: h.text,
        speaker_label: h.speaker_label || 'Voz sin identificar',
      }));

      const res = await getSmartSuggestions({
        text: heardSpeech,
        history: contextHistory,
        tone: settings.tone,
        grammaticalForm: settings.grammaticalForm,
        count: settings.suggestionCount || 6,
        userContext,
        preferredEngine: activeSettings.preferredEngine,
        automatic,
        focusTopic,
        signal: controller.signal,
      });

      if (requestId === suggestionRequest.current && res) {
        if (Array.isArray(res.suggestions) && (res.suggestions.length > 0 || !automatic)) {
          setSuggestions(res.suggestions);
          setAiEngine(res.engine || 'groq');
        }
        if (Array.isArray(res.topics) && res.topics.length > 0) {
          setConversationTopics((prev) => {
            const next = [...prev];
            for (const t of res.topics) {
              const name = typeof t === 'string' ? t.trim() : (t.name || '').trim();
              if (!name) continue;
              const existingIdx = next.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
              const entry = {
                name,
                pictogram: (typeof t === 'object' && t.pictogram) || findTopicPictogram(name)
              };
              if (existingIdx !== -1) {
                next.splice(existingIdx, 1);
              }
              next.push(entry);
            }
            return next.slice(-6);
          });
        }
        setConversationStatus(
          focusTopic
            ? `Respuestas para volver al tema: ${focusTopic}`
            : res.reason === 'service_unavailable'
              ? 'No se pudo valorar el turno. Puedes pedir respuestas con el botón.'
              : automatic && !res.should_suggest
                ? 'Siguiendo la conversación · esperando un momento para participar.'
                : 'Hay un momento para participar. Elige una respuesta o escribe la tuya.'
        );
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error fetching suggestions:', err);
    } finally {
      if (requestId === suggestionRequest.current) setIsLoadingSuggestions(false);
    }
  }, [settings.grammaticalForm, settings.tone, settings.suggestionCount, settings.userContext, activeSettings.preferredEngine]);

  // Handle incoming speech recognized from partner
  const handleSpeechCompleted = useCallback((heardText, metadata = {}) => {
    if (!heardText || !heardText.trim()) return;
    abortPendingSuggestions();
    addToHistory('partner', heardText.trim(), metadata.turns);
    fetchSuggestions(heardText.trim(), metadata.automatic !== false, activeTopic);
  }, [addToHistory, abortPendingSuggestions, fetchSuggestions, activeTopic]);

  const handleSpeechActivity = useCallback(() => {
    setConversationStatus('Escuchando a las personas de la conversación…');
  }, []);

  // STT Hook
  const stt = useSpeechRecognition({
    onSpeechCompleted: handleSpeechCompleted,
    onSpeechActivity: handleSpeechActivity,
    autoTriggerDelay: settings.autoTriggerDelay || 1000,
    sttMode: activeSettings.sttMode || 'whisper',
    sttLang: settings.sttLang || 'es-ES',
    autoListen: view === 'conversation',
    suspended: tts.isSpeaking || tts.isLoading || isSettingsOpen || isContextOpen
  });

  const handleSaveContext = useCallback((newContext) => {
    handleUpdateSettings({ userContext: newContext });
    const recent = [...historyRef.current].reverse().find(m => m.sender === 'partner');
    if (recent && recent.text) {
      fetchSuggestions(recent.text, false, activeTopic, newContext);
    }
  }, [handleUpdateSettings, fetchSuggestions, activeTopic]);

  useEffect(() => () => suggestionAbort.current?.abort(), []);

  const handleSelectTopic = useCallback((topicName) => {
    if (activeTopic === topicName) {
      setActiveTopic(null);
      const lastPartner = [...historyRef.current].reverse().find(m => m.sender === 'partner');
      if (lastPartner?.text) fetchSuggestions(lastPartner.text, false, null);
    } else {
      setActiveTopic(topicName);
      const lastPartner = [...historyRef.current].reverse().find(m => m.sender === 'partner');
      fetchSuggestions(lastPartner?.text || topicName, false, topicName);
    }
  }, [activeTopic, fetchSuggestions]);

  // Action: User picks a response (or types) to speak aloud
  const handleSelectAndSpeak = useCallback((text, options) => {
    if (!text || !text.trim()) return;
    clearSuggestions();
    setActiveTopic(null);
    setConversationStatus('');
    stt.pauseForPlayback();
    tts.speak(text.trim(), options);
    addToHistory('user', text.trim());
  }, [tts, addToHistory, stt, clearSuggestions]);

  const handleTestVoice = () => {
    tts.speak("Hola, esta es una prueba de mi voz en español.");
  };

  return (
    <div className="vocalis-redesign">
      <CommunicationBoard
        speakerLabels={speakerLabels}
        view={view}
        onChangeView={setView}
        settings={activeSettings}
        tts={tts}
        stt={stt}
        suggestions={suggestions}
        loading={isLoadingSuggestions}
        onSpeak={handleSelectAndSpeak}
        onSettings={() => setIsSettingsOpen(true)}
        onOpenContext={() => setIsContextOpen(true)}
        onRegenerate={(text) => fetchSuggestions(text, false, activeTopic)}
        conversationStatus={conversationStatus}
        history={history}
        onClearHistory={handleClearHistory}
        engine={aiEngine}
        voiceLabel={activeSettings.ttsMode === 'browser' ? 'Voz del navegador' : activeSettings.ttsMode === 'pocket' ? 'Mi voz Pocket TTS' : settings.edgeVoiceId?.startsWith('voice_') ? 'Mi voz personal' : 'Voz seleccionada'}
        topics={conversationTopics}
        activeTopic={activeTopic}
        onSelectTopic={handleSelectTopic}
      />

      {/* Settings Modal */}
      <SettingsModal
        speakerLabels={speakerLabels}
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

      {/* Context Modal */}
      <ContextModal
        isOpen={isContextOpen}
        onClose={closeContext}
        contextValue={settings.userContext || ''}
        onSaveContext={handleSaveContext}
      />
    </div>
  );
}

export default App;
