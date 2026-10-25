import { AGENT_ENABLED } from '../features';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowLeft, BookOpen, ChevronRight, CircleStop, Delete, Eye, EyeOff, Folder, Grid2X2, Heart, History, Keyboard, Layers, Lightbulb, MessageSquare, Mic, MicOff, RotateCcw, Search, Settings, Sparkles, Trash2, User, Volume2, X } from 'lucide-react';
import { AAC_VOCABULARY, BOARD_CATEGORIES, CORE_STRIP, QUICK_PHRASES, pictogramPath } from './vocabulary';
import './communication.css';
import { composeSentence, personalForm, spokenTile, suggestSentence } from '../utils/spanish';
import { AgentPanel } from './AgentPanel';
import { ConversationSidebar } from './ConversationSidebar';
import { VisualPlanner } from './VisualPlanner';
import { GuidedPlanner } from './GuidedPlanner';

function readQuick() {
  try {
    const value = JSON.parse(localStorage.getItem('vocalis_quick_phrases'));
    if (Array.isArray(value) && value.every(item => typeof item?.text === 'string' && item.text.trim())) return value;
  } catch { /* Use default phrases. */ }
  return QUICK_PHRASES;
}

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem('vocalis_saved_phrases') || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
  } catch { return []; }
}
function readDraft() {
  try {
    const value = JSON.parse(sessionStorage.getItem('vocalis_draft') || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item?.text === 'string') : [];
  } catch { return []; }
}
function readShowTranscript() {
  try {
    const saved = localStorage.getItem('vocalis_show_transcript');
    return saved !== null ? saved !== 'false' : true;
  } catch { return true; }
}
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const tabs = [
  ['board', Grid2X2, 'Tablero'],
  ['conversation', MessageSquare, 'Conversación'],
  ['planner-visual', Layers, 'Plan Visual'],
  ['planner-guided', BookOpen, 'Guión Guiado'],
  ...(AGENT_ENABLED ? [['agent', Sparkles, 'Agente']] : []),
  ['history', History, 'Historial']
];
function Picto({ id }) {
  return <img src={pictogramPath(id)} alt="" draggable="false" width="80" height="80" />;
}
function Credits() {
  return <p className="pictogram-credit">Pictogramas: Sergio Palao · Gobierno de Aragón · <a href="https://arasaac.org" target="_blank" rel="noreferrer">ARASAAC</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA</a></p>;
}

