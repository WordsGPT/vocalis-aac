import React, { useEffect, useRef, useState } from 'react';
import { cloneVoiceFromAudio } from '../services/api';

const CONSENT = 'Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.';

export async function toWav(file) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    const duration = decoded.duration;
    if (duration > 30) throw new Error('Cada grabación debe durar menos de 30 segundos.');
    const sampleRate = 24000;
    const frames = Math.round(duration * sampleRate);
    const offline = new OfflineAudioContext(1, frames, sampleRate);
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const target = mono.getChannelData(0);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const input = decoded.getChannelData(channel);
      for (let i = 0; i < input.length; i += 1) target[i] += input[i] / decoded.numberOfChannels;
    }
    const source = offline.createBufferSource();
    source.buffer = mono;
    source.connect(offline.destination);
    source.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const label = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
    label(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); label(8, 'WAVE');
    label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    pcm.forEach((value, i) => view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(value * 32767))), true));
    return { wav: new Blob([buffer], { type: 'audio/wav' }), duration };
  } finally { await context.close(); }
}

export function VoiceCloner({ onCloned, authenticated }) {
  const [files, setFiles] = useState({ reference: null, consent: null });
  const [active, setActive] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const recorder = useRef(null);
  const stream = useRef(null);
  useEffect(() => () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const choose = async (kind, file) => {
    if (!file) return;
    try {
      const converted = await toWav(file);
      setFiles(previous => ({ ...previous, [kind]: converted }));
      setStatus('Grabación lista.');
    } catch (error) { setStatus(error.message); }
  };

  const record = async (kind) => {
    if (active) { recorder.current?.stop(); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const parts = [];
      const current = new MediaRecorder(media);
      recorder.current = current;
      current.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      current.onstop = async () => {
        media.getTracks().forEach(track => track.stop());
        setActive(null);
        await choose(kind, new Blob(parts, { type: current.mimeType }));
      };
      current.start();
      setActive(kind);
      setTimeout(() => { if (current.state === 'recording') current.stop(); }, 30000);
    } catch (error) { setStatus(`No se pudo grabar: ${error.message}`); }
  };

  const create = async () => {
    if (!files.reference || !files.consent) return;
    if (files.reference.duration < 10 || files.reference.duration > 30 || files.consent.duration < 2) {
      setStatus('La muestra debe durar entre 10 y 30 segundos y el consentimiento al menos 2 segundos.');
      return;
    }
    setSaving(true);
    setStatus('Creando la voz…');
    try {
      const result = await cloneVoiceFromAudio(files.reference.wav, files.consent.wav);
      onCloned?.(result.voice_id);
      setStatus(`Voz creada. Guarda este ID para usarla en otro dispositivo: ${result.voice_id}`);
    } catch (error) { setStatus(error.message); }
    finally { setSaving(false); }
  };

  if (!authenticated) return <div className="voice-cloner mt-4 rounded-xl border p-4 text-sm text-slate-300">
    Inicia sesión arriba para crear y usar una voz personal.
  </div>;

  return <div className="voice-cloner mt-4 rounded-xl border p-4 text-sm text-slate-200">
    <h4 className="font-bold m-0">Crear mi voz con Gemini</h4>
    <p className="text-xs text-slate-400">La persona propietaria de la voz debe ser adulta. Graba las dos muestras seguidas, con el mismo micrófono en un lugar tranquilo, sin unir grabaciones distintas.</p>
    {[['reference', 'Muestra de voz: habla con naturalidad durante 10–30 segundos.'],
      ['consent', `Consentimiento: di exactamente «${CONSENT}»`]].map(([kind, label]) =>
      <div key={kind} className="my-3">
        <p className="text-xs mb-1">{label}</p>
        <div className="flex gap-2 items-center">
          <button type="button" disabled={saving || (active && active !== kind)} onClick={() => record(kind)}
            className="p-2 rounded bg-violet-700 text-white">{active === kind ? 'Detener' : 'Grabar'}</button>
          <label className="p-2 rounded bg-slate-700 cursor-pointer">Subir audio
            <input type="file" accept="audio/*" className="hidden" disabled={saving || !!active}
              onChange={event => { choose(kind, event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {files[kind] && <span className="text-xs">Listo · {Math.round(files[kind].duration)} s</span>}
        </div>
      </div>)}
    <button type="button" onClick={create} disabled={saving || !!active || !files.reference || !files.consent}
      className="w-full p-2 rounded bg-violet-600 disabled:opacity-40 text-white font-bold">{saving ? 'Creando…' : 'Crear y usar esta voz'}</button>
    {status && <p role="status" className="text-xs mt-2">{status}</p>}
  </div>;
}
