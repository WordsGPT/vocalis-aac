import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudioBlob } from '../services/api';

const VOICE_LEVEL = 8;
const QUIET_LEVEL = 5;
const MIN_VOICE_MS = 120;
const MAX_RECORDING_MS = 20000;

export function useSpeechRecognition({ onSpeechCompleted, autoTriggerDelay = 1500, sttMode = 'whisper', sttLang = 'es-ES' }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const maxRecordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const accumulatedTextRef = useRef('');
  const streamRef = useRef(null);
  const listeningRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const voiceStartedAtRef = useRef(null);
  const quietStartedAtRef = useRef(null);
  const skipTranscriptionRef = useRef(false);
  const callbackRef = useRef(onSpeechCompleted);

  useEffect(() => { callbackRef.current = onSpeechCompleted; }, [onSpeechCompleted]);

  const isWebSpeechSupported = typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopAudioVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    setAudioLevel(0);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    listeningRef.current = false;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecordingTimerRef.current);
    recognitionRef.current?.abort();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    releaseStream();
    stopAudioVisualizer();
  }, [releaseStream, stopAudioVisualizer]);

  const startAudioVisualizer = useCallback(async (stream, onLevel) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteTimeDomainData(samples);
        let squareSum = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          squareSum += centered * centered;
        }
        const level = Math.min(100, Math.round(Math.sqrt(squareSum / samples.length) * 360));
        setAudioLevel(level);
        onLevel?.(level, performance.now());
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.warn('Audio visualization not available:', err);
    }
  }, []);

  const resetNativeSilenceTimer = useCallback((textToEmit) => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const finalText = (textToEmit || accumulatedTextRef.current).trim();
      if (finalText) callbackRef.current?.(finalText);
      accumulatedTextRef.current = '';
      setInterimTranscript('');
    }, autoTriggerDelay);
  }, [autoTriggerDelay]);

  const startNativeSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Este navegador no ofrece texto en directo. Usa el modo automático.');
      listeningRef.current = false;
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLang || 'es-ES';
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      if (!listeningRef.current) return;
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim || final) {
        speechDetectedRef.current = true;
        setIsSpeechDetected(true);
      }
      if (final) {
        accumulatedTextRef.current = `${accumulatedTextRef.current} ${final}`.trim();
        setTranscript(accumulatedTextRef.current);
        resetNativeSilenceTimer(accumulatedTextRef.current);
      }
      setInterimTranscript(interim);
      if (interim) clearTimeout(silenceTimerRef.current);
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      setError(event.error === 'not-allowed'
        ? 'Permite el acceso al micrófono en el navegador.'
        : 'El texto en directo falló. Selecciona Automático en Ajustes.');
      listeningRef.current = false;
      setIsListening(false);
      releaseStream();
      stopAudioVisualizer();
    };
    recognition.onend = () => {
      if (listeningRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch (_) {}
      }
    };
    try { recognition.start(); } catch (_) {
      setError('No se pudo iniciar el reconocimiento de voz.');
      listeningRef.current = false;
      setIsListening(false);
    }
  }, [releaseStream, resetNativeSilenceTimer, stopAudioVisualizer, sttLang]);

  const stopRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      listeningRef.current = false;
      setIsListening(false);
      clearTimeout(maxRecordingTimerRef.current);
      try { recorder.stop(); } catch (_) {}
    }
  }, []);

  const startMediaRecorder = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!listeningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError('No se pudo grabar el audio del micrófono.');
      recorder.onstop = async () => {
        clearTimeout(maxRecordingTimerRef.current);
        stopAudioVisualizer();
        releaseStream();
        mediaRecorderRef.current = null;
        listeningRef.current = false;
        setIsListening(false);
        if (skipTranscriptionRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000) {
          setError('La grabación fue demasiado corta. Inténtalo de nuevo.');
          return;
        }
        setIsTranscribing(true);
        try {
          const result = await transcribeAudioBlob(blob, sttLang);
          const text = (result.text || '').trim();
          if (!text) throw new Error('No se detectó ninguna frase.');
          accumulatedTextRef.current = text;
          setTranscript(text);
          callbackRef.current?.(text);
        } catch (err) {
          setError(err.message || 'No se pudo transcribir. Inténtalo de nuevo.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      startAudioVisualizer(stream, (level, now) => {
        if (level >= VOICE_LEVEL) {
          quietStartedAtRef.current = null;
          if (voiceStartedAtRef.current === null) voiceStartedAtRef.current = now;
          if (!speechDetectedRef.current && now - voiceStartedAtRef.current >= MIN_VOICE_MS) {
            speechDetectedRef.current = true;
            setIsSpeechDetected(true);
          }
        } else {
          voiceStartedAtRef.current = null;
          if (speechDetectedRef.current && level <= QUIET_LEVEL) {
            if (quietStartedAtRef.current === null) quietStartedAtRef.current = now;
            if (now - quietStartedAtRef.current >= autoTriggerDelay) stopRecorder();
          } else if (level > QUIET_LEVEL) quietStartedAtRef.current = null;
        }
      });
      maxRecordingTimerRef.current = setTimeout(() => {
        if (!speechDetectedRef.current) {
          skipTranscriptionRef.current = true;
          setError('No oí ninguna voz. Comprueba el micrófono y vuelve a intentarlo.');
        }
        stopRecorder();
      }, MAX_RECORDING_MS);
    } catch (err) {
      console.error('Microphone access failed:', err);
      listeningRef.current = false;
      setIsListening(false);
      releaseStream();
      stopAudioVisualizer();
      setError('No se pudo abrir el micrófono. Revisa el permiso del navegador.');
    }
  }, [autoTriggerDelay, releaseStream, startAudioVisualizer, stopAudioVisualizer, stopRecorder, sttLang]);

  const startListening = useCallback(async () => {
    if (listeningRef.current || isTranscribing) return;
    listeningRef.current = true;
    speechDetectedRef.current = false;
    voiceStartedAtRef.current = null;
    quietStartedAtRef.current = null;
    skipTranscriptionRef.current = false;
    setIsSpeechDetected(false);
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    accumulatedTextRef.current = '';
    setIsListening(true);
    // Old "auto" settings are migrated to the reliable server path too.
    if (sttMode !== 'browser') {
      startMediaRecorder();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!listeningRef.current) return stream.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      startAudioVisualizer(stream);
    } catch (_) { /* SpeechRecognition can still request permission itself. */ }
    if (listeningRef.current) startNativeSpeech();
  }, [isTranscribing, startAudioVisualizer, startMediaRecorder, startNativeSpeech, sttMode]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxRecordingTimerRef.current);
    if (recognitionRef.current) {
      const remaining = accumulatedTextRef.current.trim();
      if (remaining) callbackRef.current?.(remaining);
      accumulatedTextRef.current = '';
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
      releaseStream();
      stopAudioVisualizer();
    } else stopRecorder();
  }, [releaseStream, stopAudioVisualizer, stopRecorder]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  const simulateSpeech = useCallback((simulatedText) => {
    const text = (simulatedText || '').trim();
    if (!text) return;
    accumulatedTextRef.current = text;
    setTranscript(text);
    setInterimTranscript('');
    callbackRef.current?.(text);
  }, []);

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening, transcript, interimTranscript, audioLevel, isSpeechDetected,
    isTranscribing, error, isWebSpeechSupported, startListening, stopListening,
    toggleListening, simulateSpeech, clearTranscript,
  };
}
