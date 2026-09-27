import React, { useEffect, useRef, useState } from 'react';
import { toWav } from './VoiceCloner';
import { clearPocketVoice, loadPocketVoice, savePocketVoice } from '../services/pocketVoice';

export function PocketCloner({ available, onSelected, onRemoved }) {
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [consent, setConsent] = useState(false);
  const recorder = useRef(null);
  useEffect(() => {
    loadPocketVoice().then(blob => setReady(!!blob)).catch(() => {});
    return () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  }, []);

  const choose = async file => {
    if (!file || !consent) return;
    try {
      const sample = await toWav(file);
      if (sample.duration < 5 || sample.duration > 30) throw new Error('La muestra debe durar entre 5 y 30 segundos.');
      await savePocketVoice(sample.wav);
      setReady(true);
      setStatus(available ? 'Muestra guardada en este navegador. Pocket TTS está seleccionado.' : 'Este navegador no admite Pocket TTS.');
      onSelected?.();
    } catch (error) { setStatus(error.message || 'No se pudo guardar la muestra.'); }
  };

  const record = async () => {
    if (recording) { recorder.current?.stop(); return; }
    if (!consent) { setStatus('Confirma el permiso de uso de la voz antes de grabar.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const parts = [];
      const current = new MediaRecorder(stream);
      recorder.current = current;
      current.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        await choose(new Blob(parts, { type: current.mimeType }));
      };
      current.start();
      setRecording(true);
      setTimeout(() => { if (current.state === 'recording') current.stop(); }, 30000);
    } catch (error) { setStatus(`No se pudo grabar: ${error.message}`); }
  };

  const remove = async () => {
    await clearPocketVoice();
    setReady(false);
    setStatus('Muestra eliminada de este navegador.');
    onRemoved?.();
  };

  return <div className="voice-cloner mt-4 rounded-xl border p-4 text-sm text-slate-200">
    <h4 className="font-bold m-0">Mi voz con Pocket TTS</h4>
    <p className="text-xs text-slate-400">No requiere iniciar sesión. Usa una muestra clara de 5–30 segundos. La muestra permanece en este navegador; la voz se genera con la CPU del dispositivo. La primera vez se descargan unos 150 MB de modelos.</p>
    <label className="flex items-start gap-2 my-3 text-xs">
      <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
      Soy propietario de esta voz o tengo permiso explícito para clonarla.
    </label>
    <div className="flex gap-2 items-center flex-wrap">
      <button type="button" onClick={record} className="p-2 rounded bg-violet-700 text-white" disabled={!consent}>{recording ? 'Detener' : 'Grabar muestra'}</button>
      <label className="p-2 rounded bg-slate-700 cursor-pointer">Subir audio
        <input type="file" accept="audio/*" className="hidden" disabled={!consent || recording}
          onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
      {ready && <button type="button" onClick={remove} className="p-2 rounded bg-slate-700">Borrar muestra</button>}
    </div>
    {ready && <p className="text-xs text-emerald-300 mt-2">Muestra lista en este navegador.</p>}
    {status && <p role="status" className="text-xs mt-2">{status}</p>}
  </div>;
}
