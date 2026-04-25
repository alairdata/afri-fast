import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DAILY_CACHE_KEY = 'claude_daily_insights_v1';
const JFY_CACHE_KEY = 'claude_just_for_you_v2';
const JFY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Returns the timestamp of the most recent 6am refresh slot (today's if past 6am, else yesterday's)
function lastScheduledSlot() {
  const now = new Date();
  const slot6am = new Date(now); slot6am.setHours(6, 0, 0, 0);
  if (now.getHours() >= 6) return slot6am.getTime();
  const yest6am = new Date(now); yest6am.setDate(yest6am.getDate() - 1); yest6am.setHours(6, 0, 0, 0);
  return yest6am.getTime();
}

const API_URL = '/api/ai';

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

async function getLocalCache(cacheKey, userId) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

async function saveLocalCache(cacheKey, userId, payload) {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      userId,
      timestamp: Date.now(),
      ...payload,
    }));
  } catch (_) {}
}

async function getRemoteCache(userId, type) {
  try {
    const { data, error } = await supabase
      .from('user_insights')
      .select('cards, alert_card, refreshed_at')
      .eq('user_id', userId)
      .eq('type', type)
      .maybeSingle();
    if (error || !data) return null;
    return {
      cards: data.cards,
      alertCard: data.alert_card,
      timestamp: new Date(data.refreshed_at).getTime(),
    };
  } catch (_) {
    return null;
  }
}

async function saveRemoteCache(userId, type, payload) {
  try {
    await supabase.from('user_insights').upsert({
      user_id: userId,
      type,
      cards: payload.cards,
      alert_card: payload.alertCard || null,
      refreshed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type' });
  } catch (_) {}
}

// Returns fresh cached data (local or remote) or null if both are stale.
// maxAge: milliseconds TTL (JFY). If null, uses slot-based freshness (daily insights).
//
// Server is the source of truth across devices. We always read both local and
// remote in parallel and prefer whichever is more recent — that way every
// device converges on the same cards and we never burn an extra API call when
// another device already generated them.
async function getCached(cacheKey, userId, remoteType, maxAge = null) {
  const isStale = (ts) => maxAge ? (Date.now() - ts > maxAge) : (ts < lastScheduledSlot());

  const [local, remote] = await Promise.all([
    getLocalCache(cacheKey, userId),
    getRemoteCache(userId, remoteType),
  ]);

  const localTs = local?.timestamp || 0;
  const remoteTs = remote?.timestamp || 0;
  const localFresh = local && !isStale(localTs);
  const remoteFresh = remote && !isStale(remoteTs);

  // Remote at least as recent as local and fresh → use remote (and sync down if newer).
  if (remoteFresh && remoteTs >= localTs) {
    if (remoteTs > localTs) {
      await saveLocalCache(cacheKey, userId, { cards: remote.cards, alertCard: remote.alertCard });
    }
    return { userId, timestamp: remoteTs, cards: remote.cards, alertCard: remote.alertCard };
  }

  // Otherwise fall back to local if it's still fresh (offline / remote unreachable).
  if (localFresh) return local;

  return null;
}

async function saveCache(cacheKey, userId, remoteType, payload) {
  await Promise.all([
    saveLocalCache(cacheKey, userId, payload),
    saveRemoteCache(userId, remoteType, payload),
  ]);
}

// Returns last cached daily insights from local storage only (fast path for instant display)
export async function getCachedDailyInsights(userId) {
  if (!userId) return null;
  const cached = await getLocalCache(DAILY_CACHE_KEY, userId);
  if (!cached?.cards?.length) return null;
  if (!cached.cards[0]?.feeling) return null;
  return { cards: cached.cards, alertCard: cached.alertCard || null };
}

export async function insightsNeedRefresh(userId) {
  if (!userId) return true;
  const cached = await getCached(DAILY_CACHE_KEY, userId, 'daily');
  if (!cached?.cards?.length || !cached.cards[0]?.feeling) return true;
  return cached.timestamp < lastScheduledSlot();
}

export async function getScheduledDailyInsights(data) {
  const userId = data?.profile?.userId;
  if (!userId) return null;
  const slotStart = lastScheduledSlot();
  const cached = await getCached(DAILY_CACHE_KEY, userId, 'daily');
  if (cached?.cards?.length && cached.cards[0]?.feeling && cached.timestamp >= slotStart) {
    return { cards: cached.cards, alertCard: cached.alertCard || null, fromCache: true };
  }
  return refreshDailyInsights(data);
}

export async function refreshDailyInsights(data) {
  const userId = data?.profile?.userId;
  if (!userId) return null;

  try {
    const result = await callApi('daily_insights', data);
    if (result?.cards?.length) {
      await saveCache(DAILY_CACHE_KEY, userId, 'daily', {
        cards: result.cards,
        alertCard: result.alertCard || '',
      });
    }
    return {
      cards: result?.cards || null,
      alertCard: result?.alertCard || null,
      prediction: result?.prediction || null,
    };
  } catch (e) {
    console.error('[DailyInsights error]', e);
    return null;
  }
}

export async function getJustForYou(data, forceRefresh = false) {
  const userId = data?.profile?.userId;
  if (!userId) return null;

  if (!forceRefresh) {
    const cached = await getCached(JFY_CACHE_KEY, userId, 'just_for_you_v2', JFY_TTL);
    if (cached?.cards?.length) return cached.cards;
  }

  try {
    const result = await callApi('just_for_you', data);
    const cards = result?.cards;
    if (cards?.length) await saveCache(JFY_CACHE_KEY, userId, 'just_for_you_v2', { cards });
    return cards;
  } catch (e) {
    console.error('[JustForYou error]', e);
    return null;
  }
}
