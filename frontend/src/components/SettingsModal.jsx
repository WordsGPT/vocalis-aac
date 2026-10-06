import React, { useEffect, useRef, useState } from 'react';
import { X, Volume2, Sparkles, Mic, Sliders, Key, ShieldCheck, Globe, FileText, Download, Trash2 } from 'lucide-react';
import { VoiceCloner } from './VoiceCloner';
import { PocketCloner } from './PocketCloner';
import { AccessPanel } from './AccessPanel';
import { pictogramPath } from './vocabulary';
import { exportAuditTranscript, clearAuditLogs } from '../services/api';

export function SettingsModal({
  speakerLabels = true,
  isOpen,
  onClose,
  onLogout,
  voiceAuthenticated,
  authRequired = false,
  pocketReady,
  onVoiceLogin,
  settings,
  onUpdateSettings,
  browserVoices = [],
  edgeVoices = [],
  onTestVoice,
  preparationCounts = { frequent: 0, all: 0 },
  onPreparePhrases,
  onCancelPreparation,
  onVoiceCloned,
  onPocketSelected,
  onPocketRemoved,
}) {
  const dialogRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  const [preparingScope, setPreparingScope] = useState(null);
  const [preparationStatus, setPreparationStatus] = useState('');
  const [auditMessage, setAuditMessage] = useState('');
  const [isAuditActionLoading, setIsAuditActionLoading] = useState(false);

  const handleDownloadAudit = async () => {
    setIsAuditActionLoading(true);
    setAuditMessage('Obteniendo registro de auditoría…');
    try {
      const text = await exportAuditTranscript();
      if (!text || !text.trim()) {
        setAuditMessage('No hay registros de auditoría guardados todavía.');
        return;
      }
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_conversacion_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setAuditMessage('Transcripción de auditoría descargada con éxito.');
    } catch {
      setAuditMessage('Error al descargar la auditoría del servidor.');
    } finally {
      setIsAuditActionLoading(false);
    }
  };

  const handleClearAudit = async () => {
    if (!window.confirm('¿Deseas borrar definitivamente los registros de auditoría guardados en el servidor para este dispositivo?')) {
      return;
    }
    setIsAuditActionLoading(true);
    setAuditMessage('Borrando registros del servidor…');
    try {
      await clearAuditLogs();
      setAuditMessage('Registros de auditoría eliminados correctamente del servidor.');
    } catch {
      setAuditMessage('Error al borrar los registros del servidor.');
    } finally {
      setIsAuditActionLoading(false);
    }
  };

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
          {authRequired && (
            <AccessPanel authenticated={voiceAuthenticated} onLogin={onVoiceLogin} onLogout={onLogout} />
          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                id="tts-mode-qwen"
                onClick={() => onUpdateSettings({ ttsMode: 'edge-tts', edgeVoiceId: settings.edgeVoiceId || 'qwen-clone' })}
                disabled={authRequired && !voiceAuthenticated}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'edge-tts' || settings.ttsMode === 'qwen'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium ring-1 ring-blue-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-xs text-blue-300">Qwen3-TTS</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">GPU · Servidor</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">Voz clonada de alta calidad en servidor GPU</div>
              </button>

              <button
                type="button"
                id="tts-mode-pocket"
                onClick={() => onUpdateSettings({ ttsMode: 'pocket' })}
                disabled={!pocketReady}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors disabled:opacity-50 ${
                  settings.ttsMode === 'pocket'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium ring-1 ring-blue-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-xs text-blue-300">Pocket TTS</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">WASM · Local</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">Voz clonada en tu navegador sin servidor</div>
              </button>

              <button
                type="button"
                id="tts-mode-browser"
                onClick={() => onUpdateSettings({ ttsMode: 'browser' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  settings.ttsMode === 'browser'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium ring-1 ring-blue-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-xs text-blue-300">Voz del dispositivo</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">Sistema</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">Voz estándar del navegador o sistema</div>
              </button>
            </div>

            {/* Voice dropdown */}
            {(settings.ttsMode === 'edge-tts' || settings.ttsMode === 'qwen') && (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Voz del servidor seleccionada:</label>
                <select
                  value={settings.edgeVoiceId || 'qwen-clone'}
                  onChange={(e) => onUpdateSettings({ edgeVoiceId: e.target.value })}
                  className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="qwen-clone">⭐ Mi voz clonada con Qwen3-TTS (GPU)</option>
                  {edgeVoices.filter(v => v.id !== 'qwen-clone').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {settings.ttsMode === 'browser' && (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Voz del dispositivo seleccionada:</label>
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
              </div>
            )}

            {/* Sliders for rate and pitch */}
            {settings.ttsMode !== 'pocket' && <div className="grid grid-cols-2 gap-4">
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
            </div>}

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

            {/* Cloner section for selected engine */}
            {(settings.ttsMode === 'edge-tts' || settings.ttsMode === 'qwen') && (
              <VoiceCloner
                onCloned={(voiceId) => {
                  onUpdateSettings({ edgeVoiceId: voiceId || 'qwen-clone' });
                  onVoiceCloned?.(voiceId || 'qwen-clone');
                }}
                authenticated={voiceAuthenticated}
                authRequired={authRequired}
                isQwen={true}
              />
            )}

            {settings.ttsMode === 'pocket' && (
              <>
                <PocketCloner available={pocketReady} onSelected={onPocketSelected} onRemoved={onPocketRemoved} />
                {!pocketReady && <p className="text-xs text-slate-400 mt-2">Este navegador no admite Pocket TTS.</p>}
              </>
            )}
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

            {/* User Personal Context / Details */}
            <div className="mb-1">
              <label htmlFor="user-context" className="block text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Sobre mí (contexto para la IA):</span>
                <span className="text-[11px] text-slate-500">Opcional</span>
              </label>
              <textarea
                id="user-context"
                rows={4}
                maxLength={2000}
                value={settings.userContext || ''}
                onChange={(e) => onUpdateSettings({ userContext: e.target.value })}
                placeholder="Ej.: Me llamo Clara. Tengo 24 años. Vivo en Valencia. Estudio informática. Tengo un perro que se llama Toby. Me encanta la pizza pero no el picante."
                className="w-full bg-slate-950 text-white rounded-lg p-2.5 border border-slate-700 text-xs focus:outline-none focus:border-indigo-500 font-medium resize-y placeholder:text-slate-600 leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Escribe aquí tu nombre, gustos, familia, mascotas o cualquier detalle para que las sugerencias respondan con tu información real.
              </p>
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
                <div className="font-semibold text-xs text-emerald-300 mb-0.5">Escucha de conversación</div>
                <div className="text-[11px] text-slate-400">{speakerLabels ? 'Distingue voces y propone respuestas en las pausas. Sigue escuchando hasta que lo detengas.' : 'Transcribe la conversación y propone respuestas en las pausas. Sigue escuchando hasta que lo detengas.'}</div>
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
                <div className="text-[11px] text-slate-400">{speakerLabels ? 'Texto inmediato del navegador, sin distinguir voces' : 'Texto inmediato con el reconocimiento del navegador'}</div>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Pausa de silencio para sugerir respuestas:</span>
                <span className="font-mono font-bold text-emerald-300">{((settings.autoTriggerDelay || 1000) / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="600"
                max="3000"
                step="100"
                value={settings.autoTriggerDelay || 1000}
                onChange={(e) => onUpdateSettings({ autoTriggerDelay: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Conversation Audit & Privacy Section */}
          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/50 space-y-3" id="audit-settings-section">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 m-0">
                <FileText className="w-4 h-4 text-emerald-400" />
                Auditoría y registro en servidor
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                settings.auditLogging
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {settings.auditLogging ? 'Registro activo' : 'Desactivado (por defecto)'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed m-0">
              Permite guardar las intervenciones de la conversación en el servidor para su posterior auditoría clínica o personal.
              Por motivos de privacidad, esta opción es <strong className="text-white">estrictamente voluntaria (opt-in)</strong> y permanece desactivada a menos que la actives expresamente.
            </p>

            <label
              htmlFor="audit-logging-toggle"
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-colors cursor-pointer select-none"
            >
              <input
                id="audit-logging-toggle"
                type="checkbox"
                checked={Boolean(settings.auditLogging)}
                onChange={(e) => onUpdateSettings({ auditLogging: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-xs text-white">
                  Guardar registro de conversación en el servidor para auditoría
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Al activarse, cada turno (hablado por ti o transcrito de tu interlocutor) se registrará de forma segura en el servidor.
                </div>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                id="audit-download-btn"
                onClick={handleDownloadAudit}
                disabled={isAuditActionLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 cursor-pointer font-medium transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar transcripción de auditoría
              </button>

              <button
                type="button"
                id="audit-clear-btn"
                onClick={handleClearAudit}
                disabled={isAuditActionLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/30 cursor-pointer font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Borrar registros del servidor
              </button>
            </div>

            {auditMessage && (
              <div className="text-xs text-slate-300 bg-slate-950/60 rounded-lg px-3 py-1.5 border border-slate-800 animate-fade-in font-mono">
                {auditMessage}
              </div>
            )}
          </div>

          <details className="settings-advanced"><summary>Ajustes avanzados</summary><div className="space-y-4 pt-4"><h3>Motor de respuestas</h3>            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { id: 'groq', label: 'Groq', desc: 'Respuestas en la nube' },
                { id: 'gemini', label: 'Gemini', desc: 'Google Cloud' },
                { id: 'heuristic', label: 'Respuestas básicas', desc: 'Sin esperar a la IA' }
              ].map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => onUpdateSettings({ preferredEngine: eng.id })}
                  disabled={authRequired && !voiceAuthenticated && eng.id === 'gemini'}
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

            <p className="text-xs text-slate-400">Groq genera respuestas sin iniciar sesión. Gemini 3.8 Flash y su voz requieren iniciar sesión. Las claves API se configuran en el servidor.</p>
            {settings.edgeVoiceId?.startsWith('voice_') && (
              <div className="text-xs text-slate-400">ID de voz personal: <code>{settings.edgeVoiceId}</code></div>
            )}
            <label className="block text-xs text-slate-400">Usar un ID de voz personal guardado en otro dispositivo</label>
            <input type="text" placeholder="voice_..." value={settings.edgeVoiceId?.startsWith('voice_') ? settings.edgeVoiceId : ''}
              onChange={(e) => { if (!e.target.value || /^voice_[A-Za-z0-9_-]+$/.test(e.target.value)) onUpdateSettings({ edgeVoiceId: e.target.value || 'Puck' }); }}
              className="w-full bg-slate-950 text-white rounded-lg p-2 text-xs border border-slate-700" />
            </div></details>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-between">
<span />
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
