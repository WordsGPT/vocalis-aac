import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchEdgeTTSAudio } from '../services/api';

export function useTTS(settings = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [browserVoices, setBrowserVoices] = useState([]);
  const audioRef = useRef(null);

  const ttsMode = settings.ttsMode || 'browser'; // 'browser' | 'edge-tts'
  const browserVoiceURI = settings.browserVoiceURI || '';
  const edgeVoiceId = settings.edgeVoiceId || 'en-US-GuyNeural';
  const speechRate = settings.speechRate ?? 1.0; // 0.5 - 1.5
  const speechPitch = settings.speechPitch ?? 1.0; // 0.5 - 1.5

  // Load browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setBrowserVoices(voices);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Stop any active speech
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    setCurrentText('');
  }, []);

  // Speak a piece of text
  const speak = useCallback(async (textToSpeak) => {
    const text = (textToSpeak || '').trim();
    if (!text) return;

    stop();
    setIsSpeaking(true);
    setCurrentText(text);

    if (ttsMode === 'edge-tts') {
      try {
        const ratePercent = `${Math.round((speechRate - 1.0) * 100)}%`;
        const rateParam = ratePercent.startsWith('-') ? ratePercent : `+${ratePercent}`;
        const pitchHz = `${Math.round((speechPitch - 1.0) * 50)}Hz`;
        const pitchParam = pitchHz.startsWith('-') ? pitchHz : `+${pitchHz}`;

        const audioUrl = await fetchEdgeTTSAudio(text, edgeVoiceId, rateParam, pitchParam);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentText('');
        };
        audio.onerror = (e) => {
          console.warn('Edge-TTS playback failed, falling back to browser synthesis:', e);
          fallbackBrowserSpeak(text);
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn('Edge-TTS request failed, using browser synthesis:', err);
        fallbackBrowserSpeak(text);
        return;
      }
    }

    // Default: Browser Web SpeechSynthesis
    fallbackBrowserSpeak(text);
  }, [ttsMode, edgeVoiceId, browserVoiceURI, speechRate, speechPitch, stop]);

  const fallbackBrowserSpeak = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      setIsSpeaking(false);
      setCurrentText('');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;

    if (browserVoiceURI) {
      const selected = browserVoices.find((v) => v.voiceURI === browserVoiceURI);
      if (selected) utterance.voice = selected;
    } else {
      // Pick good default English voice if available
      const preferred = browserVoices.find((v) => v.lang.startsWith('en') && !v.name.includes('Google') || v.default);
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentText('');
    };

    utterance.onerror = (err) => {
      console.error('SpeechSynthesis error:', err);
      setIsSpeaking(false);
      setCurrentText('');
    };

    window.speechSynthesis.speak(utterance);
  };

  return {
    isSpeaking,
    currentText,
    browserVoices,
    speak,
    stop
  };
}
