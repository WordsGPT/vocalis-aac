import React, { useState } from 'react';
import {
  Sparkles,
  Lightbulb,
  Calendar,
  User,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Zap,
  Edit3
} from 'lucide-react';

export function AgentPanel({
  agentLight = { state: 'off', color: 'green', brightness: 100 },
  onToggleLight = () => {},
  calendarEvents = [],
  onAddCalendarEvent = () => {},
  onDeleteCalendarEvent = () => {},
  userContext = '',
  onOpenContextModal = () => {},
  actionLog = [],
  onProcessCommand = () => {},
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState('11:00');
  const [newDesc, setNewDesc] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isLightOn = agentLight.state === 'on';
  const lightColor = agentLight.color || 'green';

  const colorOptions = [
    { id: 'green', label: 'Verde', hex: '#22c55e', bg: 'bg-emerald-500' },
    { id: 'warm white', label: 'Cálido', hex: '#fde047', bg: 'bg-amber-300' },
    { id: 'blue', label: 'Azul', hex: '#3b82f6', bg: 'bg-blue-500' },
    { id: 'red', label: 'Rojo', hex: '#ef4444', bg: 'bg-red-500' },
    { id: 'purple', label: 'Morado', hex: '#a855f7', bg: 'bg-purple-500' },
    { id: 'white', label: 'Blanco', hex: '#f8fafc', bg: 'bg-slate-100' },
  ];

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddCalendarEvent({
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      description: newDesc.trim(),
    });
    setNewTitle('');
    setNewDesc('');
    setIsAddingEvent(false);
  };

  const handleTestCommand = async (cmd) => {
    const textToRun = cmd || commandInput;
    if (!textToRun.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      await onProcessCommand(textToRun.trim());
      setCommandInput('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Color glow dynamic styling for the demo light
  const getLightStyle = () => {
    if (!isLightOn) {
      return {
        background: '#1e293b',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
        color: '#64748b',
        border: '2px solid #334155'
      };
    }
    const colorHexes = {
      green: '#22c55e',
      blue: '#3b82f6',
      red: '#ef4444',
      purple: '#a855f7',
      'warm white': '#fde047',
      yellow: '#eab308',
      white: '#f8fafc'
    };
    const activeHex = colorHexes[lightColor] || '#22c55e';
    return {
      background: activeHex,
      color: '#0f172a',
      border: `2px solid ${activeHex}`,
      boxShadow: `0 0 45px ${activeHex}99, 0 0 15px ${activeHex}cc`
    };
  };

  return (
    <div className="aac-agent-panel p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in text-slate-100 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white m-0">Agente y Herramientas</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Activo
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 m-0">
            El LLM ejecuta llamadas a herramientas en segundo plano, controla dispositivos y actualiza su memoria sobre ti.
          </p>
        </div>

        {/* Quick test runner */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Probar comando: «turn the light on»"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestCommand()}
            className="bg-transparent text-xs text-white px-2.5 py-1.5 focus:outline-none w-full sm:w-56"
          />
          <button
            type="button"
            onClick={() => handleTestCommand()}
            disabled={!commandInput.trim() || isProcessing}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3" />
            <span>Ejecutar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================================================================= */}
        {/* 1. Smart Light Demo Card */}
        {/* ================================================================= */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className={`w-5 h-5 ${isLightOn ? 'text-emerald-400' : 'text-slate-500'}`} />
                <h2 className="text-base font-bold text-white m-0">Luz inteligente (Demo)</h2>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase ${
                isLightOn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {isLightOn ? `ON · ${lightColor}` : 'OFF'}
              </span>
            </div>

            {/* Glowing Lamp Display */}
            <div className="flex flex-col items-center justify-center p-6 my-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl relative overflow-hidden">
              <div
                id="agent-smart-light-bulb"
                style={getLightStyle()}
                className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative cursor-pointer"
                onClick={() => onToggleLight(isLightOn ? 'off' : 'on', 'green')}
                title="Toca para encender/apagar"
              >
                <Lightbulb className={`w-12 h-12 transition-transform duration-300 ${isLightOn ? 'scale-110' : 'scale-90'}`} />
              </div>
              <div className="mt-4 text-center">
                <span className="text-xs font-mono font-bold tracking-wide uppercase text-slate-300">
                  {isLightOn ? `Estado: Encendida (${lightColor})` : 'Estado: Apagada'}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs m-0">
                  Se activa automáticamente cuando el agente escucha o lee <strong className="text-emerald-400">«turn the light on»</strong> o <strong className="text-emerald-400">«enciende la luz»</strong>.
                </p>
              </div>
            </div>

            {/* Color Palette Controls */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-400 mb-2">Color de la luz:</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggleLight('on', c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                      isLightOn && lightColor === c.id
                        ? 'border-white bg-slate-800 text-white shadow-sm ring-1 ring-white/50'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Light Actions & Quick Trigger Chips */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="agent-toggle-light-btn"
                onClick={() => onToggleLight(isLightOn ? 'off' : 'on', 'green')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs cursor-pointer transition-colors shadow-md ${
                  isLightOn
                    ? 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isLightOn ? 'Apagar luz' : 'Encender en verde (turn light on)'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-slate-400">Comandos rápidos:</span>
              <button
                type="button"
                onClick={() => handleTestCommand('turn the light on')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer"
              >
                «turn the light on»
              </button>
              <button
                type="button"
                onClick={() => handleTestCommand('enciende la luz')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer"
              >
                «enciende la luz»
              </button>
              <button
                type="button"
                onClick={() => handleTestCommand('apaga la luz')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                «apaga la luz»
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. Calendar Event Management Demo Card */}
        {/* ================================================================= */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white m-0">Calendario (Demo)</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingEvent(!isAddingEvent)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingEvent ? 'Cancelar' : 'Nuevo evento'}</span>
              </button>
            </div>

            {/* Manual New Event Form */}
            {isAddingEvent && (
              <form onSubmit={handleCreateEvent} className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3 mb-3 space-y-2.5 animate-fade-in">
                <div className="text-xs font-semibold text-blue-300">Añadir evento manual al calendario</div>
                <input
                  type="text"
                  placeholder="Título del evento (ej: Consulta médica)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 text-xs text-white rounded-lg p-2 border border-slate-700"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-slate-900 text-xs text-white rounded-lg p-2 border border-slate-700"
                  />
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-slate-900 text-xs text-white rounded-lg p-2 border border-slate-700"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Detalles o notas opcionales"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 text-xs text-white rounded-lg p-2 border border-slate-700"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Guardar en calendario
                </button>
              </form>
            )}

            {/* Calendar Events List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {calendarEvents.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs m-0">No hay eventos programados todavía.</p>
                  <p className="text-[11px] text-slate-400 mt-1 m-0">
                    Prueba diciendo «añade cita con el médico mañana a las 11:00».
                  </p>
                </div>
              ) : (
                calendarEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-xs text-white truncate">{evt.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          evt.source === 'agent'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {evt.source === 'agent' ? '🤖 Agente' : '👤 Manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-blue-400" />
                          {evt.date}
                        </span>
                        {evt.time && (
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            {evt.time}
                          </span>
                        )}
                      </div>
                      {evt.description && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate m-0">{evt.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteCalendarEvent(evt.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calendar Quick Trigger Chips */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="text-slate-400">Comandos de voz:</span>
            <button
              type="button"
              onClick={() => handleTestCommand('añade cita con el médico mañana a las 11:00')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 cursor-pointer"
            >
              «añade cita con el médico…»
            </button>
            <button
              type="button"
              onClick={() => handleTestCommand('add team meeting tomorrow at 3pm')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 cursor-pointer"
            >
              «add team meeting…»
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. Memory & Editable Context Section */}
      {/* =================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white m-0">Memoria del Agente (Contexto sobre el usuario)</h2>
          </div>
          <button
            type="button"
            id="agent-edit-context-btn"
            onClick={onOpenContextModal}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium cursor-pointer transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar o añadir memoria</span>
          </button>
        </div>

        <p className="text-xs text-slate-300 m-0 leading-relaxed">
          El LLM puede <strong className="text-white">editar y enriquecer su propio contexto</strong> cuando aprende cosas sobre ti durante la conversación (tus gustos, necesidades o alergias).
          Tú puedes consultar, modificar o borrar este contexto en cualquier momento.
        </p>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {userContext?.trim() ? (
            userContext.trim()
          ) : (
            <span className="text-slate-500 italic">
              Aún no hay contexto guardado. Prueba a decirle al agente: «recuerda que soy alérgico a los frutos secos» o «mi nombre es Carlos y me gusta la música clásica».
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 pt-1">
          <span className="text-slate-400">Probar aprendizaje:</span>
          <button
            type="button"
            onClick={() => handleTestCommand('recuerda que soy alérgico a los cacahuetes y prefiero té')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 cursor-pointer"
          >
            «recuerda que soy alérgico…»
          </button>
          <button
            type="button"
            onClick={() => handleTestCommand('remember that I love jazz music')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 cursor-pointer"
          >
            «remember that I love jazz…»
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. Action Log (Audit of Tool Calls) */}
      {/* =================================================================== */}
      {actionLog && actionLog.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white m-0">Historial de herramientas ejecutadas</h3>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {actionLog.slice(0, 10).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-white font-bold">{act.tool}</span>
                  <span className="text-slate-400 text-[11px] truncate max-w-xs">
                    {act.result?.message || JSON.stringify(act.parameters)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {act.timestamp?.slice(11, 19)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
