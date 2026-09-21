import React from 'react';
import { MessageSquareQuote, Volume2, ShieldAlert } from 'lucide-react';

const ESSENTIAL_PHRASES = [
  { text: "Por favor, dame un momento. Estoy usando un comunicador de voz para responder.", priority: true, label: "Espera un momento" },
  { text: "¡Sí, por supuesto!", label: "Sí" },
  { text: "No, muchas gracias.", label: "No" },
  { text: "¡Muchas gracias por tu paciencia!", label: "Gracias" },
  { text: "¿Podrías repetir eso más despacio, por favor?", label: "Repite por favor" },
  { text: "Entendido, me parece muy bien.", label: "Entendido" },
  { text: "No estoy seguro, déjame pensarlo.", label: "No lo sé" },
  { text: "Disculpa, tengo una pregunta.", label: "Pregunta" },
  { text: "¡Necesito ayuda, por favor!", priority: true, label: "¡Ayuda!" }
];

export function QuickPhrases({ onSelectAndSpeak }) {
  return (
    <div className="w-full bg-slate-900/40 rounded-xl p-3 sm:p-4 border border-slate-800/80">
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <MessageSquareQuote className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Frases Rápidas de Comunicación (Toca para hablar de inmediato)
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESSENTIAL_PHRASES.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectAndSpeak(item.text)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer shadow-sm ${
              item.priority
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30 hover:border-amber-400/50 font-bold'
                : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-700/80 hover:border-slate-600'
            }`}
            title={`Hablar: "${item.text}"`}
          >
            {item.priority && <ShieldAlert className="w-3 h-3 text-amber-400" />}
            <Volume2 className="w-3 h-3 opacity-60" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
