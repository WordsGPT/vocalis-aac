import React, { useState, useEffect, useCallback } from 'react';
import { 
  Volume2, Trash2, Delete, ThumbsUp, HelpCircle, 
  Hand, Sparkles, Coffee, Utensils, Home, Heart, AlertTriangle, 
  User, Users, Check, X, MessageSquare, Footprints, Music, 
  RotateCcw, Mic, MicOff, ChevronDown, ChevronUp, History,
  Smile, Frown, ShieldAlert, Clock, ArrowRight, Activity,
  Pill, Thermometer, Bed
} from 'lucide-react';

// AAC Categories and Vocabulary with standard Fitzgerald Key Color Coding:
// 🟡 Amarillo = Pronombres / Personas (Yo, Tú, Nosotros...)
// 🟢 Verde = Verbos / Acciones (Quiero, Necesito, Ir, Ayuda, Comer...)
// 🟠 Naranja = Sustantivos / Objetos / Lugares (Agua, Baño, Casa, Comida...)
// 🔵 Azul = Descriptores / Adjetivos / Sentimientos (Bien, Mal, Dolor, Cansado, Frío...)
// 🟣 Rosa/Morado = Social / Cortesía (Hola, Adiós, Por favor, Gracias, Sí, No...)
// ⚪/🩵 Turquesa/Gris = Preguntas / Conectores (¿Qué?, ¿Dónde?, ¿Cuándo?...)

const AAC_CATEGORIES = [
  { id: 'core', label: '⭐ Vocabulario Clave', count: 18 },
  { id: 'social', label: '💬 Social y Saludos', count: 12 },
  { id: 'needs', label: '🚨 Urgencias y Necesidades', count: 8 },
  { id: 'food', label: '🍽️ Comida y Bebida', count: 12 },
  { id: 'health', label: '🩺 Salud y Dolor', count: 14 },
  { id: 'places', label: '🏠 Lugares y Actividades', count: 10 }
];

