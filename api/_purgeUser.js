// Permanently erases one account: stored photos, every row of their data, then the login itself.
// Used by /api/delete-account ("delete it now") and by the daily cron that erases accounts whose 7-day
// restore window has passed. Returns { ok, error }.

const USER_TABLES = [
  'meals', 'meal_logs', 'weight_logs', 'water_logs', 'check_ins', 'fasting_sessions', 'active_fasts',
  'willpower_logs', 'step_logs', 'activities', 'user_insights', 'burnout_predictions',
  'weight_predictions', 'daily_goal_ledger', 'whispers_posts',
  'chat_messages', 'cached_insights', 'burnout_daily_scores', 'feedback',
];
const STORAGE_BUCKETS = ['avatars', 'meal-photos'];

export const RESTORE_WINDOW_DAYS = 7;

export const adminHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
});

export async function purgeUser(uid) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const headers = adminHeaders();

  // Photos in storage (best effort -- a failure here must not leave the account half-deleted).
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: uid, limit: 1000 }),
      });
      const files = list.ok ? await list.json() : [];
      const names = (Array.isArray(files) ? files : []).filter((f) => f.name).map((f) => `${uid}/${f.name}`);
      if (names.length) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: names }),
        });
      }
    } catch (e) {
      console.error(`[purgeUser] storage cleanup failed for ${bucket}:`, e.message);
    }
  }

  // Community recipe photos hang off the user's meals, not the user directly.
  try {
    const meals = await fetch(`${SUPABASE_URL}/rest/v1/meals?user_id=eq.${uid}&select=id`, { headers });
    const ids = meals.ok ? (await meals.json()).map((m) => m.id) : [];
    if (ids.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/recipe_community_photos?meal_id=in.(${ids.join(',')})`, { method: 'DELETE', headers });
    }
  } catch (e) {
    console.error('[purgeUser] community photo cleanup failed:', e.message);
  }

  // Data rows. A table that doesn't exist or has no user_id column just logs and moves on.
  for (const table of USER_TABLES) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${uid}`, { method: 'DELETE', headers });
    if (!r.ok) console.error(`[purgeUser] ${table}: ${r.status} ${await r.text()}`);
  }
  const prof = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, { method: 'DELETE', headers });
  if (!prof.ok) console.error(`[purgeUser] profiles: ${prof.status} ${await prof.text()}`);

  // Last: the login itself.
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers });
  if (!del.ok) {
    const text = await del.text();
    console.error('[purgeUser] auth user delete failed:', del.status, text);
    return { ok: false, error: 'Could not delete the login. Please try again.' };
  }
  return { ok: true };
}

// Sets (or clears, with null) the date after which the account is erased, on the login's app_metadata
// (which only the server can change).
export async function setDeletionDate(uid, isoOrNull) {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_metadata: { deletion_scheduled_at: isoOrNull } }),
  });
  return r.ok;
}

// The signed-in user behind a request's access token, or null.
export async function userFromRequest(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const who = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!who.ok) return null;
  const user = await who.json();
  return user?.id ? { ...user, token } : null;
}
