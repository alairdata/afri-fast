// Ask Logga's past conversations, kept on the account (profiles.app_prefs.askChats) so Recents can reopen a chat
// exactly as it was and carry on, like ChatGPT. The newest MAX_CHATS are kept, each with its last MAX_MESSAGES
// messages. Photos stay on the phone that took them (a photo's address means nothing elsewhere), so a reopened
// chat shows the words only.
import { getAccountPref, setAccountPref } from './accountPrefs';

const KEY = 'askChats';
const MAX_CHATS = 10;
const MAX_MESSAGES = 40;

export const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function loadChats(userId) {
  if (!userId) return [];
  const list = await getAccountPref(userId, KEY);
  return Array.isArray(list) ? list : [];
}

// What a chat is called in Recents: the meal it settled on, else what the person first asked.
const titleOf = (messages) => {
  const meal = [...messages].reverse().find((m) => m.loggableMeal?.title)?.loggableMeal;
  if (meal) return meal.title;
  const first = messages.find((m) => m.role === 'user' && String(m.content || '').trim());
  return first ? String(first.content).trim().slice(0, 60) : 'New chat';
};
const caloriesOf = (messages) => {
  const meal = [...messages].reverse().find((m) => m.loggableMeal?.foods?.length)?.loggableMeal;
  return meal ? Math.round(meal.foods.reduce((sum, f) => sum + (Number(f.cal) || 0), 0)) : null;
};

/** Saves (or updates) one chat and returns the new list, newest first. */
export async function saveChat(userId, id, messages) {
  if (!userId || !id || !messages.some((m) => m.role === 'user')) return loadChats(userId);
  const kept = messages.slice(-MAX_MESSAGES).map(({ photo, ...m }) => ({
    role: m.role, content: m.content || (photo ? '(photo)' : ''), ...(m.loggableMeal ? { loggableMeal: m.loggableMeal } : {}),
  }));
  const entry = { id, title: titleOf(messages), cal: caloriesOf(messages), updatedAt: new Date().toISOString(), messages: kept };
  const list = (await loadChats(userId)).filter((c) => c.id !== id);
  const next = [entry, ...list].slice(0, MAX_CHATS);
  setAccountPref(userId, KEY, next);
  return next;
}
