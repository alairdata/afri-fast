// Email sign-up, the So-UnFiltered AI way: our server creates the (unconfirmed) account and sends the
// branded verification email through Resend. See api/_authEmail.js for how it fits together.
// Responses: 200 {ok} | 400 {error} | 409 {error:'already_registered'} | 429 {error} | 5xx {error}
import {
  cors, configured, clientIp, rateLimit, isDisposableEmail, isValidEmail, pickRedirect,
  generateLink, updateUser, sendVerificationEmail, passwordError,
} from './_authEmail.js';
import { trackServerEvent } from './_analytics.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Sign-up is not set up yet. Please try again later.' });

  const { name = '', email: rawEmail = '', password = '', redirectTo, website } = req.body || {};
  const email = String(rawEmail).trim().toLowerCase();
  const cleanName = String(name).trim().slice(0, 80);

  // Honeypot: real people never fill this hidden field. Pretend it worked.
  if (website) return res.status(200).json({ ok: true });

  const pwProblem = passwordError(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });
  if (!cleanName || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter your name and a valid email.' });
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: 'Disposable email addresses are not allowed. Please use your real email.' });
  }
  if (!rateLimit(`signup-ip:${clientIp(req)}`, 5, 60 * 60 * 1000) || !rateLimit(`signup-email:${email}`, 3, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many sign-up attempts. Please try again in a little while.' });
  }

  try {
    const redirect_to = pickRedirect(redirectTo);
    let link;
    let toName = cleanName;

    // Creates the unconfirmed user and returns the confirmation link without emailing it.
    const created = await generateLink({ type: 'signup', email, password, data: { name: cleanName }, redirect_to });
    if (created.ok) {
      link = created.body.action_link;
    } else if (created.status === 422 || created.body?.error_code === 'email_exists') {
      // Already has a login. If they never confirmed it, treat this as "try again": set the password
      // they just chose and send a fresh link. If it is confirmed, tell them to log in.
      const existing = await generateLink({ type: 'magiclink', email, redirect_to });
      if (!existing.ok) return res.status(500).json({ error: 'Could not create your account. Please try again.' });
      if (existing.body.email_confirmed_at) return res.status(409).json({ error: 'already_registered' });
      await updateUser(existing.body.id, { password, user_metadata: { name: cleanName } });
      link = existing.body.action_link;
    } else {
      console.error('[signup] generate_link failed:', created.status, created.body);
      return res.status(500).json({ error: 'Could not create your account. Please try again.' });
    }

    if (!link) return res.status(500).json({ error: 'Could not create your confirmation link. Please try again.' });
    const sent = await sendVerificationEmail(email, toName, link);
    const userId = created.ok ? created.body.id : null;
    if (sent && userId) await trackServerEvent(userId, 'email_sent', { email_type: 'verification' });
    if (!sent) return res.status(502).json({ error: "We couldn't send the confirmation email. Please try again." });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[signup]', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
