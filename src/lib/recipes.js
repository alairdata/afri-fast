// The app's recipes, from our server (api/_recipes.js) so nobody can copy the whole collection:
//  - the list is cards only (name, photo, calories, times, ingredient names), swapped into AFRICAN_RECIPES so every
//    screen that reads it sees them. The phone keeps a copy of the cards for a fast start and for offline.
//  - the full recipe (amounts and method) loads when someone opens it: loadRecipeDetail(id). Opened recipes are kept
//    on this phone, so opening one again works offline and doesn't count against the day's limit.
// Recipes are edited in the admin portal (logga.space/admin).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AFRICAN_RECIPES } from './africanRecipes';
import { aiHeaders } from './aiAuth';

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const CACHE_KEY = 'logga-recipe-cards-v2';
const DETAIL_KEY = (id) => `logga-recipe-full-${id}`;
let version = 0;
let started = false;
let fromServer = false;
const listeners = new Set();
const details = new Map();

// The old cache held every recipe in full; it isn't needed any more.
AsyncStorage.removeItem('logga-recipes-v1').catch(() => {});

const apply = (list) => {
  if (!Array.isArray(list) || !list.length) return;
  AFRICAN_RECIPES.splice(0, AFRICAN_RECIPES.length, ...list);
  version += 1;
  listeners.forEach((fn) => { try { fn(version); } catch (_) {} });
};

const post = async (body) => {
  const r = await fetch(`${BASE}/api/gemini`, { method: 'POST', headers: await aiHeaders(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`); e.status = r.status; throw e; }
  return j;
};

/** Starts loading once per app run (again after sign-in if it failed); safe to call from anywhere. */
export function loadRecipes() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(CACHE_KEY).then((raw) => {
    if (raw && !fromServer) apply(JSON.parse(raw));
  }).catch(() => {});
  post({ type: 'recipe_cards' })
    .then(({ recipes }) => {
      if (!recipes?.length) { started = false; return; }
      fromServer = true;
      apply(recipes);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(recipes)).catch(() => {});
    }, () => { started = false; }); // offline or not signed in yet: try again next time
}

/** The full recipe (amounts and method). Returns { recipe } or { error }. Kitchen-built recipes are already full. */
export async function loadRecipeDetail(card) {
  if (!card || !card.partial) return { recipe: card };
  const id = card.id;
  if (details.has(id)) return { recipe: { ...details.get(id), shownName: card.shownName } };
  try {
    const raw = await AsyncStorage.getItem(DETAIL_KEY(id));
    if (raw) { const full = JSON.parse(raw); details.set(id, full); return { recipe: { ...full, shownName: card.shownName } }; }
  } catch (_) {}
  try {
    const { recipe } = await post({ type: 'recipe_detail', data: { id } });
    details.set(id, recipe);
    AsyncStorage.setItem(DETAIL_KEY(id), JSON.stringify(recipe)).catch(() => {});
    return { recipe: { ...recipe, shownName: card.shownName } };
  } catch (e) {
    return { error: e.status === 429 ? e.message : "Couldn't load this recipe. Check your connection and try again." };
  }
}

/** Re-renders the caller when the recipe list changes; use it in useMemo deps. */
export function useRecipesVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    loadRecipes();
    if (v !== version) setV(version);
    return () => listeners.delete(setV);
  }, []);
  return v;
}
