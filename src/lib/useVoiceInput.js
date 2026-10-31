// Tap-to-talk for a text box (Ask Logga, Fit it in, Build a recipe) and the web side of Say it. On the web the
// browser's speech recognition writes as you speak, listening for the person's own English (Ghana, Nigeria,
// Kenya...) and carrying on through pauses until they stop; then the AI fixes misheard local food names
// ("walk eye" -> "waakye"). On phones it records, then the server writes down what was said. The words land in the
// box so they can be checked before sending. voice: 'idle' | 'listening' | 'transcribing'.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { ensureAiConsent, AiConsentError } from './consent';
import { aiHeaders } from './aiAuth';

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';

// The person's country (set by the app once the profile loads), for the speech language and the name fix.
let voiceCountry = '';
export const setVoiceCountry = (country) => { voiceCountry = country || ''; };

const LANG_BY_COUNTRY = {
  Ghana: 'en-GH', Nigeria: 'en-NG', Kenya: 'en-KE', Tanzania: 'en-TZ', Uganda: 'en-UG',
  'South Africa': 'en-ZA', Cameroon: 'en-GB', Ethiopia: 'en-GB', Senegal: 'en-GB',
};
// English as spoken where they are: their country's, else the browser's own English, else British English.
export const speechLang = () => {
  if (LANG_BY_COUNTRY[voiceCountry]) return LANG_BY_COUNTRY[voiceCountry];
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return /^en-/i.test(nav || '') ? nav : 'en-GB';
};

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

async function post(type, data) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  const response = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ type, data }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not hear that');
  return result;
}

async function transcribe(uri) {
  const base64 = await readUriAsBase64(uri);
  return (await post('transcribe_audio', { base64, country: voiceCountry })).text || '';
}

/** The browser's words with misheard local food names put right; the words as they were if that fails. */
export async function fixTranscript(text) {
  const t = String(text || '').trim();
  if (!t) return t;
  try { return (await post('fix_transcript', { text: t, country: voiceCountry })).text || t; } catch (_) { return t; }
}

const WEB_ERRORS = {
  'not-allowed': 'Allow the microphone for this site in your browser to use voice.',
  'service-not-allowed': 'Allow the microphone for this site in your browser to use voice.',
  'audio-capture': 'No microphone found. Check it’s plugged in, or type it.',
  network: 'Voice needs an internet connection. Check it, or type it.',
};

/**
 * The browser's speech recognition, listening until stop() even through pauses (browsers end a session after a
 * few quiet seconds; it starts a new one and keeps what was already said). onText(all words so far);
 * onEnd(note) when it stops on its own because of a problem. Returns { stop } or null when the browser can't.
 */
export function startWebSpeech({ onText, onEnd }) {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) return null;
  let stopped = false;
  let kept = ''; // words from earlier sessions
  let rec = null;
  const join = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(' ');
  const begin = () => {
    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechLang();
    let session = '';
    rec.onresult = (e) => {
      session = '';
      for (let i = 0; i < e.results.length; i++) session += e.results[i][0].transcript;
      onText(join(kept, session));
    };
    rec.onerror = (e) => {
      const note = WEB_ERRORS[e?.error];
      if (note) { stopped = true; onEnd?.(note); }
      // 'no-speech' and 'aborted' just end this session; onend starts the next one.
    };
    rec.onend = () => {
      kept = join(kept, session);
      if (!stopped) { try { begin(); } catch (_) { stopped = true; onEnd?.(null); } }
    };
    rec.start();
  };
  begin();
  return { stop: () => { stopped = true; try { rec?.stop(); } catch (_) {} } };
}

// text/setText: the box's value; active: false stops any recording (screen closed); joiner goes between what was
// already in the box and the new words.
export function useVoiceInput({ text, setText, active = true, joiner = ' ' }) {
  const [voice, setVoice] = useState('idle');
  const [voiceNote, setVoiceNote] = useState(null);
  const recordingRef = useRef(null);
  const speechRef = useRef(null);
  const baseTextRef = useRef('');
  const saidRef = useRef('');
  const join = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(joiner);

  const startVoice = async () => {
    setVoiceNote(null);
    baseTextRef.current = text;
    saidRef.current = '';
    if (Platform.OS === 'web') {
      const ctl = startWebSpeech({
        onText: (said) => { saidRef.current = said; setText(join(baseTextRef.current, said)); },
        onEnd: (note) => { speechRef.current = null; if (note) setVoiceNote(note); setVoice('idle'); },
      });
      if (!ctl) { setVoiceNote('Voice isn’t supported in this browser. Try Chrome, or type it.'); return; }
      speechRef.current = ctl;
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
      const said = saidRef.current.trim();
      if (!said) { setVoice('idle'); setVoiceNote('Didn’t catch that. Try again, or type it.'); return; }
      setVoice('transcribing');
      const fixed = await fixTranscript(said);
      setText(join(baseTextRef.current, fixed));
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
    speechRef.current = null;
    recordingRef.current?.stopAndUnloadAsync?.().catch(() => {});
    recordingRef.current = null;
    setVoice('idle');
    return undefined;
  }, [active]);

  return { voice, voiceNote, startVoice, stopVoice };
}
