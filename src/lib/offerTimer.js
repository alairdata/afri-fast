// The first-month offer's two hours, kept on the account (app_prefs.offerDeadline) so the countdown keeps
// running while the app is closed and follows them to another phone. Set once, when the offer screen is
// first shown (onboarding or the catch-up); the Today tab shows the time left until it runs out.
import { getAccountPref, setAccountPref } from './accountPrefs';

const listeners = new Set();

/** The offer's end time (ms) for this account, or null. */
export async function getOfferDeadline(userId) {
  const v = Number(await getAccountPref(userId, 'offerDeadline'));
  return v > 0 ? v : null;
}

/** Saves the end time, unless one is already saved (the two hours start only once). */
export async function saveOfferDeadline(userId, deadline) {
  if (!userId || !(deadline > 0)) return;
  if (await getOfferDeadline(userId)) return;
  await setAccountPref(userId, 'offerDeadline', deadline);
  listeners.forEach((fn) => { try { fn(deadline); } catch (_) {} });
}

export const onOfferDeadline = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
