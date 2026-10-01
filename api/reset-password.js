// Sets a new password from the reset page (public/reset-password.html). The page passes the one-time
// access token Supabase put in the reset link; we check it belongs to a real user, apply the same strong
// password rules as sign-up, change the password, then sign the account out of every device.
import { cors, configured, clientIp, rateLimit, passwordError, adminHeaders, updateUser } from './_authEmail.js';
import { trackServerEvent } from './_analytics.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Password reset is not set up yet. Please try again later.' });

  if (!rateLimit(`reset-ip:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
  }
  const { accessToken, password } = req.body || {};
  const problem = passwordError(password);
  if (problem) return res.status(400).json({ error: problem });
  if (!accessToken || typeof accessToken !== 'string') return res.status(400).json({ error: 'Invalid or expired reset link' });

  try {
    const who = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!who.ok) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    const uid = (await who.json())?.id;
    if (!uid) return res.status(400).json({ error: 'Invalid or expired reset link' });

    if (!(await updateUser(uid, { password }))) return res.status(500).json({ error: 'Failed to reset password' });

    // Sign out every other device (SUAI bumps a session version for the same effect).
    const out = await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=global`, {
      method: 'POST', headers: { ...adminHeaders(), Authorization: `Bearer ${accessToken}` },
    });
    if (!out.ok) console.error('[reset-password] global sign-out failed:', out.status);

    await trackServerEvent(uid, 'password_reset_completed');
    return res.status(200).json({
      message: 'Password reset successfully. You can now log in with your new password. All other sessions have been logged out.',
    });
  } catch (e) {
    console.error('[reset-password]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
