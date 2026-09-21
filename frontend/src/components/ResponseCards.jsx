import React, { useState, useEffect } from 'react';
import { Volume2, Edit3, RefreshCw, ThumbsUp, Check, HelpCircle, Shuffle, XCircle, Clock, Sparkles } from 'lucide-react';

export function ResponseCards({
  suggestions = [],
  isLoading = false,
  onSelectAndSpeak,
  isSpeaking,
  currentSpeakingText,
  onRegenerate,
  lastHeardText
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState('');

  // Setup keyboard shortcut listener (Keys 1 to suggestions.length)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }
      if (editingIndex !== null) return;

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= suggestions.length && suggestions[num - 1]) {
        e.preventDefault();
        onSelectAndSpeak(suggestions[num - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, onSelectAndSpeak, editingIndex]);

  const handleStartEdit = (idx, text, e) => {
    e.stopPropagation();
    setEditingIndex(idx);
    setEditedText(text);
  };

  const handleSaveAndSpeak = (e) => {
    e?.stopPropagation();
    if (editedText.trim()) {
      onSelectAndSpeak(editedText.trim());
    }
    setEditingIndex(null);
  };

  const CARD_STYLES = [
    {
      role: 'Afirmativo / Aceptar',
      icon: ThumbsUp,
      accent: 'emerald',
      bgClass: 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-400/60',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      hotkeyClass: 'bg-emerald-500 text-slate-950 font-bold',
      speakingBorder: 'border-emerald-400 ring-2 ring-emerald-400/50'
    },
    {
      role: 'De acuerdo / Sí',
      icon: Check,
      accent: 'teal',
      bgClass: 'bg-teal-950/20 hover:bg-teal-950/40 border-teal-500/30 hover:border-teal-400/60',
      badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      hotkeyClass: 'bg-teal-400 text-slate-950 font-bold',
      speakingBorder: 'border-teal-400 ring-2 ring-teal-400/50'
    },
    {
      role: 'Preguntar / Consulta',
      icon: HelpCircle,
      accent: 'sky',
      bgClass: 'bg-sky-950/20 hover:bg-sky-950/40 border-sky-500/30 hover:border-sky-400/60',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      hotkeyClass: 'bg-sky-400 text-slate-950 font-bold',
      speakingBorder: 'border-sky-400 ring-2 ring-sky-400/50'
    },
    {
      role: 'Alternativa / Otra opción',
      icon: Shuffle,
      accent: 'indigo',
      bgClass: 'bg-indigo-950/20 hover:bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400/60',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      hotkeyClass: 'bg-indigo-400 text-slate-950 font-bold',
      speakingBorder: 'border-indigo-400 ring-2 ring-indigo-400/50'
    },
    {
      role: 'Declinar / Límite',
      icon: XCircle,
      accent: 'rose',
      bgClass: 'bg-rose-950/20 hover:bg-rose-950/40 border-rose-500/30 hover:border-rose-400/60',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      hotkeyClass: 'bg-rose-400 text-slate-950 font-bold',
      speakingBorder: 'border-rose-400 ring-2 ring-rose-400/50'
    },
    {
      role: 'Pausa / Pensar',
      icon: Clock,
      accent: 'amber',
      bgClass: 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/30 hover:border-amber-400/60',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      hotkeyClass: 'bg-amber-400 text-slate-950 font-bold',
      speakingBorder: 'border-amber-400 ring-2 ring-amber-400/50'
    }
  ];

  return (
    <div className="w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 m-0">
            Respuestas Inteligentes Sugeridas <span className="text-xs text-slate-500 font-normal lowercase">(Haz clic o pulsa del [1] al [{suggestions.length || 6}] para hablar)</span>
          </h2>
        </div>

        {lastHeardText && (
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Regenerar</span>
          </button>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {isLoading ? (
          // Loading Skeletons
          [...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-slate-900/50 border border-slate-800/80 p-5 flex flex-col justify-between animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="w-16 h-5 rounded-md bg-slate-800" />
                <div className="w-6 h-6 rounded-md bg-slate-800" />
              </div>
              <div className="space-y-2 my-auto">
                <div className="w-full h-4 bg-slate-800 rounded" />
                <div className="w-3/4 h-4 bg-slate-800 rounded" />
              </div>
              <div className="w-20 h-4 bg-slate-800 rounded" />
            </div>
          ))
        ) : suggestions.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
            <p className="text-sm">Aún no hay sugerencias. Habla al micrófono o escribe para generar respuestas inteligentes.</p>
          </div>
        ) : (
          suggestions.map((text, idx) => {
            const style = CARD_STYLES[idx % CARD_STYLES.length];
            const Icon = style.icon;
            const isCardSpeaking = isSpeaking && currentSpeakingText === text;
            const isEditing = editingIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => !isEditing && onSelectAndSpeak(text)}
                className={`relative group flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-150 text-left shadow-lg cursor-pointer select-none min-h-[140px] ${style.bgClass} ${
                  isCardSpeaking ? style.speakingBorder : ''
                }`}
              >
                {/* Top Row: Hotkey Badge & Stance */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center shadow ${style.hotkeyClass}`}>
                      {idx + 1}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${style.badgeClass}`}>
                      <Icon className="w-3 h-3" />
                      {style.role}
                    </span>
                  </div>

                  {/* Edit button */}
                  {!isEditing && (
                    <button
                      onClick={(e) => handleStartEdit(idx, text, e)}
                      title="Editar respuesta antes de hablar"
                      className="opacity-60 group-hover:opacity-100 p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-opacity cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Content text or Edit input */}
                {isEditing ? (
                  <div className="my-auto space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 text-white rounded-lg p-2 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 resize-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveAndSpeak}
                        className="text-xs px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        Hablar Ahora
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base sm:text-lg font-medium text-white leading-snug my-auto tracking-normal">
                    "{text}"
                  </p>
                )}

                {/* Bottom Row: Tap to Speak indicator */}
                {!isEditing && (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/40">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      {isCardSpeaking ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                          <Volume2 className="w-3.5 h-3.5" />
                          Hablando en voz alta...
                        </span>
                      ) : (
                        <span className="group-hover:text-slate-200 transition-colors flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5" />
                          Toca para hablar
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                      Pulsa [{idx + 1}]
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
