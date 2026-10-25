import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, Plus, Play, CheckCircle2, ChevronRight, ChevronLeft, RotateCcw, X, Check, ArrowRight, MessageSquare, ShieldAlert } from 'lucide-react';
import { pictogramPath } from './vocabulary';
import { RECIPIENTS } from './VisualPlanner';
import { fetchGuidedStoryboard } from '../services/api';

const GOAL_PRESETS_BY_RECIPIENT = {
  medico: [
    { id: 'sintoma', label: 'Describir un dolor o síntoma que me preocupa', icon: '🩺' },
    { id: 'medicacion', label: 'Consultar dudas sobre la medicación o dosis', icon: '💊' },
    { id: 'pruebas', label: 'Preguntar por resultados de pruebas médicas', icon: '📋' },
    { id: 'habitos', label: 'Explicar cómo estoy durmiendo o comiendo', icon: '🌙' },
  ],
  familia: [
    { id: 'ayuda', label: 'Pedir ayuda con una tarea o gestión de casa', icon: '🤝' },
    { id: 'hablar', label: 'Hablar de algo personal que me preocupa', icon: '💬' },
    { id: 'plan', label: 'Proponer un plan o paseo juntos este fin de semana', icon: '🚗' },
    { id: 'dia', label: 'Contarles cómo ha ido mi día y cómo me siento', icon: '☀️' },
  ],
  amigo: [
    { id: 'quedar', label: 'Proponer quedar a tomar algo y charlar', icon: '☕' },
    { id: 'anecdota', label: 'Contar una anécdota divertida o curiosa', icon: '😄' },
    { id: 'apoyo', label: 'Desahogarme y pedir su opinión de amigo/a', icon: '👂' },
    { id: 'planes', label: 'Hacer planes para ir al cine, parque o evento', icon: '🎉' },
  ],
  tienda: [
    { id: 'precio', label: 'Preguntar el precio y si tienen más tallas/modelos', icon: '🏷️' },
    { id: 'devolucion', label: 'Hacer una devolución o cambio de producto', icon: '🔄' },
    { id: 'pedir', label: 'Pedir algo específico en un mostrador o restaurante', icon: '🍽️' },
    { id: 'duda', label: 'Preguntar cómo funciona un servicio o garantía', icon: '❓' },
  ],
  trabajo: [
    { id: 'coordinar', label: 'Coordinar una tarea y consultar dudas al equipo', icon: '📊' },
    { id: 'reunion', label: 'Pedir una breve reunión de seguimiento', icon: '📅' },
    { id: 'avance', label: 'Presentar el avance de lo que he estado haciendo', icon: '📑' },
    { id: 'plazo', label: 'Avisar sobre tiempos o pedir una adaptación', icon: '⏱️' },
  ],
  general: [
    { id: 'consulta', label: 'Hacer una consulta o pedir una indicación', icon: '🗺️' },
    { id: 'agradecer', label: 'Agradecer una atención y despedirme cordialmente', icon: '🙏' },
    { id: 'explicar', label: 'Explicar que uso comunicador y necesito paciencia', icon: '🗣️' },
    { id: 'limite', label: 'Decir que no con educación y poner un límite', icon: '🛑' },
  ],
};

