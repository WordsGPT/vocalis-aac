import React from 'react';
import { Volume2, Mic, Settings, Radio, Sparkles, VolumeX, LayoutGrid, MessageSquare } from 'lucide-react';

export function Navbar({ 
  isListening, 
  isSpeaking, 
  ttsMode, 
  aiEngine, 
  onOpenSettings,
  onStopSpeech,
  appView = 'flow',
  onToggleAppView
}) {
  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5 sm:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white m-0">Vocalis AAC</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                Speech Assistant
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher (Flow vs AAC Board) */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onToggleAppView('flow')}
            title="Switch to Conversational Flow view"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              appView === 'flow'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Flow</span>
          </button>

          <button
            onClick={() => onToggleAppView('aac-board')}
            title="Switch to Standard AAC Symbol Board view"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              appView === 'aac-board'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>AAC Board</span>
          </button>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Speaking Status Pill */}
          {isSpeaking && (
            <button
              onClick={onStopSpeech}
              title="Click to stop speaking"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-semibold animate-pulse hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Speaking... (Stop)</span>
            </button>
          )}

          {/* Mic Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
            isListening 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-slate-800/80 text-slate-400 border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline">{isListening ? 'Listening' : 'Mic Off'}</span>
          </div>

          {/* AI Engine Badge */}
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="capitalize">{aiEngine || 'Ollama'}</span>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
