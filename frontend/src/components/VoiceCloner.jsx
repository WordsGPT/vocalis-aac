import React, { useEffect, useRef, useState } from 'react';
import { CircleStop, Mic, Upload, UserRoundCheck } from 'lucide-react';
import { cloneVoiceFromAudio } from '../services/api';

export function VoiceCloner({ onCloned }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sample, setSample] = useState(null);
  const [sampleUrl, setSampleUrl] = useState('');
  const [sampleSeconds, setSampleSeconds] = useState(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => () => { if (sampleUrl) URL.revokeObjectURL(sampleUrl); }, [sampleUrl]);
  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const selectSample = (audio, duration = null) => {
    if (!audio) return;
    setSample(audio);
    setSampleUrl(URL.createObjectURL(audio));
    setSampleSeconds(duration);
    setStatus(duration !== null && duration < 6
      ? 'La muestra es demasiado corta. Graba al menos 8 segundos para una voz más fiable.'
      : duration !== null && duration > 30
        ? 'La muestra supera los 30 segundos. Elige un fragmento más corto.'
        : 'Muestra lista. Escúchala antes de crear la voz.');
  };

  const startRecording = async () => {
    try {
      setStatus('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearInterval(timerRef.current);
        const duration = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size) selectSample(blob, duration);
        else setStatus('No se grabó audio. Prueba otra vez.');
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      setStatus('Grabando… habla con naturalidad. Se detendrá a los 15 segundos.');
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecordingSeconds(seconds);
        if (seconds >= 15 && recorder.state === 'recording') recorder.stop();
      }, 250);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus(`No se pudo usar el micrófono: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const createVoice = async () => {
    if (!sample || !consent || (sampleSeconds !== null && (sampleSeconds < 6 || sampleSeconds > 30))) return;
    setIsSaving(true);
    setStatus('Creando el perfil de voz… puede tardar un poco.');
    try {
      const result = await cloneVoiceFromAudio(sample);
      setStatus(`✓ ${result.message}`);
      onCloned?.(result.voice_id);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="voice-cloner mt-4 rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-1">
        <UserRoundCheck className="w-4 h-4 text-violet-300" />
        <h4 className="font-bold text-violet-200 m-0">Clonar una voz</h4>
      </div>
      <p className="text-xs text-slate-400 mt-1 mb-3">
        Graba entre 8 y 15 segundos en un lugar silencioso, o sube un audio. Una sola muestra crea el perfil que usan tanto el modo rápido como el estándar; no necesitas escribir lo que dices.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isSaving}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold cursor-pointer ${isRecording ? 'bg-red-600/25 border-red-500 text-red-200' : 'bg-violet-600/20 border-violet-500/50 text-violet-200'}`}>
          {isRecording ? <CircleStop className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isRecording ? `Detener · ${recordingSeconds}s` : 'Grabar muestra'}
        </button>
        <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 font-bold cursor-pointer">
          <Upload className="w-4 h-4" /> Subir audio
          <input type="file" accept="audio/*" className="hidden" disabled={isSaving || isRecording}
            onChange={(event) => { selectSample(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
      </div>
      {isRecording && <p className="text-xs text-slate-300 mt-2 mb-0" role="timer">{recordingSeconds < 8 ? `Sigue hablando · ${Math.max(0, 8 - recordingSeconds)} s para la muestra recomendada` : 'Puedes detener la grabación cuando quieras.'}</p>}
      {sampleUrl && <audio className="w-full mt-3 h-9" controls src={sampleUrl} onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration) && sampleSeconds === null) {
          setSampleSeconds(duration);
          if (duration < 6) setStatus('La muestra es demasiado corta. Graba al menos 8 segundos para una voz más fiable.');
          if (duration > 30) setStatus('La muestra supera los 30 segundos. Elige un fragmento más corto.');
        }
      }} />}
      <label className="flex items-start gap-2 mt-3 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 accent-violet-500" />
        Confirmo que es mi voz o que tengo permiso explícito para clonarla.
      </label>
      <button type="button" onClick={createVoice} disabled={!sample || !consent || isSaving || isRecording || (sampleSeconds !== null && (sampleSeconds < 6 || sampleSeconds > 30))}
        className="w-full mt-3 p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer">
        {isSaving ? 'Creando voz…' : 'Crear y usar esta voz'}
      </button>
      {status && <p className="text-xs text-slate-300 mt-2 mb-0" role="status">{status}</p>}
    </div>
  );
}
