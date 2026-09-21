import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, User, Radio, Trash2, Sparkles, AudioWaveform, RotateCcw, ArrowUp } from 'lucide-react';

const QUICK_TEST_PROMPTS = [
  "¿Quieres tomar un café o prefieres agua?",
  "¿Cómo te encuentras hoy?",
  "¿Te apetece salir a dar un paseo?",
  "¿Quieres que llame a alguien para ayudarte?"
];

export function ConversationStream({
  history = [],
  currentTranscript = '',
  interimTranscript = '',
  isListening,
  onToggleListening,
  onClearCurrent,
  onClearAllHistory,
  onReplay,
  onTriggerSuggestions,
  onSimulateSpeech,
  audioLevel,
  isTranscribing,
  isLoadingSuggestions
}) {
  const scrollContainerRef = useRef(null);
  const activeTurnRef = useRef(null);

  const displayLiveText = (currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  // Auto-scroll to bottom on new messages or speech
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [history, displayLiveText]);

  return (
    <div className="w-full bg-slate-900/70 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
      {/* Top Header: Mic Controls, Visualizer, Demo Prompts, Clear All */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Main Mic Toggle */}
          <button
            onClick={onToggleListening}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 ring-2 ring-red-400/40'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 animate-pulse" />
                <span>Pausar Micrófono</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Escuchar al Interlocutor</span>
              </>
            )}
          </button>

          {/* Audio VU Meter */}
          {isListening && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 rounded-lg border border-slate-700/60">
              <div className="flex items-end gap-0.5 h-3.5 w-10">
                {[1, 2, 3, 4, 5].map((i) => {
                  const threshold = i * 18;
                  const isActive = audioLevel >= threshold;
                  return (
                    <span
                      key={i}
                      className={`flex-1 rounded-sm transition-all duration-75 ${
                        isActive ? 'bg-emerald-400' : 'bg-slate-600/40'
                      }`}
                      style={{
                        height: isActive ? `${Math.max(25, (audioLevel / 100) * 100)}%` : '20%'
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {audioLevel > 10 ? 'Detectando' : 'Silencio'}
              </span>
            </div>
          )}
        </div>

        {/* Demo Prompts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Ejemplos:</span>
          {QUICK_TEST_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onSimulateSpeech(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 hover:border-slate-600 transition-colors cursor-pointer"
            >
              "{prompt.slice(0, 18)}..."
            </button>
          ))}
          {history.length > 0 && (
            <button
              onClick={onClearAllHistory}
              title="Borrar conversación completa"
              className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <Trash2 className="w-3 h-3" />
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Conversation Stream */}
      <div
        ref={scrollContainerRef}
        className="p-4 sm:p-5 overflow-y-auto max-h-[380px] min-h-[180px] space-y-3.5 scroll-smooth"
      >
        {history.length > 2 && (
          <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-600 font-medium">
            <ArrowUp className="w-3 h-3 opacity-60" />
            <span>Mensajes anteriores (desplaza hacia arriba para verlos)</span>
          </div>
        )}

        {/* 1. PAST MESSAGES */}
        {history.map((entry, idx) => {
          const isUser = entry.sender === 'user';
          const isOlder = idx < history.length - 1 || displayLiveText;

          return (
            <div
              key={idx}
              className={`group flex items-start gap-2.5 p-3 rounded-xl border text-sm transition-all duration-200 ${
                isOlder
                  ? 'opacity-50 hover:opacity-100 bg-slate-900/30 border-slate-800/40 text-slate-400'
                  : 'opacity-90 bg-slate-900/60 border-slate-800 text-slate-300'
              } ${isUser ? 'ml-6 sm:ml-12' : 'mr-6 sm:mr-12'}`}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs ${
                  isUser
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                }`}
              >
                {isUser ? <User className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {isUser ? 'Tú (Hablado en voz alta):' : 'El interlocutor dijo:'}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {entry.time || ''}
                  </span>
                </div>
                <p className="m-0 text-sm leading-relaxed font-normal break-words">
                  {entry.text}
                </p>
              </div>

              {/* Replay button on hover */}
              {isUser && onReplay && (
                <button
                  onClick={() => onReplay(entry.text)}
                  title="Repetir esta frase en voz alta"
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-300 transition-opacity cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* 2. CURRENT ACTIVE TURN */}
        <div ref={activeTurnRef} className="pt-1">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-500/40 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  {displayLiveText ? 'El interlocutor está diciendo:' : 'Escuchando al interlocutor...'}
                </span>
              </div>

              {displayLiveText && (
                <button
                  onClick={onClearCurrent}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-slate-800"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar
                </button>
              )}
            </div>

            {displayLiveText ? (
              <p className="text-base sm:text-lg text-white font-semibold leading-relaxed m-0 text-left">
                {currentTranscript}
                {interimTranscript && (
                  <span className="text-blue-300 italic opacity-85 ml-1">
                    {interimTranscript}
                  </span>
                )}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 italic text-sm py-1.5 text-left">
                <AudioWaveform className="w-4 h-4 opacity-40" />
                <span>
                  {isListening
                    ? 'Habla al micrófono o selecciona uno de los ejemplos arriba...'
                    : 'Micrófono pausado. Haz clic en "Escuchar al Interlocutor" para comenzar.'}
                </span>
              </div>
            )}

            {/* Whisper indicator if audio transcribing */}
            {isTranscribing && (
              <div className="mt-2 text-xs text-blue-400 flex items-center gap-1.5 animate-pulse">
                <span>Whisper GPU transcribiendo audio...</span>
              </div>
            )}

            {/* Manual update suggestions trigger */}
            {displayLiveText && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => onTriggerSuggestions(displayLiveText)}
                  disabled={isLoadingSuggestions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                  <span>{isLoadingSuggestions ? 'Generando opciones...' : 'Actualizar 3 Respuestas Inteligentes'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
