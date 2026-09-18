import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ConversationStream } from './components/ConversationStream';
import { StandardAACBoard } from './components/StandardAACBoard';
import { ResponseCards } from './components/ResponseCards';
import { QuickPhrases } from './components/QuickPhrases';
import { TypeToSpeak } from './components/TypeToSpeak';
import { SettingsModal } from './components/SettingsModal';

import { useTTS } from './hooks/useTTS';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { getSmartSuggestions, fetchCuratedVoices } from './services/api';

const DEFAULT_SETTINGS = {
  ttsMode: 'browser', // 'browser' | 'edge-tts'
  edgeVoiceId: 'en-US-GuyNeural',
  browserVoiceURI: '',
  speechRate: 1.0,
  speechPitch: 1.0,
  preferredEngine: 'groq', // 'groq' | 'ollama' | 'gemini' | 'heuristic'
  groqApiKey: '',
  tone: 'natural',
  geminiApiKey: '',
  sttMode: 'auto', // 'auto' | 'whisper'
  autoTriggerDelay: 1500
};

const INITIAL_SUGGESTIONS = [
  "Hello! How are you doing today?",
  "Could you give me just one moment?",
  "I'm listening, please go ahead."
];

export function App() {
  // View mode: 'aac-board' (Standard AAC symbol board) | 'flow' (Conversational Stream)
  const [appView, setAppView] = useState(() => {
    try {
      return localStorage.getItem('vocalis_view') || 'aac-board';
    } catch (_) {
      return 'aac-board';
    }
  });

  const handleToggleAppView = (view) => {
    setAppView(view);
    try {
      localStorage.setItem('vocalis_view', view);
    } catch (_) {}
  };

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
  const [edgeVoices, setEdgeVoices] = useState([]);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiEngine, setAiEngine] = useState('groq');
  const [lastHeardText, setLastHeardText] = useState('');

  // Conversation history: chronological order [oldest, ..., newest]
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalis_history');
      return saved ? JSON.parse(saved) : [];
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
    setIsLoadingSuggestions(true);
    setLastHeardText(heardSpeech.trim());

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
        geminiApiKey: settings.geminiApiKey,
        groqApiKey: settings.groqApiKey,
        preferredEngine: settings.preferredEngine
      });

      if (res && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setAiEngine(res.engine || 'groq');
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [history, settings.tone, settings.geminiApiKey, settings.groqApiKey, settings.preferredEngine]);

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
    sttMode: settings.sttMode || 'auto'
  });

  // Action: User picks a response (or types) to speak aloud
  const handleSelectAndSpeak = useCallback((text) => {
    if (!text || !text.trim()) return;
    tts.speak(text.trim());
    addToHistory('user', text.trim());
    stt.clearTranscript();
  }, [tts, addToHistory, stt]);

  const handleTestVoice = () => {
    tts.speak("Hello, this is a preview of my voice.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Navigation with View Mode Switcher */}
      <Navbar
        isListening={stt.isListening}
        isSpeaking={tts.isSpeaking}
        ttsMode={settings.ttsMode}
        aiEngine={aiEngine}
        appView={appView}
        onToggleAppView={handleToggleAppView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStopSpeech={tts.stop}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        {appView === 'aac-board' ? (
          /* STANDARD AAC SOFTWARE BOARD VIEW */
          <StandardAACBoard
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onSelectAndSpeak={handleSelectAndSpeak}
            isSpeaking={tts.isSpeaking}
            currentSpeakingText={tts.currentText}
            currentTranscript={stt.transcript}
            interimTranscript={stt.interimTranscript}
            isListening={stt.isListening}
            onToggleListening={stt.toggleListening}
            onSimulateSpeech={stt.simulateSpeech}
            audioLevel={stt.audioLevel}
            history={history}
          />
        ) : (
          /* CONVERSATIONAL FLOW STREAM VIEW */
          <>
            {/* Helper Banner for Hotkeys */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/40 border border-blue-500/20 rounded-xl text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  Quick Tip
                </span>
                <span>
                  Tap any response or press keyboard keys <span className="font-mono font-bold bg-slate-800 px-1 py-0.5 rounded text-white">[1]</span>, <span className="font-mono font-bold bg-slate-800 px-1 py-0.5 rounded text-white">[2]</span>, or <span className="font-mono font-bold bg-slate-800 px-1 py-0.5 rounded text-white">[3]</span> to speak instantly.
                </span>
              </div>
              {stt.error && (
                <span className="text-red-400 font-medium ml-2">
                  {stt.error}
                </span>
              )}
            </div>

            {/* 1. Unified Conversation Stream (Past Turns Greyed Out & Scrollable Upwards, Active Turn Highlighted) */}
            <section>
              <ConversationStream
                history={history}
                currentTranscript={stt.transcript}
                interimTranscript={stt.interimTranscript}
                isListening={stt.isListening}
                onToggleListening={stt.toggleListening}
                onClearCurrent={stt.clearTranscript}
                onClearAllHistory={handleClearHistory}
                onReplay={tts.speak}
                onTriggerSuggestions={fetchSuggestions}
                onSimulateSpeech={stt.simulateSpeech}
                audioLevel={stt.audioLevel}
                isTranscribing={stt.isTranscribing}
                isLoadingSuggestions={isLoadingSuggestions}
              />
            </section>

            {/* 2. 3 Context-Aware Smart Response Options (Ready to speak) */}
            <section>
              <ResponseCards
                suggestions={suggestions}
                isLoading={isLoadingSuggestions}
                onSelectAndSpeak={handleSelectAndSpeak}
                isSpeaking={tts.isSpeaking}
                currentSpeakingText={tts.currentText}
                onRegenerate={() => fetchSuggestions(lastHeardText || "What's going on?")}
                lastHeardText={lastHeardText}
              />
            </section>

            {/* 3. Essential Quick Phrases (Emergency & Common AAC) */}
            <section>
              <QuickPhrases onSelectAndSpeak={handleSelectAndSpeak} />
            </section>

            {/* 4. Type to Speak Custom Input */}
            <section>
              <TypeToSpeak onSpeakText={handleSelectAndSpeak} isSpeaking={tts.isSpeaking} />
            </section>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        browserVoices={tts.browserVoices}
        edgeVoices={edgeVoices}
        onTestVoice={handleTestVoice}
      />
    </div>
  );
}

export default App;
