// Saved recipes: the ids of recipes someone bookmarked, kept on the phone per account.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = (userId) => `saved_recipes_${userId || 'anon'}`;

let state = { userId: undefined, ids: [] };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(state.ids); } catch (_) {} });

async function load(userId) {
  if (state.userId === userId) return;
  state = { userId, ids: [] };
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    const ids = raw ? JSON.parse(raw) : [];
    if (state.userId === userId) state = { userId, ids: Array.isArray(ids) ? ids : [] };
  } catch (_) {}
  emit();
}

export async function toggleSavedRecipe(userId, recipeId) {
  await load(userId);
  const has = state.ids.includes(recipeId);
  state = { userId, ids: has ? state.ids.filter((id) => id !== recipeId) : [recipeId, ...state.ids] };
  emit();
  try { await AsyncStorage.setItem(KEY(userId), JSON.stringify(state.ids)); } catch (_) {}
  return !has;
}

// The saved ids for this account, kept current across every screen that uses it.
export function useSavedRecipes(userId) {
  const [ids, setIds] = useState(state.userId === userId ? state.ids : []);
  useEffect(() => {
    listeners.add(setIds);
    load(userId).then(() => setIds(state.ids));
    return () => listeners.delete(setIds);
  }, [userId]);
  return ids;
}
