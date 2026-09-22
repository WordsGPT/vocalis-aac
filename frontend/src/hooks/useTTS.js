import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchEdgeTTSAudio, fetchStreamingTTSAudio } from '../services/api';

const START_BUFFER_SECONDS = 0.2;

export function useTTS(settings = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState('');
  const [browserVoices, setBrowserVoices] = useState([]);
  const audioRef = useRef(null);
  const streamAudioRef = useRef(null);
  const urlRef = useRef(null);
  const generation = useRef(0);
  const abortRef = useRef(null);
  const ttsMode = settings.ttsMode || 'browser';
  const qwenEngine = settings.qwenEngine || 'standard';
  const browserVoiceURI = settings.browserVoiceURI || '';
  const edgeVoiceId = settings.edgeVoiceId || 'qwen-clone';
  const speechRate = settings.speechRate ?? 1;
  const speechPitch = settings.speechPitch ?? 1;

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => setBrowserVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    const streaming = streamAudioRef.current;
    if (streaming) {
      streamAudioRef.current = null;
      clearTimeout(streaming.timer);
      streaming.reader?.cancel().catch(() => {});
      streaming.sources.forEach((source) => { try { source.stop(); } catch (_) {} });
      streaming.context.close().catch(() => {});
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    generation.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    window.speechSynthesis?.cancel();
    releaseAudio();
    setIsSpeaking(false);
    setIsLoading(false);
    setCurrentText('');
  }, [releaseAudio]);

  useEffect(() => () => {
    generation.current += 1;
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    releaseAudio();
  }, [releaseAudio]);

  const playPcmStream = useCallback(async (response, signal, onFirstAudio) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Este navegador no puede reproducir audio transmitido.');
    const sampleRate = Number(response.headers.get('X-Audio-Sample-Rate')) || 24000;
    const context = new AudioCtx();
    await context.resume?.();
    const reader = response.body.getReader();
    const playback = { context, reader, sources: new Set(), timer: null };
    streamAudioRef.current = playback;
    let pending = new Uint8Array(0);
    let started = false;
    let nextStart = 0;
    const startThreshold = Math.round(sampleRate * 2 * START_BUFFER_SECONDS);

    const append = (left, right) => {
      const joined = new Uint8Array(left.length + right.length);
      joined.set(left);
      joined.set(right, left.length);
      return joined;
    };
    const schedule = (bytes) => {
      const usableLength = bytes.length - (bytes.length % 2);
      if (!usableLength) return bytes;
      const view = new DataView(bytes.buffer, bytes.byteOffset, usableLength);
      const samples = new Float32Array(usableLength / 2);
      for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => playback.sources.delete(source);
      if (!started) {
        started = true;
        nextStart = context.currentTime + START_BUFFER_SECONDS;
        onFirstAudio();
      }
      source.start(nextStart);
      nextStart += buffer.duration;
      playback.sources.add(source);
      return bytes.slice(usableLength);
    };

    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (value?.length) pending = append(pending, value);
      if (!started && pending.length >= startThreshold) pending = schedule(pending);
      else if (started && pending.length >= 2) pending = schedule(pending);
      if (done) break;
    }
    if (pending.length >= 2) pending = schedule(pending);
    if (!started) throw new Error('El motor rápido no devolvió audio.');

    const remainingMs = Math.max(0, (nextStart - context.currentTime) * 1000);
    await new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      playback.timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, remainingMs + 30);
    });
  }, []);

  const speak = useCallback(async (value) => {
    const text = (value || '').trim();
    if (!text) return;
    stop();
    const request = generation.current;
    const isCurrent = () => generation.current === request;
    setError('');
    setIsSpeaking(true);
    setCurrentText(text);

    const finish = () => {
      if (!isCurrent()) return;
      releaseAudio();
      setIsLoading(false);
      setIsSpeaking(false);
      setCurrentText('');
    };
    let browserFallbackStarted = false;
    const browserSpeak = () => {
      if (!isCurrent() || browserFallbackStarted) return;
      browserFallbackStarted = true;
      releaseAudio();
      setIsLoading(false);
      if (!window.speechSynthesis) {
        setError('Este navegador no puede reproducir la voz.');
        finish();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
      utterance.voice = browserVoices.find((voice) => voice.voiceURI === browserVoiceURI)
        || browserVoices.find((voice) => voice.lang?.startsWith('es')) || browserVoices[0] || null;
      utterance.lang = utterance.voice?.lang || 'es-ES';
      utterance.onend = finish;
      utterance.onerror = () => {
        if (!isCurrent()) return;
        setError('No se pudo reproducir el mensaje. Comprueba el audio e inténtalo de nuevo.');
        finish();
      };
      window.speechSynthesis.speak(utterance);
    };
    if (ttsMode === 'browser') {
      browserSpeak();
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const playStandard = async () => {
      const signed = (number) => (number >= 0 ? '+' : '') + number;
      const url = await fetchEdgeTTSAudio(
        text,
        edgeVoiceId,
        `${signed(Math.round((speechRate - 1) * 100))}%`,
        `${signed(Math.round((speechPitch - 1) * 50))}Hz`,
        controller.signal,
      );
      if (!isCurrent()) {
        URL.revokeObjectURL(url);
        return;
      }
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = finish;
      audio.onerror = () => {
        if (!isCurrent()) return;
        setError('La voz seleccionada no está disponible. Usando la voz del navegador.');
        browserSpeak();
      };
      await audio.play();
      if (isCurrent()) setIsLoading(false);
    };

    try {
      const useStreaming = qwenEngine === 'streaming' && edgeVoiceId === 'qwen-clone';
      if (useStreaming) {
        try {
          const response = await fetchStreamingTTSAudio(text, controller.signal);
          await playPcmStream(response, controller.signal, () => {
            if (isCurrent()) setIsLoading(false);
          });
          finish();
          return;
        } catch (problem) {
          if (!isCurrent() || problem.name === 'AbortError') return;
          releaseAudio();
          setError('El motor rápido no está disponible; usando el motor estándar.');
          setIsLoading(true);
        }
      }
      await playStandard();
    } catch (problem) {
      if (!isCurrent() || problem.name === 'AbortError') return;
      setError('La voz seleccionada no está disponible. Usando la voz del navegador.');
      browserSpeak();
    }
  }, [stop, releaseAudio, playPcmStream, ttsMode, qwenEngine, edgeVoiceId, browserVoiceURI, browserVoices, speechRate, speechPitch]);

  return { isSpeaking, isLoading, currentText, error, browserVoices, speak, stop };
}
