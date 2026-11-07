// Sign-in check for the AI endpoints (gemini, ai, chat), so only Logga accounts can spend AI credits.
// Step 1 (now): the app sends the person's session token, and calls without a valid one are only logged,
// because App Store builds from before this don't send it yet. Step 2: set REQUIRE_AI_AUTH=true in Vercel
// once the logs show those calls have died down; from then on they get a 401.
// An account restricted from the admin portal (user_admin_flags.restricted) is always refused.
import { userFromRequest } from './_purgeUser.js';

export async function isRestricted(userId) {
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

// Counts this AI call for the account and returns today's total (null when it can't be counted: then it's let through).
async function countAiCall(userId) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/bump_ai_usage`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: userId }),
    });
    if (!r.ok) return null;
    return Number(await r.json());
  } catch (_) {
    return null;
  }
}

// Whether this account has Logga Pro right now, from RevenueCat (the app logs in to RevenueCat with the account's
// id). Uses the app's public key, which can read a subscriber; if RevenueCat can't be reached, Pro is assumed so a
// paying person is never cut off by our mistake.
const RC_PUBLIC_KEY = () => process.env.REVENUECAT_IOS_PUBLIC_KEY || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'appl_vZinLvIPrzgYbpiLBwZItkfHBHV';
async function hasPro(userId) {
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${RC_PUBLIC_KEY()}` } });
    if (!r.ok) return true;
    const ent = (await r.json())?.subscriber?.entitlements?.logga_pro;
    if (!ent) return false;
    const until = ent.grace_period_expires_date || ent.expires_date;
    return !until || new Date(until).getTime() > Date.now();
  } catch (_) {
    return true;
  }
}

/** Returns true when the request may go on; otherwise it has already answered (401, 403 or 429). */
export async function checkAiAuth(req, res, endpoint) {
  let user = null;
  try { user = await userFromRequest(req); } catch (_) { /* Supabase unreachable: treat as unsigned */ }
  if (user) {
    // Both checks at once, to keep replies quick. Daily cap per account: 20 AI uses a day on Free, 100 on Pro
    // (AI_DAILY_LIMIT / AI_DAILY_LIMIT_PRO in Vercel). Pro is only looked up once someone passes the Free cap.
    const [restricted, calls] = await Promise.all([isRestricted(user.id), countAiCall(user.id)]);
    if (restricted) { res.status(403).json({ error: 'This account is on hold.' }); return false; }
    const freeCap = Number(process.env.AI_DAILY_LIMIT) > 0 ? Number(process.env.AI_DAILY_LIMIT) : 20;
    const proCap = Number(process.env.AI_DAILY_LIMIT_PRO) > 0 ? Number(process.env.AI_DAILY_LIMIT_PRO) : 100;
    const cap = calls != null && calls > freeCap && (await hasPro(user.id)) ? proCap : freeCap;
    if (calls != null && calls > cap) {
      console.warn(`[ai-auth] ${endpoint}: daily cap reached for ${user.id} (${calls})`);
      res.status(429).json({ error: "You've used Logga's AI a lot today. Please try again tomorrow." });
      return false;
    }
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
