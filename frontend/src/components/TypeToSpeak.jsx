import React, { useState } from 'react';
import { Volume2, X } from 'lucide-react';

export function TypeToSpeak({ onSpeakText, _isSpeaking }) {
  const [customText, setCustomText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    onSpeakText(trimmed);
    setCustomText('');
  };

  return (
    <div className="type-panel w-full rounded-xl p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Escribe algo para decirlo en voz alta…"
            className="w-full bg-slate-950/80 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm border border-slate-700/80 focus:outline-none focus:border-blue-500 pr-9 transition-colors"
          />
          {customText && (
            <button
              type="button"
              onClick={() => setCustomText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              title="Borrar texto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!customText.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm transition-colors cursor-pointer shadow-md shadow-blue-600/20 disabled:shadow-none whitespace-nowrap"
        >
          <Volume2 className="w-4 h-4" />
          <span>Hablar</span>
        </button>
      </form>
    </div>
  );
}
