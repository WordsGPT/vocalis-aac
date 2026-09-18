import React from 'react';
import { MessageSquareQuote, Volume2, ShieldAlert } from 'lucide-react';

const ESSENTIAL_PHRASES = [
  { text: "Please give me a moment, I'm using a communication app.", priority: true, label: "Wait a moment" },
  { text: "Yes, definitely.", label: "Yes" },
  { text: "No, thank you.", label: "No" },
  { text: "Thank you very much!", label: "Thank you" },
  { text: "Could you please repeat that for me?", label: "Please repeat" },
  { text: "I understand, thank you.", label: "I understand" },
  { text: "I'm not sure.", label: "Not sure" },
  { text: "Excuse me.", label: "Excuse me" }
];

export function QuickPhrases({ onSelectAndSpeak }) {
  return (
    <div className="w-full bg-slate-900/40 rounded-xl p-3 sm:p-4 border border-slate-800/80">
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <MessageSquareQuote className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick AAC Phrases (Instant Tap & Speak)
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESSENTIAL_PHRASES.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectAndSpeak(item.text)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer shadow-sm ${
              item.priority
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30 hover:border-amber-400/50'
                : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-700/80 hover:border-slate-600'
            }`}
            title={`Speak: "${item.text}"`}
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
