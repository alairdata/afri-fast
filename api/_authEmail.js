// Shared bits for the sign-up / resend endpoints. Same idea as the So-UnFiltered AI app: our own API
// creates the account and sends a branded verification email through Resend, instead of Supabase
// sending its plain default email (which is also capped at a couple of emails per hour).
//
// Supabase still owns the login: the admin "generate link" call creates the (unconfirmed) user and
// hands back a one-time confirmation link WITHOUT emailing it. We email that link ourselves. Tapping
// it confirms the address and returns to the app through logga://auth-callback with a signed-in
// session, which AuthScreen already handles.
//
// Env vars (Vercel): SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, optional RESEND_FROM.

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const RESEND_FROM = () => process.env.RESEND_FROM || 'Logga <support@logga.space>';

// Only these can be used as the link's landing place (they must also be in Supabase's Redirect URLs).
const CALLBACK_PAGE = 'https://afri-fast.vercel.app/auth-callback';
const ALLOWED_REDIRECTS = [CALLBACK_PAGE, 'https://afri-fast.vercel.app', 'https://www.logga.space'];
// The app asks for its own logga:// link, but mail apps and browsers often refuse to follow a redirect
// straight into an app link (the button looks dead), so phones are sent to a small web page that opens
// the app instead (public/auth-callback.html).
export const pickRedirect = (requested) => (ALLOWED_REDIRECTS.includes(requested) ? requested : CALLBACK_PAGE);

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com', 'throwaway.email',
  'getnada.com', 'trashmail.com', 'fakeinbox.com', 'yopmail.com', 'temp-mail.org', 'maildrop.cc',
  'sharklasers.com', 'spam4.me', 'emailondeck.com', 'dropmail.me',
]);
export const isDisposableEmail = (email) => DISPOSABLE_DOMAINS.has(String(email).split('@')[1]?.toLowerCase());

export const isValidEmail = (email) => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Small in-memory limiter (per server instance): enough to stop a hammering client.
const hits = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

export const adminHeaders = () => ({ apikey: SERVICE_KEY(), Authorization: `Bearer ${SERVICE_KEY()}`, 'Content-Type': 'application/json' });

export const configured = () => !!(SUPABASE_URL() && SERVICE_KEY() && process.env.RESEND_API_KEY);

// Returns { ok, status, body }. body (on success) holds action_link plus the user's fields.
export async function generateLink(payload) {
  const r = await fetch(`${SUPABASE_URL()}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export async function updateUser(id, patch) {
  const r = await fetch(`${SUPABASE_URL()}/auth/v1/admin/users/${id}`, {
    method: 'PUT', headers: adminHeaders(), body: JSON.stringify(patch),
  });
  return r.ok;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendVerificationEmail(to, name, link) {
  const hello = name ? `Welcome to Logga, ${escapeHtml(name)},` : 'Welcome to Logga,';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;margin:0;padding:0;background:#fbfbf7;color:#10201a;">
<div style="max-width:560px;margin:0 auto;padding:48px 24px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:26px;font-weight:800;letter-spacing:-0.04em;color:#059669;">Logga</div>
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;margin:18px 0 0;line-height:1.2;">One tap to get started.</h1>
  </div>
  <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.07);border-radius:16px;padding:32px;margin-bottom:24px;">
    <div style="font-size:15px;font-weight:600;margin-bottom:8px;">${hello}</div>
    <div style="font-size:14px;color:#5b6b64;margin-bottom:24px;">Confirm your email and you're in. Your goal, meals and streak will be saved to your account.</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}" style="display:inline-block;padding:14px 36px;background:#059669;color:#ffffff !important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Confirm my email</a>
    </div>
    <div style="font-size:12px;color:#8a978f;word-break:break-all;margin-top:16px;">Or paste this link:<br><a href="${link}" style="color:#059669;text-decoration:none;">${link}</a></div>
    <div style="height:1px;background:rgba(0,0,0,0.07);margin:24px 0;"></div>
    <div style="font-size:12px;color:#8a978f;text-align:center;">Open this on the phone where you installed Logga. Can't find our emails? Check your spam folder.</div>
  </div>
  <div style="text-align:center;font-size:12px;color:#8a978f;">Didn't sign up? Just ignore this email and nothing will happen.
    <div style="margin-top:12px;font-size:11px;"><a href="https://www.logga.space" style="color:#8a978f;text-decoration:none;">logga.space</a></div>
  </div>
</div></body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM(), to, subject: 'Confirm your Logga account', html }),
  });
  if (!r.ok) console.error('[auth-email] Resend failed:', r.status, await r.text().catch(() => ''));
  return r.ok;
}

export const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