export function CommunicationBoard({
  inert = false,
  tutorialStep = null,
  speakerLabels = true,
  view,
  onChangeView,
  settings = {},
  onUpdateSettings = () => {},
  tts,
  stt,
  suggestions,
  directYes = 'Sí',
  directNo = 'No',
  loading,
  onSpeak,
  onSettings,
  onOpenContext,
  onRegenerate,
  history,
  onClearHistory,
  voiceLabel,
  engine,
  conversationStatus,
  topics = [],
  activeTopic = null,
  onSelectTopic = () => {},
  speakMode = false,
  onToggleSpeakMode = () => {},
  activeTopicContext = '',
  onRepliesMouseEnter,
  onRepliesMouseLeave,
  agentLight = { state: 'off', color: 'green', brightness: 100 },
  onToggleLight = () => {},
  calendarEvents = [],
  onAddCalendarEvent = () => {},
  onDeleteCalendarEvent = () => {},
  agentActionLog = [],
  lastAgentAction = null,
  onProcessCommand = () => {},
}) {

  const [quick, setQuick] = useState(readQuick);
  const [quickText, setQuickText] = useState('');
  const [editingQuick, setEditingQuick] = useState(null);
  const adapt = tile => ({ ...tile, text: personalForm(tile.text, settings.grammaticalForm) });
  const [category, setCategory] = useState('core');
  const [showFolders, setShowFolders] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [storedSegments, setStoredSegments] = useState(readDraft);
  const [practiceSegments, setPracticeSegments] = useState([]);
  const segments = tutorialStep ? practiceSegments : storedSegments;
  const setSegments = tutorialStep ? setPracticeSegments : setStoredSegments;
  const [storedUndo, setStoredUndo] = useState([]);
  const [practiceUndo, setPracticeUndo] = useState([]);
  const undo = tutorialStep ? practiceUndo : storedUndo;
  const setUndo = tutorialStep ? setPracticeUndo : setStoredUndo;
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [notice, setNotice] = useState('');
  const [manageSaved, setManageSaved] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [editReplyMode, setEditReplyMode] = useState(false);
  const [partnerText, setPartnerText] = useState('');
  const [isPartnerOpen, setIsPartnerOpen] = useState(false);
  const partnerDetailsRef = useRef(null);
  const partnerInputRef = useRef(null);
  const [showTranscript, setShowTranscript] = useState(readShowTranscript);
  const toggleTranscript = () => {
    setShowTranscript(prev => {
      const next = !prev;
      try { localStorage.setItem('vocalis_show_transcript', String(next)); } catch { /* Storage error */ }
      return next;
    });
  };

  // Persistent planned phrases and recipient for Planning modes
  const [plannedPhrases, setPlannedPhrases] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vocalis_planned_phrases') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch { return []; }
  });

  const [plannedRecipient, setPlannedRecipient] = useState(() => {
    try {
      return localStorage.getItem('vocalis_planned_recipient') || 'medico';
    } catch { return 'medico'; }
  });

  const handleSelectPlannedRecipient = (newRec) => {
    setPlannedRecipient(newRec);
    try { localStorage.setItem('vocalis_planned_recipient', newRec); } catch {}
  };

  const handleAddPlannedPhrase = (phrase) => {
    setPlannedPhrases((prev) => {
      const updated = [phrase, ...prev];
      try { localStorage.setItem('vocalis_planned_phrases', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleRemovePlannedPhrase = (id) => {
    setPlannedPhrases((prev) => {
      const updated = prev.filter(p => (p.id ? p.id !== id : true));
      try { localStorage.setItem('vocalis_planned_phrases', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleReorderPlannedPhrases = (fromIdx, toIdx) => {
    setPlannedPhrases((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, item);
      try { localStorage.setItem('vocalis_planned_phrases', JSON.stringify(copy)); } catch {}
      return copy;
    });
  };

  const handleClearPlannedPhrases = () => {
    if (window.confirm('¿Borrar todas las frases de tu guion planificado?')) {
      setPlannedPhrases([]);
      try { localStorage.removeItem('vocalis_planned_phrases'); } catch {}
    }
  };

  const handleInsertIntoComposer = (text) => {
    updateMessage([{ text }]);
    startComposing();
  };
  const input = useRef(null);
  const workspace = useRef(null);
  const scrollArea = useRef(null);
  const boardBeforeTutorial = useRef(null);
  const sentenceStrip = useRef(null);
  const draft = composeSentence(segments);
  const improvedSentence = suggestSentence(segments);
  const heard = [stt.transcript, stt.interimTranscript].filter(Boolean).join(' ');
  const lastPartnerMessage = [...(history || [])].reverse().find(m => m.sender === 'partner')?.text || '';
  const canGenerate = Boolean(heard || lastPartnerMessage || activeTopic || speakMode);
  const targetText = heard || lastPartnerMessage || '';
  const isManualMode = settings.responseGenerationMode === 'manual';

  const handleToggleAutoMode = useCallback(() => {
    const newMode = isManualMode ? 'auto' : 'manual';
    if (onUpdateSettings) {
      onUpdateSettings({ responseGenerationMode: newMode, responseGenerationMode_v2: newMode });
    }
    if (newMode === 'auto' && !suggestions.length && canGenerate) {
      onRegenerate(targetText);
    }
  }, [isManualMode, onUpdateSettings, suggestions.length, canGenerate, onRegenerate, targetText]);
  const search = normalize(query.trim());
  const foldersVisible = showFolders && !search;
  const activeCategory = BOARD_CATEGORIES.find(item => item.id === category);
  const pictogramScale = Math.min(160, Math.max(70, Number(settings.pictogramSize) || 100)) / 100;
  const pictogramPixels = base => `${Math.round(base * pictogramScale)}px`;
  const pictogramStyle = {
    '--aac-tile-min-width': `${Math.min(280, Math.round(200 * pictogramScale))}px`,
    '--aac-tile-min-width-tablet': `${Math.min(230, Math.round(170 * pictogramScale))}px`,
    '--aac-tile-min-width-mobile': `${Math.min(140, Math.round(110 * pictogramScale))}px`,
    '--aac-tile-height': pictogramPixels(163),
    '--aac-tile-height-mobile': pictogramPixels(130),
    '--aac-tile-font': pictogramPixels(18),
    '--aac-tile-font-mobile': `${Math.max(11, Math.round(15 * pictogramScale))}px`,
    '--aac-tile-padding': pictogramPixels(12),
    '--aac-tile-padding-mobile': `${Math.max(4, Math.round(8 * pictogramScale))}px`,
    '--aac-tile-picto': pictogramPixels(96),
    '--aac-tile-picto-mobile': pictogramPixels(75),
    '--aac-core-picto': pictogramPixels(44),
    '--aac-core-picto-mobile': pictogramPixels(32),
    '--aac-quick-picto': pictogramPixels(30),
    '--aac-quick-picto-mobile': pictogramPixels(28),
    '--aac-folder-picto': pictogramPixels(65),
    '--aac-folder-picto-mobile': pictogramPixels(61),
    '--aac-sentence-picto': pictogramPixels(34),
    '--aac-sentence-picto-mobile': pictogramPixels(28),
    '--aac-sentence-picto-short': pictogramPixels(24),
    '--aac-word-symbol-size': pictogramPixels(36),
  };
  const allTiles = [...Object.values(AAC_VOCABULARY).flat().map(adapt), ...saved.map(text => ({ text, pictogram: 9837, category: 'social' }))];
  const tiles = search
    ? allTiles.filter((tile, i) => normalize(tile.text).includes(search) && allTiles.findIndex(other => other.text === tile.text) === i)
    : category === 'saved' ? saved.map(text => ({ text, pictogram: 9837, category: 'social' })) : AAC_VOCABULARY[category].map(adapt);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      // Mobile keyboards can resize only the visual viewport, leaving dvh unchanged.
      if (viewport.scale === 1) workspace.current?.style.setProperty('height', `${viewport.height}px`);
      else workspace.current?.style.removeProperty('height');
    };
    resize();
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (tutorialStep) return;
    try { sessionStorage.setItem('vocalis_draft', JSON.stringify(segments)); } catch { /* Draft remains available in memory. */ }
    sentenceStrip.current?.scrollTo({ left: sentenceStrip.current.scrollWidth });
  }, [segments, tutorialStep]);

  useEffect(() => {
    const onKey = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || document.querySelector('[role="dialog"]') || event.target.closest('input, textarea, select, [contenteditable=true]')) return;
      if (event.key === 'Escape') tts.stop();
      if (view === 'conversation' && !loading && /^[1-9]$/.test(event.key) && suggestions[Number(event.key) - 1]) {
        event.preventDefault();
        onSpeak(suggestions[Number(event.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, loading, onSpeak, suggestions, tts]);

  const captureBoardNavigation = useEffectEvent(() => ({ category, showFolders, query }));
  useEffect(() => {
    if (tutorialStep && !boardBeforeTutorial.current) {
      boardBeforeTutorial.current = captureBoardNavigation();
    }
    if (tutorialStep === 'board-tiles') { setCategory('core'); setShowFolders(false); setQuery(''); setPracticeSegments([]); }
    if (tutorialStep === 'composer' || tutorialStep === 'speak' || tutorialStep === 'edit') setIsComposing(false);
    if (!tutorialStep) {
      setPracticeSegments([]);
      if (boardBeforeTutorial.current) {
        const previous = boardBeforeTutorial.current;
        setCategory(previous.category); setShowFolders(previous.showFolders); setQuery(previous.query);
        boardBeforeTutorial.current = null;
      }
    }
  }, [tutorialStep]);

  function updateMessage(next) {
    setUndo(previous => [...previous.slice(-39), segments]);
    setSegments(next);
    setNotice('');
  }
  function startComposing() {
    // Focus within the activation event so tablet browsers can open the keyboard.
    flushSync(() => { setIsComposing(true); setShowMessagePanel(false); setEditReplyMode(false); });
    input.current?.focus();
  }
  function append(tile) {
    updateMessage([...segments.filter(item => item.text.trim()), { text: tile.text, pictogram: tile.pictogram, connector: tile.connector }]);
    if (!tutorialStep && settings.speakTiles !== false) {
      stt.pauseForPlayback();
      tts.speak(spokenTile(segments, tile), { prepared: true });
    }
  }
  function undoMessage() {
    if (!undo.length) return;
    setSegments(undo[undo.length - 1]);
    setUndo(previous => previous.slice(0, -1));
    setNotice('');
  }
  function eraseLast() {
    if (!segments.length) return;
    const last = segments[segments.length - 1];
    if (last.pictogram) updateMessage(segments.slice(0, -1));
    else {
      const text = last.text.trimEnd().replace(/\S+$/, '').trimEnd();
      updateMessage([...segments.slice(0, -1), ...(text ? [{ text }] : [])]);
    }
  }
  function changeView(next) {
    document.activeElement?.closest('input, textarea')?.blur();
    setIsComposing(false);
    setShowMessagePanel(false);
    setEditReplyMode(false);
    if (next !== 'conversation' && stt.isListening) stt.stopListening();
    onChangeView(next);
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function openFolders() {
    setShowFolders(true); setQuery(''); setManageSaved(false);
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function openCategory(id) {
    setCategory(id); setShowFolders(false); setQuery(''); setManageSaved(false);
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function savePhrase() {
    if (tutorialStep) return;
    const text = draft.trim();
    if (!text) return;
    const next = [...new Set([...saved, text])];
    try {
      localStorage.setItem('vocalis_saved_phrases', JSON.stringify(next));
      setSaved(next); setNotice('Frase guardada en Mis frases.');
    } catch { setNotice('No se pudo guardar la frase.'); }
  }
  function removePhrase(text) {
    const next = saved.filter(item => item !== text);
    try { localStorage.setItem('vocalis_saved_phrases', JSON.stringify(next)); setSaved(next); }
    catch { setNotice('No se pudo eliminar la frase.'); }
  }
  function saveQuick(next) {
    try {
      localStorage.setItem('vocalis_quick_phrases', JSON.stringify(next));
      setQuick(next); setNotice('Frases rápidas guardadas.');
      return true;
    } catch { setNotice('No se pudieron guardar las frases rápidas.'); return false; }
  }
  function submitQuick(event) {
    event.preventDefault();
    const text = quickText.trim();
    if (!text) return;
    const next = [...quick];
    if (editingQuick === null) next.push({ text, pictogram: 9837, category: 'social' });
    else next[editingQuick] = { ...next[editingQuick], text };
    if (saveQuick(next)) { setQuickText(''); setEditingQuick(null); }
  }
  function openSettings() {
    stt.pauseForPlayback();
    onSettings();
  }

  const topicStrip = view === 'conversation' && topics?.length > 0 && (
    <div className="aac-header-topics" role="region" aria-label="Temas de la conversación">
      <span className="aac-topics-label">Retomar un tema</span>
      {topics.map(t => <button key={t.name} type="button" className={'aac-topic-chip' + (activeTopic === t.name ? ' active' : '')}
        aria-pressed={activeTopic === t.name} title={activeTopic === t.name ? `Tema activo: ${t.name}. Toca para volver a conversación general` : `Volver al tema: ${t.name}`}
        onClick={() => onSelectTopic(t.name)}><Picto id={t.pictogram || 9837} /><span>{t.name}</span>{activeTopic === t.name && <X size={16} aria-hidden="true" />}</button>)}
    </div>
  );

  return <div ref={workspace} inert={inert} className={'aac-app aac-view-' + view + (view === 'board' && foldersVisible ? ' aac-show-categories' : '') + (view === 'conversation' && suggestions.length > 0 && suggestions.length <= 6 && !isComposing && !isPartnerOpen ? ' aac-compact-replies' : '') + (pictogramScale >= 1.3 ? ' aac-large-pictograms' : '')} style={pictogramStyle}>
    <a className="aac-skip-link" href="#communication-panel">Ir al contenido</a>
    <header className="aac-header">
      <button className="aac-brand" aria-label="Ir al tablero principal" onClick={() => { changeView('board'); openFolders(); }}><span className="aac-brand-mark"><Volume2 /></span><span>vocalis</span></button>
      <span className="aac-brand-caption">Tu voz, a tu manera.</span>
      <div className="aac-header-actions">
        <span className="aac-voice-label">{voiceLabel}</span>
        <button
          type="button"
          id="header-context-btn"
          className={'aac-tool aac-context-tool' + (settings.userContext?.trim() ? ' has-context' : '')}
          onClick={onOpenContext}
          aria-label="Contexto personal para la IA"
          title={settings.userContext?.trim() ? `Contexto activo: ${settings.userContext.trim().slice(0, 60)}…` : 'Añadir contexto sobre ti para la IA'}
        >
          <User size={18} aria-hidden="true" />
          <span>Contexto</span>
          {settings.userContext?.trim() && <span className="aac-context-dot" aria-label="Contexto activo" />}
        </button>
        {AGENT_ENABLED && <button
          type="button"
          id="header-light-btn"
          className={'aac-tool aac-light-tool' + (agentLight?.state === 'on' ? ' is-lit' : '')}
          onClick={() => changeView('agent')}
          aria-label="Luz inteligente"
          title={`Luz: ${agentLight?.state === 'on' ? 'Encendida (' + (agentLight.color || 'verde') + ')' : 'Apagada'}. Toca para abrir el panel del agente.`}
        >
          <Lightbulb size={18} className={agentLight?.state === 'on' ? 'text-emerald-400' : ''} aria-hidden="true" />
          <span>Luz</span>
          {agentLight?.state === 'on' && (
            <span
              className="aac-light-header-dot"
              style={{
                backgroundColor: agentLight.color === 'green' ? '#22c55e' : (agentLight.color === 'blue' ? '#3b82f6' : '#22c55e')
              }}
              aria-label="Luz encendida"
            />
          )}
        </button>}
        <button className="aac-tool" onClick={openSettings} aria-label="Ajustes y clonar mi voz"><Settings /><span>Ajustes y voz</span></button>
      </div>

    </header>

    <section id="message-composer" className="aac-composer" aria-label="Mi mensaje" hidden={view !== 'board' && !isComposing}>
      <div className="aac-composer-label"><span>Mi mensaje</span>{view === 'conversation' ? <button className="aac-tool aac-close-composer" onClick={() => { input.current?.blur(); flushSync(() => setIsComposing(false)); document.getElementById('conversation-write')?.focus(); }}><X size={20} />Cerrar teclado</button> : <span>Enter para hablar</span>}</div>
      <div className="aac-message-line">
        <label className="sr-only" htmlFor="message-draft">Escribe tu mensaje</label>
        <textarea id="message-draft" ref={input} rows={2} placeholder="Escribe aquí o toca los pictogramas…" value={draft}
          onChange={event => updateMessage(event.target.value ? [{ text: event.target.value }] : [])}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && draft.trim()) { event.preventDefault(); onSpeak(draft); } }} />
        <div className="aac-edit-tools">
          <button className="aac-tool" disabled={!draft} onClick={eraseLast} aria-label="Borrar último elemento"><Delete /><span>Borrar</span></button>
          <button className="aac-tool" disabled={!draft} onClick={() => updateMessage([])} aria-label="Limpiar mensaje"><Trash2 /><span>Limpiar</span></button>
        </div>
        <button className={'aac-speak ' + (tts.isSpeaking ? 'is-speaking' : '')} disabled={!draft.trim() && !tts.isSpeaking} onClick={() => tts.isSpeaking ? tts.stop() : onSpeak(draft)}>
          {tts.isSpeaking ? <CircleStop /> : <Volume2 />}<span>{tts.isSpeaking ? 'Detener' : 'Hablar'}</span>
        </button>
      </div>
      <div className="aac-sentence-row">
        {view === 'board' && <div className="aac-board-actions"><button className="aac-tool" aria-label="Categorías" title="Categorías" aria-pressed={!!foldersVisible} onClick={openFolders}><Folder size={20} /><span>Categorías</span></button><label className="aac-search"><Search size={18} /><input aria-label="Buscar palabras y frases" placeholder="Buscar" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Borrar búsqueda" onClick={() => setQuery('')}><X size={18} /></button>}</label></div>}
        <div className="aac-sentence-strip" ref={sentenceStrip} aria-label="Pictogramas del mensaje" hidden={!segments.some(item => item.pictogram)}>
          {segments.some(item => item.pictogram) ? segments.map((item, index) => <button key={index} className="aac-sentence-symbol" onClick={() => updateMessage(segments.filter((_, i) => i !== index))} aria-label={'Quitar del mensaje: ' + spokenTile(segments.slice(0, index), item)}>
            {item.pictogram && <Picto id={item.pictogram} />}<span>{spokenTile(segments.slice(0, index), item)}</span><X size={12} />
          </button>) : null}
        </div>
        <button className="aac-icon-tool" disabled={!undo.length} onClick={undoMessage} aria-label="Deshacer último cambio" title="Deshacer"><RotateCcw size={19} /></button>
        <button className="aac-icon-tool" onClick={() => input.current?.focus()} aria-label="Escribir con el teclado" title="Escribir"><Keyboard size={21} /></button>
        <button className="aac-icon-tool" disabled={!draft.trim()} onClick={savePhrase} aria-label="Guardar frase" title="Guardar en Mis frases"><Heart size={20} /></button>
      </div>
      {improvedSentence && <div className="aac-sentence-suggestion"><span>Podrías decir: <strong>{improvedSentence}</strong></span><button className="aac-tool" onClick={() => updateMessage([{ text: improvedSentence }])}>Usar esta frase</button><span className="sr-only">Puedes deshacer el cambio. No se hablará automáticamente.</span></div>}
      {(notice || tts.error) && <p className={tts.error ? 'aac-error' : 'aac-notice'} role="status">{tts.error || notice}</p>}
      {tts.isSpeaking && <p className="sr-only" role="status">{tts.isLoading ? 'Preparando la voz.' : 'Hablando.'}</p>}
    </section>

    <div className="aac-navigation">
      <span className="aac-nav-label">MI ESPACIO</span>
      <nav className="aac-tabs" aria-label="Modo de comunicación">
        {tabs.map(([id, Icon, label]) => <button type="button" key={id} id={'tab-' + id} aria-pressed={view === id} aria-controls="communication-panel" onClick={() => changeView(id)}>
          <Icon size={20} aria-hidden="true" /><span>{label}</span>{id === 'conversation' && stt.isListening && <span className="aac-mic-dot" />}
        </button>)}
      </nav>
      <div className="aac-quick" aria-label="Hablar inmediatamente">
        <span className="aac-nav-label">A UN TOQUE</span>
        {quick.map((tile, index) => {
          const lower = (tile.text || '').trim().toLowerCase();
          const isYes = lower === 'sí' || lower === 'si';
          const isNo = lower === 'no';
          const toneClass = tile.category === 'priority' ? 'aac-help' : isYes ? 'aac-quick-yes' : isNo ? 'aac-quick-no' : '';
          return (
            <button
              key={index}
              onClick={() => onSpeak(tile.text, { prepared: true })}
              aria-label={'Decir: ' + tile.text}
              className={toneClass + (isYes || isNo ? ' aac-binary-quick' : '')}
            >
              <Picto id={tile.pictogram} />
              <span>{tile.text}</span>
              <Volume2 size={13} />
            </button>
          );
        })}
      </div>
    </div>

    <main className={'aac-scroll-area' + (view === 'conversation' ? ' aac-conversation-workspace' : '')} ref={scrollArea}>
      {view === 'conversation' && <div className="aac-page-heading"><div><h1>Conversación</h1><p>Escucha, elige una respuesta y hazla tuya.</p></div><span className="aac-session-label"><span />Tu espacio para hablar</span></div>}
      {view === 'conversation' && <div className="aac-conversation-controls" aria-label="Controles de conversación">
        <button type="button" className={'aac-listen ' + (stt.isListening ? 'active' : '')} aria-label={stt.isListening ? 'Detener escucha' : 'Escuchar'} aria-pressed={stt.isListening} onClick={() => { document.activeElement?.closest('input, textarea')?.blur(); setIsComposing(false); tts.stop(); stt.toggleListening(); }}>{stt.isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}<span>{stt.isListening ? 'Pausar' : 'Escuchar'}</span></button>
        <div className="aac-hearing-status" role="status">{!stt.isListening ? 'Micrófono apagado' : tts.isSpeaking || tts.isLoading ? 'La escucha se reanuda al terminar mi voz' : stt.isSpeechDetected ? 'Escuchando voz…' : stt.isTranscribing ? 'Escuchando · transcribiendo lo anterior…' : 'Escuchando la conversación'}{stt.isListening && <meter min="0" max="100" value={stt.audioLevel} aria-label="Nivel del micrófono" />}</div>
        <button
          type="button"
          id="conversation-speak-mode"
          className={'aac-tool aac-speak-mode-btn' + (speakMode ? ' is-active' : '')}
          aria-pressed={speakMode}
          aria-label={speakMode ? 'Modo hablar activo (dirigir conversación). Toca para volver a modo respuesta' : 'Cambiar a modo hablar (dirigir conversación)'}
          title={speakMode ? 'Modo hablar activo: sugerencias para dirigir la conversación. Pulsa para volver a modo respuesta.' : 'Cambiar a modo hablar: sugerencias para dirigir la conversación o decir lo que tú quieres decir.'}
          onClick={onToggleSpeakMode}
        >
          <Sparkles aria-hidden="true" size={20} />
          <span>Modo hablar</span>
          {speakMode && <span className="aac-speak-mode-dot" aria-label="Activo" />}
        </button>
        <button type="button" id="conversation-write" className="aac-tool" aria-label="Escribir" aria-expanded={isComposing} aria-controls="message-composer" onClick={() => (isComposing ? (input.current?.blur(), setIsComposing(false)) : startComposing())}><Keyboard aria-hidden="true" size={20} /><span className="aac-write-label">Escribir</span></button>
        <button type="button" id="conversation-toggle-transcript" className={'aac-tool aac-transcript-toggle' + (!showTranscript ? ' is-collapsed' : '')} aria-expanded={showTranscript} aria-controls="conversation-hearing" aria-label={showTranscript ? 'Ocultar transcripción' : 'Mostrar transcripción'} title={showTranscript ? 'Ocultar transcripción' : 'Mostrar transcripción'} onClick={toggleTranscript}>
          {showTranscript ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
          <span>{showTranscript ? 'Ocultar' : 'Mostrar'}<span className="aac-transcript-btn-extra"> transcripción</span></span>
        </button>
        <button type="button" id="conversation-toggle-messages" className="aac-icon-tool aac-chat-toggle" aria-label={showMessagePanel ? 'Ocultar panel de mensajes' : 'Mostrar panel de mensajes'} aria-expanded={showMessagePanel} aria-controls="conversation-messages" title="Mensajes de la conversación" onClick={() => setShowMessagePanel(value => !value)}><History size={20} /></button>
        {tts.isSpeaking && <button type="button" className="aac-tool" onClick={tts.stop}><CircleStop size={20} />Detener voz</button>}
      </div>}
      <section id="communication-panel" aria-labelledby={'tab-' + view} className="aac-tab-content" tabIndex={0}>
        {view === 'board' && <>
          <div className="aac-board-toolbar">
            <div className="aac-breadcrumb">{foldersVisible ? <button className="aac-tool" onClick={() => openCategory('core')}><Grid2X2 size={20} /><span>Inicio</span></button> : (category !== 'core' || search) && <button className="aac-tool" aria-label="Volver a categorías" onClick={openFolders}><ArrowLeft size={20} /><span>Categorías</span></button>}<div><h1>{search ? 'Buscar palabras' : foldersVisible ? 'Categorías' : category === 'core' ? 'Tablero de palabras' : activeCategory.label}</h1><p>{search ? `${tiles.length} resultados para «${query}»` : foldersVisible ? 'Encuentra las palabras que necesitas.' : 'Toca los pictogramas para construir tu mensaje.'}</p></div></div>
          </div>
          {category === 'core' && !search && !foldersVisible && <button className="aac-tool aac-connectors-link" onClick={() => openCategory('connectors')}>Unir palabras: a, el, la, y…</button>}
          {category !== 'core' && !search && !foldersVisible && <nav className="aac-core-strip" aria-label="Palabras esenciales">{CORE_STRIP.map(tile => <button key={tile.text} className={'tone-' + tile.category} onClick={() => append(tile)} aria-label={(settings.speakTiles !== false ? 'Añadir y decir: ' : 'Añadir: ') + tile.text}><Picto id={tile.pictogram} /><span>{tile.text}</span></button>)}</nav>}
          {category === 'saved' && !search && !foldersVisible && <div className="aac-saved-controls"><p>Guarda un mensaje con el corazón. Abajo puedes personalizar las frases rápidas.</p><button className="aac-tool" aria-pressed={manageSaved} onClick={() => setManageSaved(value => !value)}>{manageSaved ? 'Terminar' : 'Organizar frases'}</button></div>}
          <div hidden={!!foldersVisible} className="aac-tile-grid" aria-label={search ? 'Resultados' : 'Palabras'}>
            {tiles.map(tile => <div className="aac-tile-wrap" key={tile.text}>
              <button className={'aac-tile tone-' + tile.category} onClick={() => append(tile)} aria-label={(settings.speakTiles !== false ? 'Añadir y decir: ' : 'Añadir: ') + tile.text}>
                {tile.pictogram ? <Picto id={tile.pictogram} /> : <span className="aac-word-symbol" aria-hidden="true">{tile.text}</span>}<span>{tile.text}</span>
              </button>
              {category === 'saved' && !search && !foldersVisible && manageSaved && <button className="aac-remove-saved" aria-label={'Eliminar frase: ' + tile.text} onClick={() => removePhrase(tile.text)}><Trash2 size={18} /></button>}
            </div>)}
          </div>
          {!foldersVisible && !tiles.length && <div className="aac-empty"><MessageSquare size={36} /><h2>{search ? 'No hay coincidencias' : 'Tus propias palabras'}</h2><p>{search ? 'Escribe lo que necesitas en el mensaje de arriba.' : 'Escribe una frase y guárdala con el corazón. Aparecerá aquí.'}</p><button className="aac-tool" onClick={() => input.current?.focus()}><Keyboard />Escribir en mi mensaje</button></div>}
          {foldersVisible && <nav className="aac-folders" aria-label="Categorías">
            {BOARD_CATEGORIES.map(item => <button key={item.id} className={'aac-folder tone-' + item.category} onClick={() => openCategory(item.id)} aria-label={'Abrir: ' + item.label}>
              <Folder className="aac-folder-mark" size={17} /><Picto id={item.pictogram} /><span>{item.label}</span><ChevronRight size={18} />
            </button>)}
          </nav>}
          {category === 'saved' && !search && !foldersVisible && <details className="aac-quick-editor">
            <summary>Personalizar frases rápidas</summary>
            <p>Se hablan con un toque. Se mantienen en el orden que elijas. Puedes añadir nombres, lugares o mensajes.</p>
            <form onSubmit={submitQuick}><label htmlFor="quick-text">{editingQuick === null ? 'Nueva frase rápida' : 'Editar frase rápida'}</label><input id="quick-text" value={quickText} maxLength={200} onChange={event => setQuickText(event.target.value)} required /><button className="aac-tool">{editingQuick === null ? 'Añadir' : 'Guardar cambio'}</button>{editingQuick !== null && <button type="button" className="aac-tool" onClick={() => { setEditingQuick(null); setQuickText(''); }}>Cancelar</button>}</form>
            <button className="aac-tool" disabled={!draft.trim()} onClick={() => { setQuickText(draft); setEditingQuick(null); }}>Añadir mi mensaje</button>
            <ol>{quick.map((tile, index) => <li key={index}><span>{tile.text}</span><button className="aac-tool" onClick={() => { setEditingQuick(index); setQuickText(tile.text); }}>Editar<span className="sr-only">: {tile.text}</span></button><button className="aac-tool" disabled={index === 0} aria-label={'Mover antes: ' + tile.text} onClick={() => { const next = [...quick]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; if (saveQuick(next)) { setEditingQuick(null); setQuickText(''); } }}>↑</button><button className="aac-tool" aria-label={'Quitar frase rápida: ' + tile.text} onClick={() => { if (saveQuick(quick.filter((_, i) => i !== index))) { setEditingQuick(null); setQuickText(''); } }}>Quitar</button></li>)}</ol>
            <p>Añadir una frase habitual:</p><div className="aac-phrase-presets">{AAC_VOCABULARY.social.slice(0, 5).map(tile => <button key={tile.text} className="aac-tool" disabled={quick.some(item => item.text === tile.text)} onClick={() => saveQuick([...quick, tile])}>{tile.text}</button>)}</div>
          </details>}
          <Credits />
        </>}

        {view === 'conversation' && <div className="aac-conversation">
          {topicStrip}
          {stt.error && <p className="aac-error aac-conversation-error" role="alert">{stt.error}</p>}
          {!showTranscript && !tutorialStep && <div className="aac-hearing-collapsed">
            <button type="button" className="aac-tool aac-show-hearing-btn" onClick={toggleTranscript} aria-label="Mostrar transcripción">
              <Eye size={18} aria-hidden="true" />
              <span>Mostrar transcripción</span>
              {stt.turns?.length > 0 && <span className="aac-hearing-badge">{stt.turns.length} turno{stt.turns.length > 1 ? 's' : ''}</span>}
            </button>
            <button
              type="button"
              className="aac-tool aac-show-hearing-btn"
              onClick={() => {
                setShowTranscript(true);
                setIsPartnerOpen(true);
                if (partnerDetailsRef.current) partnerDetailsRef.current.open = true;
                if (!partnerText && heard) setPartnerText(heard);
                setTimeout(() => {
                  partnerInputRef.current?.focus();
                  partnerInputRef.current?.select?.();
                  partnerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 60);
              }}
              aria-label="Escribir o corregir lo que dijo el interlocutor"
            >
              <span>Escribir o corregir</span>
            </button>
          </div>}
          <section id="conversation-hearing" className={'aac-hearing' + (isPartnerOpen ? ' has-partner-open' : '')} aria-label="Escuchar al interlocutor" hidden={!showTranscript && !tutorialStep}>
            <div className="aac-hearing-header">
              <span className="aac-hearing-title"><MessageSquare size={16} aria-hidden="true" />Lo que estás escuchando</span>
              <span className="aac-transcript-label">Transcripción</span>
            </div>
            {speakerLabels && stt.turns?.length ? <ol className="aac-speaker-turns" aria-label="Últimos turnos escuchados">{stt.turns.map((turn, index) => <li key={index}><strong>{turn.speaker_label}</strong><span>{turn.text}</span></li>)}</ol> : <p className="aac-heard">{stt.transcript || (speakerLabels ? 'La conversación aparecerá aquí, separada por voces.' : 'Lo que se diga aparecerá aquí.')}</p>}
            {stt.interimTranscript && <p className="aac-heard">{stt.interimTranscript}</p>}
            {speakerLabels && stt.turns?.length > 0 && <p className="aac-conversation-note">{stt.diarization === 'estimated' ? 'Las etiquetas de voz son aproximadas; pueden confundirse si hablan a la vez.' : 'No se han podido distinguir las voces de este audio.'}</p>}
            <details
              ref={partnerDetailsRef}
              className="aac-partner-input"
              open={isPartnerOpen}
              onToggle={event => {
                const isOpen = event.currentTarget.open;
                setIsPartnerOpen(isOpen);
                if (isOpen) {
                  if (!partnerText && heard) setPartnerText(heard);
                  setTimeout(() => {
                    partnerInputRef.current?.focus();
                    partnerInputRef.current?.select?.();
                    partnerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 60);
                }
              }}
            >
              <summary><span>Escribir o corregir lo que dijo</span><Keyboard size={18} aria-hidden="true" /></summary>
              <form onSubmit={event => {
                event.preventDefault();
                if (partnerText.trim()) {
                  partnerInputRef.current?.blur();
                  setIsPartnerOpen(false);
                  if (partnerDetailsRef.current) partnerDetailsRef.current.open = false;
                  stt.simulateSpeech(partnerText);
                  setPartnerText('');
                }
              }}>
                <label htmlFor="partner-text" className="sr-only">Mensaje del interlocutor</label>
                <input
                  ref={partnerInputRef}
                  id="partner-text"
                  value={partnerText}
                  onChange={event => setPartnerText(event.target.value)}
                  placeholder={heard || '¿Qué te han dicho?'}
                  aria-label="Mensaje del interlocutor"
                />
                <button type="submit" className="aac-tool" disabled={!partnerText.trim()}>Generar respuestas</button>
              </form>
            </details>
          </section>
          <div className="aac-reply-heading">
            <div className="aac-reply-heading-title">
              <h2>
                {activeTopic
                  ? `Volviendo a: ${activeTopic}`
                  : speakMode
                    ? 'Qué quieres decir · Dirigir'
                    : editReplyMode ? 'Elige una respuesta para editar' : 'Podrías decir'}
              </h2>
              {speakMode && !activeTopic && (
                <button
                  type="button"
                  className="aac-speak-mode-badge"
                  onClick={onToggleSpeakMode}
                  title="Modo hablar activo: pulsa para volver a modo respuesta"
                  aria-label="Modo hablar activo: volver a modo respuesta"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>Modo hablar</span>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
              {activeTopic && (
                <div className="aac-active-topic-wrap">
                  <button
                    type="button"
                    className="aac-active-topic-badge"
                    onClick={() => onSelectTopic(activeTopic)}
                    title="Quitar tema y volver a sugerencias generales"
                    aria-label={`Quitar tema activo: ${activeTopic}`}
                  >
                    <span>Quitar tema</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                  {activeTopicContext && (
                    <span className="aac-topic-context-hint" title={activeTopicContext}>
                      Contexto: {activeTopicContext.length > 55 ? activeTopicContext.slice(0, 55) + '…' : activeTopicContext}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="aac-reply-quick-actions" role="group" aria-label="Respuestas directas">
              <button
                type="button"
                id="conversation-quick-yes"
                className="aac-quick-reply-btn aac-quick-yes"
                onClick={() => { input.current?.blur(); setIsComposing(false); onSpeak(directYes || 'Sí', { prepared: true }); }}
                aria-label={`Decir: ${directYes || 'Sí'}`}
                title={directYes && directYes !== 'Sí' ? `Decir: "${directYes}"` : 'Decir Sí inmediatamente'}
              >
                <Picto id={5584} />
                <span>Sí</span>
                <Volume2 size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                id="conversation-quick-no"
                className="aac-quick-reply-btn aac-quick-no"
                onClick={() => { input.current?.blur(); setIsComposing(false); onSpeak(directNo || 'No', { prepared: true }); }}
                aria-label={`Decir: ${directNo || 'No'}`}
                title={directNo && directNo !== 'No' ? `Decir: "${directNo}"` : 'Decir No inmediatamente'}
              >
                <Picto id={5526} />
                <span>No</span>
                <Volume2 size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                id="conversation-quick-repeat"
                className="aac-quick-reply-btn aac-quick-repeat"
                onClick={() => { input.current?.blur(); setIsComposing(false); onSpeak('¿Puedes repetir lo que dijiste, por favor?', { prepared: true }); }}
                aria-label="Decir: ¿Puedes repetir lo que dijiste?"
                title="Pedir que repitan lo que dijeron inmediatamente"
              >
                <Picto id={11752} />
                <span>¿Puedes repetir?</span>
                <Volume2 size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="aac-reply-heading-actions">
              <button type="button" className="aac-icon-tool aac-reply-edit-mode" aria-label={editReplyMode ? 'Volver a hablar respuestas' : 'Elegir una respuesta para editar'} aria-pressed={editReplyMode} title={editReplyMode ? 'Volver a hablar respuestas' : 'Editar una respuesta'} onClick={() => setEditReplyMode(value => !value)}><Keyboard size={18} /></button>
              {settings.userContext?.trim() && (
                <button
                  type="button"
                  id="conversation-context-chip"
                  className="aac-context-chip"
                  onClick={onOpenContext}
                  title="Ver o modificar contexto personal para la IA"
                  aria-label="Contexto activo: ver o modificar"
                >
                  <User size={13} aria-hidden="true" />
                  <span className="aac-context-chip-text">
                    {settings.userContext.trim().length > 26
                      ? settings.userContext.trim().slice(0, 26) + '…'
                      : settings.userContext.trim()}
                  </span>
                </button>
              )}
              <div className="aac-generate-control-group" role="group" aria-label="Generación de respuestas">
                <button
                  type="button"
                  className={`aac-auto-toggle-btn ${!isManualMode ? 'is-active' : ''}`}
                  onClick={handleToggleAutoMode}
                  role="switch"
                  aria-checked={!isManualMode}
                  title={!isManualMode ? 'Generación automática activada. Haz clic para cambiar a modo manual (generar solo al pulsar el botón).' : 'Modo manual activo (espera a pulsar el botón). Haz clic para activar respuestas automáticas tras cada turno de voz.'}
                  aria-label="Generación automática de respuestas"
                >
                  <span className="aac-auto-toggle-switch" aria-hidden="true">
                    <span className="aac-auto-toggle-knob" />
                  </span>
                  <span className="aac-auto-toggle-label">Auto</span>
                </button>

                <button
                  type="button"
                  id="conversation-generate-btn"
                  className={`aac-regenerate-btn aac-generate-prominent ${canGenerate ? 'is-ready' : ''} ${loading ? 'is-loading' : ''}`}
                  aria-label={isManualMode ? (suggestions.length ? 'Generar nuevas respuestas' : 'Generar respuestas') : 'Otras respuestas'}
                  disabled={loading || !canGenerate}
                  onClick={() => onRegenerate(targetText)}
                  title={isManualMode ? 'Generar respuestas con IA' : 'Generar otras opciones con IA'}
                >
                  {loading ? (
                    <RotateCcw size={16} className="aac-spin" aria-hidden="true" />
                  ) : isManualMode && !suggestions.length ? (
                    <Sparkles size={16} aria-hidden="true" />
                  ) : (
                    <RotateCcw size={16} aria-hidden="true" />
                  )}
                  <span className="aac-regenerate-text">
                    {loading
                      ? 'Generando…'
                      : isManualMode
                        ? (suggestions.length ? 'Generar nuevas' : 'Generar respuestas')
                        : 'Otras respuestas'}
                  </span>
                  <span className="aac-regenerate-short">
                    {loading ? '…' : isManualMode ? 'Generar' : 'Otras'}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {loading && <p className="aac-loading" role="status"><span className="aac-loading-dot" />Preparando respuestas…</p>}
          {!isComposing && tts.error && <p className="aac-error" role="alert">{tts.error}</p>}
          {!loading && !suggestions.length && (
            <div className="aac-empty-replies" role="status">
              <span className="aac-empty-mark"><MessageSquare size={28} aria-hidden="true" /></span>
              <h2>{stt.isListening ? 'Todo empieza con una conversación' : 'Cuando quieras, empezamos'}</h2>
              <p>
                {conversationStatus || (
                  isManualMode
                    ? (lastPartnerMessage ? 'Mensaje recibido. Pulsa el botón para generar respuestas.' : 'Pulsa «Generar respuestas» para obtener sugerencias.')
                    : (stt.isListening ? 'Escuchando. Las respuestas aparecerán después de una pausa.' : 'Pulsa Escuchar o escribe lo que te han dicho para obtener respuestas.')
                )}
              </p>
              {isManualMode && (
                <div className="aac-empty-generate-row">
                  <button
                    type="button"
                    className="aac-manual-generate-action"
                    disabled={loading || !canGenerate}
                    onClick={() => onRegenerate(targetText)}
                  >
                    {loading ? (
                      <RotateCcw size={18} className="aac-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={18} aria-hidden="true" />
                    )}
                    <span>{loading ? 'Generando respuestas…' : 'Generar respuestas'}</span>
                  </button>
                  <button
                    type="button"
                    className={`aac-auto-toggle-btn aac-auto-toggle-large ${!isManualMode ? 'is-active' : ''}`}
                    onClick={handleToggleAutoMode}
                    role="switch"
                    aria-checked={!isManualMode}
                    title="Activar generación automática"
                    aria-label="Generación automática de respuestas"
                  >
                    <span className="aac-auto-toggle-switch" aria-hidden="true">
                      <span className="aac-auto-toggle-knob" />
                    </span>
                    <span className="aac-auto-toggle-label">Auto</span>
                  </button>
                </div>
              )}
              <span className="aac-empty-hint">Tú eliges qué decir. También puedes escribir tu propio mensaje.</span>
            </div>
          )}
          {conversationStatus && suggestions.length > 0 && !conversationStatus.startsWith('Hay un momento para participar') && <p className="aac-conversation-note" role="status">{conversationStatus}</p>}
          {AGENT_ENABLED && lastAgentAction && (
            <button type="button"
              className="aac-agent-action-banner"
              role="status"
              onClick={() => changeView('agent')}
              title="Toca para ver detalles en el panel de Agente"
            >
              <Sparkles size={14} className="text-emerald-500" aria-hidden="true" />
              <span className="aac-agent-action-text">{lastAgentAction.result?.message || 'Acción de agente completada'}</span>
              <span className="aac-agent-action-link">Ver Agente →</span>
            </button>
          )}
          <div className={'aac-replies' + (suggestions.length ? ' aac-count-' + suggestions.length : '')} style={{ '--aac-reply-rows': Math.max(1, Math.ceil(suggestions.length / 3)), '--aac-reply-rows-mobile': Math.max(1, Math.ceil(suggestions.length / 2)) }} aria-busy={loading} onMouseEnter={onRepliesMouseEnter} onMouseLeave={onRepliesMouseLeave}>{suggestions.map((text, index) => <article key={index} className="aac-reply"><button className="aac-reply-speak" onClick={() => { if (editReplyMode) { updateMessage([{ text }]); startComposing(); } else { input.current?.blur(); setIsComposing(false); onSpeak(text); } }} aria-label={(editReplyMode ? 'Editar respuesta ' : 'Decir respuesta ') + (index + 1) + ': ' + text}><span className="aac-reply-number">{index + 1}</span><span className="aac-reply-text">{text}</span><Volume2 size={20} aria-hidden="true" /></button><button className="aac-reply-edit" onClick={() => { updateMessage([{ text }]); startComposing(); }} aria-label={'Editar respuesta ' + (index + 1)}><Keyboard size={14} aria-hidden="true" /><span>Editar en mi mensaje</span></button></article>)}</div>
          {suggestions.length > 0 && <p className="aac-conversation-note aac-reply-instructions">El botón de voz habla directamente. «Editar» te permite cambiar la respuesta.{engine === 'heuristic' || engine === 'client-offline' ? ' Se están usando respuestas básicas de respaldo.' : ''}</p>}
        </div>}

        {AGENT_ENABLED && view === 'agent' && (
          <AgentPanel
            agentLight={agentLight}
            onToggleLight={onToggleLight}
            calendarEvents={calendarEvents}
            onAddCalendarEvent={onAddCalendarEvent}
            onDeleteCalendarEvent={onDeleteCalendarEvent}
            userContext={settings.userContext}
            onOpenContextModal={onOpenContext}
            actionLog={agentActionLog}
            onProcessCommand={onProcessCommand}
          />
        )}

        {view === 'planner-visual' && (
          <VisualPlanner
            recipient={plannedRecipient}
            onSelectRecipient={handleSelectPlannedRecipient}
            plannedPhrases={plannedPhrases}
            onAddPlannedPhrase={handleAddPlannedPhrase}
            onRemovePlannedPhrase={handleRemovePlannedPhrase}
            onReorderPlannedPhrases={handleReorderPlannedPhrases}
            onClearPlannedPhrases={handleClearPlannedPhrases}
            onSpeak={onSpeak}
            onInsertIntoComposer={handleInsertIntoComposer}
            settings={settings}
            tts={tts}
          />
        )}

        {view === 'planner-guided' && (
          <GuidedPlanner
            recipient={plannedRecipient}
            onSelectRecipient={handleSelectPlannedRecipient}
            plannedPhrases={plannedPhrases}
            onAddPlannedPhrase={handleAddPlannedPhrase}
            onSpeak={onSpeak}
            onInsertIntoComposer={handleInsertIntoComposer}
            settings={settings}
            tts={tts}
          />
        )}

        {view === 'history' && <div className="aac-history">
          <div className="aac-section-heading"><div><h1>Historial</h1><p>Recupera un mensaje para volver a decirlo o editarlo.</p></div><button className="aac-tool" disabled={!history.length} onClick={() => { if (window.confirm('¿Borrar el historial de este navegador?')) onClearHistory(); }}><Trash2 size={18} />Borrar historial</button></div>
          {!history.length && <div className="aac-empty"><History size={36} /><h2>Aún no hay mensajes</h2><p>Lo que digas y escuches aparecerá aquí.</p></div>}
          <ol>{[...history].reverse().map((item, index) => <li key={index} className={item.sender === 'user' ? 'aac-history-self' : ''}><div><small>{item.sender === 'user' ? 'Tú' : speakerLabels ? item.speaker_label || 'Interlocutor' : 'Conversación'} · {item.time}</small><p>{item.text}</p></div><button className="aac-icon-tool" aria-label={'Editar mensaje: ' + item.text} onClick={() => { updateMessage([{ text: item.text }]); onChangeView('conversation'); startComposing(); }}><Keyboard size={20} /></button><button className="aac-icon-tool" aria-label={'Repetir: ' + item.text} onClick={() => onSpeak(item.text)}><Volume2 size={22} /></button></li>)}</ol>
        </div>}
      </section>
    </main>
    {view === 'conversation' && <ConversationSidebar history={history} speakerLabels={speakerLabels} isOpen={showMessagePanel} onClose={() => { flushSync(() => setShowMessagePanel(false)); document.getElementById('conversation-toggle-messages')?.focus(); }} />}
  </div>;
}
