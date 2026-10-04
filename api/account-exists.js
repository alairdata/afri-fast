// "Is there a Logga account for this email?" Used only after a failed email log-in, so the app can say
// "We couldn't find your account" (and offer sign-up) instead of a vague "invalid email or password".
// Every account that has ever signed in has a profiles row with its email.
// Responses: 200 {exists} | 400 | 429 | 5xx.
import { cors, clientIp, rateLimit, isValidEmail, adminHeaders } from './_authEmail.js';

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
    return res.status(200).json({ exists: Array.isArray(rows) && rows.length > 0 });
  } catch (e) {
    console.error('[account-exists]', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
