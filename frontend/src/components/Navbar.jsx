import React from 'react';
import { Settings, Radio, Sparkles, VolumeX, LayoutGrid, MessageSquare } from 'lucide-react';

export function Navbar({ 
  isListening, 
  isSpeaking, 
  _ttsMode, 
  aiEngine, 
  onOpenSettings,
  onStopSpeech,
  appView = 'aac-board',
  onToggleAppView
}) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {/* Logo & Title */}
        <div className="brand">
          <div className="brand__mark">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="brand__name">Vocalis</h1>
            <div className="brand__tagline">COMUNICACIÓN AUMENTATIVA</div>
          </div>
        </div>

        {/* View Mode Switcher (Tablero AAC vs Flujo) */}
        <div className="view-toggle">
          <button
            onClick={() => onToggleAppView('aac-board')}
            title="Vista de Tablero de Comunicación Aumentativa (AAC)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              appView === 'aac-board'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tablero</span>
          </button>

          <button
            onClick={() => onToggleAppView('flow')}
            title="Vista de Flujo de Diálogo Continuo"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              appView === 'flow'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Conversación</span>
          </button>
        </div>

        {/* Status Indicators & Controls */}
        <div className="topbar__actions">
          {/* Speaking Status Pill */}
          {isSpeaking && (
            <button
              onClick={onStopSpeech}
              title="Haz clic para detener la voz"
              className="status-chip flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-semibold animate-pulse hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Detener voz</span>
            </button>
          )}

          {/* Mic Status */}
          <div className={`status-chip flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border ${
            isListening 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-slate-800/80 text-slate-400 border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline">{isListening ? 'Escuchando' : 'En pausa'}</span>
          </div>

          {/* AI Engine Badge */}
          <div className="engine-chip hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="capitalize">{aiEngine || 'Groq'}</span>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="settings-trigger bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 transition-colors cursor-pointer"
            title="Ajustes y Perfil de Voz"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
