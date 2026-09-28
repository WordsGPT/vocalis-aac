// Pocket TTS runs in a Web Worker. Model weights are fetched by the visitor's browser.
export const POCKET_MODEL_VERSION = 'spanish-v3.3.0-28c044b';
let worker;
let ready;
let encodedReference;
let queue = Promise.resolve();

function listen(type) {
  return new Promise((resolve, reject) => {
    const onMessage = event => {
      if (event.data.type === type) { cleanup(); resolve(event.data); }
      else if (event.data.type === 'error') { cleanup(); reject(new Error(event.data.error)); }
    };
    const onError = event => { cleanup(); reject(new Error(event.message || 'Pocket TTS no está disponible.')); };
    const cleanup = () => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
  });
}

async function ensureReady() {
  if (ready) return ready;
  if (!globalThis.Worker || !globalThis.WebAssembly) throw new Error('Este navegador no admite Pocket TTS.');
  worker = new Worker('/pocket/inference-worker.js', { type: 'module' });
  ready = listen('loaded');
  worker.postMessage({ type: 'load' });
  try { await ready; }
  catch (error) { worker.terminate(); worker = null; ready = null; throw error; }
}

async function encodeReference(reference) {
  const buffer = await reference.arrayBuffer();
  const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (fingerprint === encodedReference) return;
  const view = new DataView(buffer);
  const count = Math.min(Math.floor((buffer.byteLength - 44) / 2), 24000 * 30);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) samples[i] = view.getInt16(44 + i * 2, true) / 32768;
  const done = listen('voice_encoded');
  worker.postMessage({ type: 'encode_voice', data: { audio: samples } }, [samples.buffer]);
  await done;
  encodedReference = fingerprint;
}

function wav(chunks) {
  const count = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const data = new ArrayBuffer(44 + count * 2);
  const view = new DataView(data);
  const label = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  label(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 24000, true);
  view.setUint32(28, 48000, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true);
    offset += 2;
  }
  return new Blob([data], { type: 'audio/wav' });
}

async function runGeneration(text, reference, signal) {
  await ensureReady();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await encodeReference(reference);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const chunks = [];
  return new Promise((resolve, reject) => {
    let error;
    const onMessage = event => {
      if (event.data.type === 'audio_chunk') chunks.push(event.data.data);
      else if (event.data.type === 'error') error = new Error(event.data.error);
      else if (event.data.type === 'stream_ended') {
        cleanup();
        if (signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
        else if (error) reject(error);
        else if (!chunks.length) reject(new Error('Pocket TTS no devolvió audio.'));
        else resolve(wav(chunks));
      }
    };
    const onAbort = () => { worker.postMessage({ type: 'stop' }); };
    const cleanup = () => { worker.removeEventListener('message', onMessage); signal?.removeEventListener('abort', onAbort); };
    worker.addEventListener('message', onMessage);
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.postMessage({ type: 'generate', data: { text, voice: 'custom' } });
  });
}

export function generatePocketAudio(text, reference, signal) {
  const result = queue.catch(() => {}).then(() => runGeneration(text, reference, signal));
  queue = result;
  return result;
}
