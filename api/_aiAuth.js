// Sign-in check for the AI endpoints (gemini, ai, chat), so only Logga accounts can spend AI credits.
// Step 1 (now): the app sends the person's session token, and calls without a valid one are only logged,
// because App Store builds from before this don't send it yet. Step 2: set REQUIRE_AI_AUTH=true in Vercel
// once the logs show those calls have died down; from then on they get a 401.
import { userFromRequest } from './_purgeUser.js';

/** Returns true when the request may go on; otherwise it has already answered with a 401. */
export async function checkAiAuth(req, res, endpoint) {
  let user = null;
  try { user = await userFromRequest(req); } catch (_) { /* Supabase unreachable: treat as unsigned */ }
  if (user) return true;
  const hadToken = /^Bearer\s+\S/i.test(req.headers.authorization || '');
  console.warn(`[ai-auth] ${endpoint}: ${hadToken ? 'invalid or expired token' : 'no token'} (type: ${req.body?.type || req.body?.action || '-'})`);
  // Forgiving about how the value was typed in Vercel ("true", True, ' true ').
  if (String(process.env.REQUIRE_AI_AUTH || '').replace(/["'\s]/g, '').toLowerCase() !== 'true') return true;
  res.status(401).json({ error: 'Please sign in again.' });
  return false;
}
