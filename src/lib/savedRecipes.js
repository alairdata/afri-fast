// Saved recipes, kept on the account (Supabase saved_recipes) so they survive logging out and follow the person to
// any phone: bookmarks (the ids of built-in recipes) and recipes built in "Build a recipe from my kitchen" (whole
// recipe objects, same shape as AFRICAN_RECIPES, with custom: true). The phone keeps a copy for a fast first paint
// and for when the account can't be reached; logging out wipes that copy, the account keeps the real one.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const KEY = (userId) => `saved_recipes_${userId || 'anon'}`;
const CUSTOM_KEY = (userId) => `saved_kitchen_recipes_${userId || 'anon'}`;
const TABLE = 'saved_recipes';

let state = { userId: undefined, ids: [], list: [] };
let loading = null;
const listeners = new Set();
const customListeners = new Set();
const emit = () => {
  listeners.forEach((fn) => { try { fn(state.ids); } catch (_) {} });
  customListeners.forEach((fn) => { try { fn(state.list); } catch (_) {} });
};
const cache = () => AsyncStorage.multiSet([[KEY(state.userId), JSON.stringify(state.ids)], [CUSTOM_KEY(state.userId), JSON.stringify(state.list)]]).catch(() => {});
const remote = (q, label) => Promise.resolve(q).then(({ error } = {}) => { if (error) console.warn(`[Saved recipes] ${label}`, error.message); }, () => {});

async function load(userId) {
  if (state.userId === userId) return loading;
  state = { userId, ids: [], list: [] };
  loading = (async () => {
    // 1. the phone's copy, shown straight away
    try {
      const [[, rawIds], [, rawList]] = await AsyncStorage.multiGet([KEY(userId), CUSTOM_KEY(userId)]);
      const ids = rawIds ? JSON.parse(rawIds) : [];
      const list = rawList ? JSON.parse(rawList) : [];
      if (state.userId === userId) state = { userId, ids: Array.isArray(ids) ? ids : [], list: Array.isArray(list) ? list : [] };
    } catch (_) {}
    emit();
    if (!userId) return;
    // 2. the account's copy, which wins
    const { data, error } = await supabase.from(TABLE).select('kind, recipe_id, data').eq('user_id', userId).order('created_at', { ascending: false });
    if (error || state.userId !== userId) return; // offline, or before the table exists: keep the phone's copy
    if (!data.length && (state.ids.length || state.list.length)) {
      // Saved on this phone before they were kept on the account: move them up once.
      const rows = [
        ...state.ids.map((id) => ({ user_id: userId, kind: 'bookmark', recipe_id: String(id) })),
        ...state.list.map((r) => ({ user_id: userId, kind: 'custom', recipe_id: String(r.id), data: r })),
      ];
      await remote(supabase.from(TABLE).upsert(rows), 'move phone copy to account');
      return;
    }
    state = {
      userId,
      ids: data.filter((r) => r.kind === 'bookmark').map((r) => (/^\d+$/.test(r.recipe_id) ? Number(r.recipe_id) : r.recipe_id)),
      list: data.filter((r) => r.kind === 'custom' && r.data).map((r) => ({ ...r.data, custom: true })),
    };
    emit();
    cache();
  })();
  return loading;
}

export async function toggleSavedRecipe(userId, recipeId) {
  await load(userId);
  const has = state.ids.includes(recipeId);
  state = { ...state, ids: has ? state.ids.filter((id) => id !== recipeId) : [recipeId, ...state.ids] };
  emit();
  cache();
  if (userId) {
    await remote(has
      ? supabase.from(TABLE).delete().eq('user_id', userId).eq('kind', 'bookmark').eq('recipe_id', String(recipeId))
      : supabase.from(TABLE).upsert({ user_id: userId, kind: 'bookmark', recipe_id: String(recipeId) }), 'bookmark');
  }
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

export async function saveCustomRecipe(userId, recipe) {
  await load(userId);
  const saved = { ...recipe, custom: true };
  state = { ...state, list: [saved, ...state.list.filter((r) => r.id !== recipe.id)] };
  emit();
  cache();
  if (userId) await remote(supabase.from(TABLE).upsert({ user_id: userId, kind: 'custom', recipe_id: String(recipe.id), data: saved }), 'save kitchen recipe');
}

export async function removeCustomRecipe(userId, recipeId) {
  await load(userId);
  state = { ...state, list: state.list.filter((r) => r.id !== recipeId) };
  emit();
  cache();
  if (userId) await remote(supabase.from(TABLE).delete().eq('user_id', userId).eq('kind', 'custom').eq('recipe_id', String(recipeId)), 'remove kitchen recipe');
}

export function useCustomRecipes(userId) {
  const [list, setList] = useState(state.userId === userId ? state.list : []);
  useEffect(() => {
    customListeners.add(setList);
    load(userId).then(() => setList(state.list));
    return () => customListeners.delete(setList);
  }, [userId]);
  return list;
}
