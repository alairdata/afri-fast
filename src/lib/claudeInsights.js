import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_CACHE_KEY = 'claude_daily_insights_v1';
const JFY_CACHE_KEY = 'claude_just_for_you_v1';
const JFY_TTL = 3 * 24 * 60 * 60 * 1000; // 72 hours

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

async function getCached(cacheKey, userId) {
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

async function saveCache(cacheKey, userId, payload) {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      userId,
      timestamp: Date.now(),
      ...payload,
    }));
  } catch (_) {}
}

// Returns last cached daily insights immediately (no TTL — keep forever until replaced)
export async function getCachedDailyInsights(userId) {
  if (!userId) return null;
  const cached = await getCached(DAILY_CACHE_KEY, userId);
  if (!cached?.cards?.length) return null;
  return { cards: cached.cards, alertCard: cached.alertCard || null };
}

// Fetches fresh daily insights from API and updates cache
export async function refreshDailyInsights(data) {
  const userId = data?.profile?.userId;
  if (!userId) return null;

  try {
    const result = await callApi('daily_insights', data);
    if (result?.cards?.length) {
      await saveCache(DAILY_CACHE_KEY, userId, {
        cards: result.cards,
        alertCard: result.alertCard || '',
      });
    }
    return { cards: result?.cards || null, alertCard: result?.alertCard || null };
  } catch (e) {
    console.error('[DailyInsights error]', e);
    return null;
  }
}

export async function getJustForYou(data, forceRefresh = false) {
  const userId = data?.profile?.userId;
  if (!userId) return null;

  if (!forceRefresh) {
    const cached = await getCached(JFY_CACHE_KEY, userId);
    if (cached && Date.now() - cached.timestamp < JFY_TTL) return cached.cards;
  }

  try {
    const result = await callApi('just_for_you', data);
    const cards = result?.cards;
    if (cards?.length) await saveCache(JFY_CACHE_KEY, userId, { cards });
    return cards;
  } catch (e) {
    console.error('[JustForYou error]', e);
    return null;
  }
}
