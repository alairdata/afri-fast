// AI-generated "why" line for the Momentum gauge — reuses the same /api/ai + user_insights
// caching pattern as claudeInsights.js, but instead of a fixed daily refresh slot, it's keyed
// on a fingerprint of the driving numbers (see InsightsTab.jsx): regenerate when the picture
// actually changes, not on every render, with a 1-hour floor as a cost safety net regardless.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const CACHE_KEY = 'claude_momentum_nudge_v1';
const REMOTE_TYPE = 'momentum_nudge';
const MIN_REFRESH_MS = 60 * 60 * 1000;

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const API_URL = `${BASE}/api/ai`;

async function callApi(data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: REMOTE_TYPE, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'API error');
  return result;
}

async function getLocalCache(userId) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

async function saveLocalCache(userId, payload) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId, timestamp: Date.now(), ...payload }));
  } catch (_) {}
}

async function getRemoteCache(userId) {
  try {
    const { data, error } = await supabase
      .from('user_insights')
      .select('cards, refreshed_at')
      .eq('user_id', userId)
      .eq('type', REMOTE_TYPE)
      .maybeSingle();
    if (error || !data?.cards?.[0]) return null;
    return { ...data.cards[0], timestamp: new Date(data.refreshed_at).getTime() };
  } catch (_) {
    return null;
  }
}

async function saveRemoteCache(userId, payload) {
  try {
    await supabase.from('user_insights').upsert({
      user_id: userId,
      type: REMOTE_TYPE,
      cards: [payload],
      refreshed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type' });
  } catch (_) {}
}

// Fast path — whatever's cached locally right now, no network. Callers show this instantly
// while getMomentumNudge refreshes in the background.
export async function getCachedMomentumNudge(userId) {
  if (!userId) return null;
  const cached = await getLocalCache(userId);
  return cached?.nudge || null;
}

// facts: the structured, already-computed numbers (subscores, kcal gaps, burnout drivers, the
// trailing 14-day gym/steps split) — never anything the model has to infer on its own.
// fingerprint: a coarse string built from those same facts (see InsightsTab.jsx), rounded enough
// that trivial noise doesn't force a regenerate — only a materially different picture does.
export async function getMomentumNudge({ userId, facts, fingerprint }) {
  if (!userId) return null;

  const [local, remote] = await Promise.all([getLocalCache(userId), getRemoteCache(userId)]);
  const newest = [local, remote].filter(Boolean).sort((a, b) => b.timestamp - a.timestamp)[0];

  if (newest) {
    const sameFingerprint = newest.fingerprint === fingerprint;
    const withinSafetyWindow = Date.now() - newest.timestamp < MIN_REFRESH_MS;
    if (sameFingerprint || withinSafetyWindow) {
      if (remote && (!local || remote.timestamp > local.timestamp)) {
        await saveLocalCache(userId, { nudge: remote.nudge, fingerprint: remote.fingerprint });
      }
      return newest.nudge;
    }
  }

  try {
    const result = await callApi(facts);
    if (result?.nudge) {
      const payload = { nudge: result.nudge, fingerprint };
      await Promise.all([saveLocalCache(userId, payload), saveRemoteCache(userId, payload)]);
      return result.nudge;
    }
  } catch (e) {
    console.error('[MomentumNudge error]', e);
  }
  return newest?.nudge || null; // stale-but-present beats nothing if the call failed
}
