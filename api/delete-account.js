// Permanently deletes the calling user's account: their stored photos, every row of their data, and
// finally the Supabase auth user itself (which needs the service key, so it can't be done from the
// app). The user is identified from their own access token -- never from anything in the request
// body -- so one person can't delete another's account.

const USER_TABLES = [
  'meals', 'meal_logs', 'weight_logs', 'water_logs', 'check_ins', 'fasting_sessions', 'active_fasts',
  'willpower_logs', 'step_logs', 'activities', 'user_insights', 'burnout_predictions',
  'weight_predictions', 'daily_goal_ledger', 'whispers_posts',
];
const STORAGE_BUCKETS = ['avatars', 'meal-photos'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Server not configured' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const adminHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) return res.status(401).json({ error: 'Invalid session' });
    const uid = (await who.json())?.id;
    if (!uid) return res.status(401).json({ error: 'Invalid session' });

    // Photos in storage (best effort -- a failure here must not leave the account half-deleted).
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
          method: 'POST',
          headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: uid, limit: 1000 }),
        });
        const files = list.ok ? await list.json() : [];
        const names = (Array.isArray(files) ? files : []).filter((f) => f.name).map((f) => `${uid}/${f.name}`);
        if (names.length) {
          await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            headers: { ...adminHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: names }),
          });
        }
      } catch (e) {
        console.error(`[delete-account] storage cleanup failed for ${bucket}:`, e.message);
      }
    }

    // Community recipe photos hang off the user's meals, not the user directly.
    try {
      const meals = await fetch(`${SUPABASE_URL}/rest/v1/meals?user_id=eq.${uid}&select=id`, { headers: adminHeaders });
      const ids = meals.ok ? (await meals.json()).map((m) => m.id) : [];
      if (ids.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/recipe_community_photos?meal_id=in.(${ids.join(',')})`, {
          method: 'DELETE',
          headers: adminHeaders,
        });
      }
    } catch (e) {
      console.error('[delete-account] community photo cleanup failed:', e.message);
    }

    // Data rows. A table that doesn't exist or has no user_id column just logs and moves on.
    for (const table of USER_TABLES) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${uid}`, { method: 'DELETE', headers: adminHeaders });
      if (!r.ok) console.error(`[delete-account] ${table}: ${r.status} ${await r.text()}`);
    }
    const prof = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, { method: 'DELETE', headers: adminHeaders });
    if (!prof.ok) console.error(`[delete-account] profiles: ${prof.status} ${await prof.text()}`);

    // Last: the login itself. If this fails the user can simply try again.
    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: adminHeaders });
    if (!del.ok) {
      const text = await del.text();
      console.error('[delete-account] auth user delete failed:', del.status, text);
      return res.status(500).json({ error: 'Could not delete the login. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[delete-account] exception:', e);
    return res.status(500).json({ error: e.message });
  }
}
