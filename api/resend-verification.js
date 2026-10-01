// "Resend email" for someone who signed up but has not confirmed yet.
// Responses: 200 {ok, alreadyConfirmed?} | 400 | 429 | 5xx. Unknown emails get a plain 200 so this
// can't be used to probe which addresses have accounts.
import {
  cors, configured, clientIp, rateLimit, isValidEmail, pickRedirect, generateLink, sendVerificationEmail, emailConfirmLink,
} from './_authEmail.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Email is not set up yet. Please try again later.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!rateLimit(`resend-ip:${clientIp(req)}`, 10, 60 * 60 * 1000) || !rateLimit(`resend-email:${email}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
  }

  try {
    const link = await generateLink({ type: 'magiclink', email, redirect_to: pickRedirect(req.body?.redirectTo) });
    if (!link.ok) return res.status(200).json({ ok: true }); // no such account: say nothing
    if (link.body.email_confirmed_at) return res.status(200).json({ ok: true, alreadyConfirmed: true });
    const sent = await sendVerificationEmail(email, link.body.user_metadata?.name || '', emailConfirmLink(link.body));
    if (!sent) return res.status(502).json({ error: "We couldn't send the email. Please try again." });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[resend-verification]', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
