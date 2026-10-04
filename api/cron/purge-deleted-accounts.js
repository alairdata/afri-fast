// Daily: permanently erases accounts whose 7-day restore window has passed (see api/delete-account.js).
// Runs from vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
import { purgeUser, adminHeaders } from '../_purgeUser.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || '') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });

  const due = [];
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: adminHeaders() });
    if (!r.ok) break;
    const { users = [] } = await r.json();
    if (!users.length) break;
    for (const u of users) {
      const at = u.app_metadata?.deletion_scheduled_at;
      if (at && new Date(at).getTime() <= Date.now()) due.push(u.id);
    }
    if (users.length < 200) break;
  }

  let erased = 0;
  for (const uid of due) {
    const result = await purgeUser(uid);
    if (result.ok) erased++;
  }
  return res.status(200).json({ ok: true, due: due.length, erased });
}
