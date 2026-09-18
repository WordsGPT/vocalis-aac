import React from 'react';
import { X, Volume2, Sparkles, Mic, Sliders, Key, ShieldCheck } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  browserVoices = [],
  edgeVoices = [],
  onTestVoice
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white m-0">Settings & Voice Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* 1. Voice & TTS Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 m-0">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Text-to-Speech (TTS) Voice
              </h3>
              <button
                type="button"
                onClick={onTestVoice}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                Test Voice
              </button>
            </div>

            {/* TTS Engine Mode */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ttsMode: 'browser' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'browser'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Browser Native</div>
                <div className="text-[11px] text-slate-400">Zero latency, system voices</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ttsMode: 'edge-tts' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'edge-tts'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Neural Edge-TTS</div>
                <div className="text-[11px] text-slate-400">Natural human studio voices</div>
              </button>
            </div>

            {/* Voice dropdown */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Select Voice:</label>
              {settings.ttsMode === 'edge-tts' ? (
                <select
                  value={settings.edgeVoiceId || 'en-US-GuyNeural'}
                  onChange={(e) => onUpdateSettings({ edgeVoiceId: e.target.value })}
                  className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
                >
                  {edgeVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={settings.browserVoiceURI || ''}
                  onChange={(e) => onUpdateSettings({ browserVoiceURI: e.target.value })}
                  className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
                >
                  {browserVoices.length === 0 ? (
                    <option value="">Default System Voice</option>
                  ) : (
                    browserVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang}) {v.default ? '★' : ''}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Sliders for rate and pitch */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Speed:</span>
                  <span className="font-mono">{settings.speechRate || 1.0}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.1"
                  value={settings.speechRate || 1.0}
                  onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pitch:</span>
                  <span className="font-mono">{settings.speechPitch || 1.0}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.1"
                  value={settings.speechPitch || 1.0}
                  onChange={(e) => onUpdateSettings({ speechPitch: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 2. AI Suggestions Engine */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              AI Suggestions Engine
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { id: 'groq', label: '⚡ Groq', desc: 'Ultra-fast ~100ms' },
                { id: 'ollama', label: 'Ollama', desc: 'Local Gemma 3' },
                { id: 'gemini', label: 'Gemini', desc: 'Google Cloud' },
                { id: 'heuristic', label: 'Heuristic', desc: 'Instant offline' }
              ].map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => onUpdateSettings({ preferredEngine: eng.id })}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    settings.preferredEngine === eng.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-md shadow-indigo-500/10'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-xs text-indigo-300">{eng.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{eng.desc}</div>
                </button>
              ))}
            </div>

            {/* Tone Selector */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Response Personality / Tone:</label>
              <select
                value={settings.tone || 'natural'}
                onChange={(e) => onUpdateSettings({ tone: e.target.value })}
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="natural">Natural & Conversational</option>
                <option value="casual">Casual & Relaxed</option>
                <option value="professional">Polite & Professional</option>
                <option value="concise">Concise & Direct (1-3 words)</option>
                <option value="warm">Warm & Empathetic</option>
              </select>
            </div>

            {/* Groq API Key */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>Groq API Key (Ultra-Fast Inference):</span>
                </span>
                {settings.groqApiKey && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Active
                  </span>
                )}
              </label>
              <input
                type="password"
                value={settings.groqApiKey || ''}
                onChange={(e) => onUpdateSettings({ groqApiKey: e.target.value })}
                placeholder="gsk_..."
                className="w-full bg-slate-950 text-white rounded-lg p-2 text-xs border border-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Optional Gemini API Key */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-500" />
                <span>Optional Gemini API Key (for cloud models):</span>
              </label>
              <input
                type="password"
                value={settings.geminiApiKey || ''}
                onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 text-white rounded-lg p-2 text-xs border border-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 mb-0">
                Key is stored only in your local browser and used for smart cloud responses.
              </p>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 3. Speech Recognition (STT) Settings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Mic className="w-4 h-4 text-emerald-400" />
              Speech-to-Text Listening
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ sttMode: 'auto' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode === 'auto'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Auto STT</div>
                <div className="text-[11px] text-slate-400">Web Speech API + Whisper</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ sttMode: 'whisper' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode === 'whisper'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Whisper GPU Only</div>
                <div className="text-[11px] text-slate-400">High accuracy audio upload</div>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Silence trigger delay (before generating suggestions):</span>
                <span className="font-mono">{(settings.autoTriggerDelay || 1500) / 1000}s</span>
              </div>
              <input
                type="range"
                min="800"
                max="3000"
                step="200"
                value={settings.autoTriggerDelay || 1500}
                onChange={(e) => onUpdateSettings({ autoTriggerDelay: parseInt(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
