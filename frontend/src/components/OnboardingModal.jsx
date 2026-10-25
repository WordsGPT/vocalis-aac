import { AGENT_ENABLED } from '../features';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import './onboarding.css';

const STORAGE_KEY = 'vocalis_onboarding_v1';
const steps = [
  { id: 'welcome', target: '.aac-tabs', title: 'Este es tu espacio', text: 'Estas pestañas abren Tablero, Conversación e Historial. Vamos a recorrer la pantalla juntos. El micrófono estará pausado y la práctica no se guardará.' },
  { id: 'settings', target: '[aria-label="Ajustes y clonar mi voz"]', title: 'Tus ajustes están aquí', text: 'Este botón abre tus preferencias y tu voz. Desde aquí también puedes volver a iniciar el tutorial.' },
  { id: 'voice-type', settings: true, target: '[data-tour="voice-type"]', title: 'Elige cómo quieres sonar', text: 'Selecciona una voz del servidor, del dispositivo o Pocket TTS. La voz personal se configura más abajo en este mismo panel.', interactive: true },
  { id: 'voice-choice', settings: true, target: '#server-voice, #browser-voice, [data-tour="voice-type"]', title: 'Elige tu voz', text: 'Elige una voz disponible en el selector. Pocket TTS utiliza una voz local que debes configurar en Ajustes.', interactive: true },
  { id: 'voice-speed', settings: true, target: '[data-tour="voice-speed"], [data-tour="voice-type"]', title: 'Velocidad y tono', text: 'Ajusta estos controles para hablar a tu ritmo. En Pocket TTS estos controles no se aplican.', interactive: true },
  { id: 'voice-test', settings: true, target: '[data-tour="voice-test"]', title: 'Escucha tu voz', text: 'Pulsa «Probar voz» para escuchar tu selección. Este es el único paso que reproduce audio durante la guía.', interactive: true },
  { id: 'form', settings: true, target: '#grammatical-form', title: 'Cómo hablas de ti', text: 'Elige masculino o femenino para las palabras del tablero y las nuevas sugerencias. Tus mensajes escritos conservan tus palabras.', interactive: true },
  { id: 'size', settings: true, target: '#pictogram-size', title: 'Un tamaño cómodo', text: 'Mueve el control para ajustar las casillas, los pictogramas y el texto. La muestra cambia al momento.', interactive: true },
  { id: 'tile-speech', settings: true, target: '[data-tour="tile-speech"]', title: 'Leer al tocar', text: 'Activa esta opción si quieres oír cada palabra al añadirla. «Hablar» siempre dice el mensaje completo. La práctica de esta guía permanece en silencio.', interactive: true },
  { id: 'tone', settings: true, target: '#response-tone', title: 'Tu estilo de respuesta', text: 'Elige el estilo de las sugerencias: natural, informal, formal, breve o cálido.', interactive: true },
  { id: 'count', settings: true, target: '#response-count', title: 'Cuántas opciones quieres', text: 'Elige entre tres y seis respuestas. Menos opciones pueden hacer más fácil elegir.', interactive: true },
  { id: 'context-setting', settings: true, target: '#user-context', title: 'Un poco sobre ti', text: 'Puedes añadir gustos o detalles para personalizar las respuestas. Es opcional: se guarda en este navegador y se envía con las solicitudes de sugerencias.', interactive: true },
  { id: 'language', settings: true, target: '#listening-language', title: 'Idioma de escucha', text: 'Elige el idioma de las personas con las que conversas.', interactive: true },
  { id: 'recognition', settings: true, target: '[data-tour="recognition"]', title: 'Cómo escuchar', text: 'Conversación transcribe el audio en pausas. Texto en directo utiliza el reconocimiento del navegador, si está disponible.', interactive: true },
  { id: 'pause', settings: true, target: '[data-tour="listening-pause"]', title: 'Da tiempo para terminar', text: 'Una pausa más larga evita pedir respuestas antes de que la otra persona termine. Tus cambios se guardan automáticamente.', interactive: true },
  { id: 'board-tiles', view: 'board', target: '.aac-tile-grid .aac-tile', title: 'Toca una palabra', text: 'Toca el pictograma resaltado para añadirlo a «Mi mensaje». Usas el tablero real: durante la guía, la práctica queda en silencio y no se guarda.', interactive: true },
  { id: 'composer', view: 'board', target: '#message-draft', title: 'Aquí construyes tu mensaje', text: 'Las palabras aparecen aquí. También puedes escribir directamente. Prueba a editar el mensaje; esta práctica se descarta al terminar.', interactive: true },
  { id: 'speak', view: 'board', target: '.aac-speak', title: 'Hablar y detener', text: 'Este botón dice el mensaje completo y cambia a «Detener» durante la reproducción. Enter también habla; Mayús + Enter añade una línea.' },
  { id: 'edit', view: 'board', target: '.aac-edit-tools', title: 'Borrar y limpiar', text: '«Borrar» quita el último elemento. «Limpiar» vacía el mensaje. Puedes probarlos con tu mensaje de práctica.', interactive: true },
  { id: 'find', view: 'board', target: '.aac-board-actions', title: 'Encuentra tus palabras', text: 'El tablero empieza en «Categorías». Elige una carpeta o usa «Buscar» para encontrar palabras y frases. «Inicio» abre las palabras esenciales; «Categorías» vuelve a las carpetas.', interactive: true },
  { id: 'save', view: 'board', target: '[aria-label="Guardar frase"]', title: 'Tus frases favoritas', text: 'El corazón guarda el mensaje en «Mis frases». Allí puedes organizarlo y personalizar las frases rápidas. La flecha circular junto a él deshace el último cambio.' },
  { id: 'quick', target: '.aac-quick button', title: 'Frases a un toque', text: 'Estas frases rápidas hablan inmediatamente al tocarlas. Están disponibles también mientras conversas.' },
  { id: 'listen', target: '.aac-listen', title: 'Escuchar y pausar', text: 'Este botón inicia o detiene la escucha. El navegador te pedirá permiso para usar el micrófono. La escucha se pausa mientras tu voz habla; durante la guía sigue apagada.' },
  { id: 'transcript', target: '#conversation-hearing', title: 'Lo que estás escuchando', text: 'Aquí aparece la transcripción. «Escribir o corregir lo que dijo» permite introducir el mensaje del interlocutor si el micrófono no está disponible.' },
  { id: 'visibility', target: '#conversation-toggle-transcript', title: 'Despeja la pantalla', text: 'Este botón oculta o muestra la transcripción. El botón de mensajes abre el historial de la conversación en pantallas pequeñas.' },
  { id: 'replies', target: '.aac-replies .aac-reply', title: 'Elige qué decir', text: 'Toca una tarjeta para hablar o usa «Editar en mi mensaje» para cambiarla antes. Los números 1–6 eligen respuestas cuando no estás escribiendo. Esta tarjeta es un ejemplo temporal.' },
  { id: 'direct', target: '.aac-reply-quick-actions', title: 'Responde al momento', text: '«Sí», «No» y «¿Puedes repetir?» hablan con un toque. Las sugerencias nunca se reproducen por sí solas.' },
  { id: 'regenerate', target: '.aac-regenerate-btn', title: 'Pide otras opciones', text: '«Otras respuestas» genera opciones nuevas para lo que has escuchado.' },
  { id: 'topics', target: '.aac-header-topics', title: 'Retoma un tema', text: 'Los temas aparecen aquí durante la conversación. Toca uno para volver a él; quita el tema activo para seguir la conversación general.' },
  { id: 'mode', target: '#conversation-speak-mode', title: 'Dirige la conversación', text: '«Modo hablar» propone formas de expresar lo que tú quieres decir. Tócalo otra vez para volver a las respuestas.' },
  { id: 'write', target: '#conversation-write', title: 'Escribe tu propia respuesta', text: '«Escribir» abre el mismo editor de mensajes con el teclado. Puedes decir lo que quieras sin elegir una sugerencia.' },
  { id: 'context', target: '#header-context-btn', title: 'Cambia tu contexto aquí', text: 'Este botón permite consultar o modificar lo que la IA sabe sobre ti sin buscarlo dentro de Ajustes.' },
  { id: 'agent', view: 'agent', target: '.aac-command', title: 'Pide ayuda al agente', text: 'Aquí puedes escribir instrucciones para la luz de demostración, el calendario o tu contexto personal. Los mensajes que dices también pueden interpretarse como instrucciones.' },
  { id: 'light', view: 'agent', target: '#agent-smart-light-bulb', title: 'Luz de demostración', text: 'Esta bombilla enciende o apaga la luz virtual. Los controles de abajo cambian su color. El botón «Luz» del encabezado abre este panel.' },
  { id: 'calendar', view: 'agent', target: '[aria-controls="agent-event-form"]', title: 'Tu calendario', text: '«Nuevo evento» abre un formulario con título, fecha y hora. Los eventos aparecen debajo y se pueden eliminar.' },
  { id: 'history', view: 'history', target: '.aac-history li', title: 'Recupera un mensaje', text: 'En Historial, el botón de voz repite un mensaje y el teclado permite editarlo. Este mensaje es un ejemplo temporal. «Borrar historial» pide confirmación.' },
  { id: 'ready', target: '[aria-label="Ajustes y clonar mi voz"]', title: 'Ya conoces tu espacio', text: 'Tus preferencias están guardadas. Vuelve a este botón para cambiarlas o repetir la guía con «Abrir tutorial». Al terminar podrás empezar a conversar.' },
].filter(step => AGENT_ENABLED || step.view !== 'agent');
function initialStep() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved?.status === 'in-progress' && Number.isInteger(saved.step) ? Math.max(0, Math.min(steps.length - 1, saved.step)) : 0; }
  catch { return 0; }
}
function remember(status, step) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, step })); } catch { /* The tour remains usable without storage. */ }
}
const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function OnboardingModal({ onStepChange, tts, onClose }) {
  const [step, setStep] = useState(initialStep);
  const [position, setPosition] = useState(null);
  const card = useRef(null), heading = useRef(null), target = useRef(null);
  const current = steps[step];
  const callbacks = useRef({ onClose, tts, step });
  useEffect(() => { callbacks.current = { onClose, tts, step }; });
  const finish = status => { remember(status, step); tts.stop(); onClose(status === 'completed' ? 'conversation' : undefined); };

  useEffect(() => {
    document.body.classList.add('tour-active');
    const originalFocus = document.activeElement;
    return () => {
      document.body.classList.remove('tour-active');
      requestAnimationFrame(() => {
        if (originalFocus?.isConnected && !originalFocus.closest('[inert]')) originalFocus.focus();
        else document.querySelector('[aria-label="Ajustes y clonar mi voz"]')?.focus();
      });
    };
  }, []);
  useLayoutEffect(() => {
    onStepChange({ ...current, view: current.view || 'conversation' });
    remember('in-progress', step);
    heading.current?.focus({ preventScroll: true });
  }, [step, current, onStepChange]);

  useEffect(() => {
    let frame, node, observer;
    const findTarget = () => current.target.split(',').flatMap(selector => [...document.querySelectorAll(selector.trim())]).find(item => item.getClientRects().length && !item.closest('[hidden]'));
    const measure = () => {
      const found = findTarget();
      if (!found || !card.current) { frame = requestAnimationFrame(measure); return; }
      if (node !== found) {
        node?.removeAttribute('data-tour-active');
        node = found; target.current = found; node.setAttribute('data-tour-active', 'true');
        node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        observer?.disconnect(); observer = new ResizeObserver(schedule); observer.observe(node); observer.observe(card.current);
      }
      const r = node.getBoundingClientRect();
      const w = window.innerWidth, h = window.innerHeight;
      const cw = card.current.offsetWidth, ch = card.current.offsetHeight, gap = 18;
      let x, y, side;
      if (w - r.right >= cw + gap + 12) { x = r.right + gap; y = clamp(r.top, 12, h - ch - 12); side = 'right'; }
      else if (r.left >= cw + gap + 12) { x = r.left - cw - gap; y = clamp(r.top, 12, h - ch - 12); side = 'left'; }
      else if (h - r.bottom >= ch + gap + 12) { x = clamp(r.left, 12, w - cw - 12); y = r.bottom + gap; side = 'below'; }
      else if (r.top >= ch + gap + 12) { x = clamp(r.left, 12, w - cw - 12); y = r.top - ch - gap; side = 'above'; }
      else if (r.top >= ch + 4) { x = clamp(r.left, 12, w - cw - 12); y = Math.max(4, r.top - ch - 4); side = 'above'; }
      else if (h - r.bottom >= ch + 8) { x = clamp(r.left, 12, w - cw - 12); y = r.bottom + 4; side = 'below'; }
      else {
        // Reserve the lower part of short screens for instructions and scroll
        // the real control into the remaining visible area.
        x = (w - cw) / 2; y = h - ch - 12; side = 'above';
        const scroller = (() => { let ancestor = node.parentElement; while (ancestor) { if (/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY) && ancestor.scrollHeight > ancestor.clientHeight) return ancestor; ancestor = ancestor.parentElement; } return null; })();
        if (scroller && r.height + ch + gap + 24 <= h && r.height > y - scroller.getBoundingClientRect().top - gap) {
          // On small phones a taller settings group fits below the callout.
          const before = scroller.scrollTop;
          scroller.scrollTop += r.top - (ch + gap + 12);
          if (scroller.scrollTop !== before) { frame = requestAnimationFrame(measure); return; }
          y = 12;
        }
        if (scroller && y !== 12 && r.bottom > y - gap && scroller.scrollHeight > scroller.clientHeight) {
          const top = scroller.getBoundingClientRect().top;
          const shift = r.top - top - 16;
          if (Math.abs(shift) > 2) { const before = scroller.scrollTop; scroller.scrollTop += shift; if (scroller.scrollTop !== before) { frame = requestAnimationFrame(measure); return; } }
        }
      }
      // Respect the same clipping as the actual scrolling panel; the outline
      // must not cut a hole through navigation covering the control.
      let visibleTop = r.top, visibleBottom = r.bottom;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(ancestor).overflowY)) {
          const bounds = ancestor.getBoundingClientRect();
          visibleTop = Math.max(visibleTop, bounds.top); visibleBottom = Math.min(visibleBottom, bounds.bottom);
        }
      }
      const top = clamp(visibleTop - 6, 4, h - 8), left = clamp(r.left - 6, 4, w - 8);
      const bottom = clamp(visibleBottom + 6, top + 4, h - 4), right = clamp(r.right + 6, left + 4, w - 4);
      setPosition({ x, y, side, cardWidth: cw, cardHeight: ch, rect: { top, left, width: right - left, height: bottom - top }, anchor: { x: clamp(r.left + r.width / 2, 8, w - 8), y: clamp((visibleTop + visibleBottom) / 2, 8, h - 8) } });
    };
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); }
    // React may mount the requested screen after this effect starts.
    schedule();
    const mutation = new MutationObserver(schedule); mutation.observe(document.querySelector('.vocalis-redesign'), { childList: true, subtree: true });
    window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); remember('skipped', callbacks.current.step); callbacks.current.tts.stop(); callbacks.current.onClose(); }
      if (event.key !== 'Tab') return;
      const inputs = current.interactive && node ? [node, ...node.querySelectorAll(focusableSelector)].filter(item => item.matches(focusableSelector) && !item.matches(':disabled') && item.getClientRects().length) : [];
      const buttons = [...card.current.querySelectorAll(focusableSelector)].filter(item => item.getClientRects().length);
      const nodes = [...inputs, ...buttons];
      const index = nodes.indexOf(document.activeElement);
      const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      event.preventDefault(); nodes[next]?.focus();
    };
    const block = event => {
      if (card.current?.contains(event.target)) return;
      if (current.interactive && node?.contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('click', block, true);
    document.addEventListener('pointerdown', block, true);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); mutation.disconnect(); node?.removeAttribute('data-tour-active'); target.current = null;
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); window.visualViewport?.removeEventListener('resize', schedule);
      document.removeEventListener('keydown', key, true); document.removeEventListener('click', block, true); document.removeEventListener('pointerdown', block, true);
    };
  }, [current]);
  function go(next) { tts.stop(); setPosition(null); setStep(next); }
  const rect = position?.rect;
  // The outline's large shadow dims everything except the real target. It
  // never changes that control's position or replaces it with a copy.
  return <div className="onboarding-tour">
    {rect && <div className="onboarding-spotlight" aria-hidden="true" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />}
    {position && <svg className="onboarding-pointer" aria-hidden="true"><defs><marker id="tour-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><polygon points="0,0 10,5 0,10" fill="#0e9caa" /></marker></defs><path markerEnd="url(#tour-arrow)" d={`M ${position.side === 'left' ? position.x + position.cardWidth : position.side === 'right' ? position.x : clamp(position.anchor.x, position.x + 20, position.x + position.cardWidth - 20)} ${position.side === 'below' ? position.y : position.side === 'above' ? position.y + position.cardHeight : clamp(position.anchor.y, position.y + 20, position.y + position.cardHeight - 20)} L ${position.anchor.x} ${position.anchor.y}`} /></svg>}
    <section ref={card} className="onboarding-dialog" role="dialog" aria-modal="false" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" data-settings={Boolean(current.settings)} data-step={current.id} data-target={current.target} style={position ? { left: position.x, top: position.y } : { left: 12, bottom: 12 }}>
      <header><span>PRIMEROS PASOS · {step + 1} / {steps.length}</span><button type="button" onClick={() => finish('skipped')} aria-label="Cerrar tutorial"><X size={20} /></button></header>
      <h2 ref={heading} id="onboarding-title" tabIndex={-1}>{current.title}</h2>
      <p id="onboarding-description">{current.text}</p>
      {current.interactive && <p className="onboarding-hint">Puedes usar el control resaltado ahora.</p>}
      <footer><button type="button" onClick={() => finish('skipped')} className="onboarding-skip">Ahora no</button><div><button type="button" disabled={step === 0} onClick={() => go(step - 1)} aria-label="Paso anterior"><ArrowLeft size={18} /></button><button type="button" className="onboarding-primary" onClick={() => step === steps.length - 1 ? finish('completed') : go(step + 1)}>{step === steps.length - 1 ? 'Terminar' : 'Siguiente'}<ArrowRight size={18} /></button></div></footer>
    </section>
  </div>;
}
