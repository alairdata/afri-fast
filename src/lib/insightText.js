// Plain-language AI text for the Insights tab (Gemini, via /api/gemini): the burnout explanation and
// the weekly pattern insight. Same idea as momentumWhy.js -- every answer is cached against a
// "fingerprint" of the facts that produced it, so the AI is only called again when the picture
// has materially changed (plus a 1-hour floor as a cost safety net), never on every render.
// Also owns "Got it": a dismissed card stays dismissed until its fingerprint changes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const MIN_REFRESH_MS = 60 * 60 * 1000;
const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const API_URL = `${BASE}/api/gemini`;

const cacheKey = (kind, userId) => `logga-ai-${kind}-v1-${userId}`;
const dismissKey = (userId) => `logga-dismissed-insights-v1-${userId}`;

async function callApi(type, data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'API error');
  return result;
}

async function readCache(kind, userId) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(kind, userId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// Whatever is cached right now, no network -- shown instantly while a refresh runs.
export async function getCachedAiText(kind, userId) {
  if (!userId) return null;
  return (await readCache(kind, userId))?.value || null;
}

// kind: 'burnout_why' | 'pattern_insight' (also the API type). Returns the text object, or the
// stale cached one if the call fails, or null.
export async function getAiText({ kind, userId, facts, fingerprint, force = false }) {
  if (!userId) return null;
  const cached = await readCache(kind, userId);
  if (cached) {
    const same = cached.fingerprint === fingerprint;
    const fresh = !force && Date.now() - cached.timestamp < MIN_REFRESH_MS;
    if (same || fresh) return cached.value;
  }
  try {
    const value = await callApi(kind, facts);
    await AsyncStorage.setItem(cacheKey(kind, userId), JSON.stringify({ fingerprint, value, timestamp: Date.now() })).catch(() => {});
    return value;
  } catch (e) {
    console.log('[insightText]', kind, e?.message);
    return cached?.value || null;
  }
}

// ---- "Got it" -----------------------------------------------------------------------------------

export async function getDismissedFingerprints(userId) {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(dismissKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export async function dismissInsight(userId, kind, fingerprint) {
  if (!userId) return;
  const all = await getDismissedFingerprints(userId);
  all[kind] = fingerprint;
  try { await AsyncStorage.setItem(dismissKey(userId), JSON.stringify(all)); } catch (_) {}
}
