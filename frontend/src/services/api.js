// API client for Vocalis AAC backend

const API_BASE = '/api';

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
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

export async function getSmartSuggestions({ 
  text, 
  history = [], 
  tone = 'natural', 
  count = 6,
  geminiApiKey = null, 
  groqApiKey = null, 
  preferredEngine = 'groq' 
}) {
  try {
    const res = await fetch(`${API_BASE}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        history,
        tone,
        count,
        gemini_api_key: geminiApiKey || null,
        groq_api_key: groqApiKey || null,
        preferred_engine: preferredEngine
      })
    });
    if (!res.ok) throw new Error(`Suggest failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend suggestion call failed, using client fallback:', err);
    // Offline client fallback (Spanish)
    const fallbackList = [
      "¡Sí, suena genial!",
      "De acuerdo, me parece bien.",
      "¿Podrías contarme un poco más sobre eso?",
      "¿Y si probamos otra alternativa diferente?",
      "No podré en esta ocasión, muchas gracias.",
      "Dame un momento para pensarlo con calma."
    ];
    return {
      suggestions: fallbackList.slice(0, count || 6),
      engine: 'client-offline'
    };
  }
}

export async function transcribeAudioBlob(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Transcription failed: ${res.status}`);
  }
  return await res.json();
}

export async function fetchEdgeTTSAudio(text, voice = 'en-US-GuyNeural', rate = '+0%', pitch = '+0Hz') {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate, pitch })
  });
  
  if (!res.ok) {
    throw new Error(`TTS generation failed: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
