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

// Recipes built in "Build a recipe from my kitchen" and saved: full recipe objects (same shape as
// AFRICAN_RECIPES, with custom: true), kept on the phone per account.
const CUSTOM_KEY = (userId) => `saved_kitchen_recipes_${userId || 'anon'}`;
let custom = { userId: undefined, list: [] };
const customListeners = new Set();
const emitCustom = () => customListeners.forEach((fn) => { try { fn(custom.list); } catch (_) {} });

async function loadCustom(userId) {
  if (custom.userId === userId) return;
  custom = { userId, list: [] };
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_KEY(userId));
    const list = raw ? JSON.parse(raw) : [];
    if (custom.userId === userId) custom = { userId, list: Array.isArray(list) ? list : [] };
  } catch (_) {}
  emitCustom();
}

async function writeCustom(userId, list) {
  custom = { userId, list };
  emitCustom();
  try { await AsyncStorage.setItem(CUSTOM_KEY(userId), JSON.stringify(list)); } catch (_) {}
}

export async function saveCustomRecipe(userId, recipe) {
  await loadCustom(userId);
  await writeCustom(userId, [{ ...recipe, custom: true }, ...custom.list.filter((r) => r.id !== recipe.id)]);
}

export async function removeCustomRecipe(userId, recipeId) {
  await loadCustom(userId);
  await writeCustom(userId, custom.list.filter((r) => r.id !== recipeId));
}

export function useCustomRecipes(userId) {
  const [list, setList] = useState(custom.userId === userId ? custom.list : []);
  useEffect(() => {
    customListeners.add(setList);
    loadCustom(userId).then(() => setList(custom.list));
    return () => customListeners.delete(setList);
  }, [userId]);
  return list;
}
