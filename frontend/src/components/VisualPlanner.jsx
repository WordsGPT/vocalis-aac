import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, Plus, Trash2, ArrowUp, ArrowDown, Send, Check, X, RotateCcw, MessageSquare, Layers } from 'lucide-react';
import { pictogramPath } from './vocabulary';
import { fetchPlanContinuations } from '../services/api';

export const RECIPIENTS = [
  { id: 'medico', label: 'Médico / Salud', picto: 6561, icon: '🩺', desc: 'Clínica, síntomas, dolor y tratamientos' },
  { id: 'familia', label: 'Familia / Casa', picto: 38351, icon: '🏠', desc: 'Convivencia, afecto, tareas y necesidades del día a día' },
  { id: 'amigo', label: 'Amigo / Social', picto: 25790, icon: '😊', desc: 'Planes, charla distendida, compartir anécdotas y humor' },
  { id: 'tienda', label: 'Tienda / Trámites', picto: 8986, icon: '🛒', desc: 'Compras, servicios, precios y peticiones directas' },
  { id: 'trabajo', label: 'Profesor / Trabajo', picto: 6556, icon: '💼', desc: 'Entorno formal, consultas académicas o laborales' },
  { id: 'general', label: 'Cualquier persona', picto: 34560, icon: '👥', desc: 'Conversaciones cotidianas y temas generales' },
];

const PICTO_CATEGORIES = [
  {
    id: 'health',
    label: 'Salud y Bienestar',
    items: [
      { text: 'Dolor', picto: 5504 },
      { text: 'Cabeza', picto: 2248 },
      { text: 'Estómago', picto: 2304 },
      { text: 'Espalda', picto: 2276 },
      { text: 'Cansado', picto: 2314 },
      { text: 'Descansar', picto: 3299 },
      { text: 'Medicina', picto: 37867 },
      { text: 'Médico', picto: 6561 },
      { text: 'Ayuda', picto: 4570 },
      { text: 'Malestar', picto: 5504 },
    ]
  },
  {
    id: 'needs',
    label: 'Necesidades y Peticiones',
    items: [
      { text: 'Necesito', picto: 37160 },
      { text: 'Quiero', picto: 5441 },
      { text: 'Por favor', picto: 8195 },
      { text: 'Gracias', picto: 8129 },
      { text: 'Espera un momento', picto: 8109 },
      { text: 'Ir al baño', picto: 6929 },
      { text: 'Agua', picto: 2342 },
      { text: 'Comida', picto: 2339 },
      { text: 'Parar', picto: 7196 },
      { text: 'Silencio y calma', picto: 6572 },
    ]
  },
  {
    id: 'questions',
    label: 'Preguntas y Dudas',
    items: [
      { text: '¿Qué?', picto: 22620 },
      { text: '¿Por qué?', picto: 36719 },
      { text: '¿Cuándo?', picto: 32874 },
      { text: '¿Dónde?', picto: 7764 },
      { text: '¿Quién?', picto: 9853 },
      { text: 'Tengo una pregunta', picto: 9847 },
      { text: '¿Cuánto cuesta?', picto: 8986 },
      { text: '¿Podemos hablar?', picto: 6517 },
    ]
  },
  {
    id: 'feelings',
    label: 'Sentimientos y Estados',
    items: [
      { text: 'Estoy contento', picto: 35547 },
      { text: 'Estoy preocupado', picto: 26985 },
      { text: 'Estoy nervioso', picto: 30391 },
      { text: 'Estoy tranquilo', picto: 31310 },
      { text: 'Estoy triste', picto: 35545 },
      { text: 'Me gusta', picto: 7124 },
      { text: 'No me gusta', picto: 5526 },
      { text: 'De acuerdo', picto: 5584 },
      { text: 'No de acuerdo', picto: 5526 },
    ]
  },
  {
    id: 'actions',
    label: 'Planes y Actividades',
    items: [
      { text: 'Salir y pasear', picto: 8142 },
      { text: 'Ir a casa', picto: 2497 },
      { text: 'Comprar', picto: 8986 },
      { text: 'Comer juntos', picto: 2339 },
      { text: 'Charlar con calma', picto: 6517 },
      { text: 'Ahora', picto: 32747 },
      { text: 'Más tarde', picto: 32747 },
    ]
  }
];

