import { personalForm } from '../utils/spanish.js';
// API client for Vocalis AAC backend

const API_BASE = '/api';
const CLIENT_ID_KEY = 'vocalis_client_id';

export function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = globalThis.crypto?.randomUUID?.()
      || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function deviceHeaders(headers = {}) {
  return { ...headers, 'X-Vocalis-Client': getClientId() };
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { headers: deviceHeaders() });
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend offline or health check failed:', err);
    return { status: 'offline', cuda: false, ollama: false };
  }
}

export async function fetchCuratedVoices() {
  try {
    const res = await fetch(`${API_BASE}/voices`);
    if (!res.ok) throw new Error('Voices fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('Failed to load server voices:', err);
    return [];
  }
}

export async function cloneVoiceFromAudio(reference, consent) {
  const formData = new FormData();
  formData.append('reference', reference, 'reference.wav');
  formData.append('file', reference, 'reference.wav');
  if (consent) formData.append('consent', consent, 'consent.wav');
  const res = await fetch(`${API_BASE}/voice/clone`, {
    method: 'POST',
    headers: deviceHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.dispatchEvent(new Event('vocalis:unauthorized'));
  if (!res.ok) throw new Error(data.detail || `Voice cloning failed: ${res.status}`);
  return data;
}

export function getOfflineSuggestions(count = 6, grammaticalForm = 'masculine', mode = 'reply') {
  if (mode === 'speak') {
    const speakSuggestions = [
      'Tengo una idea sobre eso que podríamos probar.',
      'Quería decirte lo que opino sobre este tema.',
      '¿Y si lo enfocamos de otra manera totalmente distinta?',
      'A mí me gustaría mucho que hiciéramos un plan con eso.',
      'Cambiando un poco de rumbo, quería comentarte algo.',
      '¿Qué te parecería si tomamos la iniciativa nosotros?',
    ];
    return {
      suggestions: speakSuggestions.slice(0, count).map(text => personalForm(text, grammaticalForm)),
      direct_yes: personalForm('Sí, totalmente de acuerdo con eso.', grammaticalForm),
      direct_no: personalForm('No, no lo veo de esa forma.', grammaticalForm),
      engine: 'client-offline',
    };
  }
  const suggestions = [
    '¡Sí, suena genial!',
    'De acuerdo, me parece bien.',
    '¿Podrías contarme un poco más sobre eso?',
    '¿Y si probamos otra alternativa diferente?',
    'No podré en esta ocasión, muchas gracias.',
    'Dame un momento para pensarlo con calma.',
  ];
  return {
    suggestions: suggestions.slice(0, count).map(text => personalForm(text, grammaticalForm)),
    direct_yes: 'Sí, me parece bien.',
    direct_no: 'No, ahora mismo no.',
    engine: 'client-offline',
  };
}

export async function getSmartSuggestions({ 
  text, 
  history = [], 
  tone = 'natural',
  grammaticalForm = 'masculine',
  count = 6,
  userContext = '',
  preferredEngine = 'groq',
  automatic = false,
  focusTopic = null,
  mode = 'reply',
  topicContext = null,
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        text,
        history,
        tone,
        grammatical_form: grammaticalForm,
        count,
        user_context: userContext.slice(0, 2000) || null,
        preferred_engine: preferredEngine,
        automatic,
        focus_topic: focusTopic || null,
        mode: mode || 'reply',
        topic_context: topicContext || null,
      })
    });
    if (!res.ok) throw new Error(`Suggest failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (automatic) return { should_suggest: false, reason: 'service_unavailable', suggestions: [], engine: 'conversation-offline' };
    console.warn('Backend suggestion call failed, using client fallback:', err);
    return getOfflineSuggestions(count || 6, grammaticalForm, mode);
  }
}

export async function transcribeAudioBlob(blob, language = 'es-ES', sessionId = '', signal) {
  const formData = new FormData();
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  formData.append('file', blob, `recording.${extension}`);
  formData.append('language', language);
  formData.append('session_id', sessionId);
  
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    signal,
    body: formData
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Transcription failed: ${res.status}`);
  }
  return await res.json();
}

export async function fetchEdgeTTSAudio(text, voice = 'en-US-GuyNeural', rate = '+0%', pitch = '+0Hz', signal) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: deviceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, voice, rate, pitch }),
    signal
  });
  
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('vocalis:unauthorized'));
    throw new Error(`TTS generation failed: ${res.status}`);
  }
  return res.blob();
}

