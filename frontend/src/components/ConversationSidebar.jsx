import { useEffect, useRef, useState } from 'react';
import { ArrowDown, MessageSquare, X } from 'lucide-react';

function speakerTone(key) {
  let hash = 0;
  for (const character of String(key)) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 3;
}

export function ConversationSidebar({ history = [], speakerLabels = true, isOpen, onClose }) {
  const scroller = useRef(null);
  const following = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  function goToLatest() {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
    following.current = true;
    setAtBottom(true);
  }

  useEffect(() => {
    if (following.current) {
      const node = scroller.current;
      if (node) node.scrollTop = node.scrollHeight;
    }
  }, [history, isOpen]);

  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (following.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <aside id="conversation-messages" className="aac-chat-panel" data-open={isOpen} aria-labelledby="conversation-messages-title">
    <div className="aac-chat-heading"><div><MessageSquare size={18} aria-hidden="true" /><h2 id="conversation-messages-title">La conversación</h2></div><button type="button" className="aac-icon-tool aac-chat-close" onClick={onClose} aria-label="Cerrar panel de mensajes"><X size={18} /></button></div>
    <p className="aac-chat-caption">Lo que escuchas y lo que dices, en orden.</p>
    <div ref={scroller} className="aac-chat-scroll" role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions" tabIndex={0}
      onScroll={event => {
        const node = event.currentTarget;
        const next = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
        following.current = next;
        setAtBottom(next);
      }}>
      {!history.length && <div className="aac-chat-empty"><MessageSquare size={26} aria-hidden="true" /><p>Los mensajes aparecerán aquí cuando empieces a conversar.</p></div>}
      <ol className="aac-chat-messages">{history.map((message, index) => {
        const self = message.sender === 'user';
        const speaker = self ? 'Tú' : speakerLabels ? message.speaker_label || 'Voz sin identificar' : 'Conversación';
        const key = speakerLabels ? message.speaker || speaker : 'partner';
        return <li key={index} className={'aac-chat-message ' + (self ? 'is-self' : 'speaker-tone-' + speakerTone(key))}>
          <div className="aac-chat-meta"><span>{speaker}</span><span className="aac-chat-time">{message.time}</span></div>
          <p className="aac-chat-bubble">{message.text}</p>
        </li>;
      })}</ol>
    </div>
    {!atBottom && <button type="button" className="aac-tool aac-chat-latest" onClick={goToLatest}><ArrowDown size={16} />Ir al último mensaje</button>}
  </aside>;
}
