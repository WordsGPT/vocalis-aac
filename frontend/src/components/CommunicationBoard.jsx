import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, CircleStop, Delete, Folder, Grid2X2, Heart, History, Keyboard, MessageSquare, Mic, MicOff, RotateCcw, Search, Settings, Trash2, Volume2, X } from 'lucide-react';
import { AAC_VOCABULARY, BOARD_CATEGORIES, CORE_STRIP, QUICK_PHRASES, pictogramPath } from './vocabulary';
import './communication.css';
import { composeSentence, personalForm, spokenTile, suggestSentence } from '../utils/spanish';

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
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const tabs = [['board', Grid2X2, 'Tablero'], ['conversation', MessageSquare, 'Conversación'], ['history', History, 'Historial']];
function Picto({ id }) {
  return <img src={pictogramPath(id)} alt="" draggable="false" width="80" height="80" />;
}
function Credits() {
  return <p className="pictogram-credit">Pictogramas: Sergio Palao · Gobierno de Aragón · <a href="https://arasaac.org" target="_blank" rel="noreferrer">ARASAAC</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA</a></p>;
}

export function CommunicationBoard({ settings = {}, tts, stt, suggestions, loading, onSpeak, onSettings, onRegenerate, history, onClearHistory, voiceLabel, engine }) {
  const [quick, setQuick] = useState(readQuick);
  const [quickText, setQuickText] = useState('');
  const [editingQuick, setEditingQuick] = useState(null);
  const adapt = tile => ({ ...tile, text: personalForm(tile.text, settings.grammaticalForm) });
  const [category, setCategory] = useState('core');
  const [showFolders, setShowFolders] = useState(false);
  const [view, setView] = useState('board');
  const [segments, setSegments] = useState(readDraft);
  const [undo, setUndo] = useState([]);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [notice, setNotice] = useState('');
  const [manageSaved, setManageSaved] = useState(false);
  const [partnerText, setPartnerText] = useState('');
  const input = useRef(null);
  const scrollArea = useRef(null);
  const sentenceStrip = useRef(null);
  const tabButtons = useRef([]);
  const draft = composeSentence(segments);
  const improvedSentence = suggestSentence(segments);
  const heard = [stt.transcript, stt.interimTranscript].filter(Boolean).join(' ');
  const search = normalize(query.trim());
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
    try { sessionStorage.setItem('vocalis_draft', JSON.stringify(segments)); } catch { /* Draft remains available in memory. */ }
    sentenceStrip.current?.scrollTo({ left: sentenceStrip.current.scrollWidth });
  }, [segments]);

  useEffect(() => {
    const onKey = event => {
      if (document.querySelector('[role="dialog"]') || event.target.closest('input, textarea, select, [contenteditable=true]')) return;
      if (event.key === 'Escape') tts.stop();
      if (view === 'conversation' && !loading && /^[1-9]$/.test(event.key) && suggestions[Number(event.key) - 1]) {
        event.preventDefault();
        onSpeak(suggestions[Number(event.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, loading, onSpeak, suggestions, tts]);

  function updateMessage(next) {
    setUndo(previous => [...previous.slice(-39), segments]);
    setSegments(next);
    setNotice('');
  }
  function append(tile) {
    updateMessage([...segments.filter(item => item.text.trim()), { text: tile.text, pictogram: tile.pictogram, connector: tile.connector }]);
    if (settings.speakTiles !== false) {
      if (stt.isListening) stt.stopListening();
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
    if (next !== 'conversation' && stt.isListening) stt.stopListening();
    setView(next);
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function openCategory(id) {
    setCategory(id); setShowFolders(false); setQuery(''); setManageSaved(false);
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function savePhrase() {
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
    if (stt.isListening) stt.stopListening();
    onSettings();
  }

  return <div className={'aac-app' + (pictogramScale >= 1.3 ? ' aac-large-pictograms' : '')} style={pictogramStyle}>
    <header className="aac-header">
      <button className="aac-brand" aria-label="Ir al tablero principal" onClick={() => { changeView('board'); openCategory('core'); }}><Volume2 /> <span>vocalis</span></button>
      <span className="aac-voice-label">{voiceLabel}</span>
      <button className="aac-tool" onClick={openSettings} aria-label="Ajustes y clonar mi voz"><Settings /><span>Ajustes y voz</span></button>
    </header>

    <section className="aac-composer" aria-label="Mi mensaje">
      <div className="aac-message-line">
        <label className="sr-only" htmlFor="message-draft">Escribe tu mensaje</label>
        <textarea id="message-draft" ref={input} rows={2} placeholder="Escribe aquí o toca los pictogramas…" value={draft}
          onChange={event => updateMessage(event.target.value ? [{ text: event.target.value }] : [])}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSpeak(draft); } }} />
        <div className="aac-edit-tools">
          <button className="aac-tool" disabled={!draft} onClick={eraseLast} aria-label="Borrar último elemento"><Delete /><span>Borrar</span></button>
          <button className="aac-tool" disabled={!draft} onClick={() => updateMessage([])} aria-label="Limpiar mensaje"><Trash2 /><span>Limpiar</span></button>
        </div>
        <button className={'aac-speak ' + (tts.isSpeaking ? 'is-speaking' : '')} disabled={!draft.trim() && !tts.isSpeaking} onClick={() => tts.isSpeaking ? tts.stop() : onSpeak(draft)}>
          {tts.isSpeaking ? <CircleStop /> : <Volume2 />}<span>{tts.isSpeaking ? 'Detener' : 'Hablar'}</span>
        </button>
      </div>
      <div className="aac-sentence-row">
        {view === 'board' && <div className="aac-board-actions"><button className="aac-tool" aria-label="Categorías" title="Categorías" aria-pressed={showFolders} onClick={() => { setShowFolders(value => !value); setQuery(''); scrollArea.current?.scrollTo({ top: 0 }); }}><Folder size={20} /><span>Categorías</span></button><label className="aac-search"><Search size={18} /><input aria-label="Buscar palabras y frases" placeholder="Buscar" value={query} onChange={event => { setQuery(event.target.value); setShowFolders(false); }} />{query && <button aria-label="Borrar búsqueda" onClick={() => setQuery('')}><X size={18} /></button>}</label></div>}
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
      <nav className="aac-tabs" role="tablist" aria-label="Modo de comunicación">
        {tabs.map(([id, Icon, label], index) => <button key={id} id={'tab-' + id} role="tab" aria-selected={view === id} aria-controls={'panel-' + id} tabIndex={view === id ? 0 : -1}
          ref={node => { tabButtons.current[index] = node; }} onClick={() => changeView(id)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            changeView(tabs[next][0]); tabButtons.current[next]?.focus();
          }}>
          <Icon size={20} /><span>{label}</span>{id === 'conversation' && stt.isListening && <span className="aac-mic-dot" />}
        </button>)}
      </nav>
      <div className="aac-quick" aria-label="Hablar inmediatamente">
        {quick.map((tile, index) => <button key={index} onClick={() => onSpeak(tile.text, { prepared: true })} aria-label={'Decir: ' + tile.text} className={tile.category === 'priority' ? 'aac-help' : ''}><Picto id={tile.pictogram} /><span>{tile.text}</span><Volume2 size={13} /></button>)}
      </div>
    </div>

    <main className="aac-scroll-area" ref={scrollArea}>
      <section role="tabpanel" id={'panel-' + view} aria-labelledby={'tab-' + view} className="aac-tab-content" tabIndex={0}>
        {view === 'board' && <>
          {(category !== 'core' || showFolders || search) && <div className="aac-board-toolbar">
            <div className="aac-breadcrumb">{(category !== 'core' || showFolders) && <button className="aac-tool" onClick={() => openCategory('core')}><ArrowLeft size={20} /><span>Inicio</span></button>}<h1>{search ? 'Buscar palabras' : showFolders ? 'Categorías' : activeCategory.label}</h1></div>
          </div>}
          {category === 'core' && !search && !showFolders && <button className="aac-tool aac-connectors-link" onClick={() => openCategory('connectors')}>Unir palabras: a, el, la, y…</button>}
          {category !== 'core' && !search && <nav className="aac-core-strip" aria-label="Palabras esenciales">{CORE_STRIP.map(tile => <button key={tile.text} className={'tone-' + tile.category} onClick={() => append(tile)} aria-label={(settings.speakTiles !== false ? 'Añadir y decir: ' : 'Añadir: ') + tile.text}><Picto id={tile.pictogram} /><span>{tile.text}</span></button>)}</nav>}
          {category === 'saved' && !search && <div className="aac-saved-controls"><p>Guarda un mensaje con el corazón. Abajo puedes personalizar las frases rápidas.</p><button className="aac-tool" aria-pressed={manageSaved} onClick={() => setManageSaved(value => !value)}>{manageSaved ? 'Terminar' : 'Organizar frases'}</button></div>}
          <div hidden={showFolders} className="aac-tile-grid" aria-label={search ? 'Resultados' : 'Palabras'}>
            {tiles.map(tile => <div className="aac-tile-wrap" key={tile.text}>
              <button className={'aac-tile tone-' + tile.category} onClick={() => append(tile)} aria-label={(settings.speakTiles !== false ? 'Añadir y decir: ' : 'Añadir: ') + tile.text}>
                {tile.pictogram ? <Picto id={tile.pictogram} /> : <span className="aac-word-symbol" aria-hidden="true">{tile.text}</span>}<span>{tile.text}</span>
              </button>
              {category === 'saved' && !search && manageSaved && <button className="aac-remove-saved" aria-label={'Eliminar frase: ' + tile.text} onClick={() => removePhrase(tile.text)}><Trash2 size={18} /></button>}
            </div>)}
          </div>
          {!showFolders && !tiles.length && <div className="aac-empty"><MessageSquare size={36} /><h2>{search ? 'No hay coincidencias' : 'Tus propias palabras'}</h2><p>{search ? 'Escribe lo que necesitas en el mensaje de arriba.' : 'Escribe una frase y guárdala con el corazón. Aparecerá aquí.'}</p><button className="aac-tool" onClick={() => input.current?.focus()}><Keyboard />Escribir en mi mensaje</button></div>}
          {showFolders && <nav className="aac-folders" aria-label="Categorías">
            {BOARD_CATEGORIES.map(item => <button key={item.id} className={'aac-folder tone-' + item.category} onClick={() => openCategory(item.id)} aria-label={'Abrir: ' + item.label}>
              <Folder className="aac-folder-mark" size={17} /><Picto id={item.pictogram} /><span>{item.label}</span><ChevronRight size={18} />
            </button>)}
          </nav>}
          {category === 'saved' && !search && <details className="aac-quick-editor">
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
          <div className="aac-section-heading"><div><h1>Escucha y responde</h1><p>Escucha a la otra persona. Elige una respuesta o edítala antes de hablar.</p></div></div>
          <section className="aac-hearing" aria-label="Escuchar al interlocutor">
            <div className="aac-hearing-controls"><button className={'aac-listen ' + (stt.isListening ? 'active' : '')} disabled={stt.isTranscribing} onClick={() => { tts.stop(); stt.toggleListening(); }}>{stt.isListening ? <MicOff /> : <Mic />}<span>{stt.isTranscribing ? 'Transcribiendo…' : stt.isListening ? 'Detener escucha' : 'Escuchar'}</span></button>
              <div className="aac-hearing-status" role="status">{stt.isTranscribing ? 'Convirtiendo audio en texto…' : stt.isListening ? (stt.isSpeechDetected ? 'Voz detectada · termina de hablar' : 'Escuchando · empieza a hablar') : 'Micrófono apagado'}{stt.isListening && <meter min="0" max="100" value={stt.audioLevel} aria-label="Nivel del micrófono" />}</div>
            </div>
            <p className="aac-heard" aria-live="polite">{heard || 'Lo que diga tu interlocutor aparecerá aquí.'}</p>
            {stt.error && <p className="aac-error" role="alert">{stt.error}</p>}
            <details className="aac-partner-input"><summary>Escribir o corregir lo que dijo</summary><form onSubmit={event => { event.preventDefault(); if (partnerText.trim()) { stt.simulateSpeech(partnerText); setPartnerText(''); } }}><label htmlFor="partner-text">Mensaje del interlocutor</label><input id="partner-text" value={partnerText} onChange={event => setPartnerText(event.target.value)} placeholder={heard || '¿Qué te han dicho?'} /><button className="aac-tool" disabled={!partnerText.trim()}>Generar respuestas</button></form></details>
          </section>
          <div className="aac-reply-heading"><h2>Podrías decir</h2><button className="aac-tool" disabled={loading || !heard} onClick={() => onRegenerate(heard)}><RotateCcw size={18} />Otras respuestas</button></div>
          {loading && <p className="aac-loading" role="status">Preparando respuestas…</p>}
          {!loading && !suggestions.length && <p className="aac-empty-replies">Activa Escuchar o escribe el mensaje del interlocutor para recibir sugerencias.</p>}
          <div className="aac-replies" aria-busy={loading}>{!loading && suggestions.map((text, index) => <article key={index} className="aac-reply"><button className="aac-reply-speak" onClick={() => onSpeak(text)} aria-label={'Decir respuesta ' + (index + 1) + ': ' + text}><span className="aac-reply-number">{index + 1}</span><span>{text}</span><Volume2 size={22} /></button><button className="aac-reply-edit" onClick={() => { updateMessage([{ text }]); input.current?.focus(); }} aria-label={'Editar respuesta ' + (index + 1)}><Keyboard size={16} />Editar en mi mensaje</button></article>)}</div>
          {suggestions.length > 0 && <p className="aac-conversation-note">El botón de voz habla directamente. «Editar» te permite cambiar la respuesta.{engine === 'heuristic' || engine === 'client-offline' ? ' Se están usando respuestas básicas de respaldo.' : ''}</p>}
        </div>}

        {view === 'history' && <div className="aac-history">
          <div className="aac-section-heading"><div><h1>Historial</h1><p>Recupera un mensaje para volver a decirlo o editarlo.</p></div><button className="aac-tool" disabled={!history.length} onClick={() => { if (window.confirm('¿Borrar el historial de este navegador?')) onClearHistory(); }}><Trash2 size={18} />Borrar historial</button></div>
          {!history.length && <div className="aac-empty"><History size={36} /><h2>Aún no hay mensajes</h2><p>Lo que digas y escuches aparecerá aquí.</p></div>}
          <ol>{[...history].reverse().map((item, index) => <li key={index} className={item.sender === 'user' ? 'aac-history-self' : ''}><div><small>{item.sender === 'user' ? 'Tú' : 'Interlocutor'} · {item.time}</small><p>{item.text}</p></div><button className="aac-icon-tool" aria-label={'Editar mensaje: ' + item.text} onClick={() => { updateMessage([{ text: item.text }]); input.current?.focus(); }}><Keyboard size={20} /></button><button className="aac-icon-tool" aria-label={'Repetir: ' + item.text} onClick={() => onSpeak(item.text)}><Volume2 size={22} /></button></li>)}</ol>
        </div>}
      </section>
    </main>
  </div>;
}