export async function fetchStreamingTTSAudio(text, signal) {
  const res = await fetch(`${API_BASE}/tts/stream`, {
    method: 'POST',
    headers: deviceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, voice: 'qwen-clone', language: 'Spanish' }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Streaming TTS failed: ${res.status}`);
  }
  if (!res.body) throw new Error('Este navegador no admite audio transmitido.');
  return res;
}

export async function logConversationTurn({ sender, text, speaker_label, time, mode, metadata }) {
  try {
    const res = await fetch(`${API_BASE}/audit/log`, {
      method: 'POST',
      headers: deviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        sender,
        text,
        speaker_label: speaker_label || null,
        time: time || null,
        mode: mode || null,
        metadata: metadata || null,
      }),
    });
    if (!res.ok) throw new Error(`Audit logging failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to log conversation turn:', err);
    return { status: 'failed', error: err.message };
  }
}

export async function fetchAuditLogs(limit = 100) {
  try {
    const res = await fetch(`${API_BASE}/audit/logs?limit=${encodeURIComponent(limit)}`, {
      headers: deviceHeaders(),
    });
    if (!res.ok) throw new Error(`Fetch audit logs failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch audit logs:', err);
    return { client_id: getClientId(), count: 0, entries: [] };
  }
}

export async function exportAuditTranscript() {
  const res = await fetch(`${API_BASE}/audit/export`, {
    headers: deviceHeaders(),
  });
  if (!res.ok) throw new Error(`Export audit transcript failed: ${res.status}`);
  return await res.text();
}

export async function clearAuditLogs() {
  const res = await fetch(`${API_BASE}/audit/logs`, {
    method: 'DELETE',
    headers: deviceHeaders(),
  });
  if (!res.ok) throw new Error(`Clear audit logs failed: ${res.status}`);
  return await res.json();
}

export async function fetchAgentState() {
  try {
    const res = await fetch(`${API_BASE}/agent/state`);
    if (!res.ok) throw new Error(`Failed to fetch agent state: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Agent state fetch failed:', err);
    return {
      light: { state: 'off', color: 'green', brightness: 100 },
      calendar_events: [],
      action_log: [],
    };
  }
}

export async function processAgentMessage(text, userContext = '', history = []) {
  try {
    const res = await fetch(`${API_BASE}/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        user_context: userContext || null,
        history,
      }),
    });
    if (!res.ok) throw new Error(`Agent process failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Agent process failed:', err);
    return { status: 'error', tool_calls: [], state: null };
  }
}

export async function setAgentLight({ state, color = 'green', brightness = 100 }) {
  try {
    const res = await fetch(`${API_BASE}/agent/light`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, color, brightness }),
    });
    if (!res.ok) throw new Error(`Set agent light failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Set agent light error:', err);
    return { status: 'error', light: { state, color, brightness } };
  }
}

export async function addAgentCalendarEvent({ title, date, time, description }) {
  try {
    const res = await fetch(`${API_BASE}/agent/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, time, description }),
    });
    if (!res.ok) throw new Error(`Add agent calendar event failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Add agent calendar event error:', err);
    return { status: 'error' };
  }
}

export async function deleteAgentCalendarEvent(eventId) {
  try {
    const res = await fetch(`${API_BASE}/agent/calendar/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete agent calendar event failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Delete agent calendar event error:', err);
    return { status: 'error' };
  }
}

