// What the person has agreed to (App Store guidelines 5.1.1(ii) and 5.1.2(i)):
//  - ai: sending their meal photos, voice notes, descriptions and log summaries to third-party AI
//        (Google Gemini, Anthropic Claude). null = not asked yet.
//  - analytics: anonymous usage events to Mixpanel. null = not asked yet (events wait, unsent).
// Stored on the device; asked once after sign-in and changeable any time in Privacy Settings.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'logga_consent_v1';
let state = { ai: null, analytics: null };
let loaded = null;
const listeners = new Set();

export const loadConsent = () => {
  if (!loaded) {
    loaded = AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) state = { ...state, ...JSON.parse(raw) }; })
      .catch(() => {})
      .then(() => state);
  }
  return loaded;
};

export const getConsent = () => state;

export const saveConsent = async (patch) => {
  await loadConsent();
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((fn) => { try { fn(state); } catch (_) {} });
  return state;
};

export const onConsentChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// The app registers a function that shows the consent screen and resolves true/false.
let asker = null;
export const setAiConsentAsker = (fn) => { asker = fn; };

// Before any call that sends personal data to AI. Background work passes { silent: true } and simply
// skips when there's no consent; a feature the person tapped asks them first.
export const ensureAiConsent = async ({ silent = false } = {}) => {
  await loadConsent();
  if (state.ai === true) return true;
  if (silent || !asker) return false;
  return asker();
};

export class AiConsentError extends Error {
  constructor() { super('AI features are turned off. You can turn them on in Settings > Privacy Settings.'); this.code = 'AI_CONSENT'; }
}
