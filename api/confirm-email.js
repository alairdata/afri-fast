// Confirms an email address when the person taps the Confirm button on /confirm-email. The one-time code in
// the email link is only used up HERE, never by merely opening the page, so mail apps and security scanners
// that pre-open every link can no longer burn it before the person taps.
// Responses: 200 {ok} | 400 {error} | 429 {error}
import { cors, configured, clientIp, rateLimit, verifyTokenHash } from './_authEmail.js';
import { trackServerEvent } from './_analytics.js';

const ALLOWED_TYPES = new Set(['signup', 'magiclink', 'email']);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Not set up yet. Please try again later.' });

  if (!rateLimit(`confirm-ip:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }
  const { tokenHash, type } = req.body || {};
  if (typeof tokenHash !== 'string' || !tokenHash || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid link' });
  }

  try {
    const v = await verifyTokenHash(tokenHash, type);
    if (!v.ok) return res.status(400).json({ error: 'expired' });
    if (v.body.user?.id) await trackServerEvent(v.body.user.id, 'email_verified');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[confirm-email]', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
