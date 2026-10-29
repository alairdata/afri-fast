// Small preferences and "already seen" markers kept on the account (profiles.app_prefs), so a new phone or a log
// out doesn't lose them. Each screen still keeps its own copy on the phone for a fast start; the account's copy is
// read once per account and wins, and every change is written to both. Keys are set one at a time on the server
// (set_app_pref), so two phones never overwrite each other's keys.
import { supabase } from './supabase';

let cache = { userId: null, prefs: null, loading: null };

export function getAccountPrefs(userId) {
  if (!userId) return Promise.resolve({});
  if (cache.userId === userId && cache.prefs) return Promise.resolve(cache.prefs);
  if (cache.userId === userId && cache.loading) return cache.loading;
  const loading = Promise.resolve(supabase.from('profiles').select('app_prefs').eq('id', userId).maybeSingle())
    .then(({ data, error }) => {
      const prefs = !error && data?.app_prefs && typeof data.app_prefs === 'object' ? data.app_prefs : {};
      if (cache.userId === userId) cache.prefs = prefs;
      return prefs;
    }, () => ({}));
  cache = { userId, prefs: null, loading };
  return loading;
}

/** One saved value for this account, or undefined. */
export async function getAccountPref(userId, key) {
  return (await getAccountPrefs(userId))[key];
}

/** Saves one value on the account (and in the cache). Never throws. */
export async function setAccountPref(userId, key, value) {
  if (!userId) return;
  if (cache.userId === userId && cache.prefs) cache.prefs = { ...cache.prefs, [key]: value };
  try {
    const { error } = await supabase.rpc('set_app_pref', { p_key: key, p_value: value === undefined ? null : value });
    if (error) console.warn(`[accountPrefs] ${key}`, error.message);
  } catch (_) {}
}
