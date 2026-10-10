// Logga's analytics: Mixpanel through its plain HTTP API (no native module, so it works in the iOS app,
// Expo Go and the web build alike). Modelled on So-UnFiltered AI's lib/analytics.ts: one `track()`,
// user properties, identify-on-login, and the same silent-failure rule -- analytics must never break
// the app. Logga uses its OWN Mixpanel project (token below), not SUAI's.
//
// Set the project token with EXPO_PUBLIC_MIXPANEL_TOKEN (EAS secret / .env). With no token every call
// here is a harmless no-op. The full event list is documented in MIXPANEL_EVENTS.md.
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConsent, loadConsent, onConsentChange } from './consent';

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '';
const APP_VERSION = (() => { try { return require('../../app.json').expo.version; } catch (_) { return ''; } })();

const ANON_KEY = 'logga-mp-anon-id';
const USER_KEY = 'logga-mp-user-id';
const QUEUE_KEY = 'logga-mp-queue';
const MAX_QUEUE = 100;
const FLUSH_MS = 2000;

export const EVENTS = {
  // Session
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  BOUNCE_DETECTED: 'bounce_detected',
  // Auth
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  LOGIN_FAILED: 'login_failed',
  EMAIL_VERIFIED: 'email_verified',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  USER_LOGGED_OUT: 'user_logged_out',
  ACCOUNT_DELETED: 'account_deleted',
  FORM_VALIDATION_ERROR: 'form_validation_error',
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  // Logging (the core loop)
  MEAL_LOGGED: 'meal_logged',
  FIRST_MEAL_LOGGED: 'first_meal_logged',
  MEAL_DELETED: 'meal_deleted',
  WATER_LOGGED: 'water_logged',
  WEIGHT_LOGGED: 'weight_logged',
  STEPS_LOGGED: 'steps_logged',
  ACTIVITY_LOGGED: 'activity_logged',
  CALORIE_TARGET_CHANGED: 'calorie_target_changed',
  // Retention & activation
  ACTIVATION_MILESTONE: 'activation_milestone',
  RETENTION_DAY: 'retention_day',
  STREAK_MILESTONE: 'streak_milestone',
  // Quality & frustration
  CLIENT_ERROR: 'client_error',
  UNHANDLED_REJECTION: 'unhandled_rejection',
  AI_RESPONSE_ERROR: 'ai_response_error',
  // Growth
  EMAIL_SENT: 'email_sent',
  NOTIFICATION_OPENED: 'notification_opened',
  WIDGET_OPENED: 'widget_opened',
};

let ready = null;        // resolves once ids are loaded
let anonId = null;
let userId = null;
let queue = [];
let flushTimer = null;
let sessionStartedAt = 0;
let messagesLogged = 0;

// Consent (guideline 5.1.1(ii)): events wait on the device until the person says yes on the consent
// screen, are sent from then on, and are dropped if they say no.
const enabled = () => !!MIXPANEL_TOKEN && getConsent().analytics !== false;
const canSend = () => !!MIXPANEL_TOKEN && getConsent().analytics === true;
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
const distinctId = () => userId || `$device:${anonId}`;

