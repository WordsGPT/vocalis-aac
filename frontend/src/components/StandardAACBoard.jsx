import React, { useState } from 'react';
import { 
  Volume2, Trash2, Delete, ThumbsUp, ThumbsDown, HelpCircle, 
  Hand, Sparkles, Coffee, Utensils, Home, Heart, AlertTriangle, 
  User, Users, Check, X, MessageSquare, Footprints, Music, 
  RotateCcw, Mic, MicOff, ChevronDown, ChevronUp, History,
  Smile, Frown, ShieldAlert, Clock, ArrowRight, CornerDownLeft
} from 'lucide-react';

// AAC Categories and Vocabulary with Fitzgerald Key Color Coding
// Yellow = Pronouns, Green = Verbs, Orange = Nouns/Objects, Blue = Descriptors, Pink/Gray = Social/Core
const AAC_CATEGORIES = [
  { id: 'core', label: 'Core & Quick' },
  { id: 'social', label: 'Social & Chat' },
  { id: 'food', label: 'Food & Drinks' },
  { id: 'feelings', label: 'Feelings & Health' },
  { id: 'places', label: 'Places & Actions' },
  { id: 'emergency', label: 'Safety & Quick Help' }
];

const AAC_VOCABULARY = {
  core: [
    { text: 'I', category: 'pronoun', icon: User, color: 'bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30' },
    { text: 'You', category: 'pronoun', icon: Users, color: 'bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Want', category: 'verb', icon: Heart, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Like', category: 'verb', icon: ThumbsUp, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Go', category: 'verb', icon: ArrowRight, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Stop', category: 'verb', icon: Hand, color: 'bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/30' },
    { text: 'Help', category: 'verb', icon: AlertTriangle, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Good', category: 'adjective', icon: Smile, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Bad', category: 'adjective', icon: Frown, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'More', category: 'adjective', icon: Sparkles, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Yes', category: 'social', icon: Check, color: 'bg-teal-500/20 border-teal-500/50 text-teal-200 hover:bg-teal-500/30' },
    { text: 'No', category: 'social', icon: X, color: 'bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Please', category: 'social', icon: Heart, color: 'bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Thank you', category: 'social', icon: ThumbsUp, color: 'bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500/30' },
    { text: 'What?', category: 'question', icon: HelpCircle, color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/30' }
  ],
  social: [
    { text: 'Hello, good to see you!', category: 'social', icon: Smile, color: 'bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Goodbye, see you later!', category: 'social', icon: Hand, color: 'bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500/30' },
    { text: 'How are you doing?', category: 'question', icon: HelpCircle, color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/30' },
    { text: 'I am doing well, thanks.', category: 'social', icon: ThumbsUp, color: 'bg-teal-500/20 border-teal-500/50 text-teal-200 hover:bg-teal-500/30' },
    { text: 'Nice idea!', category: 'social', icon: Sparkles, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Excuse me, please.', category: 'social', icon: MessageSquare, color: 'bg-purple-500/20 border-purple-500/50 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Could you repeat that for me?', category: 'social', icon: RotateCcw, color: 'bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30' },
    { text: 'I understand.', category: 'social', icon: Check, color: 'bg-teal-500/20 border-teal-500/50 text-teal-200 hover:bg-teal-500/30' },
    { text: 'I do not understand.', category: 'social', icon: X, color: 'bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30' },
    { text: 'I am thinking...', category: 'social', icon: Clock, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' }
  ],
  food: [
    { text: 'Water', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Coffee', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Tea', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Cheese', category: 'noun', icon: Utensils, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Snack', category: 'noun', icon: Utensils, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Lunch', category: 'noun', icon: Utensils, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Eat', category: 'verb', icon: Utensils, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Drink', category: 'verb', icon: Coffee, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Hungry', category: 'adjective', icon: Utensils, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Full', category: 'adjective', icon: Check, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' }
  ],
  feelings: [
    { text: 'Happy', category: 'adjective', icon: Smile, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Tired', category: 'adjective', icon: Clock, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Pain / Hurt', category: 'adjective', icon: AlertTriangle, color: 'bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Cold', category: 'adjective', icon: Frown, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Hot', category: 'adjective', icon: AlertTriangle, color: 'bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Excited', category: 'adjective', icon: Sparkles, color: 'bg-teal-500/20 border-teal-500/50 text-teal-200 hover:bg-teal-500/30' },
    { text: 'Relaxed', category: 'adjective', icon: Smile, color: 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Need Rest', category: 'verb', icon: Clock, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' }
  ],
  places: [
    { text: 'Home', category: 'noun', icon: Home, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Outside', category: 'noun', icon: Footprints, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Bathroom', category: 'noun', icon: Home, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Walk', category: 'verb', icon: Footprints, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Music', category: 'noun', icon: Music, color: 'bg-orange-500/20 border-orange-500/50 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Rest', category: 'verb', icon: Clock, color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30' }
  ],
  emergency: [
    { text: "Please give me a moment, I use a communication app to speak.", category: 'priority', icon: ShieldAlert, color: 'bg-amber-500/25 border-amber-500/60 text-amber-200 hover:bg-amber-500/35 col-span-2' },
    { text: "I need some help please.", category: 'priority', icon: AlertTriangle, color: 'bg-rose-500/25 border-rose-500/60 text-rose-200 hover:bg-rose-500/35' },
    { text: "Could you speak a little slower?", category: 'priority', icon: Clock, color: 'bg-blue-500/25 border-blue-500/60 text-blue-200 hover:bg-blue-500/35' },
    { text: "I do not feel well.", category: 'priority', icon: Frown, color: 'bg-rose-500/25 border-rose-500/60 text-rose-200 hover:bg-rose-500/35' },
    { text: "Thank you for your patience with me.", category: 'priority', icon: Heart, color: 'bg-purple-500/25 border-purple-500/60 text-purple-200 hover:bg-purple-500/35' }
  ]
};

export function StandardAACBoard({
  suggestions = [],
  isLoadingSuggestions = false,
  onSelectAndSpeak,
  isSpeaking,
  currentSpeakingText,
  currentTranscript = '',
  interimTranscript = '',
  isListening,
  onToggleListening,
  onSimulateSpeech,
  audioLevel,
  history = []
}) {
  const [activeCategory, setActiveCategory] = useState('core');
  const [sentenceWords, setSentenceWords] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const displayLiveHeard = (currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  // Add word to sentence builder bar
  const handleAddWord = (word) => {
    setSentenceWords((prev) => [...prev, word]);
  };

  // Remove last word
  const handleBackspace = () => {
    setSentenceWords((prev) => prev.slice(0, -1));
  };

  // Clear sentence bar
  const handleClearSentence = () => {
    setSentenceWords([]);
  };

  // Speak the built sentence
  const handleSpeakSentence = () => {
    const fullText = sentenceWords.join(' ').trim();
    if (fullText) {
      onSelectAndSpeak(fullText);
    }
  };

  // Immediate speak from single-tap tile
  const handleInstantSpeakTile = (phrase) => {
    onSelectAndSpeak(phrase);
    setSentenceWords([phrase]);
  };

  const AI_CARD_THEMES = [
    { label: 'Option 1 (Yes / Agree)', hotkey: '1', border: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-100 hover:bg-emerald-950/50 hover:border-emerald-400', icon: ThumbsUp, badge: 'bg-emerald-500 text-slate-950' },
    { label: 'Option 2 (Question / Alternative)', hotkey: '2', border: 'border-sky-500/50 bg-sky-950/30 text-sky-100 hover:bg-sky-950/50 hover:border-sky-400', icon: HelpCircle, badge: 'bg-sky-400 text-slate-950' },
    { label: 'Option 3 (No / Decline)', hotkey: '3', border: 'border-rose-500/50 bg-rose-950/30 text-rose-100 hover:bg-rose-950/50 hover:border-rose-400', icon: Hand, badge: 'bg-rose-400 text-slate-950' }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 text-left select-none">
      {/* 1. TOP SECTION: THE AAC SENTENCE BUILDER STRIP */}
      <div className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Sentence accumulator display */}
        <div className="w-full sm:flex-1 min-h-[56px] bg-slate-950 rounded-xl border border-slate-800 px-4 py-2 flex items-center flex-wrap gap-2">
          {sentenceWords.length === 0 ? (
            <span className="text-slate-500 italic text-sm">
              Tap tiles below or choose an AI response to build and speak...
            </span>
          ) : (
            sentenceWords.map((word, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg bg-blue-600/30 text-blue-200 border border-blue-500/40 text-base font-bold shadow-sm animate-fade-in"
              >
                {word}
              </span>
            ))
          )}
        </div>

        {/* Action Controls: SPEAK ALOUD & CLEAR */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleBackspace}
            disabled={sentenceWords.length === 0}
            title="Delete last word"
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>

          <button
            onClick={handleClearSentence}
            disabled={sentenceWords.length === 0}
            title="Clear sentence"
            className="p-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 disabled:opacity-40 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50 font-bold transition-all cursor-pointer flex items-center justify-center"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleSpeakSentence}
            disabled={sentenceWords.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-base tracking-wide shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
          >
            <Volume2 className="w-6 h-6 animate-pulse" />
            <span>SPEAK</span>
          </button>
        </div>
      </div>

      {/* 2. AMBIENT LISTENING BANNER (What the conversational partner is saying) */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleListening}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Mic Active' : 'Enable Mic'}</span>
            </button>

            {isListening && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-md border border-slate-700 text-[11px] text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Audio in: {audioLevel > 10 ? 'Hearing' : 'Quiet'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({history.length})</span>
                {showHistoryDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Current speech display */}
        <div className="mt-2.5 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Partner is saying:
            </span>
            <p className="text-base sm:text-lg font-bold text-white m-0 leading-snug">
              {displayLiveHeard || (
                <span className="text-slate-500 font-normal italic text-sm">
                  {isListening ? 'Listening for speech in room...' : 'Microphone paused. Click "Enable Mic" to listen.'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Expandable Greyed-out Conversation History Drawer */}
        {showHistoryDrawer && history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto pr-1 animate-fade-in">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Earlier Conversation (Greyed Out):
            </span>
            {history.map((h, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg text-xs border transition-opacity ${
                  h.sender === 'user'
                    ? 'bg-blue-950/20 border-blue-900/30 text-slate-400 opacity-60 hover:opacity-100 ml-6'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 opacity-60 hover:opacity-100 mr-6'
                }`}
              >
                <span className="font-bold text-[10px] text-slate-500 mr-1.5">
                  {h.sender === 'user' ? 'You:' : 'Partner:'}
                </span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. DYNAMIC AAC SMART AI RESPONSE TILES (The 3 Contextual Choices) */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-indigo-300 m-0">
              Dynamic AI AAC Responses (Tap to speak instantly)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Hotkeys: [1], [2], [3]
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isLoadingSuggestions ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 p-4 animate-pulse" />
            ))
          ) : (
            suggestions.map((text, idx) => {
              const theme = AI_CARD_THEMES[idx % AI_CARD_THEMES.length];
              const Icon = theme.icon;
              const isCardSpeaking = isSpeaking && currentSpeakingText === text;

              return (
                <button
                  key={idx}
                  onClick={() => handleInstantSpeakTile(text)}
                  className={`group relative p-4 rounded-2xl border-2 transition-all duration-150 text-left cursor-pointer flex flex-col justify-between shadow-xl min-h-[115px] ${
                    theme.border
                  } ${isCardSpeaking ? 'ring-4 ring-emerald-400 shadow-emerald-500/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center font-black shadow ${theme.badge}`}>
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-bold flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <Icon className="w-3.5 h-3.5" />
                      {theme.label}
                    </span>
                  </div>

                  <p className="text-base sm:text-lg font-black leading-snug my-1 tracking-tight">
                    "{text}"
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[10px] opacity-70">
                    <span className="flex items-center gap-1 font-bold">
                      <Volume2 className="w-3 h-3" />
                      {isCardSpeaking ? 'Speaking aloud...' : 'Instant Speak'}
                    </span>
                    <span className="font-mono uppercase font-bold">Press [{idx + 1}]</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 4. STANDARD AAC SOUNDBOARD GRID (Modified Fitzgerald Key System) */}
      <div className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 shadow-2xl">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-slate-800 scrollbar-none">
          {AAC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all cursor-pointer border ${
                activeCategory === cat.id
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Symbol Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {AAC_VOCABULARY[activeCategory]?.map((tile, idx) => {
            const Icon = tile.icon;
            return (
              <button
                key={idx}
                onClick={() => handleAddWord(tile.text)}
                onDoubleClick={() => handleInstantSpeakTile(tile.text)}
                className={`group flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-95 shadow-md min-h-[96px] ${
                  tile.color
                } ${tile.colSpan ? tile.colSpan : ''}`}
              >
                <div className="p-2 rounded-lg bg-black/20 group-hover:bg-black/30 transition-colors">
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
                </div>
                <span className="text-xs sm:text-sm font-black tracking-tight text-center leading-tight">
                  {tile.text}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pronouns
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Actions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Objects
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Descriptors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Social
            </span>
          </div>
          <span className="hidden sm:inline italic">
            Single-tap adds to sentence bar • Double-tap speaks immediately
          </span>
        </div>
      </div>
    </div>
  );
}