export async function updateAgentContext(context, action = 'replace', currentContext = '') {
  try {
    const res = await fetch(`${API_BASE}/agent/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, action, current_context: currentContext }),
    });
    if (!res.ok) throw new Error(`Update agent context failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Update agent context error:', err);
    return { status: 'error' };
  }
}

// ==============================================================================
// Planning Mode API Services (Visual & Guided Techniques)
// ==============================================================================

export async function fetchPlanContinuations({
  recipient = 'general',
  pictograms = [],
  tone = 'natural',
  grammaticalForm = 'masculine',
  userContext = '',
  count = 5,
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        type: 'continuations',
        recipient,
        pictograms,
        tone,
        grammatical_form: grammaticalForm,
        count,
        user_context: userContext || null,
      }),
    });
    if (!res.ok) throw new Error(`Plan continuations failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('Backend plan continuations failed, using client fallback:', err);
    // Offline client fallback
    const pictoStr = pictograms.join(', ');
    let fallback = [
      `Quiero hablar sobre ${pictoStr || 'este asunto'} con calma.`,
      `¿Podrías ayudarme con esto cuando tengas un momento?`,
      `Me parece importante comentarte lo que necesito ahora.`,
      `He preparado estas ideas con mi comunicador.`,
      `Tengo una pregunta sobre cómo podemos hacer esto.`,
    ];
    if (recipient === 'medico') {
      fallback = [
        `Tengo dolor o molestia relacionada con ${pictoStr || 'mi salud'} desde hace días.`,
        `¿Podría revisar si mi medicación actual es la adecuada?`,
        `Noto que el malestar empeora por las noches y me impide descansar.`,
        `Quisiera saber qué tratamiento o prueba me recomienda.`,
        `He preparado estas notas para explicarle mis síntomas con claridad.`,
      ];
    } else if (recipient === 'familia') {
      fallback = [
        `Quería comentaros algo sobre ${pictoStr || 'las cosas de casa'}.`,
        `¿Podéis ayudarme con una cosa cuando tengáis un momento libre?`,
        `Necesito descansar un poco tranquilo en casa, por favor.`,
        `Me gustaría que organizáramos un plan juntos.`,
        `Muchas gracias por vuestra ayuda y por estar conmigo.`,
      ];
    } else if (recipient === 'amigo') {
      fallback = [
        `¡Hola! Quería contarte algo sobre ${pictoStr || 'lo que he estado pensando'}.`,
        `¿Te apetece que quedemos un rato y charlemos tranquilos?`,
        `Tenía muchas ganas de saber cómo te van las cosas últimamente.`,
        `¡Qué buena idea, me alegro mucho de hablar contigo!`,
        `Dame un momento mientras preparo lo siguiente que te quiero decir.`,
      ];
    } else if (recipient === 'tienda') {
      fallback = [
        `Buenos días. Quisiera pedir información sobre ${pictoStr || 'este producto'}.`,
        `¿Podría decirme cuánto cuesta esto, por favor?`,
        `¿Tiene otra opción o talla diferente disponible?`,
        `Voy a pagar con tarjeta, muchas gracias por su ayuda.`,
      ];
    }
    return {
      suggestions: fallback.map(text => personalForm(text, grammaticalForm)),
      engine: 'client-offline',
      recipient,
    };
  }
}

export async function fetchGuidedStoryboard({
  recipient = 'general',
  goal = 'Conversación guiada',
  tone = 'natural',
  grammaticalForm = 'masculine',
  userContext = '',
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        type: 'storyboard',
        recipient,
        goal,
        tone,
        grammatical_form: grammaticalForm,
        user_context: userContext || null,
      }),
    });
    if (!res.ok) throw new Error(`Guided storyboard failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('Backend guided storyboard failed, using client fallback:', err);
    // Offline client fallback
    const stages = [
      {
        id: 'apertura',
        title: '1. Saludo y Encuadre',
        options: [
          personalForm('Hola, buenos días. Uso un comunicador asistido para expresarme.', grammaticalForm),
          personalForm('Buenas. He preparado unas notas para hablar de forma ordenada.', grammaticalForm),
          personalForm('Hola. Gracias por tu tiempo y por tu paciencia.', grammaticalForm),
        ],
      },
      {
        id: 'nucleo',
        title: '2. Mensaje Principal',
        options: [
          personalForm(`El motivo de hablar es: ${goal}.`, grammaticalForm),
          personalForm(`Quería consultarte y pedirte ayuda con respecto a: ${goal}.`, grammaticalForm),
          personalForm(`He estado pensando en ${goal} y quería saber qué opinas.`, grammaticalForm),
        ],
      },
      {
        id: 'seguimiento',
        title: '3. Si me preguntan detalles',
        options: [
          personalForm('Tengo los detalles preparados por si necesitas saber más.', grammaticalForm),
          personalForm('Podemos hacerlo de la manera más sencilla y directa.', grammaticalForm),
          personalForm('Si no es posible ahora, podemos buscar otra alternativa con calma.', grammaticalForm),
        ],
      },
      {
        id: 'cierre',
        title: '4. Cierre y Agradecimiento',
        options: [
          personalForm('Muchas gracias por tu atención y comprensión.', grammaticalForm),
          personalForm('Me alegro mucho de que lo hayamos hablado tranquilamente.', grammaticalForm),
          personalForm('Quedamos así entonces. ¡Hasta pronto y gracias!', grammaticalForm),
        ],
      },
    ];
    return { stages, engine: 'client-offline', recipient, goal };
  }
}



