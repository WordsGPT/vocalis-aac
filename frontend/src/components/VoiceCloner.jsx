import React, { useEffect, useRef, useState } from 'react';
import { CircleStop, Mic, Upload, UserRoundCheck } from 'lucide-react';
import { cloneVoiceFromAudio } from '../services/api';

export function VoiceCloner({ onCloned }) {
  const [isRecording, setIsRecording] = useState(false);
  const [sample, setSample] = useState(null);
  const [sampleUrl, setSampleUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => () => {
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [sampleUrl]);

  const selectSample = (audio) => {
    if (!audio) return;
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSample(audio);
    setSampleUrl(URL.createObjectURL(audio));
    setStatus('Muestra lista. Escúchala antes de crear la voz.');
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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        selectSample(blob);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setIsRecording(true);
      setStatus('Grabando… habla con naturalidad durante 8–15 segundos.');
    } catch (error) {
      setStatus(`No se pudo usar el micrófono: ${error.message}`);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const createVoice = async () => {
    if (!sample || !consent) return;
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
        Graba entre 8 y 15 segundos en un lugar silencioso. No necesitas escribir lo que dices.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isSaving}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold cursor-pointer ${isRecording ? 'bg-red-600/25 border-red-500 text-red-200' : 'bg-violet-600/20 border-violet-500/50 text-violet-200'}`}>
          {isRecording ? <CircleStop className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isRecording ? 'Detener' : 'Grabar muestra'}
        </button>
        <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 font-bold cursor-pointer">
          <Upload className="w-4 h-4" /> Subir audio
          <input type="file" accept="audio/*" className="hidden" disabled={isSaving || isRecording}
            onChange={(event) => selectSample(event.target.files?.[0])} />
        </label>
      </div>
      {sampleUrl && <audio className="w-full mt-3 h-9" controls src={sampleUrl} />}
      <label className="flex items-start gap-2 mt-3 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 accent-violet-500" />
        Confirmo que es mi voz o que tengo permiso explícito para clonarla.
      </label>
      <button type="button" onClick={createVoice} disabled={!sample || !consent || isSaving || isRecording}
        className="w-full mt-3 p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer">
        {isSaving ? 'Creando voz…' : 'Crear y usar esta voz'}
      </button>
      {status && <p className="text-xs text-slate-300 mt-2 mb-0" role="status">{status}</p>}
    </div>
  );
}
