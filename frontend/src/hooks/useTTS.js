import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchEdgeTTSAudio, fetchStreamingTTSAudio, getClientId } from '../services/api';
import { clearPreparedAudio, loadPreparedAudio, savePreparedAudio } from '../services/preparedAudio';

const START_BUFFER_SECONDS = 0.2;
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 24;

function pcmToWav(chunks, sampleRate) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const label = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  label(0, 'RIFF'); view.setUint32(4, 36 + length, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, length, true);
  return new Blob([header, ...chunks], { type: 'audio/wav' });
}

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
  const preparationRef = useRef(null);
  const cacheRef = useRef(new Map());
  const cacheBytesRef = useRef(0);
  const ttsMode = settings.ttsMode || 'browser';
  const qwenEngine = settings.qwenEngine || 'streaming';
  const browserVoiceURI = settings.browserVoiceURI || '';
  const edgeVoiceId = settings.edgeVoiceId || 'qwen-clone';
  const speechRate = settings.speechRate ?? 1;
  const speechPitch = settings.speechPitch ?? 1;
  const voiceRevision = settings.voiceRevision || 'original';
  const audioKey = useCallback((text, engine) => JSON.stringify([
    getClientId(), voiceRevision, text, edgeVoiceId, engine, speechRate, speechPitch,
  ]), [voiceRevision, edgeVoiceId, speechRate, speechPitch]);

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
    preparationRef.current?.abort();
    preparationRef.current = null;
    window.speechSynthesis?.cancel();
    releaseAudio();
    setIsSpeaking(false);
    setIsLoading(false);
    setCurrentText('');
  }, [releaseAudio]);

  const clearCache = useCallback(() => {
    stop();
    cacheRef.current.clear();
    cacheBytesRef.current = 0;
    clearPreparedAudio().catch(() => {});
  }, [stop]);

  const cancelPreparation = useCallback(() => {
    preparationRef.current?.abort();
    preparationRef.current = null;
  }, []);

  const rememberAudio = useCallback((key, blob) => {
    if (!blob?.size || blob.size > MAX_ENTRY_BYTES) return;
    const cache = cacheRef.current;
    if (cache.has(key)) cacheBytesRef.current -= cache.get(key).size;
    cache.delete(key);
    cache.set(key, blob);
    cacheBytesRef.current += blob.size;
    while (cache.size > MAX_CACHE_ENTRIES || cacheBytesRef.current > MAX_CACHE_BYTES) {
      const oldest = cache.keys().next().value;
      cacheBytesRef.current -= cache.get(oldest).size;
      cache.delete(oldest);
    }
  }, []);

  useEffect(() => () => {
    generation.current += 1;
    abortRef.current?.abort();
    preparationRef.current?.abort();
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
    const recorded = [];
    let recordedBytes = 0;
    let canCache = true;
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
      if (value?.length) {
        pending = append(pending, value);
        if (canCache && recordedBytes + value.length <= MAX_ENTRY_BYTES - 44) {
          recorded.push(value.slice());
          recordedBytes += value.length;
        } else {
          canCache = false;
          recorded.length = 0;
        }
      }
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
    return canCache ? pcmToWav(recorded, sampleRate) : null;
  }, []);

  const speak = useCallback(async (value, { prepared = false } = {}) => {
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
    const engine = prepared && edgeVoiceId === 'qwen-clone' ? 'standard' : qwenEngine;
    const cacheKey = audioKey(text, engine);
    const playAudioBlob = async (blob) => {
      const url = URL.createObjectURL(blob);
      if (!isCurrent()) { URL.revokeObjectURL(url); return; }
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
    const playStandard = async () => {
      const signed = (number) => (number >= 0 ? '+' : '') + number;
      const blob = await fetchEdgeTTSAudio(
        text,
        edgeVoiceId,
        `${signed(Math.round((speechRate - 1) * 100))}%`,
        `${signed(Math.round((speechPitch - 1) * 50))}Hz`,
        controller.signal,
      );
      if (!isCurrent()) return;
      await playAudioBlob(blob);
      if (isCurrent()) {
        rememberAudio(cacheKey, blob);
        if (prepared) savePreparedAudio(cacheKey, blob).catch(() => {});
      }
    };

    try {
      let cached = cacheRef.current.get(cacheKey);
      if (!cached) {
        cached = await loadPreparedAudio(cacheKey);
        if (cached && isCurrent()) rememberAudio(cacheKey, cached);
      }
      if (!isCurrent()) return;
      if (cached) {
        cacheRef.current.delete(cacheKey);
        cacheRef.current.set(cacheKey, cached);
        await playAudioBlob(cached);
        return;
      }
      const useStreaming = engine === 'streaming' && edgeVoiceId === 'qwen-clone';
      if (useStreaming) {
        try {
          const response = await fetchStreamingTTSAudio(text, controller.signal);
          const blob = await playPcmStream(response, controller.signal, () => {
            if (isCurrent()) setIsLoading(false);
          });
          if (isCurrent()) rememberAudio(cacheKey, blob);
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
  }, [stop, releaseAudio, playPcmStream, rememberAudio, audioKey, ttsMode, qwenEngine, edgeVoiceId, browserVoiceURI, browserVoices, speechRate, speechPitch]);

  const preparePhrases = useCallback(async (phrases, onProgress = () => {}) => {
    if (ttsMode === 'browser') return { completed: 0, total: 0, cancelled: false };
    cancelPreparation();
    const controller = new AbortController();
    preparationRef.current = controller;
    const words = [...new Set(phrases.map(text => text.trim()).filter(Boolean))];
    let completed = 0;
    let failed = false;
    for (const text of words) {
      if (controller.signal.aborted) break;
      const key = audioKey(text, 'standard');
      try {
        const stored = await loadPreparedAudio(key);
        let blob = stored || cacheRef.current.get(key);
        if (!stored) {
          const signed = number => (number >= 0 ? '+' : '') + number;
          if (!blob) {
            blob = await fetchEdgeTTSAudio(
              text, edgeVoiceId,
              `${signed(Math.round((speechRate - 1) * 100))}%`,
              `${signed(Math.round((speechPitch - 1) * 50))}Hz`,
              controller.signal,
            );
          }
          if (controller.signal.aborted) break;
          if (!await savePreparedAudio(key, blob)) throw new Error('No se pudo guardar el audio preparado.');
        }
        if (controller.signal.aborted) break;
        rememberAudio(key, blob);
        completed += 1;
      } catch (problem) {
        if (problem.name === 'AbortError') break;
        // A missing profile or offline voice service would fail every phrase.
        failed = true;
        break;
      }
      onProgress(completed, words.length);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (preparationRef.current === controller) preparationRef.current = null;
    return { completed, total: words.length, cancelled: controller.signal.aborted, failed };
  }, [ttsMode, cancelPreparation, audioKey, edgeVoiceId, speechRate, speechPitch, rememberAudio]);

  return { isSpeaking, isLoading, currentText, error, browserVoices, speak, stop, clearCache, preparePhrases, cancelPreparation };
}
