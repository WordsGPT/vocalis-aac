import React, { useEffect, useRef, useState } from 'react';
import { X, Volume2, Sparkles, Mic, Sliders, Key, ShieldCheck, Globe } from 'lucide-react';
import { VoiceCloner } from './VoiceCloner';
import { pictogramPath } from './vocabulary';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  browserVoices = [],
  edgeVoices = [],
  onTestVoice,
  preparationCounts = { frequent: 0, all: 0 },
  onPreparePhrases,
  onCancelPreparation,
  onVoiceCloned
}) {
  const dialogRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  const [preparingScope, setPreparingScope] = useState(null);
  const [preparationStatus, setPreparationStatus] = useState('');
  const pictogramSize = Math.min(160, Math.max(70, Number(settings.pictogramSize) || 100));
  const preparePhrases = async (scope) => {
    setPreparing(true);
    setPreparingScope(scope);
    setPreparationStatus(scope === 'all' ? 'Preparando todo el tablero…' : 'Preparando frases frecuentes…');
    try {
      const result = await onPreparePhrases(scope, (completed, total) => setPreparationStatus(`Preparadas ${completed} de ${total} frases…`));
      setPreparationStatus(result.cancelled
        ? `Preparación detenida. ${result.completed} frases listas.`
        : result.failed
          ? `Preparadas ${result.completed} de ${result.total}. No se pudo continuar; comprueba la voz y el espacio disponible.`
          : `Listas ${result.completed} de ${result.total} frases para reproducir al instante.`);
    } catch {
      setPreparationStatus('No se pudieron preparar las frases. Comprueba la conexión de voz.');
    } finally {
      setPreparing(false);
      setPreparingScope(null);
    }
  };
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', handleKey);
    return () => { dialog?.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  return (
    <div className="settings-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-settings-title" tabIndex={-1} className="settings-dialog rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-left">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 id="voice-settings-title" className="text-lg font-bold text-white m-0">Ajustes y voz</h2>
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
          <div>
            <label htmlFor="grammatical-form" className="block text-sm font-semibold mb-2">Cómo hablo de mí</label>
            <select id="grammatical-form" className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700" value={settings.grammaticalForm || 'masculine'} onChange={event => onUpdateSettings({ grammaticalForm: event.target.value })}>
              <option value="masculine">Masculino: estoy cansado</option>
              <option value="feminine">Femenino: estoy cansada</option>
            </select>
            <p className="text-xs text-slate-400 mt-2">Se aplica al tablero y a las nuevas respuestas sugeridas. Tus mensajes escritos y guardados conservan tus palabras.</p>
          </div>
          {/* 1. Voice & TTS Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 m-0">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Mi voz
              </h3>
              <button
                type="button"
                onClick={onTestVoice}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-pointer font-bold transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Probar voz
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
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz personal o del catálogo</div>
                <div className="text-[11px] text-slate-400">Elige tu voz guardada u otra voz</div>
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
                <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz del dispositivo</div>
                <div className="text-[11px] text-slate-400">Usa las voces disponibles en este dispositivo</div>
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

            <div className="mt-4 rounded-xl border border-slate-700 p-3 bg-slate-800/60">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label htmlFor="pictogram-size" className="font-semibold text-sm text-slate-200">Tamaño de casillas</label>
                <output htmlFor="pictogram-size" className="font-semibold text-blue-300">{pictogramSize}%</output>
              </div>
              <div className="flex items-center gap-4">
                <input id="pictogram-size" type="range" min="70" max="160" step="10" value={pictogramSize}
                  onChange={(event) => onUpdateSettings({ pictogramSize: Number(event.target.value) })}
                  aria-describedby="pictogram-size-help" className="flex-1 min-w-0 accent-blue-600 cursor-pointer" />
                <div className="shrink-0 flex flex-col items-center justify-between rounded-lg border-2 border-amber-500 bg-amber-50 p-1 text-slate-800"
                  style={{ width: Math.round(75 * pictogramSize / 100), height: Math.round(85 * pictogramSize / 100) }} aria-hidden="true">
                  <img src={pictogramPath(5441)} alt="" draggable="false" width={Math.round(48 * pictogramSize / 100)} height={Math.round(48 * pictogramSize / 100)} className="max-w-full object-contain" />
                  <span style={{ fontSize: Math.max(10, Math.round(12 * pictogramSize / 100)) }} className="font-semibold leading-tight">Quiero</span>
                </div>
              </div>
              <p id="pictogram-size-help" className="text-xs text-slate-400 mt-2 mb-0">Cambia el tamaño de las casillas completas, imágenes y texto. Las casillas pequeñas permiten ver más palabras por fila.</p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-700 p-3 bg-slate-800/60">
              <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-200">
                <input type="checkbox" checked={settings.speakTiles !== false}
                  onChange={(event) => onUpdateSettings({ speakTiles: event.target.checked })}
                  className="mt-1 accent-blue-600" />
                <span><strong>Leer pictogramas al tocarlos</strong><br />Cada toque añade y dice esa palabra o frase. «Hablar» dice el mensaje completo con entonación natural.</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button type="button" onClick={() => preparePhrases('frequent')} disabled={preparing || settings.ttsMode === 'browser'}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">
                  {preparingScope === 'frequent' ? 'Preparando…' : `Preparar frecuentes (${preparationCounts.frequent})`}
                </button>
                <button type="button" onClick={() => preparePhrases('all')} disabled={preparing || settings.ttsMode === 'browser'}
                  className="px-3 py-2 rounded-lg border border-blue-500 text-blue-800 font-semibold disabled:opacity-50">
                  {preparingScope === 'all' ? 'Preparando todo…' : `Preparar todo el tablero (${preparationCounts.all})`}
                </button>
                {preparing && <button type="button" onClick={() => onCancelPreparation?.()}
                  className="px-3 py-2 rounded-lg border border-slate-600 text-slate-200">Detener</button>}
              </div>
              <p className="text-xs text-slate-400 mt-2 mb-0">Las frases rápidas van primero. Preparar todo incluye palabras, frases del tablero y tus frases guardadas; puede tardar bastante y necesita espacio en este dispositivo. Puedes detenerlo y reanudarlo después. Se interrumpe al hablar.</p>
              {preparationStatus && <p className="text-xs text-slate-300 mt-2 mb-0" role="status">{preparationStatus}</p>}
            </div>

            <VoiceCloner onCloned={onVoiceCloned} />
          </div>

          <hr className="border-slate-800" />

          {/* 2. AI Suggestions Engine */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Respuestas sugeridas
            </h3>

            {/* Tone Selector */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Estilo de las respuestas:</label>
              <select
                value={settings.tone || 'natural'}
                onChange={(e) => onUpdateSettings({ tone: e.target.value })}
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="natural">Natural (recomendado)</option>
                <option value="casual">Informal y cercano</option>
                <option value="professional">Formal y claro</option>
                <option value="concise">Breve y directo</option>
                <option value="warm">Cálido y afectuoso</option>
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
                <option value={3}>3 opciones</option>
                <option value={4}>4 opciones</option>
                <option value={5}>5 opciones</option>
                <option value={6}>6 opciones</option>
              </select>
            </div>


          </div>

          <hr className="border-slate-800" />

          {/* 3. Speech Recognition (STT) Settings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3 m-0">
              <Mic className="w-4 h-4 text-emerald-400" />
              Escuchar a la otra persona
            </h3>

            {/* Language Selector */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Idioma de escucha:</span>
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
                onClick={() => onUpdateSettings({ sttMode: 'whisper' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode !== 'browser'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Automático (recomendado)</div>
                <div className="text-[11px] text-slate-400">Detecta cuándo habla la otra persona y escribe al terminar</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ sttMode: 'browser' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.sttMode === 'browser'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium ring-1 ring-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Texto en directo</div>
                <div className="text-[11px] text-slate-400">Más inmediato, pero depende del navegador</div>
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
          <details className="settings-advanced"><summary>Ajustes avanzados</summary><div className="space-y-4 pt-4"><h3>Motor de respuestas</h3>            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { id: 'groq', label: 'Groq', desc: 'Respuestas en la nube' },
                { id: 'ollama', label: 'Ollama', desc: 'Local Gemma 3' },
                { id: 'gemini', label: 'Gemini', desc: 'Google Cloud' },
                { id: 'heuristic', label: 'Respuestas básicas', desc: 'Sin esperar a la IA' }
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

            {settings.ttsMode === 'edge-tts' && (settings.edgeVoiceId || 'qwen-clone') === 'qwen-clone' && (
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1.5">Motor de la voz clonada:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ qwenEngine: 'streaming' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      settings.qwenEngine === 'streaming'
                        ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-400'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz rápida</div>
                    <div className="text-[11px] text-slate-400">Empieza a hablar mientras genera</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ qwenEngine: 'standard' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      settings.qwenEngine === 'standard'
                        ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-400'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-xs text-blue-300 mb-0.5">Voz estándar</div>
                    <div className="text-[11px] text-slate-400">Prepara el mensaje completo antes de hablar</div>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 mb-0">Ambos motores usan la misma voz guardada en este dispositivo.</p>
              </div>
            )}

            {/* Groq API Key */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>Clave de API de Groq:</span>
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
            </div></div></details>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md transition-colors"
          >
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
