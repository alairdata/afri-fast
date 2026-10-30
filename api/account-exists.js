// "Is there a Logga account for this email?" Used only after a failed email log-in, so the app can say
// "We couldn't find your account" (and offer sign-up) instead of a vague "invalid email or password".
// Every account that has ever signed in has a profiles row with its email.
// Responses: 200 {exists} | 400 | 429 | 5xx.
//
// With sendLoginCode: true it also logs in with a code: an existing account is emailed a 6-digit code and
// the app checks the code itself with Supabase (verifyOtp, type 'email'). The code is Supabase's magic-link
// token, so it lasts as long as Supabase's email links do. Only existing accounts get one (a magic link
// would quietly create a new account), so an unknown email gets {exists: false} and the app offers sign-up.
// Responses: 200 {exists: true, sent: true} | 200 {exists: false}. (It lives here to stay within Vercel's
// function limit.)
import { cors, clientIp, rateLimit, isValidEmail, adminHeaders, configured, generateLink, sendLoginCodeEmail } from './_authEmail.js';
import { trackServerEvent } from './_analytics.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Server not configured' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!rateLimit(`exists-ip:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`, { headers: adminHeaders() });
    if (!r.ok) return res.status(502).json({ error: 'Could not check right now.' });
    const rows = await r.json();
    const exists = Array.isArray(rows) && rows.length > 0;
    // The admin portal (logga.space/admin) asks with adminOnly: a code goes only to emails on the admin list
    // (so the portal can't be used to email codes to users); anyone else is told they have no access.
    if (req.body?.adminOnly && req.body?.sendLoginCode) {
      const a = await fetch(`${SUPABASE_URL}/rest/v1/admin_emails?select=email`, { headers: adminHeaders() });
      const admins = a.ok ? await a.json() : [];
      if (!exists || !admins.some((x) => String(x.email).toLowerCase() === email)) return res.status(200).json({ notAdmin: true });
    }
    if (!req.body?.sendLoginCode || !exists) return res.status(200).json({ exists });

    if (!configured()) return res.status(500).json({ error: 'Email is not set up yet. Please try again later.' });
    if (!rateLimit(`login-code:${email}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many codes asked for. Please try again later.' });
    }
    const link = await generateLink({ type: 'magiclink', email });
    const code = link.body?.email_otp || link.body?.properties?.email_otp;
    if (!link.ok || !code) {
      console.error('[login-code] generate_link failed:', link.status, JSON.stringify(link.body).slice(0, 300));
      return res.status(500).json({ error: "Couldn't make a code. Please try again." });
    }
    const sent = await sendLoginCodeEmail(email, link.body.user_metadata?.name || '', String(code));
    if (!sent) return res.status(500).json({ error: "Couldn't send the code. Please try again." });
    await trackServerEvent(link.body.id, 'email_sent', { email_type: 'login_code' });
    return res.status(200).json({ exists: true, sent: true });
  } catch (e) {
    console.error('[account-exists]', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