const AAC_VOCABULARY = {
  core: [
    { text: 'Yo', category: 'pronoun', icon: User, color: 'bg-amber-400/20 border-amber-400/60 text-amber-200 hover:bg-amber-400/30' },
    { text: 'Tú', category: 'pronoun', icon: Users, color: 'bg-amber-400/20 border-amber-400/60 text-amber-200 hover:bg-amber-400/30' },
    { text: 'Nosotros', category: 'pronoun', icon: Users, color: 'bg-amber-400/20 border-amber-400/60 text-amber-200 hover:bg-amber-400/30' },
    { text: 'Quiero', category: 'verb', icon: Heart, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Necesito', category: 'verb', icon: AlertTriangle, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Ir', category: 'verb', icon: ArrowRight, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Ayuda', category: 'verb', icon: AlertTriangle, color: 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-bold hover:bg-emerald-500/40 ring-1 ring-emerald-500/40' },
    { text: 'Parar', category: 'verb', icon: Hand, color: 'bg-rose-500/25 border-rose-500/60 text-rose-200 hover:bg-rose-500/35' },
    { text: 'Gustar', category: 'verb', icon: ThumbsUp, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Sí', category: 'social', icon: Check, color: 'bg-teal-500/25 border-teal-400 text-teal-100 hover:bg-teal-500/40 font-bold' },
    { text: 'No', category: 'social', icon: X, color: 'bg-rose-500/25 border-rose-400 text-rose-100 hover:bg-rose-500/40 font-bold' },
    { text: 'Por favor', category: 'social', icon: Heart, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Gracias', category: 'social', icon: ThumbsUp, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Bien', category: 'adjective', icon: Smile, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Mal', category: 'adjective', icon: Frown, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Más', category: 'adjective', icon: Sparkles, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: '¿Qué?', category: 'question', icon: HelpCircle, color: 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/30' },
    { text: '¿Dónde?', category: 'question', icon: HelpCircle, color: 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/30' }
  ],
  social: [
    { text: '¡Hola! ¿Cómo estás?', category: 'social', icon: Smile, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: '¡Adiós! Hasta luego', category: 'social', icon: Hand, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Estoy bien, gracias.', category: 'social', icon: ThumbsUp, color: 'bg-teal-500/20 border-teal-500/60 text-teal-200 hover:bg-teal-500/30' },
    { text: 'De nada / Un placer', category: 'social', icon: Smile, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: 'De acuerdo / Me parece bien', category: 'social', icon: Check, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'No lo entiendo', category: 'social', icon: HelpCircle, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' },
    { text: '¿Puedes repetir, por favor?', category: 'social', icon: RotateCcw, color: 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Perdón / Disculpa', category: 'social', icon: MessageSquare, color: 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30' },
    { text: 'Estoy pensando...', category: 'social', icon: Clock, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Tengo una pregunta', category: 'social', icon: HelpCircle, color: 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/30' },
    { text: '¡Buena idea!', category: 'social', icon: Sparkles, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'No me importa / Me da igual', category: 'social', icon: MessageSquare, color: 'bg-slate-700/40 border-slate-600/60 text-slate-300 hover:bg-slate-700/60' }
  ],
  needs: [
    { text: "Por favor, espera un momento. Estoy usando un comunicador de voz para hablar.", category: 'priority', icon: ShieldAlert, color: 'bg-amber-500/30 border-amber-400 text-amber-100 hover:bg-amber-500/40 font-bold col-span-2 shadow-lg shadow-amber-500/10' },
    { text: "¡Necesito ayuda urgente, por favor!", category: 'priority', icon: AlertTriangle, color: 'bg-rose-600/30 border-rose-400 text-rose-100 hover:bg-rose-600/40 font-bold col-span-2 shadow-lg shadow-rose-600/10' },
    { text: "¿Podrías hablar un poco más despacio?", category: 'priority', icon: Clock, color: 'bg-blue-500/25 border-blue-400 text-blue-100 hover:bg-blue-500/35 font-medium' },
    { text: "Necesito ir al baño ahora.", category: 'priority', icon: Home, color: 'bg-orange-500/25 border-orange-400 text-orange-100 hover:bg-orange-500/35 font-medium' },
    { text: "No me siento bien.", category: 'priority', icon: Frown, color: 'bg-rose-500/25 border-rose-400 text-rose-100 hover:bg-rose-500/35 font-medium' },
    { text: "Muchas gracias por tu paciencia conmigo.", category: 'priority', icon: Heart, color: 'bg-purple-500/25 border-purple-400 text-purple-100 hover:bg-purple-500/35 font-medium' }
  ],
  food: [
    { text: 'Agua', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Café', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Té', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Zumo', category: 'noun', icon: Coffee, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Comida', category: 'noun', icon: Utensils, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Fruta', category: 'noun', icon: Utensils, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Comer', category: 'verb', icon: Utensils, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Beber', category: 'verb', icon: Coffee, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Tengo hambre', category: 'adjective', icon: Utensils, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Tengo sed', category: 'adjective', icon: Coffee, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Caliente', category: 'adjective', icon: AlertTriangle, color: 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Frío', category: 'adjective', icon: Sparkles, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' }
  ],
  health: [
    { text: 'Tengo dolor', category: 'priority', icon: AlertTriangle, color: 'bg-rose-500/25 border-rose-400 text-rose-100 hover:bg-rose-500/35 font-bold' },
    { text: 'Dolor de cabeza', category: 'adjective', icon: AlertTriangle, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Dolor de estómago', category: 'adjective', icon: AlertTriangle, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Dolor de espalda', category: 'adjective', icon: AlertTriangle, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Dolor leve (1-3)', category: 'descriptor', icon: Activity, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Dolor moderado (4-6)', category: 'descriptor', icon: Activity, color: 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Dolor severo (7-10)', category: 'descriptor', icon: AlertTriangle, color: 'bg-rose-600/30 border-rose-400 text-rose-100 font-bold hover:bg-rose-600/40' },
    { text: 'Cansado / Agotado', category: 'adjective', icon: Clock, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Mareado', category: 'adjective', icon: Activity, color: 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Tengo frío', category: 'adjective', icon: Frown, color: 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30' },
    { text: 'Tengo calor / Fiebre', category: 'adjective', icon: Thermometer, color: 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30' },
    { text: 'Necesito mi medicina', category: 'noun', icon: Pill, color: 'bg-purple-500/25 border-purple-400 text-purple-200 hover:bg-purple-500/35 font-bold' },
    { text: 'Llamar al médico', category: 'action', icon: Activity, color: 'bg-rose-500/25 border-rose-400 text-rose-200 hover:bg-rose-500/35 font-bold' },
    { text: 'Necesito tumbarme', category: 'verb', icon: Bed, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' }
  ],
  places: [
    { text: 'Casa', category: 'noun', icon: Home, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Baño', category: 'noun', icon: Home, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Dormitorio / Cama', category: 'noun', icon: Bed, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Calle / Fuera', category: 'noun', icon: Footprints, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Hospital / Clínica', category: 'noun', icon: Activity, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' },
    { text: 'Pasear', category: 'verb', icon: Footprints, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Música', category: 'noun', icon: Music, color: 'bg-orange-500/20 border-orange-500/60 text-orange-200 hover:bg-orange-500/30' },
    { text: 'Descansar', category: 'verb', icon: Clock, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Esperar aquí', category: 'verb', icon: Clock, color: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30' },
    { text: 'Irnos ya', category: 'verb', icon: ArrowRight, color: 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30' }
  ]
};

const SAMPLE_PARTNER_PROMPTS = [
  "¿Quieres tomar un café o prefieres agua?",
  "¿Cómo te encuentras hoy?",
  "¿Te apetece salir a dar un paseo?",
  "¿Quieres que llame a alguien para ayudarte?"
];

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
  const [typedInput, setTypedInput] = useState('');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const displayLiveHeard = (currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  // Immediate speak from single-tap tile
  const handleInstantSpeakTile = useCallback((phrase) => {
    onSelectAndSpeak(phrase);
    setSentenceWords([phrase]);
  }, [onSelectAndSpeak]);

  // Keyboard shortcut listener for options [1] through [6]
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= suggestions.length && suggestions[num - 1]) {
        e.preventDefault();
        handleInstantSpeakTile(suggestions[num - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, handleInstantSpeakTile]);

  // Add word or symbol to sentence builder bar
  const handleAddWord = (word) => {
    setSentenceWords((prev) => [...prev, word]);
  };

  // Remove word at specific index
  const handleRemoveWordAt = (index) => {
    setSentenceWords((prev) => prev.filter((_, i) => i !== index));
  };

  // Delete last word (backspace)
  const handleBackspace = () => {
    if (typedInput) {
      setTypedInput((prev) => prev.slice(0, -1));
    } else {
      setSentenceWords((prev) => prev.slice(0, -1));
    }
  };

  // Clear sentence bar completely
  const handleClearSentence = () => {
    setSentenceWords([]);
    setTypedInput('');
  };

  // Speak the built sentence
  const handleSpeakSentence = () => {
    const parts = [...sentenceWords];
    if (typedInput.trim()) {
      parts.push(typedInput.trim());
    }
    const fullText = parts.join(' ').trim();
    if (fullText) {
      onSelectAndSpeak(fullText);
      setTypedInput('');
    }
  };


  // Handle typing input submission
  const handleTypeSubmit = (e) => {
    e.preventDefault();
    if (!typedInput.trim() && sentenceWords.length === 0) return;
    handleSpeakSentence();
  };

  const AI_CARD_THEMES = [
    { 
      label: 'Opción 1: Aceptar / Sí', 
      hotkey: '1', 
      border: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-50 hover:bg-emerald-950/60 hover:border-emerald-400', 
      icon: ThumbsUp, 
      badge: 'bg-emerald-500 text-slate-950',
      tag: 'Acuerdo'
    },
    { 
      label: 'Opción 2: De acuerdo / Neutral', 
      hotkey: '2', 
      border: 'border-teal-500/60 bg-teal-950/40 text-teal-50 hover:bg-teal-950/60 hover:border-teal-400', 
      icon: Check, 
      badge: 'bg-teal-400 text-slate-950',
      tag: 'Aceptación'
    },
    { 
      label: 'Opción 3: Preguntar / Consulta', 
      hotkey: '3', 
      border: 'border-sky-500/60 bg-sky-950/40 text-sky-50 hover:bg-sky-950/60 hover:border-sky-400', 
      icon: HelpCircle, 
      badge: 'bg-sky-400 text-slate-950',
      tag: 'Pregunta'
    },
    { 
      label: 'Opción 4: Alternativa / Otra idea', 
      hotkey: '4', 
      border: 'border-indigo-500/60 bg-indigo-950/40 text-indigo-50 hover:bg-indigo-950/60 hover:border-indigo-400', 
      icon: Sparkles, 
      badge: 'bg-indigo-400 text-slate-950',
      tag: 'Alternativa'
    },
    { 
      label: 'Opción 5: Declinar / Límite', 
      hotkey: '5', 
      border: 'border-rose-500/60 bg-rose-950/40 text-rose-50 hover:bg-rose-950/60 hover:border-rose-400', 
      icon: Hand, 
      badge: 'bg-rose-400 text-slate-950',
      tag: 'Rechazo'
    },
    { 
      label: 'Opción 6: Pensar / Pausa / Tiempo', 
      hotkey: '6', 
      border: 'border-amber-500/60 bg-amber-950/40 text-amber-50 hover:bg-amber-950/60 hover:border-amber-400', 
      icon: Clock, 
      badge: 'bg-amber-400 text-slate-950',
      tag: 'Pausa'
    }
  ];

  return (
    <div className="aac-workspace w-full mx-auto flex flex-col text-left select-none">
      
      {/* 1. TOP SECTION: LA BARRA DE FRASE AAC (Standard Message Window) */}
      <div className="composer-panel w-full rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            Tu mensaje
          </span>
          {sentenceWords.length > 0 && (
            <span className="text-[11px] text-blue-400 font-semibold font-mono">
              {sentenceWords.length} {sentenceWords.length === 1 ? 'palabra' : 'palabras'}
            </span>
          )}
        </div>

        {/* Sentence accumulator display with integrated quick typing */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="composer-input flex-1 min-h-[60px] rounded-xl border-2 focus-within:border-violet-500 px-3 py-2 flex items-center flex-wrap gap-2 transition-colors">
            {sentenceWords.map((word, idx) => (
              <span
                key={idx}
                onClick={() => handleRemoveWordAt(idx)}
                title="Toca para quitar esta palabra"
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-rose-600/30 text-blue-100 hover:text-rose-100 border border-blue-400/50 hover:border-rose-400/60 text-sm sm:text-base font-bold shadow-sm transition-colors cursor-pointer"
              >
                <span>{word}</span>
                <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
            ))}

            {/* Inline fast text typing inside the sentence strip */}
            <form onSubmit={handleTypeSubmit} className="flex-1 min-w-[160px] flex items-center">
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={sentenceWords.length === 0 ? "Toca palabras o escribe aquí…" : "Añade algo más…"}
                className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base font-medium focus:outline-none px-1 py-1"
              />
            </form>
          </div>

          {/* Action Controls: BORRAR PALABRA, LIMPIAR y ¡HABLAR! */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              onClick={handleBackspace}
              disabled={sentenceWords.length === 0 && !typedInput}
              title="Borrar última palabra"
              className="px-3.5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Delete className="w-5 h-5" />
              <span className="text-xs font-bold hidden md:inline">Borrar</span>
            </button>

            <button
              onClick={handleClearSentence}
              disabled={sentenceWords.length === 0 && !typedInput}
              title="Limpiar frase completa"
              className="px-3.5 py-3.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 disabled:opacity-40 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-xs font-bold hidden md:inline">Limpiar</span>
            </button>

            <button
              onClick={handleSpeakSentence}
              disabled={sentenceWords.length === 0 && !typedInput.trim()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-black text-base tracking-wide shadow-lg shadow-violet-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Volume2 className={`w-6 h-6 ${isSpeaking ? 'animate-bounce' : ''}`} />
              <span>HABLAR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PERSISTENT ESSENTIAL COURTESY & EMERGENCY BAR (Siempre visible en AAC) */}
      <div className="quick-strip w-full rounded-xl p-2 sm:p-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 px-1 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          Rápidos:
        </span>
        <button
          onClick={() => handleInstantSpeakTile("Por favor, dame un momento. Estoy usando un comunicador de voz.")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Espera un momento (Uso comunicador)</span>
        </button>
        <button
          onClick={() => handleInstantSpeakTile("¡Sí, por favor!")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 text-teal-400" />
          <span>Sí</span>
        </button>
        <button
          onClick={() => handleInstantSpeakTile("No, gracias.")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5 text-rose-400" />
          <span>No</span>
        </button>
        <button
          onClick={() => handleInstantSpeakTile("¡Muchas gracias!")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <ThumbsUp className="w-3.5 h-3.5 text-purple-400" />
          <span>Gracias</span>
        </button>
        <button
          onClick={() => handleInstantSpeakTile("¿Podrías repetir eso más despacio, por favor?")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Repite, por favor</span>
        </button>
        <button
          onClick={() => handleInstantSpeakTile("¡Necesito ayuda!")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 border border-rose-400 text-rose-100 text-xs font-bold transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>¡Ayuda!</span>
        </button>
      </div>

      {/* 3. AMBIENT LISTENING BANNER (Qué está diciendo la persona que habla contigo) */}
      <div className="listening-panel w-full rounded-2xl p-3 sm:p-4">
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
              {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Micrófono Activo' : 'Activar Micrófono'}</span>
            </button>

            {isListening && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-md border border-slate-700 text-[11px] text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Audio: {audioLevel > 10 ? 'Detectando voz' : 'Silencio en la sala'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick simulation buttons for partner speech in Spanish */}
            {onSimulateSpeech && (
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">Probar con:</span>
                {SAMPLE_PARTNER_PROMPTS.slice(0, 2).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => onSimulateSpeech(prompt)}
                    className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer truncate max-w-[150px]"
                    title={`Simular: "${prompt}"`}
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            )}

            {history.length > 0 && (
              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Historial ({history.length})</span>
                {showHistoryDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Current partner speech display */}
        <div className="mt-2.5 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Tu interlocutor dijo:
            </span>
            <p className="text-base sm:text-lg font-bold text-white m-0 leading-snug">
              {displayLiveHeard || (
                <span className="text-slate-500 font-normal italic text-sm">
                  {isListening ? 'Escuchando conversación en la sala...' : 'Micrófono pausado. Pulsa "Activar Micrófono" para escuchar.'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Expandable Conversation History Drawer */}
        {showHistoryDrawer && history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto pr-1 animate-fade-in">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Conversación anterior:
            </span>
            {history.map((h, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg text-xs border transition-opacity ${
                  h.sender === 'user'
                    ? 'bg-blue-950/20 border-blue-900/30 text-slate-300 ml-6'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 mr-6'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-0.5">
                  <span>{h.sender === 'user' ? 'Tú (Hablado en voz alta):' : 'Interlocutor:'}</span>
                  <span>{h.time}</span>
                </div>
                <span className="text-sm font-medium">{h.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. DYNAMIC SMART AAC AI RESPONSES (Opciones contextuales inmediatas) */}
      <div className="smart-responses w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-indigo-300 m-0">
              Respuestas sugeridas
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Atajos de teclado: teclas del <span className="text-emerald-300 font-bold">[1]</span> al <span className="text-amber-300 font-bold">[{suggestions.length || 6}]</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoadingSuggestions ? (
            [...Array(6)].map((_, i) => (
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
                  className={`group relative p-4 rounded-2xl border-2 transition-all duration-150 text-left cursor-pointer flex flex-col justify-between shadow-xl min-h-[115px] active:scale-[0.98] ${
                    theme.border
                  } ${isCardSpeaking ? 'ring-4 ring-emerald-400 shadow-emerald-500/25' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center font-black shadow ${theme.badge}`}>
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                      <Icon className="w-3.5 h-3.5" />
                      {theme.label}
                    </span>
                  </div>

                  <p className="text-base sm:text-lg font-black leading-snug my-1 tracking-tight">
                    "{text}"
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[10px] opacity-80">
                    <span className="flex items-center gap-1 font-bold text-emerald-300">
                      <Volume2 className="w-3 h-3" />
                      {isCardSpeaking ? 'Hablando en voz alta...' : 'Hablar de inmediato'}
                    </span>
                    <span className="font-mono uppercase font-bold text-slate-400">Pulsa [{idx + 1}]</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 5. TABLERO DE VOCABULARIO AAC COMPLETO (Sistema Fitzgerald Modificado) */}
      <div className="vocabulary-panel w-full rounded-2xl p-3 sm:p-4">
        {/* Category Navigation Tabs */}
        <div className="category-tabs flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-slate-800 scrollbar-none">
          {AAC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all cursor-pointer border ${
                activeCategory === cat.id
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Symbol Grid (AAC Tiles) */}
        <div className="aac-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {AAC_VOCABULARY[activeCategory]?.map((tile, idx) => {
            const Icon = tile.icon;
            return (
              <button
                key={idx}
                onClick={() => handleAddWord(tile.text)}
                onDoubleClick={() => handleInstantSpeakTile(tile.text)}
                className={`aac-tile group flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer active:scale-95 min-h-[90px] ${
                  tile.color
                } ${tile.colSpan ? tile.colSpan : ''}`}
                title={`Toca para añadir "${tile.text}" • Doble toque para hablar ya`}
              >
                <div className="p-2 rounded-lg bg-black/25 group-hover:bg-black/35 transition-colors">
                  <Icon className="w-6 h-6 shrink-0" />
                </div>
                <span className="text-xs sm:text-sm font-black tracking-tight text-center leading-tight">
                  {tile.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Color Legend (Clave de Fitzgerald) */}
        <div className="flex flex-wrap items-center justify-between mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pronombres / Personas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Verbos / Acciones
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Cosas / Lugares
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Descriptores / Sentimientos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Social / Cortesía
            </span>
          </div>
          <span className="italic text-[10px] text-slate-500">
            Un toque añade a la barra de frase • Doble toque habla de inmediato
          </span>
        </div>
      </div>
    </div>
  );
}