const post = async (path, payload) => {
  try {
    // Form-encoded `data=` is what Mixpanel's own libraries send; it also avoids a CORS preflight on web.
    const r = await fetch(`https://api.mixpanel.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/plain' },
      body: `data=${encodeURIComponent(JSON.stringify(payload))}`,
    });
    return r.ok;
  } catch (_) {
    return false;
  }
};

const init = () => {
  if (ready) return ready;
  ready = (async () => {
    try {
      await loadConsent();
      anonId = await AsyncStorage.getItem(ANON_KEY);
      if (!anonId) { anonId = uuid(); await AsyncStorage.setItem(ANON_KEY, anonId); }
      userId = await AsyncStorage.getItem(USER_KEY);
      const saved = await AsyncStorage.getItem(QUEUE_KEY);
      if (saved) queue = [...JSON.parse(saved), ...queue].slice(-MAX_QUEUE);
    } catch (_) { anonId = anonId || uuid(); }
  })();
  return ready;
};

const persistQueue = () => { AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => {}); };

const flush = async () => {
  flushTimer = null;
  if (!canSend() || !queue.length) return;
  const batch = queue.splice(0, 50);
  const ok = await post('/track?verbose=0', batch);
  if (!ok) queue = [...batch, ...queue].slice(-MAX_QUEUE); // offline: keep for the next try
  persistQueue();
  if (ok && queue.length) scheduleFlush();
};
const scheduleFlush = () => { if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS); };

onConsentChange((c) => {
  if (c.analytics === true) scheduleFlush();
  else if (c.analytics === false) { queue = []; persistQueue(); }
});

export function track(event, properties = {}) {
  if (!enabled()) return;
  (async () => {
    try {
      await init();
      queue.push({
        event,
        properties: {
          ...properties,
          token: MIXPANEL_TOKEN,
          distinct_id: distinctId(),
          $device_id: anonId,
          ...(userId ? { $user_id: userId } : {}),
          time: Date.now(),
          $insert_id: uuid(),
          platform: Platform.OS,
          app_version: APP_VERSION,
          $os: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web',
        },
      });
      if (queue.length > MAX_QUEUE) queue.shift();
      persistQueue();
      scheduleFlush();
    } catch (_) { /* silent */ }
  })();
}

// Call once the person is signed in. Links everything they did before sign-up (their anonymous
// device id) to their account, the way Mixpanel's identify does in SUAI's web app.
export function identify(id) {
  if (!enabled() || !id) return;
  (async () => {
    try {
      await init();
      if (userId === id) return;
      const previous = userId;
      userId = id;
      await AsyncStorage.setItem(USER_KEY, id);
      if (!previous) {
        queue.push({ event: '$identify', properties: { $identified_id: id, $anon_id: `$device:${anonId}`, token: MIXPANEL_TOKEN } });
        scheduleFlush();
      }
    } catch (_) { /* silent */ }
  })();
}

// Call on log-out / account deletion so the next person on this phone starts clean.
export function resetAnalytics() {
  (async () => {
    try {
      await flush();
      userId = null;
      anonId = uuid();
      await AsyncStorage.multiRemove([USER_KEY, QUEUE_KEY]);
      await AsyncStorage.setItem(ANON_KEY, anonId);
      queue = [];
    } catch (_) { /* silent */ }
  })();
}

const engage = (op, props) => {
  if (!canSend()) return;
  (async () => {
    try {
      await init();
      if (!userId) return; // profile properties only make sense for a known person
      await post('/engage?verbose=0', [{ $token: MIXPANEL_TOKEN, $distinct_id: userId, [op]: props }]);
    } catch (_) { /* silent */ }
  })();
};
export const setUserProperties = (props) => engage('$set', props);
export const setUserPropertiesOnce = (props) => engage('$set_once', props);
export const incrementUserProperty = (name, by = 1) => engage('$add', { [name]: by });

// ---------------------------------------------------------------------------------------------
// Sessions, retention and streaks (SUAI's MixpanelInit, for a phone app)
// ---------------------------------------------------------------------------------------------
const RETENTION_DAYS = [1, 3, 7, 14, 30];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function trackRetentionAndStreak(createdAt) {
  try {
    if (createdAt) {
      const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
      for (const day of RETENTION_DAYS) {
        if (days < day) continue;
        const key = `logga-mp-retention-${day}`;
        if (await AsyncStorage.getItem(key)) continue;
        await AsyncStorage.setItem(key, '1');
        track(EVENTS.RETENTION_DAY, { day });
      }
    }
    // Consecutive days the app was opened (separate from the meal-logging streak the app shows).
    const today = todayKey();
    const last = await AsyncStorage.getItem('logga-mp-streak-date');
    if (last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = last === todayKey(y) ? (parseInt(await AsyncStorage.getItem('logga-mp-streak-count'), 10) || 0) + 1 : 1;
    await AsyncStorage.setItem('logga-mp-streak-date', today);
    await AsyncStorage.setItem('logga-mp-streak-count', String(streak));
    if (STREAK_MILESTONES.includes(streak)) track(EVENTS.STREAK_MILESTONE, { streak_days: streak });
  } catch (_) { /* silent */ }
}

let sessionWired = false;
// Call when a signed-in session starts: identifies the person, records session_started, and ends the
// session (with a bounce flag for visits under 30s) when the app goes to the background.
export function startSession({ id, name, email, createdAt, onboardingComplete }) {
  if (!enabled() || !id) return;
  identify(id);
  (async () => {
    try {
      const last = await AsyncStorage.getItem('logga-mp-last-visit');
      await AsyncStorage.setItem('logga-mp-last-visit', String(Date.now()));
      sessionStartedAt = Date.now();
      messagesLogged = 0;
      setUserProperties({
        ...(name ? { $name: name } : {}),
        ...(email ? { $email: email } : {}),
        ...(createdAt ? { $created: createdAt } : {}),
        last_active_date: new Date().toISOString(),
        onboarding_completed: !!onboardingComplete,
        platform: Platform.OS,
      });
      incrementUserProperty('total_sessions');
      track(EVENTS.SESSION_STARTED, { returning: !!last });
      trackRetentionAndStreak(createdAt);
    } catch (_) { /* silent */ }
  })();

  if (sessionWired) return;
  sessionWired = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'background' && sessionStartedAt) {
      const seconds = Math.round((Date.now() - sessionStartedAt) / 1000);
      if (seconds < 30) track(EVENTS.BOUNCE_DETECTED, { session_duration_seconds: seconds });
      track(EVENTS.SESSION_ENDED, { session_duration_seconds: seconds, logs_this_session: messagesLogged });
      sessionStartedAt = 0;
      flush();
    } else if (state === 'active' && !sessionStartedAt && userId) {
      sessionStartedAt = Date.now();
      messagesLogged = 0;
      track(EVENTS.SESSION_STARTED, { returning: true });
    }
  });
}

// Counts a log (meal, water...) toward the session summary.
export const countSessionLog = () => { messagesLogged += 1; };

// ---------------------------------------------------------------------------------------------
// Crash-ish signals: uncaught errors and unhandled promise rejections (capped per launch, like SUAI)
// ---------------------------------------------------------------------------------------------
let errorsSeen = 0;
let rejectionsSeen = 0;
let errorTrackingOn = false;
export function installErrorTracking() {
  if (errorTrackingOn || !enabled()) return;
  errorTrackingOn = true;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        if (errorsSeen++ >= 10) return;
        track(EVENTS.CLIENT_ERROR, { message: String(e.message || '').slice(0, 200), filename: String(e.filename || '').slice(0, 200), line: e.lineno, col: e.colno });
      });
      window.addEventListener('unhandledrejection', (e) => {
        if (rejectionsSeen++ >= 10) return;
        track(EVENTS.UNHANDLED_REJECTION, { reason: String(e.reason?.message || e.reason || '').slice(0, 200) });
      });
      return;
    }
    const utils = global.ErrorUtils;
    const previous = utils?.getGlobalHandler?.();
    utils?.setGlobalHandler?.((error, isFatal) => {
      if (errorsSeen++ < 10) track(EVENTS.CLIENT_ERROR, { message: String(error?.message || error).slice(0, 200), fatal: !!isFatal });
      flush();
      previous?.(error, isFatal);
    });
  } catch (_) { /* silent */ }
}
