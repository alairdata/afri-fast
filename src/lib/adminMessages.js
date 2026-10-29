// What the admin portal (logga.space/admin) can send to someone's app:
// - a restriction (user_admin_flags.restricted): App.js shows the restricted screen instead of the app;
// - nudges (user_nudges): picked up when the app opens or comes back, put in the bell inbox, shown as a
//   notification on the phone, then marked delivered;
// - real push: the phone's Expo push address is saved on the account (app_prefs.pushToken), so a nudge also
//   reaches a closed app.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { recordNotifications } from './notificationInbox';
import { setAccountPref } from './accountPrefs';

/** True when an admin has restricted this account. Never throws; offline counts as not restricted. */
export async function isAccountRestricted(userId) {
  if (!userId) return false;
  try {
    const { data, error } = await supabase.from('user_admin_flags').select('restricted').eq('user_id', userId).maybeSingle();
    return !error && !!data?.restricted;
  } catch (_) {
    return false;
  }
}

let delivering = false;
/** Moves undelivered nudges into the inbox (and onto the phone's screen), then marks them delivered. */
export async function deliverNudges(userId) {
  if (!userId || delivering) return;
  delivering = true;
  try {
    const { data, error } = await supabase.from('user_nudges').select('id, title, body, created_at, pushed')
      .eq('user_id', userId).is('delivered_at', null).order('created_at', { ascending: true }).limit(20);
    if (error || !data?.length) return;
    const now = Date.now();
    await recordNotifications(data.map((n) => ({
      date: now, request: { identifier: `nudge-${n.id}`, content: { title: n.title, body: n.body, data: { type: 'nudge' } } },
    })));
    if (Platform.OS !== 'web') {
      // one already pushed to the phone was shown then; the rest pop up now
      for (const n of data.filter((x) => !x.pushed)) {
        await Notifications.scheduleNotificationAsync({
          identifier: `nudge-${n.id}`,
          content: { title: n.title, body: n.body, data: { type: 'nudge' } },
          trigger: null,
        }).catch(() => {});
      }
    }
    await supabase.from('user_nudges').update({ delivered_at: new Date().toISOString() }).in('id', data.map((n) => n.id));
  } catch (_) {
    // offline: they stay undelivered and come next time
  } finally {
    delivering = false;
  }
}

/** Saves this phone's push address on the account, when notifications are already allowed (never asks). */
export async function savePushToken(userId) {
  if (!userId || Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await setAccountPref(userId, 'pushToken', { token, platform: Platform.OS, at: new Date().toISOString() });
  } catch (_) {
    // no push on this build or device: in-app delivery still works
  }
}