export function GuidedPlanner({
  recipient = 'medico',
  onSelectRecipient,
  plannedPhrases = [],
  onAddPlannedPhrase,
  onSpeak,
  onInsertIntoComposer,
  settings = {},
  tts = {},
}) {
  const [activeGoal, setActiveGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [storyboard, setStoryboard] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({}); // stageId -> optionIndex
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [currentLiveStep, setCurrentLiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const abortControllerRef = useRef(null);

  const presets = GOAL_PRESETS_BY_RECIPIENT[recipient] || GOAL_PRESETS_BY_RECIPIENT.general;
  const activeRecipientData = RECIPIENTS.find(r => r.id === recipient) || RECIPIENTS[0];

  // Pick default preset on mount or recipient change
  useEffect(() => {
    if (presets.length > 0 && !activeGoal) {
      setActiveGoal(presets[0].label);
    }
  }, [recipient]);

  const handleGenerateStoryboard = async (goalText) => {
    const goalToUse = goalText || activeGoal || customGoal || presets[0]?.label || 'Conversación guiada';
    setIsLoading(true);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetchGuidedStoryboard({
        recipient,
        goal: goalToUse,
        tone: settings.tone || 'natural',
        grammaticalForm: settings.grammaticalForm || 'masculine',
        userContext: settings.userContext || '',
        signal: controller.signal,
      });

      if (res?.stages) {
        setStoryboard(res.stages);
        // Default each stage to option 0
        const initialSelections = {};
        res.stages.forEach(st => { initialSelections[st.id] = 0; });
        setSelectedOptions(initialSelections);
        setCompletedSteps({});
        setCurrentLiveStep(0);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error generating storyboard:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Generate when recipient or selected preset changes
  useEffect(() => {
    if (activeGoal) {
      handleGenerateStoryboard(activeGoal);
    }
  }, [activeGoal, recipient, settings.grammaticalForm]);

  const handleSelectOptionForStage = (stageId, optionIndex) => {
    setSelectedOptions(prev => ({ ...prev, [stageId]: optionIndex }));
  };

  // Add all selected options to planned phrases library
  const handleAddAllToPlan = () => {
    if (!storyboard || !onAddPlannedPhrase) return;
    storyboard.forEach((stage, idx) => {
      const optIdx = selectedOptions[stage.id] ?? 0;
      const text = stage.options[optIdx];
      if (text) {
        onAddPlannedPhrase({
          id: `guided-${Date.now()}-${idx}`,
          text,
          recipient,
          stage: stage.title,
          time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });
    setToastMessage('¡Las 4 etapas se han añadido a tu Guion!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Live Mode Helpers
  const startLiveMode = () => {
    setIsLiveMode(true);
    setCurrentLiveStep(0);
  };

  const handleLiveSpeakCurrent = () => {
    if (!storyboard) return;
    const stage = storyboard[currentLiveStep];
    if (!stage) return;
    const optIdx = selectedOptions[stage.id] ?? 0;
    const text = stage.options[optIdx];
    if (text && onSpeak) {
      onSpeak(text);
      setCompletedSteps(prev => ({ ...prev, [currentLiveStep]: true }));
    }
  };

  const currentStage = storyboard ? storyboard[currentLiveStep] : null;
  const currentStageText = currentStage ? currentStage.options[selectedOptions[currentStage.id] ?? 0] : '';

  return (
    <div className="aac-planner aac-guided-planner">
      {/* Header */}
      <div className="aac-planner-hero aac-guided-hero">
        <div className="aac-planner-hero-info">
          <span className="aac-planner-badge aac-guided-badge">
            <Sparkles size={14} aria-hidden="true" />
            Técnica 2: Storyboard Conversacional & Modo En Directo
          </span>
          <h1>Guión Guiado por Etapas</h1>
          <p>
            Estructura conversaciones completas en 4 fases naturales: <strong>Saludo y aviso</strong>, <strong>Idea principal</strong>, <strong>Respuestas a preguntas previsibles</strong> y <strong>Cierre</strong>. Todo a 1 toque, con opción de presentación en vivo sin estrés.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div className="aac-script-toast aac-guided-toast" role="status">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Recipient Selection */}
      <section className="aac-planner-section aac-recipient-section" aria-label="Destinatario de la conversación">
        <div className="aac-section-title-row">
          <h2>¿Con quién es la conversación?</h2>
          <span className="aac-section-hint">Selecciona el rol para enfocar las 4 etapas</span>
        </div>
        <div className="aac-recipient-grid" role="radiogroup" aria-label="Destinatario de la conversación">
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

      {/* Goal Selector */}
      <section className="aac-planner-section aac-goal-section" aria-label="Objetivo de la conversación">
        <div className="aac-section-title-row">
          <h2>¿Cuál es el objetivo principal de esta conversación?</h2>
          <span className="aac-section-hint">Toca un objetivo habitual o escribe el tuyo</span>
        </div>
        <div className="aac-goal-chips" role="group" aria-label="Objetivos sugeridos">
          {presets.map((p) => {
            const isSelected = activeGoal === p.label;
            return (
              <button
                key={p.id}
                type="button"
                className={`aac-goal-chip ${isSelected ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveGoal(p.label);
                  setCustomGoal('');
                }}
                aria-pressed={isSelected}
              >
                <span className="aac-goal-chip-icon" aria-hidden="true">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom goal input */}
        <div className="aac-custom-goal-row">
          <input
            type="text"
            className="aac-custom-goal-input"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customGoal.trim()) {
                setActiveGoal(customGoal.trim());
              }
            }}
            placeholder="O escribe otro objetivo diferente (ej. Explicar que prefiero otra cita)..."
            aria-label="Objetivo personalizado"
          />
          <button
            type="button"
            className="aac-tool aac-goal-apply-btn"
            disabled={!customGoal.trim() || isLoading}
            onClick={() => setActiveGoal(customGoal.trim())}
          >
            <Sparkles size={16} />
            <span>Generar Guión</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* NORMAL VIEW: 4-STAGE STORYBOARD CARDS */}
      {/* ========================================================================= */}
      {!isLiveMode && (
        <section className="aac-planner-section aac-storyboard-section" aria-label="Guión estructurado en 4 etapas">
          <div className="aac-storyboard-header-bar">
            <div>
              <h2>Guión Estructurado para {activeRecipientData.label}</h2>
              <p className="aac-section-subtitle">
                Objetivo: <em>«{activeGoal}»</em> · Elige la opción que mejor exprese tu idea en cada etapa.
              </p>
            </div>
            <div className="aac-storyboard-actions">
              <button
                type="button"
                className="aac-tool aac-add-all-plan-btn"
                disabled={!storyboard || isLoading}
                onClick={handleAddAllToPlan}
                title="Añadir estas 4 frases a Mi Guion guardado"
              >
                <Plus size={16} />
                <span>Guardar en Mi Guion</span>
              </button>
              <button
                type="button"
                className="aac-tool aac-live-mode-trigger"
                disabled={!storyboard || isLoading}
                onClick={startLiveMode}
                title="Iniciar la conversación paso a paso en pantalla completa"
              >
                <Play size={17} />
                <span>Iniciar Modo En Directo</span>
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="aac-planner-loading aac-guided-loading">
              <span className="aac-loading-dot" />
              <span>Construyendo el guión conversacional en 4 etapas para {activeRecipientData.label}…</span>
            </div>
          )}

          {!isLoading && storyboard && (
            <div className="aac-storyboard-stages">
              {storyboard.map((stage, sIdx) => {
                const chosenIdx = selectedOptions[stage.id] ?? 0;
                return (
                  <div key={stage.id} className="aac-stage-block">
                    <div className="aac-stage-title-row">
                      <span className="aac-stage-pill">Etapa {sIdx + 1} de 4</span>
                      <h3>{stage.title}</h3>
                      <button
                        type="button"
                        className="aac-stage-refresh-btn"
                        onClick={() => handleGenerateStoryboard(activeGoal)}
                        title="Generar otras 3 opciones para este objetivo"
                        aria-label="Generar nuevas opciones"
                      >
                        <RotateCcw size={14} />
                        <span>Variar</span>
                      </button>
                    </div>

                    <div className="aac-stage-options-grid" role="radiogroup" aria-label={stage.title}>
                      {stage.options.map((optText, oIdx) => {
                        const isChosen = chosenIdx === oIdx;
                        const toneTag = oIdx === 0 ? 'Directa' : oIdx === 1 ? 'Suave' : 'Detallada';
                        return (
                          <div
                            key={oIdx}
                            className={`aac-stage-option-card ${isChosen ? 'is-chosen' : ''}`}
                            onClick={() => handleSelectOptionForStage(stage.id, oIdx)}
                            role="radio"
                            aria-checked={isChosen}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectOptionForStage(stage.id, oIdx); }}
                          >
                            <div className="aac-stage-option-header">
                              <span className="aac-stage-tone-badge">{toneTag}</span>
                              <div className="aac-stage-option-tools">
                                <button
                                  type="button"
                                  className="aac-stage-listen-tool"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSpeak) onSpeak(optText);
                                  }}
                                  title="Escuchar con mi voz"
                                  aria-label="Escuchar frase"
                                >
                                  <Volume2 size={16} />
                                </button>
                                {isChosen && (
                                  <span className="aac-stage-chosen-icon" title="Opción seleccionada">
                                    <CheckCircle2 size={18} />
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="aac-stage-option-text">{optText}</p>
                            <div className="aac-stage-option-footer">
                              <span className="aac-stage-pick-label">
                                {isChosen ? '✓ Seleccionada para el guión' : 'Toca para elegir esta opción'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* LIVE PRESENTATION RUNNER: "MODO EN DIRECTO" */}
      {/* ========================================================================= */}
      {isLiveMode && storyboard && (
        <section className="aac-live-presentation-overlay" aria-label="Modo En Directo - Presentación paso a paso">
          <div className="aac-live-topbar">
            <div className="aac-live-title">
              <span className="aac-live-pulse-dot" />
              <strong>Modo En Directo Activo</strong>
              <span>· Hablando con: {activeRecipientData.label}</span>
            </div>
            <button
              type="button"
              className="aac-tool aac-live-exit-btn"
              onClick={() => setIsLiveMode(false)}
              aria-label="Salir del Modo En Directo"
            >
              <X size={18} />
              <span>Terminar En Directo</span>
            </button>
          </div>

          {/* Step Stepper Indicator */}
          <div className="aac-live-stepper" role="progressbar" aria-valuenow={currentLiveStep + 1} aria-valuemin={1} aria-valuemax={storyboard.length}>
            {storyboard.map((st, idx) => {
              const isCurrent = idx === currentLiveStep;
              const isDone = completedSteps[idx];
              return (
                <button
                  key={st.id}
                  type="button"
                  className={`aac-live-step-node ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                  onClick={() => setCurrentLiveStep(idx)}
                >
                  <span className="aac-live-step-num">
                    {isDone ? <Check size={14} /> : idx + 1}
                  </span>
                  <span className="aac-live-step-label">{st.title.split('.')[1] || st.title}</span>
                </button>
              );
            })}
          </div>

          {/* Current Stage Big Card */}
          <div className="aac-live-card-container">
            <span className="aac-live-card-step-badge">
              Paso {currentLiveStep + 1} de {storyboard.length}: {currentStage?.title}
            </span>
            <div className="aac-live-card-speech-bubble">
              <p className="aac-live-speech-text">{currentStageText}</p>
            </div>

            {/* Giant Speak Button */}
            <button
              type="button"
              className="aac-live-giant-speak-btn"
              onClick={handleLiveSpeakCurrent}
              aria-label="Hablar esta frase con mi voz"
            >
              <Volume2 size={36} aria-hidden="true" />
              <span>HABLAR ESTA FRASE</span>
              {tts.isSpeaking && <span className="aac-live-speaking-wave">Hablando…</span>}
            </button>

            {/* Step navigation controls */}
            <div className="aac-live-nav-row">
              <button
                type="button"
                className="aac-tool aac-live-nav-prev"
                disabled={currentLiveStep === 0}
                onClick={() => setCurrentLiveStep(prev => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={20} />
                <span>Paso anterior</span>
              </button>

              <button
                type="button"
                className="aac-tool aac-live-nav-next"
                disabled={currentLiveStep === storyboard.length - 1}
                onClick={() => {
                  setCompletedSteps(prev => ({ ...prev, [currentLiveStep]: true }));
                  setCurrentLiveStep(prev => Math.min(storyboard.length - 1, prev + 1));
                }}
              >
                <span>Siguiente paso</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Quick Interruption & Safety Bar (Always on screen) */}
          <div className="aac-live-emergency-bar" role="toolbar" aria-label="Respuestas rápidas para emergencias">
            <span className="aac-emergency-label">Interrupciones rápidas:</span>
            <div className="aac-emergency-buttons">
              <button
                type="button"
                className="aac-emergency-btn aac-em-wait"
                onClick={() => onSpeak && onSpeak('Dame un segundo, por favor, estoy buscando mi frase.')}
              >
                ✋ Dame un segundo
              </button>
              <button
                type="button"
                className="aac-emergency-btn aac-em-repeat"
                onClick={() => onSpeak && onSpeak('¿Puedes repetir lo que dijiste, por favor?')}
              >
                🔄 ¿Puedes repetir?
              </button>
              <button
                type="button"
                className="aac-emergency-btn aac-em-yes"
                onClick={() => onSpeak && onSpeak('Sí, de acuerdo.')}
              >
                👍 Sí, de acuerdo
              </button>
              <button
                type="button"
                className="aac-emergency-btn aac-em-no"
                onClick={() => onSpeak && onSpeak('No, ahora mismo no.')}
              >
                👎 No
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
