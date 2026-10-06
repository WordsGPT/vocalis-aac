import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommunicationBoard } from './components/CommunicationBoard';
import { SettingsModal } from './components/SettingsModal';
import { ContextModal } from './components/ContextModal';
import { AAC_VOCABULARY, CORE_STRIP, QUICK_PHRASES, findTopicPictogram } from './components/vocabulary';
import { personalForm } from './utils/spanish';

import { useTTS } from './hooks/useTTS';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import {
  getSmartSuggestions,
  fetchCuratedVoices,
  logConversationTurn,
  fetchAgentState,
  processAgentMessage,
  setAgentLight,
  addAgentCalendarEvent,
  deleteAgentCalendarEvent,
} from './services/api';


const DEFAULT_SETTINGS = {
  grammaticalForm: 'masculine',
  speakTiles: true,
  pictogramSize: 100,
  ttsMode: 'edge-tts', // 'edge-tts' (Qwen3-TTS / server) | 'pocket' | 'browser'
  edgeVoiceId: 'qwen-clone',
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
  userContext: '',
  auditLogging: false,
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

export function App({ voiceAuthenticated = true, authRequired = false, onVoiceLogin, onLogout }) {
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
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        edgeVoiceId: (stored.edgeVoiceId && stored.edgeVoiceId !== 'Puck') ? stored.edgeVoiceId : 'qwen-clone',
        qwenEngine: 'standard',
        auditLogging: Boolean(stored.auditLogging),
      };
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });
  const pocketReady = typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
  const activeSettings = (!authRequired || voiceAuthenticated) ? {
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
  const [activeTopicContext, setActiveTopicContext] = useState('');
  const [speakMode, setSpeakMode] = useState(false);
  const [agentLight, setAgentLightState] = useState({ state: 'off', color: 'green', brightness: 100 });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [agentActionLog, setAgentActionLog] = useState([]);
  const [lastAgentAction, setLastAgentAction] = useState(null);

  useEffect(() => {
    fetchAgentState().then((state) => {
      if (state) {
        if (state.light) setAgentLightState(state.light);
        if (Array.isArray(state.calendar_events)) setCalendarEvents(state.calendar_events);
        if (Array.isArray(state.action_log)) setAgentActionLog(state.action_log);
      }
    });
  }, []);

  const suggestionsRef = useRef(suggestions);
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);


  // Cursor movement tracking: prevent suggestions from updating while moving cursor
  const isCursorMovingRef = useRef(false);
  const cursorStopTimerRef = useRef(null);
  const pendingUpdateRef = useRef(null);
  const isHoveringRepliesRef = useRef(false);

  useEffect(() => {
    const handleMove = () => {
      isCursorMovingRef.current = true;
      if (cursorStopTimerRef.current) {
        clearTimeout(cursorStopTimerRef.current);
      }
      cursorStopTimerRef.current = setTimeout(() => {
        isCursorMovingRef.current = false;
        if (pendingUpdateRef.current && !isHoveringRepliesRef.current) {
          const { newSuggestions, engine, status } = pendingUpdateRef.current;
          pendingUpdateRef.current = null;
          setSuggestions(newSuggestions);
          if (engine) setAiEngine(engine);
          if (status) setConversationStatus(status);
        }
      }, 1200);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('pointermove', handleMove);
      if (cursorStopTimerRef.current) clearTimeout(cursorStopTimerRef.current);
    };
  }, []);

  const handleRepliesMouseEnter = useCallback(() => {
    isHoveringRepliesRef.current = true;
  }, []);

  const handleRepliesMouseLeave = useCallback(() => {
    isHoveringRepliesRef.current = false;
    if (pendingUpdateRef.current && !isCursorMovingRef.current) {
      const { newSuggestions, engine, status } = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      setSuggestions(newSuggestions);
      if (engine) setAiEngine(engine);
      if (status) setConversationStatus(status);
    }
  }, []);

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

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const speakModeRef = useRef(speakMode);
  useEffect(() => {
    speakModeRef.current = speakMode;
  }, [speakMode]);

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

    // If opt-in audit logging is enabled, save conversation turn to server for auditing
    if (settingsRef.current?.auditLogging) {
      entries.forEach(entry => {
        logConversationTurn({
          sender: entry.sender,
          text: entry.text,
          speaker_label: entry.speaker_label,
          time: entry.time,
          mode: speakModeRef.current ? 'speak' : 'reply',
          metadata: {
            speaker: entry.speaker || null,
          },
        }).catch((err) => console.warn('Audit logging failed for turn:', err));
      });
    }
  }, []);

  const abortPendingSuggestions = useCallback(() => {
    suggestionRequest.current += 1;
    suggestionAbort.current?.abort();
    setIsLoadingSuggestions(false);
  }, []);

  const clearSuggestions = useCallback(() => {
    abortPendingSuggestions();
    pendingUpdateRef.current = null;
    setSuggestions([]);
  }, [abortPendingSuggestions]);

  const handleToggleLight = useCallback(async (targetState, targetColor = 'green') => {
    const res = await setAgentLight({ state: targetState, color: targetColor, brightness: 100 });
    if (res?.light) {
      setAgentLightState(res.light);
      const action = { tool: 'control_light', result: res, timestamp: new Date().toISOString() };
      setLastAgentAction(action);
      setAgentActionLog(prev => [action, ...prev.slice(0, 49)]);
    }
  }, []);

  const handleAddCalendarEvent = useCallback(async (eventData) => {
    const res = await addAgentCalendarEvent(eventData);
    if (res?.event) {
      setCalendarEvents(prev => [...prev, res.event].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
      const action = { tool: 'add_calendar_event', result: res, timestamp: new Date().toISOString() };
      setLastAgentAction(action);
      setAgentActionLog(prev => [action, ...prev.slice(0, 49)]);
    }
  }, []);

  const handleDeleteCalendarEvent = useCallback(async (eventId) => {
    const res = await deleteAgentCalendarEvent(eventId);
    if (res?.status === 'success') {
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    }
  }, []);

  const handleProcessAgentCommand = useCallback(async (text) => {
    const res = await processAgentMessage(text, settingsRef.current?.userContext, historyRef.current);
    if (res?.state) {
      if (res.state.light) setAgentLightState(res.state.light);
      if (Array.isArray(res.state.calendar_events)) setCalendarEvents(res.state.calendar_events);
      if (Array.isArray(res.state.action_log)) setAgentActionLog(res.state.action_log);
    }
    if (Array.isArray(res?.tool_calls) && res.tool_calls.length > 0) {
      setLastAgentAction(res.tool_calls[0]);
    }
    if (res?.updated_context) {
      handleUpdateSettings({ userContext: res.updated_context });
    }
    return res;
  }, []);

  const handleClearHistory = () => {

    clearSuggestions();
    setConversationTopics([]);
    setActiveTopic(null);
    setActiveTopicContext('');
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
  const fetchSuggestions = useCallback(async (
    heardSpeech,
    automatic = false,
    focusTopic = null,
    userContext = settings.userContext,
    mode = speakMode ? 'speak' : 'reply',
    topicContext = null
  ) => {
    if (!heardSpeech || !heardSpeech.trim()) return;
    const requestId = ++suggestionRequest.current;
    suggestionAbort.current?.abort();
    const controller = new AbortController();
    suggestionAbort.current = controller;
    setIsLoadingSuggestions(true);

    try {
      // Pass recent chronological conversation context (both what was heard and spoken)
      // When focusing on a topic (callback), provide a wider slice of history so prior mentions aren't lost
      const historySliceLimit = focusTopic ? -36 : -16;
      const contextHistory = historyRef.current.slice(conversationStart.current).slice(historySliceLimit).map((h) => ({
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
        mode,
        topicContext: topicContext || (focusTopic ? activeTopicContext : null),
        signal: controller.signal,
      });

      if (requestId === suggestionRequest.current && res) {
        const newSuggestions = Array.isArray(res.suggestions) ? res.suggestions : [];
        const nextEngine = res.engine || 'groq';
        const nextStatus = focusTopic
          ? `Respuestas para volver al tema: ${focusTopic}`
          : mode === 'speak'
            ? 'Modo hablar: opciones para dirigir la conversación o decir lo que piensas.'
            : res.reason === 'service_unavailable'
              ? 'No se pudo valorar el turno. Puedes pedir respuestas con el botón.'
              : automatic && !res.should_suggest
                ? 'Siguiendo la conversación · esperando un momento para participar.'
                : 'Hay un momento para participar. Elige una respuesta o escribe la tuya.';

        if (newSuggestions.length > 0 || !automatic) {
          // If cursor is moving or hovering replies and we already have suggestions showing,
          // hold the update so suggestions don't disappear in front of user while trying to click!
          if (automatic && suggestionsRef.current.length > 0 && (isCursorMovingRef.current || isHoveringRepliesRef.current)) {
            pendingUpdateRef.current = {
              newSuggestions,
              engine: nextEngine,
              status: nextStatus,
            };
          } else {
            pendingUpdateRef.current = null;
            setSuggestions(newSuggestions);
            setAiEngine(nextEngine);
            setConversationStatus(nextStatus);
          }
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
        if (res.agent_state) {
          if (res.agent_state.light) setAgentLightState(res.agent_state.light);
          if (Array.isArray(res.agent_state.calendar_events)) setCalendarEvents(res.agent_state.calendar_events);
          if (Array.isArray(res.agent_state.action_log)) setAgentActionLog(res.agent_state.action_log);
        }
        if (Array.isArray(res.tool_calls) && res.tool_calls.length > 0) {
          setLastAgentAction(res.tool_calls[0]);
        }
        if (res.updated_user_context) {
          handleUpdateSettings({ userContext: res.updated_user_context });
        }
      }
    } catch (err) {

      if (err.name !== 'AbortError') console.error('Error fetching suggestions:', err);
    } finally {
      if (requestId === suggestionRequest.current) setIsLoadingSuggestions(false);
    }
  }, [settings.grammaticalForm, settings.tone, settings.suggestionCount, settings.userContext, activeSettings.preferredEngine, speakMode, activeTopicContext]);

  // Handle incoming speech recognized from partner
  const handleSpeechCompleted = useCallback((heardText, metadata = {}) => {
    if (!heardText || !heardText.trim()) return;
    abortPendingSuggestions();
    addToHistory('partner', heardText.trim(), metadata.turns);
    fetchSuggestions(heardText.trim(), metadata.automatic !== false, activeTopic, settings.userContext, speakMode ? 'speak' : 'reply');
  }, [addToHistory, abortPendingSuggestions, fetchSuggestions, activeTopic, settings.userContext, speakMode]);

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
      fetchSuggestions(recent.text, false, activeTopic, newContext, speakMode ? 'speak' : 'reply');
    }
  }, [handleUpdateSettings, fetchSuggestions, activeTopic, speakMode]);

  useEffect(() => () => suggestionAbort.current?.abort(), []);

  const handleToggleSpeakMode = useCallback(() => {
    setSpeakMode((prev) => {
      const next = !prev;
      const lastPartner = [...historyRef.current].reverse().find(m => m.sender === 'partner');
      const textToUse = lastPartner?.text || (activeTopic ? `Sobre ${activeTopic}` : '');
      if (textToUse) {
        fetchSuggestions(textToUse, false, activeTopic, settings.userContext, next ? 'speak' : 'reply');
      }
      return next;
    });
  }, [activeTopic, fetchSuggestions, settings.userContext]);

  const handleSelectTopic = useCallback((topicName) => {
    if (activeTopic === topicName) {
      setActiveTopic(null);
      setActiveTopicContext('');
      const lastPartner = [...historyRef.current].reverse().find(m => m.sender === 'partner');
      if (lastPartner?.text) fetchSuggestions(lastPartner.text, false, null, settings.userContext, speakMode ? 'speak' : 'reply');
    } else {
      setActiveTopic(topicName);
      // For the callback feature: scan conversation history for prior mentions to provide rich context
      const relevantTurns = historyRef.current.filter(item =>
        (item.text || '').toLowerCase().includes(topicName.toLowerCase())
      );
      const snippet = relevantTurns.length > 0
        ? relevantTurns.slice(-4).map(item => `${item.sender === 'user' ? 'Tú' : item.speaker_label || 'Interlocutor'}: "${item.text}"`).join(' · ')
        : '';
      setActiveTopicContext(snippet);

      const lastPartner = [...historyRef.current].reverse().find(m => m.sender === 'partner');
      fetchSuggestions(
        lastPartner?.text || topicName,
        false,
        topicName,
        settings.userContext,
        speakMode ? 'speak' : 'reply',
        snippet
      );
    }
  }, [activeTopic, fetchSuggestions, settings.userContext, speakMode]);

  // Action: User picks a response (or types) to speak aloud
  const handleSelectAndSpeak = useCallback((text, options) => {
    if (!text || !text.trim()) return;
    clearSuggestions();
    setActiveTopic(null);
    setConversationStatus('');
    stt.pauseForPlayback();
    tts.speak(text.trim(), options);
    addToHistory('user', text.trim());
    processAgentMessage(text.trim(), settingsRef.current?.userContext, historyRef.current)
      .then((agentRes) => {
        if (agentRes?.state) {
          if (agentRes.state.light) setAgentLightState(agentRes.state.light);
          if (Array.isArray(agentRes.state.calendar_events)) setCalendarEvents(agentRes.state.calendar_events);
          if (Array.isArray(agentRes.state.action_log)) setAgentActionLog(agentRes.state.action_log);
        }
        if (Array.isArray(agentRes?.tool_calls) && agentRes.tool_calls.length > 0) {
          setLastAgentAction(agentRes.tool_calls[0]);
        }
        if (agentRes?.updated_context) {
          handleUpdateSettings({ userContext: agentRes.updated_context });
        }
      })
      .catch((err) => console.warn('Agent command processing error:', err));
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
        onRegenerate={(text) => fetchSuggestions(text, false, activeTopic, settings.userContext, speakMode ? 'speak' : 'reply')}
        conversationStatus={conversationStatus}
        history={history}
        onClearHistory={handleClearHistory}
        engine={aiEngine}
        agentLight={agentLight}
        onToggleLight={handleToggleLight}
        calendarEvents={calendarEvents}
        onAddCalendarEvent={handleAddCalendarEvent}
        onDeleteCalendarEvent={handleDeleteCalendarEvent}
        agentActionLog={agentActionLog}
        lastAgentAction={lastAgentAction}
        onProcessCommand={handleProcessAgentCommand}
        voiceLabel={

          activeSettings.ttsMode === 'browser'
            ? 'Voz del dispositivo'
            : activeSettings.ttsMode === 'pocket'
            ? 'Pocket TTS (Local)'
            : settings.edgeVoiceId === 'qwen-clone'
            ? 'Qwen3-TTS (GPU)'
            : settings.edgeVoiceId?.startsWith('voice_')
            ? 'Mi voz personal'
            : (edgeVoices.find(v => v.id === settings.edgeVoiceId)?.name || 'Voz del servidor')
        }
        topics={conversationTopics}
        activeTopic={activeTopic}
        activeTopicContext={activeTopicContext}
        onSelectTopic={handleSelectTopic}
        speakMode={speakMode}
        onToggleSpeakMode={handleToggleSpeakMode}
        onRepliesMouseEnter={handleRepliesMouseEnter}
        onRepliesMouseLeave={handleRepliesMouseLeave}
      />

      {/* Settings Modal */}
      <SettingsModal
        speakerLabels={speakerLabels}
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        voiceAuthenticated={voiceAuthenticated}
        authRequired={authRequired}
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
