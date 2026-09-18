import React from 'react';
import { MessageSquare, Volume2, User, Radio, Trash2 } from 'lucide-react';

export function ConversationLog({ history = [], onReplay, onClearHistory }) {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900/40 rounded-xl p-4 border border-slate-800/80">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 m-0">
            Conversation History ({history.length})
          </h3>
        </div>

        <button
          onClick={onClearHistory}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-slate-800"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {history.map((entry, idx) => {
          const isUser = entry.sender === 'user';
          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${
                isUser
                  ? 'bg-blue-950/20 border-blue-500/20 text-blue-100 ml-4 sm:ml-8'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-200 mr-4 sm:mr-8'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {isUser ? 'You (TTS spoken):' : 'Partner said:'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {entry.time || ''}
                  </span>
                </div>
                <p className="m-0 text-sm font-medium leading-relaxed break-words">
                  {entry.text}
                </p>
              </div>

              {/* Replay TTS button for spoken messages */}
              {isUser && onReplay && (
                <button
                  onClick={() => onReplay(entry.text)}
                  title="Replay this phrase out loud"
                  className="shrink-0 p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
