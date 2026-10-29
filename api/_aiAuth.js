// Sign-in check for the AI endpoints (gemini, ai, chat), so only Logga accounts can spend AI credits.
// Step 1 (now): the app sends the person's session token, and calls without a valid one are only logged,
// because App Store builds from before this don't send it yet. Step 2: set REQUIRE_AI_AUTH=true in Vercel
// once the logs show those calls have died down; from then on they get a 401.
// An account restricted from the admin portal (user_admin_flags.restricted) is always refused.
import { userFromRequest } from './_purgeUser.js';

async function isRestricted(userId) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/user_admin_flags?user_id=eq.${userId}&select=restricted`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return false;
    const rows = await r.json();
    return !!rows?.[0]?.restricted;
  } catch (_) {
    return false;
  }
}

/** Returns true when the request may go on; otherwise it has already answered (401 or 403). */
export async function checkAiAuth(req, res, endpoint) {
  let user = null;
  try { user = await userFromRequest(req); } catch (_) { /* Supabase unreachable: treat as unsigned */ }
  if (user) {
    if (await isRestricted(user.id)) { res.status(403).json({ error: 'This account is on hold.' }); return false; }
    req.aiUser = user; // the endpoint can tell whose request this is
    return true;
  }
  const hadToken = /^Bearer\s+\S/i.test(req.headers.authorization || '');
  console.warn(`[ai-auth] ${endpoint}: ${hadToken ? 'invalid or expired token' : 'no token'} (type: ${req.body?.type || req.body?.action || '-'})`);
  // Forgiving about how the value was typed in Vercel ("true", True, ' true ').
  if (String(process.env.REQUIRE_AI_AUTH || '').replace(/["'\s]/g, '').toLowerCase() !== 'true') return true;
  res.status(401).json({ error: 'Please sign in again.' });
  return false;
}
