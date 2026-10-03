import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudioBlob } from '../services/api';

const VOICE_LEVEL = 8;
const QUIET_LEVEL = 5;
const MAX_RECORDING_MS = 12000;
const newSession = () => globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useSpeechRecognition({ onSpeechCompleted, onSpeechActivity, autoTriggerDelay = 1000,
  sttMode = 'whisper', sttLang = 'es-ES', suspended = false, autoListen = false }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [turns, setTurns] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [diarization, setDiarization] = useState('unknown');
  const config = useRef({});
  config.current = { onSpeechCompleted, onSpeechActivity, autoTriggerDelay, sttMode, sttLang, suspended };
  const desired = useRef(false);
  const generation = useRef(0);
  const session = useRef(newSession());
  const capture = useRef(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const controllers = useRef(new Set());
  const mounted = useRef(true);
  const isWebSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const dispose = useCallback((discard = true) => {
    const current = capture.current;
    capture.current = null;
    if (!current) return;
    current.closed = true;
    current.discard = discard;
    cancelAnimationFrame(current.frame);
    clearTimeout(current.timer);
    current.recognition?.abort();
    if (current.recorder?.state === 'recording') current.recorder.stop();
    current.stream?.getTracks().forEach(track => track.stop());
    current.context?.close().catch(() => {});
    setAudioLevel(0);
    setIsSpeechDetected(false);
  }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    pending.current = 0;
    setIsTranscribing(false);
    queue.current = Promise.resolve();
  }, []);

  const deliver = useCallback((result, metadata = {}) => {
    const text = (result.text || '').trim();
    if (!text) return;
    setError(null);
    const nextTurns = result.turns?.length ? result.turns : [{ text, speaker: null, speaker_label: 'Voz sin identificar' }];
    setTranscript(text);
    setInterimTranscript('');
    setTurns(nextTurns);
    setDiarization(result.diarization || 'unavailable');
    config.current.onSpeechCompleted?.(text, { ...metadata, turns: nextTurns });
  }, []);

  const enqueue = useCallback((blob, epoch, metadata) => {
    if (blob.size < 1000 || epoch !== generation.current) return;
    const sessionId = session.current;
    const language = config.current.sttLang;
    pending.current += 1;
    setIsTranscribing(true);
    // Preserve turn order even when transcription takes longer than a pause.
    queue.current = queue.current.then(async () => {
      if (epoch !== generation.current || !mounted.current) return;
      const controller = new AbortController();
      controllers.current.add(controller);
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const result = await transcribeAudioBlob(blob, language, sessionId, controller.signal);
        if (epoch === generation.current && mounted.current) deliver(result, metadata);
      } catch (err) {
        if (epoch === generation.current && mounted.current) setError(err.name === 'AbortError'
          ? 'La transcripción tardó demasiado. Puedes escribir el mensaje.' : err.message);
      } finally {
        clearTimeout(timeout);
        controllers.current.delete(controller);
        if (epoch === generation.current && mounted.current) {
          pending.current -= 1;
          setIsTranscribing(pending.current > 0);
        }
      }
    });
  }, [deliver]);

  const begin = useCallback(async () => {
    if (capture.current || !desired.current || config.current.suspended) return;
    const epoch = generation.current;
    const current = { closed: false, discard: false, voice: false, active: false, lastVoice: 0, voiceStart: 0 };
    capture.current = current;
    try {
      if (config.current.sttMode === 'browser') {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) throw new Error('Este navegador no ofrece texto en directo. Usa Escucha de conversación.');
        const recognition = new Recognition();
        current.recognition = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = config.current.sttLang;
        current.text = '';
        recognition.onresult = event => {
          if (current.closed) return;
          config.current.onSpeechActivity?.();
          clearTimeout(current.timer);
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) current.text += ` ${event.results[i][0].transcript}`;
            else interim += event.results[i][0].transcript;
          }
          setInterimTranscript(interim || current.text);
          setIsSpeechDetected(true);
          current.timer = setTimeout(() => {
            if (current.closed) return;
            setIsSpeechDetected(false);
            if (current.text.trim()) deliver({ text: current.text }, { automatic: true });
            current.text = '';
          }, config.current.autoTriggerDelay);
        };
        recognition.onend = () => {
          if (!current.closed) { try { recognition.start(); } catch { /* A pending start can race onend. */ } }
        };
        recognition.onerror = event => {
          if (current.closed || event.error === 'no-speech') return;
          setError('Falló la escucha del navegador. Usa Escucha de conversación en Ajustes.');
          desired.current = false;
          setIsListening(false);
          dispose();
        };
        recognition.start();
        setDiarization('unavailable');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (current.closed || epoch !== generation.current || !desired.current || config.current.suspended) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      current.stream = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      current.context = new AudioCtx();
      await current.context.resume();
      if (current.closed) return;
      const analyser = current.context.createAnalyser();
      analyser.fftSize = 512;
      current.context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));

      const rotate = reason => {
        if (current.recorder?.state !== 'recording') return;
        current.reason = reason;
        current.recorder.stop();
      };
      const record = () => {
        if (current.closed) return;
        const chunks = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        current.recorder = recorder;
        current.voice = false;
        current.started = performance.now();
        recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
        recorder.onstop = () => {
          const hasVoice = current.voice;
          const reason = current.reason;
          const discard = current.discard;
          if (!current.closed) record();
          if (hasVoice && !discard) {
            if (pending.current >= 4) {
              setError('La conexión no sigue el ritmo. Se ha pausado la escucha; vuelve a activarla.');
              desired.current = false;
              setIsListening(false);
              dispose();
            } else enqueue(new Blob(chunks, { type: recorder.mimeType }), epoch, { automatic: true, boundary: reason });
          }
        };
        recorder.onerror = () => {
          setError('No se pudo grabar el micrófono. Vuelve a activar Escuchar.');
          desired.current = false;
          setIsListening(false);
          dispose();
        };
        recorder.start(250);
      };
      record();
      const meter = () => {
        if (current.closed) return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
        const level = Math.min(100, Math.round(rms * 360));
        const now = performance.now();
        setAudioLevel(level);
        if (level >= VOICE_LEVEL) {
          if (!current.voiceStart) current.voiceStart = now;
          current.lastVoice = now;
          if (now - current.voiceStart >= 120) {
            current.voice = true;
            if (!current.active) {
              current.active = true;
              setIsSpeechDetected(true);
              config.current.onSpeechActivity?.();
            }
          }
        } else if (level <= QUIET_LEVEL) {
          current.voiceStart = 0;
          if (current.active && now - current.lastVoice >= config.current.autoTriggerDelay) {
            current.active = false;
            setIsSpeechDetected(false);
            rotate('pause');
          }
        }
        if (now - current.started >= MAX_RECORDING_MS) rotate('limit');
        current.frame = requestAnimationFrame(meter);
      };
      meter();
    } catch (err) {
      if (!current.closed && epoch === generation.current) {
        setError(err.name === 'NotAllowedError'
          ? 'Permite el acceso al micrófono en tu navegador y pulsa Escuchar.'
          : err.name === 'NotFoundError'
            ? 'No se ha encontrado un micrófono. Conecta uno y pulsa Escuchar.'
            : err.name === 'NotReadableError'
              ? 'No se puede usar el micrófono. Comprueba si otra aplicación lo está usando.'
              : 'No se pudo abrir el micrófono. Revisa el permiso del navegador.');
        desired.current = false;
        setIsListening(false);
        dispose();
      }
    }
  }, [deliver, dispose, enqueue]);

  const startListening = useCallback(() => {
    if (desired.current) return;
    desired.current = true;
    setIsListening(true);
    setError(null);
    begin();
  }, [begin]);
  const stopListening = useCallback(() => {
    desired.current = false;
    setIsListening(false);
    dispose(false);
  }, [dispose]);
  const pauseForPlayback = useCallback(() => {
    invalidate();
    dispose();
    setInterimTranscript('');
  }, [dispose, invalidate]);
  useEffect(() => {
    if (suspended) pauseForPlayback();
    else {
      const timer = setTimeout(() => { if (desired.current) begin(); }, 500);
      return () => clearTimeout(timer);
    }
  }, [suspended, begin, pauseForPlayback]);
  useEffect(() => {
    invalidate();
    dispose();
    if (desired.current) begin();
  }, [sttMode, sttLang, begin, dispose, invalidate]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      desired.current = false;
      invalidate();
      dispose();
    };
  }, [dispose, invalidate]);
  // Only entering/leaving conversation changes the listening intent. Playback
  // and transcription must not undo an explicit press of Detener escucha.
  useEffect(() => {
    if (autoListen) startListening();
    else stopListening();
  }, [autoListen, startListening, stopListening]);
  const resetConversation = useCallback(() => {
    invalidate();
    dispose();
    session.current = newSession();
    setTranscript('');
    setInterimTranscript('');
    setTurns([]);
    setDiarization('unknown');
    if (desired.current) begin();
  }, [begin, dispose, invalidate]);

  return { isListening, transcript, interimTranscript, turns, diarization, audioLevel, isSpeechDetected,
    isTranscribing, error, isWebSpeechSupported, startListening, stopListening, pauseForPlayback, resetConversation,
    toggleListening: () => desired.current ? stopListening() : startListening(),
    simulateSpeech: text => deliver({ text }, { automatic: false }),
    clearTranscript: () => { setTranscript(''); setInterimTranscript(''); setTurns([]); },
  };
}
