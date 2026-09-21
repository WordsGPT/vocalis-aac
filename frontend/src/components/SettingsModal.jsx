import React from 'react';
import { X, Volume2, Sparkles, Mic, Sliders, Key, ShieldCheck, Globe } from 'lucide-react';
import { VoiceCloner } from './VoiceCloner';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  browserVoices = [],
  edgeVoices = [],
  onTestVoice,
  onVoiceCloned
}) {
  if (!isOpen) return null;

  return (
    <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="settings-dialog rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-left">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white m-0">Ajustes y Perfil de Voz</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="settings-body p-5 sm:p-6 overflow-y-auto space-y-6 text-sm">
          {/* 1. Voice & TTS Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 m-0">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Voz del Sintetizador (TTS)
              </h3>
              <button
                type="button"
                onClick={onTestVoice}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-pointer font-bold transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Probar Voz
              </button>
            </div>

            {/* TTS Engine Mode */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ttsMode: 'edge-tts' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'edge-tts'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium ring-1 ring-blue-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz clonada / Neural (Recomendado)</div>
                <div className="text-[11px] text-slate-400">Tu voz Qwen o voces Edge de respaldo</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ttsMode: 'browser' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'browser'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium ring-1 ring-blue-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz Nativa del Sistema</div>
                <div className="text-[11px] text-slate-400">Sin internet, voces del navegador</div>
              </button>
            </div>

            {/* Voice dropdown */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Voz seleccionada:</label>
              {settings.ttsMode === 'edge-tts' ? (
                <select
                  value={settings.edgeVoiceId || 'qwen-clone'}
                  onChange={(e) => onUpdateSettings({ edgeVoiceId: e.target.value })}
                  className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
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
                  className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  {browserVoices.length === 0 ? (
                    <option value="">Voz por defecto del sistema</option>
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
                  <span>Velocidad de habla:</span>
                  <span className="font-mono font-bold text-blue-300">{settings.speechRate || 1.0}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={settings.speechRate || 1.0}
                  onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Tono de voz:</span>
                  <span className="font-mono font-bold text-blue-300">{settings.speechPitch || 1.0}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={settings.speechPitch || 1.0}
                  onChange={(e) => onUpdateSettings({ speechPitch: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <VoiceCloner onCloned={onVoiceCloned} />
          </div>

          <hr className="border-slate-800" />

          {/* 2. AI Suggestions Engine */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Motor de Sugerencias Inteligentes IA
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { id: 'groq', label: '⚡ Groq', desc: 'Ultra-rápido (~100ms)' },
                { id: 'ollama', label: 'Ollama', desc: 'Local Gemma 3' },
                { id: 'gemini', label: 'Gemini', desc: 'Google Cloud' },
                { id: 'heuristic', label: 'Heurístico', desc: 'Instantáneo offline' }
              ].map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => onUpdateSettings({ preferredEngine: eng.id })}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    settings.preferredEngine === eng.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-md shadow-indigo-500/10 ring-1 ring-indigo-400'
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
              <label className="block text-xs text-slate-400 mb-1">Personalidad y Tono de Respuesta:</label>
              <select
                value={settings.tone || 'natural'}
                onChange={(e) => onUpdateSettings({ tone: e.target.value })}
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="natural">Natural y Conversacional (Recomendado)</option>
                <option value="casual">Informal, Cercano y Relajado</option>
                <option value="professional">Educado, Formal y Claro</option>
                <option value="concise">Conciso y Directo (3 a 6 palabras)</option>
                <option value="warm">Cálido, Afectuoso y Empático</option>
              </select>
            </div>

            {/* Suggestions Count */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Cantidad de opciones sugeridas:</label>
              <select
                value={settings.suggestionCount || 6}
                onChange={(e) => onUpdateSettings({ suggestionCount: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value={3}>3 opciones (Compacto: Sí, Pregunta, No)</option>
                <option value={4}>4 opciones</option>
                <option value={5}>5 opciones</option>
                <option value={6}>6 opciones (Recomendado: 6 posturas conversacionales completas)</option>
              </select>
            </div>

            {/* Groq API Key */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>Clave de API de Groq (Inferencia Ultra-Rápida):</span>
                </span>
                {settings.groqApiKey && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Activa
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
                <span>Clave opcional de Google Gemini:</span>
              </label>
              <input
                type="password"
                value={settings.geminiApiKey || ''}
                onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 text-white rounded-lg p-2 text-xs border border-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 mb-0">
                Las claves se guardan de forma privada en tu navegador y en tu archivo local .env.
              </p>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 3. Speech Recognition (STT) Settings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Mic className="w-4 h-4 text-emerald-400" />
              Reconocimiento de Voz del Interlocutor (STT)
            </h3>

            {/* Language Selector */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Idioma de Escucha:</span>
              </label>
              <select
                value={settings.sttLang || 'es-ES'}
                onChange={(e) => onUpdateSettings({ sttLang: e.target.value })}
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="es-ES">Español (España - es-ES)</option>
                <option value="es-MX">Español (México - es-MX)</option>
                <option value="es-US">Español (EE. UU. - es-US)</option>
                <option value="en-US">English (United States - en-US)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ sttMode: 'auto' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode === 'auto'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">STT Automático (Híbrido)</div>
                <div className="text-[11px] text-slate-400">Web Speech API nativo + Whisper</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ sttMode: 'whisper' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode === 'whisper'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Whisper GPU Local</div>
                <div className="text-[11px] text-slate-400">Alta precisión por audio local</div>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Pausa de silencio para sugerir respuestas:</span>
                <span className="font-mono font-bold text-emerald-300">{(settings.autoTriggerDelay || 1500) / 1000}s</span>
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
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md transition-colors"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
