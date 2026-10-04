// "Restore my account": cancels a scheduled deletion during the 7-day window (see delete-account.js).
import { setDeletionDate, userFromRequest } from './_purgeUser.js';

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
    if (!(await setDeletionDate(user.id, null))) return res.status(500).json({ error: 'Could not restore your account. Please try again.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[restore-account] exception:', e);
    return res.status(500).json({ error: e.message });
  }
}
