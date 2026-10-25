import { useRef, useState } from 'react';
import { Sparkles, Lightbulb, Calendar, User, Plus, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';

const colors = [
  ['green', 'Verde', '#57ad7b'], ['warm white', 'Cálido', '#eac96b'],
  ['blue', 'Azul', '#6498e0'], ['red', 'Rojo', '#dc737b'],
  ['purple', 'Morado', '#aa85d4'], ['white', 'Blanco', '#f1f2f6'],
];
function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function AgentPanel({
  agentLight = { state: 'off', color: 'green', brightness: 100 },
  onToggleLight = () => {}, calendarEvents = [], onAddCalendarEvent = () => {},
  onDeleteCalendarEvent = () => {}, userContext = '', onOpenContextModal = () => {},
  actionLog = [], onProcessCommand = () => {},
}) {
  const [commandInput, setCommandInput] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [feedback, setFeedback] = useState(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(tomorrow);
  const [newTime, setNewTime] = useState('11:00');
  const [newDesc, setNewDesc] = useState('');
  const eventTrigger = useRef(null);
  const isLightOn = agentLight.state === 'on';
  const lightColor = agentLight.color || 'green';
  const selectedColor = colors.find(([id]) => id === lightColor) || colors[0];

  async function run(action, success, after) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await action();
      if (!result || result.status === 'error') throw new Error('request failed');
      setFeedback({ text: success || result.message || 'Solicitud procesada.', error: false });
      after?.();
    } catch {
      setFeedback({ text: 'No se pudo completar la acción. Comprueba la conexión e inténtalo de nuevo.', error: true });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function command(text) {
    if (!text.trim()) return;
    run(() => onProcessCommand(text.trim()), '', () => setCommandInput(''));
  }
  function closeEventForm() {
    setIsAddingEvent(false);
    eventTrigger.current?.focus();
  }

  return <div className="aac-agent-panel">
    <div className="aac-section-heading"><div><h1>Agente y herramientas</h1><p>Pequeñas ayudas para tu día a día.</p></div><span className="aac-demo-label">Espacio de demostración</span></div>
    <form className="aac-command" onSubmit={event => { event.preventDefault(); command(commandInput); }}>
      <label htmlFor="agent-command"><Sparkles size={18} />¿En qué te ayudo?</label>
      <div><input id="agent-command" value={commandInput} onChange={event => setCommandInput(event.target.value)} placeholder="Por ejemplo: enciende la luz" disabled={pending} /><button className="aac-primary" disabled={pending || !commandInput.trim()}>{pending ? 'Procesando…' : 'Enviar'}<ArrowRight size={18} /></button></div>
      <p>Puedes pedir cambios en la luz, añadir una cita o recordar algo sobre ti.</p>
    </form>
    {feedback && <p className={feedback.error ? 'aac-error' : 'aac-notice'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    <div className="aac-agent-grid">
      <section className="aac-agent-card" aria-labelledby="agent-light-title">
        <div className="aac-card-heading"><h2 id="agent-light-title"><Lightbulb size={20} />Luz inteligente</h2><span className="aac-demo-label">Demo</span></div>
        <div className="aac-light-preview">
          <button type="button" id="agent-smart-light-bulb" aria-label={isLightOn ? 'Apagar luz de demostración' : 'Encender luz de demostración'} aria-pressed={isLightOn} disabled={pending}
            style={{ '--light-color': isLightOn ? selectedColor[2] : '#e8eaf2' }}
            onClick={() => run(() => onToggleLight(isLightOn ? 'off' : 'on', lightColor), isLightOn ? 'Luz apagada.' : 'Luz encendida.')}><Lightbulb size={40} /></button>
          <strong>{isLightOn ? 'Encendida · ' + selectedColor[1] : 'Luz apagada'}</strong><p>Una luz virtual para probar tus comandos.</p>
        </div>
        <div className="aac-light-colors" role="group" aria-label="Color de la luz">{colors.map(([id, label, hex]) => <button key={id} className="aac-tool" type="button" aria-pressed={isLightOn && lightColor === id} disabled={pending} onClick={() => run(() => onToggleLight('on', id), 'Color actualizado.')}><span style={{ background: hex }} />{label}</button>)}</div>
        <button type="button" id="agent-toggle-light-btn" className="aac-tool aac-full-width" disabled={pending} onClick={() => run(() => onToggleLight(isLightOn ? 'off' : 'on', lightColor), isLightOn ? 'Luz apagada.' : 'Luz encendida.')}>{isLightOn ? 'Apagar luz' : 'Encender luz'}</button>
      </section>
      <section className="aac-agent-card" aria-labelledby="agent-calendar-title">
        <div className="aac-card-heading"><h2 id="agent-calendar-title"><Calendar size={20} />Calendario</h2><button ref={eventTrigger} className="aac-tool" type="button" aria-expanded={isAddingEvent} aria-controls="agent-event-form" onClick={() => setIsAddingEvent(value => !value)}><Plus size={16} />{isAddingEvent ? 'Cancelar' : 'Nuevo evento'}</button></div>
        {isAddingEvent && <form id="agent-event-form" className="aac-event-form" onSubmit={event => { event.preventDefault(); if (newTitle.trim()) run(() => onAddCalendarEvent({ title: newTitle.trim(), date: newDate, time: newTime, description: newDesc.trim() }), 'Evento guardado.', () => { setNewTitle(''); setNewDesc(''); closeEventForm(); }); }}>
          <label htmlFor="event-title">Título</label><input autoFocus id="event-title" value={newTitle} onChange={event => setNewTitle(event.target.value)} required maxLength={200} placeholder="Por ejemplo: Consulta médica" />
          <div className="aac-event-date"><div><label htmlFor="event-date">Fecha</label><input id="event-date" type="date" value={newDate} onChange={event => setNewDate(event.target.value)} required /></div><div><label htmlFor="event-time">Hora</label><input id="event-time" type="time" value={newTime} onChange={event => setNewTime(event.target.value)} /></div></div>
          <label htmlFor="event-notes">Notas <span>(opcional)</span></label><input id="event-notes" value={newDesc} onChange={event => setNewDesc(event.target.value)} />
          <button className="aac-primary" disabled={pending || !newTitle.trim()}>{pending ? 'Guardando…' : 'Guardar en calendario'}</button>
        </form>}
        {!calendarEvents.length && !isAddingEvent && <div className="aac-calendar-empty"><Calendar size={32} /><h3>Tu agenda, con espacio</h3><p>Añade tu primera cita para tenerla a mano.</p></div>}
        <ol className="aac-events">{calendarEvents.map(event => <li key={event.id}><div><strong>{event.title}</strong><span>{event.date}{event.time ? ' · ' + event.time : ''}</span>{event.description && <p>{event.description}</p>}</div><button type="button" className="aac-icon-tool" disabled={pending} aria-label={'Eliminar evento: ' + event.title} onClick={() => { if (window.confirm('¿Eliminar «' + event.title + '» del calendario?')) run(() => onDeleteCalendarEvent(event.id), 'Evento eliminado.'); }}><Trash2 size={18} /></button></li>)}</ol>
        <p className="aac-card-note">Los eventos se guardan en el calendario de demostración de Vocalis.</p>
      </section>
    </div>
    <section className="aac-agent-card" aria-labelledby="agent-memory-title">
      <div className="aac-card-heading"><h2 id="agent-memory-title"><User size={20} />Sobre ti</h2><button type="button" id="agent-edit-context-btn" className="aac-tool" onClick={onOpenContextModal}>Editar contexto</button></div>
      <p className="aac-card-note">Tus preferencias ayudan a personalizar las respuestas. El agente también puede actualizarlas durante la conversación; puedes revisarlas y corregirlas aquí.</p>
      <div className="aac-memory">{userContext?.trim() || 'Aún no has añadido información. Puedes empezar con tu nombre o algo que te guste.'}</div>
    </section>
    {actionLog.length > 0 && <section className="aac-agent-card" aria-labelledby="agent-activity-title"><div className="aac-card-heading"><h2 id="agent-activity-title"><CheckCircle2 size={20} />Actividad reciente</h2></div><ol className="aac-activity">{actionLog.slice(0, 10).map((action, index) => <li key={action.id || index}><span>{action.result?.message || ({ control_light: 'Cambio en la luz', add_calendar_event: 'Evento añadido', update_context: 'Contexto actualizado' }[action.tool]) || 'Solicitud procesada'}</span><time>{action.timestamp?.slice(11, 16)}</time></li>)}</ol></section>}
  </div>;
}
