// What the person has agreed to (App Store guidelines 5.1.1(ii) and 5.1.2(i)):
//  - ai: sending their meal photos, voice notes, descriptions and log summaries to third-party AI
//        providers. null = not asked yet.
//  - analytics: anonymous usage events to Mixpanel. null = not asked yet (events wait, unsent).
// Stored on the device and on the account (app_prefs.consent); asked once per account, changeable any time in
// Privacy Settings.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccountPref, setAccountPref } from './accountPrefs';

const KEY = 'logga_consent_v1';
// Each account's answer on this device, so logging out (which wipes the device copy) and back in to the
// same account doesn't ask again. Kept through log out; another account on the phone is still asked.
const BY_USER_KEY = 'logga_consent_by_user_v1';
export const CONSENT_KEYS_KEPT_ON_LOGOUT = [BY_USER_KEY];
let state = { ai: null, analytics: null };
let loaded = null;
let userId = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(state); } catch (_) {} });

const readByUser = () => AsyncStorage.getItem(BY_USER_KEY).then((raw) => (raw ? JSON.parse(raw) : {})).catch(() => ({}));
const rememberForUser = async () => {
  if (!userId) return;
  const all = await readByUser();
  all[userId] = state;
  AsyncStorage.setItem(BY_USER_KEY, JSON.stringify(all)).catch(() => {});
};

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

// Who is signed in. Brings back that account's earlier answer when this device has none (after a log out),
// and remembers an answer given before the account was known.
export const setConsentUser = async (id) => {
  await loadConsent();
  userId = id || null;
  if (!userId) return state;
  if (state.ai == null) {
    // This phone's earlier answer for the account, else the one kept on the account (any phone, any log out).
    let saved = (await readByUser())[userId];
    if (!saved || saved.ai == null) saved = await getAccountPref(userId, 'consent');
    if (saved && saved.ai != null) {
      state = { ...state, ai: saved.ai, analytics: saved.analytics ?? state.analytics };
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
      rememberForUser();
      notify();
    }
  } else {
    rememberForUser();
    // An answer given before it was kept on the account: copy it up once, so the next phone or log in has it.
    getAccountPref(userId, 'consent').then((onAccount) => {
      if (!onAccount || onAccount.ai == null) setAccountPref(userId, 'consent', { ai: state.ai, analytics: state.analytics });
    });
  }
  return state;
};

// On log out, after the device copy is wiped: forget the answer held in memory too.
export const resetConsentMemory = () => {
  state = { ai: null, analytics: null };
  loaded = null;
  userId = null;
};

export const saveConsent = async (patch) => {
  await loadConsent();
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  rememberForUser();
  if (userId) setAccountPref(userId, 'consent', { ai: state.ai, analytics: state.analytics }); // follows them to any phone
  notify();
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
