// In-app notifications: the nudges Lumi has sent (meal, water, streak, walk, insights), kept on
// the phone so the bell on Today can list them. They are local notifications, so the app records
// one when it arrives while the app is open, when it is tapped, and, every time the app comes to
// the front, every one still sitting in the phone's notification centre.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (userId) => `notif_inbox_${userId || 'anon'}`;
const MAX_ITEMS = 50;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let cache = { userId: null, items: [], seenAt: 0 };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(cache); } catch (_) {} });

export const onInboxChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getInbox = () => cache;

export async function loadInbox(userId) {
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    const saved = raw ? JSON.parse(raw) : {};
    cache = { userId, items: Array.isArray(saved.items) ? saved.items : [], seenAt: saved.seenAt || 0 };
  } catch (_) {
    cache = { userId, items: [], seenAt: 0 };
  }
  emit();
  return cache;
}

async function save() {
  try { await AsyncStorage.setItem(KEY(cache.userId), JSON.stringify({ items: cache.items, seenAt: cache.seenAt })); } catch (_) {}
}

// Takes expo-notifications Notification objects ({ date, request: { identifier, content } }).
export async function recordNotifications(notifications) {
  const incoming = (notifications || [])
    .map((n) => {
      const content = n?.request?.content || {};
      if (!content.title && !content.body) return null;
      const at = typeof n.date === 'number' ? (n.date < 1e12 ? n.date * 1000 : n.date) : Date.now();
      return {
        id: `${n.request.identifier}-${Math.round(at / 60000)}`,
        title: content.title || '',
        body: content.body || '',
        type: content.data?.type || null,
        at,
      };
    })
    .filter(Boolean);
  if (!incoming.length) return;
  const known = new Set(cache.items.map((i) => i.id));
  const fresh = incoming.filter((i) => !known.has(i.id));
  if (!fresh.length) return;
  const cutoff = Date.now() - MAX_AGE_MS;
  cache = {
    ...cache,
    items: [...fresh, ...cache.items].filter((i) => i.at >= cutoff).sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS),
  };
  emit();
  await save();
}

export const unseenCount = (state = cache) => state.items.filter((i) => i.at > state.seenAt).length;

export async function markAllSeen() {
  cache = { ...cache, seenAt: Date.now() };
  emit();
  await save();
}
