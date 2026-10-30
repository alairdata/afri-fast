// Apple's / Google's own "Enjoying Logga?" rating pop-up (expo-store-review), asked on someone's 2nd meal logged and
// again on their 10th. Each ask happens once per account (kept on the account, so a new phone doesn't ask again).
// The store decides whether it actually shows (at most 3 times a year, not again once they've rated), and every
// rating counts, so nobody is filtered out. Phones only; nothing on the web.
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { getAccountPref, setAccountPref } from './accountPrefs';

const ASK_AT = [2, 10];

export async function maybeAskForReview(userId, mealsLogged) {
  if (!userId || Platform.OS === 'web') return;
  const at = ASK_AT.filter((n) => mealsLogged >= n).pop();
  if (!at) return;
  try {
    const asked = (await getAccountPref(userId, 'reviewAsked')) || [];
    if (asked.includes(at)) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    await setAccountPref(userId, 'reviewAsked', [...asked, at]);
    // A moment after the meal is saved, so it doesn't land on top of the logging animation.
    setTimeout(() => { StoreReview.requestReview().catch(() => {}); }, 1500);
  } catch (_) {
    // never gets in the way of logging
  }
}
