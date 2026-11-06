// The one smart card the server leaves on Insights (see api/_smartCards.js). Read fresh from the account each
// time (not from the accountPrefs cache), because the server writes it while the app may be open.
import { supabase } from './supabase';
import { setAccountPref } from './accountPrefs';

let listeners = [];
let state = { card: null, seenId: null };
let forUser = null;
const emit = () => listeners.forEach((fn) => fn(state));

export function onSmartCardChange(fn) {
  listeners.push(fn);
  fn(state);
  return () => { listeners = listeners.filter((x) => x !== fn); };
}

/** Loads the current card for this account: shown until "Got it" or until it goes out of date. Never throws. */
export async function loadSmartCard(userId) {
  if (userId !== forUser) { forUser = userId; state = { card: null, seenId: null }; emit(); } // never show another account's card
  if (!userId) return;
  try {
    const { data, error } = await supabase.from('profiles').select('app_prefs').eq('id', userId).maybeSingle();
    if (error || forUser !== userId) return;
    const prefs = data?.app_prefs || {};
    const c = prefs.smart_card;
    const live = c && c.id && prefs.smart_card_done !== c.id && Date.parse(c.expiresAt) > Date.now();
    state = { card: live ? c : null, seenId: prefs.smart_card_seen || null };
    emit();
  } catch (_) {}
}

/** The dot on Insights has been seen. */
export function markSmartCardSeen(userId) {
  const id = state.card?.id;
  if (!userId || !id || state.seenId === id) return;
  state = { ...state, seenId: id };
  emit();
  setAccountPref(userId, 'smart_card_seen', id);
}

/** "Got it": the card is dealt with and goes away. */
export function markSmartCardDone(userId) {
  const id = state.card?.id;
  if (!userId || !id) return;
  state = { card: null, seenId: id };
  emit();
  setAccountPref(userId, 'smart_card_done', id);
}
