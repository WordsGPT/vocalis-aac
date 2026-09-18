import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudioBlob } from '../services/api';

export function useSpeechRecognition({ onSpeechCompleted, autoTriggerDelay = 1500, sttMode = 'auto' }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const accumulatedTextRef = useRef('');

  // Detect whether native speech recognition is supported
  const isWebSpeechSupported = typeof window !== 'undefined' && 
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Auto trigger callback after silence
  const resetSilenceTimer = useCallback((textToEmit) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      const finalText = (textToEmit || accumulatedTextRef.current).trim();
      if (finalText && onSpeechCompleted) {
        onSpeechCompleted(finalText);
        // Clear interim view
        setInterimTranscript('');
      }
    }, autoTriggerDelay);
  }, [autoTriggerDelay, onSpeechCompleted]);

  // Start Web Audio analyser to measure mic volume for visualizer
  const startAudioVisualizer = async (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('Audio visualization not available:', e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    setAudioLevel(0);
  };

  // 1. Native Web Speech Recognition
  const startNativeSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        accumulatedTextRef.current = (accumulatedTextRef.current ? accumulatedTextRef.current + ' ' : '') + final.trim();
        setTranscript(accumulatedTextRef.current);
        resetSilenceTimer(accumulatedTextRef.current);
      }

      setInterimTranscript(interim);
      if (interim) {
        resetSilenceTimer(accumulatedTextRef.current + ' ' + interim);
      }
    };

    recognition.onerror = (err) => {
      if (err.error !== 'no-speech') {
        console.warn('Native speech recognition error:', err.error);
        setError(`Speech error: ${err.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still flagged as listening
      if (isListening && recognitionRef.current) {
        try {
          recognition.start();
        } catch (_) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to start SpeechRecognition:', e);
    }
  }, [isListening, resetSilenceTimer]);

  // 2. MediaRecorder + Whisper Fallback
  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioVisualizer(stream);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopAudioVisualizer();
        stream.getTracks().forEach((t) => t.stop());

        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (blob.size > 2000) {
            setIsTranscribing(true);
            try {
              const res = await transcribeAudioBlob(blob);
              const text = (res.text || '').trim();
              if (text) {
                accumulatedTextRef.current = text;
                setTranscript(text);
                if (onSpeechCompleted) {
                  onSpeechCompleted(text);
                }
              }
            } catch (err) {
              console.error('Whisper transcribe error:', err);
              setError('Transcription failed. Please try again.');
            } finally {
              setIsTranscribing(false);
            }
          }
        }
      };

      mediaRecorder.start(500); // 500ms chunks
    } catch (err) {
      console.error('Microphone access denied:', err);
      setError('Microphone access denied. Please allow microphone permissions.');
      setIsListening(false);
    }
  }, [onSpeechCompleted]);

  // Toggle Listening
  const startListening = useCallback(async () => {
    setError(null);
    accumulatedTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setIsListening(true);

    const preferWhisper = sttMode === 'whisper';
    if (!preferWhisper && isWebSpeechSupported) {
      // Also request audio stream for visualizer
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startAudioVisualizer(stream);
      } catch (_) {}
      startNativeSpeech();
    } else {
      startMediaRecorder();
    }
  }, [isWebSpeechSupported, sttMode, startNativeSpeech, startMediaRecorder]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    stopAudioVisualizer();
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Simulate incoming speech (for fast testing / demo)
  const simulateSpeech = useCallback((simulatedText) => {
    const text = (simulatedText || '').trim();
    if (!text) return;
    accumulatedTextRef.current = text;
    setTranscript(text);
    setInterimTranscript('');
    if (onSpeechCompleted) {
      onSpeechCompleted(text);
    }
  }, [onSpeechCompleted]);

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    isTranscribing,
    error,
    isWebSpeechSupported,
    startListening,
    stopListening,
    toggleListening,
    simulateSpeech,
    clearTranscript
  };
}
