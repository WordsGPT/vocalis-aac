import React from 'react';
import { Mic, MicOff, Sparkles, Trash2, Volume2, RefreshCw, AudioWaveform } from 'lucide-react';

const QUICK_TEST_PROMPTS = [
  "Hey! Do you want to grab some lunch together?",
  "How are you feeling today?",
  "Could you help me move this table?",
  "Would you like some coffee or tea?",
  "What do you think of this idea?"
];

export function ListeningBar({
  isListening,
  onToggleListening,
  transcript,
  interimTranscript,
  onClearTranscript,
  onTriggerSuggestions,
  onSimulateSpeech,
  audioLevel,
  isTranscribing,
  isLoadingSuggestions
}) {
  const displayText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  return (
    <div className="w-full bg-slate-900/60 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl backdrop-blur-sm">
      {/* Top row: Mic button + Visualizer + Quick Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Main Toggle Button */}
          <button
            onClick={onToggleListening}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg cursor-pointer ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25 ring-2 ring-red-400/50'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5 animate-pulse" />
                <span>Pause Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Listening to Partner</span>
              </>
            )}
          </button>

          {/* Live Audio Level indicator */}
          {isListening && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 rounded-lg border border-slate-700/60">
              <div className="flex items-end gap-0.5 h-4 w-12">
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
              <span className="text-[11px] text-slate-400 font-mono">
                {audioLevel > 10 ? 'Audio in' : 'Quiet'}
              </span>
            </div>
          )}
        </div>

        {/* Prompt presets / test pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-1">Demo Prompts:</span>
          {QUICK_TEST_PROMPTS.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onSimulateSpeech(prompt)}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 hover:border-slate-600 transition-colors cursor-pointer"
            >
              "{prompt.slice(0, 18)}..."
            </button>
          ))}
        </div>
      </div>

      {/* Transcript Display Box */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            What the other person is saying:
          </span>
          <div className="flex items-center gap-2">
            {displayText && (
              <button
                onClick={onClearTranscript}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-slate-800"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-[72px] bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 text-left">
          {displayText ? (
            <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed m-0">
              {transcript}
              {interimTranscript && (
                <span className="text-blue-300 italic opacity-85 ml-1">
                  {interimTranscript}
                </span>
              )}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 italic text-sm py-2">
              <AudioWaveform className="w-4 h-4 opacity-50" />
              <span>
                {isListening 
                  ? 'Listening for speech... (speak into mic or select a demo prompt above)' 
                  : 'Microphone paused. Tap "Start Listening" to begin.'}
              </span>
            </div>
          )}

          {/* Whisper transcription in progress badge */}
          {isTranscribing && (
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Whisper GPU Transcribing...</span>
            </div>
          )}
        </div>

        {/* Suggestion trigger button if transcript exists */}
        {displayText && (
          <div className="mt-2.5 flex justify-end">
            <button
              onClick={() => onTriggerSuggestions(displayText)}
              disabled={isLoadingSuggestions}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
              <span>{isLoadingSuggestions ? 'Generating 3 Options...' : 'Update 3 Smart Responses'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
