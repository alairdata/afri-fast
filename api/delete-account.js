// Deleting an account, with a 7-day safety window. The user is identified from their own access token --
// never from anything in the request body -- so one person can't delete another's account.
//
//   body { mode: 'schedule' } (default): nothing is erased yet. The account is marked for deletion in 7 days
//     and signed out everywhere. Logging back in within those days offers "Restore my account".
//     The daily cron erases it once the 7 days have passed.
//   body { mode: 'now' }: erase everything immediately (photos, every row of data, the login).
//   body { mode: 'restore' }: cancel a scheduled deletion.
// api/cron/user-onboarding.js erases accounts once their 7 days have passed.
import { purgeUser, setDeletionDate, userFromRequest, RESTORE_WINDOW_DAYS } from './_purgeUser.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Server not configured' });

  try {
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Invalid session' });

    // "Restore my account" during the 7-day window. (Here rather than its own endpoint: the Hobby plan allows
    // only 12 serverless functions.)
    if (req.body?.mode === 'restore') {
      if (!(await setDeletionDate(user.id, null))) return res.status(500).json({ error: 'Could not restore your account. Please try again.' });
      return res.status(200).json({ ok: true, restored: true });
    }

    if (req.body?.mode === 'now') {
      const result = await purgeUser(user.id);
      if (!result.ok) return res.status(500).json({ error: result.error });
      return res.status(200).json({ ok: true, deleted: true });
    }

    const deleteAfter = new Date(Date.now() + RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    if (!(await setDeletionDate(user.id, deleteAfter))) {
      return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
    }
    // Sign the account out on every device.
    await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${user.token}` },
    }).catch(() => {});
    return res.status(200).json({ ok: true, deleteAfter });
  } catch (e) {
    console.error('[delete-account] exception:', e);
    return res.status(500).json({ error: e.message });
  }
}
