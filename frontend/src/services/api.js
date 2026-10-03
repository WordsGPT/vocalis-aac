import { personalForm } from '../utils/spanish';
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
  formData.append('consent', consent, 'consent.wav');
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

export function getOfflineSuggestions(count = 6, grammaticalForm = 'masculine') {
  const suggestions = [
    '¡Sí, suena genial!',
    'De acuerdo, me parece bien.',
    '¿Podrías contarme un poco más sobre eso?',
    '¿Y si probamos otra alternativa diferente?',
    'No podré en esta ocasión, muchas gracias.',
    'Dame un momento para pensarlo con calma.',
  ];
  return { suggestions: suggestions.slice(0, count).map(text => personalForm(text, grammaticalForm)), engine: 'client-offline' };
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
      })
    });
    if (!res.ok) throw new Error(`Suggest failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (automatic) return { should_suggest: false, reason: 'service_unavailable', suggestions: [], engine: 'conversation-offline' };
    console.warn('Backend suggestion call failed, using client fallback:', err);
    return getOfflineSuggestions(count || 6, grammaticalForm);
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
