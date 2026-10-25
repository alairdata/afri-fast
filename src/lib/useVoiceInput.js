// Tap-to-talk for a text box, as on Fit it in: on the web the browser's speech recognition writes as you speak;
// on phones it records, then the server writes down what was said. The words land in the box so they can be
// checked before sending. voice: 'idle' | 'listening' | 'transcribing'.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { ensureAiConsent, AiConsentError } from './consent';

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';

const readUriAsBase64 = async (uri) => {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) return uri.split(',')[1];
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
};

async function transcribe(uri) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  const base64 = await readUriAsBase64(uri);
  const response = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'transcribe_audio', data: { base64 } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not hear that');
  return result.text || '';
}

// text/setText: the box's value; active: false stops any recording (screen closed)
export function useVoiceInput({ text, setText, active = true, joiner = ' ' }) {
  const [voice, setVoice] = useState('idle');
  const [voiceNote, setVoiceNote] = useState(null);
  const recordingRef = useRef(null);
  const speechRef = useRef(null);
  const baseTextRef = useRef('');
  const join = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(joiner);

  const startVoice = async () => {
    setVoiceNote(null);
    baseTextRef.current = text;
    if (Platform.OS === 'web') {
      const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!SR) { setVoiceNote('Voice isn’t supported in this browser. Try Chrome, or type it.'); return; }
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (e) => {
        let said = '';
        for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
        setText(join(baseTextRef.current, said));
      };
      rec.onerror = () => setVoice('idle');
      rec.onend = () => setVoice((v) => (v === 'listening' ? 'idle' : v));
      speechRef.current = rec;
      rec.start();
      setVoice('listening');
      return;
    }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setVoiceNote('Allow the microphone in Settings to use voice.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setVoice('listening');
    } catch (_) {
      setVoiceNote('Couldn’t start the microphone. Try again, or type it.');
    }
  };

  const stopVoice = async () => {
    if (Platform.OS === 'web') {
      speechRef.current?.stop();
      speechRef.current = null;
      setVoice('idle');
      return;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    try { await rec?.stopAndUnloadAsync(); } catch (_) {}
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch (_) {}
    const uri = rec?.getURI();
    if (!uri) { setVoice('idle'); return; }
    setVoice('transcribing');
    try {
      const said = await transcribe(uri);
      if (said) setText(join(baseTextRef.current, said));
      else setVoiceNote('Didn’t catch that. Try again, or type it.');
    } catch (e) {
      setVoiceNote(e instanceof AiConsentError ? 'AI features are off. Turn them on in Settings › Privacy Settings.' : 'Didn’t catch that. Try again, or type it.');
    }
    setVoice('idle');
  };

  useEffect(() => {
    if (active) return undefined;
    speechRef.current?.stop?.();
    recordingRef.current?.stopAndUnloadAsync?.().catch(() => {});
    recordingRef.current = null;
    setVoice('idle');
    return undefined;
  }, [active]);

  return { voice, voiceNote, startVoice, stopVoice };
}
