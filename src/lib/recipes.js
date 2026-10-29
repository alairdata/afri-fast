// The app's recipes. The built-in list (africanRecipes.js) shows first; then the published recipes from Supabase
// (the recipes table, edited in the admin portal at logga.space/admin) are swapped into that same array, so every
// screen that reads AFRICAN_RECIPES sees them. If Supabase can't be reached (or the table is empty), the last copy
// this phone saw is used, else the built-in list stays.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { AFRICAN_RECIPES } from './africanRecipes';

const CACHE_KEY = 'logga-recipes-v1';
let version = 0;
let started = false;
let fromServer = false;
const listeners = new Set();

const apply = (list) => {
  if (!Array.isArray(list) || !list.length) return;
  AFRICAN_RECIPES.splice(0, AFRICAN_RECIPES.length, ...list);
  version += 1;
  listeners.forEach((fn) => { try { fn(version); } catch (_) {} });
};

/** Starts loading once per app run; safe to call from anywhere. */
export function loadRecipes() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(CACHE_KEY).then((raw) => {
    if (raw && !fromServer) apply(JSON.parse(raw));
  }).catch(() => {});
  Promise.resolve(supabase.from('recipes').select('id, data').eq('published', true).order('sort', { ascending: true }))
    .then(({ data, error }) => {
      if (error || !data?.length) { started = !error; return; } // an error (offline) tries again next time
      const list = data.map((r) => ({ ...r.data, id: r.id }));
      fromServer = true;
      apply(list);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)).catch(() => {});
    }, () => { started = false; });
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