export function VisualPlanner({
  recipient = 'medico',
  onSelectRecipient,
  plannedPhrases = [],
  onAddPlannedPhrase,
  onRemovePlannedPhrase,
  onReorderPlannedPhrases,
  onClearPlannedPhrases,
  onSpeak,
  onInsertIntoComposer,
  settings = {},
  tts = {},
}) {
  const [selectedCategory, setSelectedCategory] = useState('health');
  const [selectedItems, setSelectedItems] = useState([]);
  const [continuations, setContinuations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(null);
  const abortControllerRef = useRef(null);

  // Toggle selection of a pictogram
  const handleToggleItem = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.some(p => p.text === item.text);
      if (exists) {
        return prev.filter(p => p.text !== item.text);
      }
      return [...prev, item];
    });
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
    setContinuations([]);
  };

  // Fetch AI continuations based on recipient + selected pictograms
  const handleGenerateContinuations = async () => {
    if (selectedItems.length === 0) return;
    setIsLoading(true);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetchPlanContinuations({
        recipient,
        pictograms: selectedItems.map(item => item.text),
        tone: settings.tone || 'natural',
        grammaticalForm: settings.grammaticalForm || 'masculine',
        userContext: settings.userContext || '',
        count: 5,
        signal: controller.signal,
      });
      if (res?.suggestions) {
        setContinuations(res.suggestions);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching plan continuations:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-suggest when items change if user has selected 2 or more
  useEffect(() => {
    if (selectedItems.length >= 1) {
      const timer = setTimeout(() => {
        handleGenerateContinuations();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setContinuations([]);
    }
  }, [selectedItems, recipient, settings.grammaticalForm, settings.tone]);

  const handleAddPhrase = (text) => {
    if (onAddPlannedPhrase) {
      onAddPlannedPhrase({
        id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        text,
        recipient,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      });
      setCopiedNotice(text);
      setTimeout(() => setCopiedNotice(null), 2500);
    }
  };

  const activeCategoryData = PICTO_CATEGORIES.find(c => c.id === selectedCategory) || PICTO_CATEGORIES[0];
  const activeRecipientData = RECIPIENTS.find(r => r.id === recipient) || RECIPIENTS[0];

  return (
    <div className="aac-planner aac-visual-planner">
      {/* Header */}
      <div className="aac-planner-hero">
        <div className="aac-planner-hero-info">
          <span className="aac-planner-badge">
            <Sparkles size={14} aria-hidden="true" />
            Técnica 1: Selección Visual + Continuaciones con IA
          </span>
          <h1>Plan Visual con Pictogramas</h1>
          <p>
            No necesitas teclear letras. Elige <strong>para quién</strong> es el mensaje y selecciona <strong>imágenes de ideas</strong>. La inteligencia artificial te propondrá frases completas pensadas para esa persona.
          </p>
        </div>
      </div>

      {/* Recipient Selection Bar */}
      <section className="aac-planner-section aac-recipient-section" aria-label="Selección de destinatario">
        <div className="aac-section-title-row">
          <h2>¿Con quién vas a hablar?</h2>
          <span className="aac-section-hint">La IA adaptará el tono y las opciones al destinatario</span>
        </div>
        <div className="aac-recipient-grid" role="radiogroup" aria-label="Destinatario del mensaje">
          {RECIPIENTS.map((rec) => {
            const isSelected = recipient === rec.id;
            return (
              <button
                key={rec.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`aac-recipient-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectRecipient && onSelectRecipient(rec.id)}
              >
                <div className="aac-recipient-picto-wrap">
                  <img src={pictogramPath(rec.picto)} alt="" className="aac-recipient-picto" />
                  <span className="aac-recipient-emoji" aria-hidden="true">{rec.icon}</span>
                </div>
                <div className="aac-recipient-text">
                  <strong>{rec.label}</strong>
                  <span>{rec.desc}</span>
                </div>
                {isSelected && <span className="aac-recipient-check"><Check size={16} /></span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Workspace: Left = Visual Selection & Continuations, Right = Planned Script */}
      <div className="aac-planner-layout">
        <div className="aac-planner-main">
          {/* Pictogram Selection */}
          <section className="aac-planner-section aac-picto-section" aria-label="Selección de pictogramas">
            <div className="aac-section-title-row">
              <h2>1. Selecciona las ideas con imágenes</h2>
              {selectedItems.length > 0 && (
                <button
                  type="button"
                  className="aac-tool aac-tool-small"
                  onClick={handleClearSelection}
                  aria-label="Limpiar selección de pictogramas"
                >
                  <X size={14} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Selected ideas tray */}
            <div className="aac-selected-tray" role="region" aria-label="Ideas seleccionadas">
              <span className="aac-tray-label">Ideas seleccionadas:</span>
              {selectedItems.length === 0 ? (
                <span className="aac-tray-empty">Toca una o varias imágenes de abajo para comenzar tu idea.</span>
              ) : (
                <div className="aac-tray-chips">
                  {selectedItems.map((item, idx) => (
                    <span key={idx} className="aac-tray-chip">
                      <img src={pictogramPath(item.picto)} alt="" width="22" height="22" />
                      <span>{item.text}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item)}
                        aria-label={`Quitar ${item.text}`}
                        title="Quitar"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Category tabs */}
            <div className="aac-picto-category-tabs" role="tablist" aria-label="Categorías de pictogramas">
              {PICTO_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat.id}
                  className={`aac-picto-cat-btn ${selectedCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Pictogram Grid */}
            <div className="aac-picto-picker-grid" role="group" aria-label={activeCategoryData.label}>
              {activeCategoryData.items.map((item, idx) => {
                const isSelected = selectedItems.some(p => p.text === item.text);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`aac-picto-tile ${isSelected ? 'is-picked' : ''}`}
                    onClick={() => handleToggleItem(item)}
                    aria-pressed={isSelected}
                    aria-label={`${item.text}${isSelected ? ' (seleccionado)' : ''}`}
                  >
                    <img src={pictogramPath(item.picto)} alt="" className="aac-picto-img" draggable="false" />
                    <span className="aac-picto-name">{item.text}</span>
                    {isSelected && <span className="aac-tile-picked-dot" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI Continuations Section */}
          <section className="aac-planner-section aac-continuations-section" aria-label="Continuaciones sugeridas por IA">
            <div className="aac-section-title-row">
              <div>
                <h2>2. Frases completas sugeridas por la IA</h2>
                <p className="aac-section-subtitle">
                  Generadas para: <strong>{activeRecipientData.label}</strong>
                  {selectedItems.length > 0 && ` a partir de: «${selectedItems.map(p => p.text).join(', ')}»`}
                </p>
              </div>
              <button
                type="button"
                className="aac-tool aac-generate-prominent aac-refresh-continuations"
                disabled={isLoading || selectedItems.length === 0}
                onClick={handleGenerateContinuations}
                title="Volver a generar opciones"
              >
                {isLoading ? <RotateCcw size={16} className="aac-spin" /> : <Sparkles size={16} />}
                <span>{isLoading ? 'Generando…' : 'Otras frases'}</span>
              </button>
            </div>

            {isLoading && (
              <div className="aac-planner-loading">
                <span className="aac-loading-dot" />
                <span>La IA está elaborando frases naturales para {activeRecipientData.label}…</span>
              </div>
            )}

            {!isLoading && continuations.length === 0 && (
              <div className="aac-planner-empty-hint">
                <Layers size={28} aria-hidden="true" />
                <p>Elige al menos un pictograma arriba para ver frases y continuaciones sugeridas listas para hablar.</p>
              </div>
            )}

            {!isLoading && continuations.length > 0 && (
              <div className="aac-continuations-grid">
                {continuations.map((text, idx) => (
                  <article key={idx} className="aac-continuation-card">
                    <div className="aac-continuation-header">
                      <span className="aac-continuation-index">{idx + 1}</span>
                      <button
                        type="button"
                        className="aac-continuation-listen-btn"
                        onClick={() => onSpeak && onSpeak(text)}
                        title="Escuchar con mi voz"
                        aria-label={`Escuchar: ${text}`}
                      >
                        <Volume2 size={17} />
                        <span>Escuchar</span>
                      </button>
                    </div>
                    <p className="aac-continuation-text">{text}</p>
                    <div className="aac-continuation-actions">
                      <button
                        type="button"
                        className="aac-continuation-add-btn"
                        onClick={() => handleAddPhrase(text)}
                        title="Añadir a mi guion planificado"
                      >
                        <Plus size={16} />
                        <span>Añadir al Guion</span>
                      </button>
                      <button
                        type="button"
                        className="aac-continuation-speak-now-btn"
                        onClick={() => {
                          if (onInsertIntoComposer) onInsertIntoComposer(text);
                          if (onSpeak) onSpeak(text);
                        }}
                        title="Hablar ahora mismo y poner en mi mensaje"
                      >
                        <Send size={15} />
                        <span>Decir ahora</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: Planned Script (Mi Guion Planificado) */}
        <aside className="aac-planned-script-panel" aria-label="Mi Guion Planificado">
          <div className="aac-script-header">
            <div>
              <h3>Mi Guion de Frases</h3>
              <p>{plannedPhrases.length} {plannedPhrases.length === 1 ? 'frase preparada' : 'frases preparadas'}</p>
            </div>
            {plannedPhrases.length > 0 && (
              <button
                type="button"
                className="aac-icon-tool"
                onClick={onClearPlannedPhrases}
                title="Borrar todas las frases del guion"
                aria-label="Borrar guion completo"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {copiedNotice && (
            <div className="aac-script-toast" role="status">
              <Check size={14} />
              <span>Añadido al guion</span>
            </div>
          )}

          {plannedPhrases.length === 0 ? (
            <div className="aac-script-empty">
              <MessageSquare size={32} />
              <h4>Tu guion está vacío</h4>
              <p>Elige sugerencias de la izquierda y pulsa «Añadir al Guion» para ordenar las cosas que quieres decir.</p>
            </div>
          ) : (
            <ol className="aac-script-list">
              {plannedPhrases.map((phrase, idx) => (
                <li key={phrase.id || idx} className="aac-script-item">
                  <div className="aac-script-item-top">
                    <span className="aac-script-num">{idx + 1}</span>
                    <span className="aac-script-rec-tag">Para: {phrase.recipient || 'general'}</span>
                    <div className="aac-script-reorder-tools">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onReorderPlannedPhrases && onReorderPlannedPhrases(idx, idx - 1)}
                        title="Mover arriba"
                        aria-label="Mover arriba"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === plannedPhrases.length - 1}
                        onClick={() => onReorderPlannedPhrases && onReorderPlannedPhrases(idx, idx + 1)}
                        title="Mover abajo"
                        aria-label="Mover abajo"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="aac-script-text">{phrase.text}</p>
                  <div className="aac-script-actions">
                    <button
                      type="button"
                      className="aac-script-speak-btn"
                      onClick={() => onSpeak && onSpeak(phrase.text)}
                      title="Hablar esta frase con mi voz"
                    >
                      <Volume2 size={16} />
                      <span>Hablar</span>
                    </button>
                    <button
                      type="button"
                      className="aac-script-copy-btn"
                      onClick={() => onInsertIntoComposer && onInsertIntoComposer(phrase.text)}
                      title="Poner en mi mensaje de arriba"
                    >
                      <Send size={14} />
                      <span>Al mensaje</span>
                    </button>
                    <button
                      type="button"
                      className="aac-script-remove-btn"
                      onClick={() => onRemovePlannedPhrase && onRemovePlannedPhrase(phrase.id || idx)}
                      title="Eliminar de mi guion"
                      aria-label="Eliminar frase"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {plannedPhrases.length > 0 && (
            <div className="aac-script-footer">
              <button
                type="button"
                className="aac-tool aac-speak-all-btn"
                onClick={() => {
                  const fullText = plannedPhrases.map(p => p.text).join(' ');
                  if (onSpeak) onSpeak(fullText);
                }}
                title="Hablar todas las frases seguidas con mi voz"
              >
                <Volume2 size={18} />
                <span>Hablar todo el guion</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
