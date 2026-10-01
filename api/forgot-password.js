// Forgot password, the So-UnFiltered AI way: 3 requests per hour per IP, and the answer is always
// the same whether or not the email has an account (so nobody can probe which emails exist).
// The reset link lasts 1 hour (Supabase's recovery link) and lands on /reset-password.
import {
  cors, configured, clientIp, rateLimit, isValidEmail, generateLink, sendPasswordResetEmail, RESET_PAGE,
} from './_authEmail.js';
import { trackServerEvent } from './_analytics.js';

const SAME_ANSWER = { message: 'If an account exists with this email, you will receive a password reset link.' };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Email is not set up yet. Please try again later.' });

  if (!rateLimit(`forgot-ip:${clientIp(req)}`, 3, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

  try {
    const link = await generateLink({ type: 'recovery', email, redirect_to: RESET_PAGE });
    // No account, or one that never confirmed its email: same answer, nothing sent.
    if (!link.ok || !link.body.email_confirmed_at) return res.status(200).json(SAME_ANSWER);
    const sent = await sendPasswordResetEmail(email, link.body.user_metadata?.name || '', link.body.action_link);
    if (!sent) return res.status(500).json({ error: 'Failed to send reset email' });
    await trackServerEvent(link.body.id, 'email_sent', { email_type: 'password_reset' });
    return res.status(200).json(SAME_ANSWER);
  } catch (e) {
    console.error('[forgot-password]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
