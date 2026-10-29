// Admin portal server actions (logga.space/admin), served by /api/delete-account with body { mode: 'admin_…' }
// because the Hobby plan allows only 12 serverless functions. Every action first checks the caller's own login
// is on admin_emails (with the service key, never trusting the request body).
//
//   admin_delete_user { userId }            erase another account now (same purge as "delete my account")
//   admin_nudge { userIds, title, body }    save a nudge for each person and push it to phones with a push address
//   admin_revenue                           RevenueCat overview: active subscriptions, trials, MRR, revenue
//   admin_plans { userIds }                 each person's plan from RevenueCat (Pro or Free), for the Users table
//   admin_customer { userId }               one person's subscription history and lifetime spend
//
// RevenueCat needs REVENUECAT_API_KEY (a v2 secret key) and REVENUECAT_PROJECT_ID in Vercel.
import { purgeUser, adminHeaders } from './_purgeUser.js';

const SB = () => process.env.SUPABASE_URL;
const RC = 'https://api.revenuecat.com/v2';

async function isAdmin(user) {
  const email = String(user?.email || '').toLowerCase();
  if (!email) return false;
  const r = await fetch(`${SB()}/rest/v1/admin_emails?select=email`, { headers: adminHeaders() });
  if (!r.ok) return false;
  return (await r.json()).some((a) => String(a.email).toLowerCase() === email);
}

function rcConfigured() { return !!(process.env.REVENUECAT_API_KEY && process.env.REVENUECAT_PROJECT_ID); }
async function rc(path) {
  const r = await fetch(`${RC}/projects/${process.env.REVENUECAT_PROJECT_ID}${path}`, { headers: { Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`RevenueCat ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
// Runs fn over items, a few at a time.
async function pool(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

async function sendPush(messages) {
  if (!messages.length) return [];
  const r = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages),
  });
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j.data) ? j.data : [];
}

export async function handleAdmin(req, res, user) {
  if (!(await isAdmin(user))) return res.status(403).json({ error: 'Admins only.' });
  const body = req.body || {};
  const mode = body.mode;

  if (mode === 'admin_delete_user') {
    const id = String(body.userId || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Missing user' });
    if (id === user.id) return res.status(400).json({ error: 'Use Settings in the app to delete your own account.' });
    const result = await purgeUser(id);
    return result.ok ? res.status(200).json({ ok: true }) : res.status(500).json({ error: result.error });
  }

  if (mode === 'admin_nudge') {
    const ids = (Array.isArray(body.userIds) ? body.userIds : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
    const title = String(body.title || '').trim().slice(0, 80), text = String(body.body || '').trim().slice(0, 300);
    if (!ids.length || !title || !text) return res.status(400).json({ error: 'Add a title and a message.' });
    const ins = await fetch(`${SB()}/rest/v1/user_nudges`, {
      method: 'POST', headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(ids.map((uid) => ({ user_id: uid, title, body: text, sent_by: user.email }))),
    });
    if (!ins.ok) return res.status(500).json({ error: `Could not save the nudge (${ins.status}). Has the admin actions SQL been run?` });
    const rows = await ins.json();
    // Push to phones that have a push address on their account
    const prof = await fetch(`${SB()}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,app_prefs`, { headers: adminHeaders() });
    const tokens = {};
    (prof.ok ? await prof.json() : []).forEach((p) => { const t = p.app_prefs?.pushToken?.token; if (t) tokens[p.id] = t; });
    const toPush = rows.filter((n) => tokens[n.user_id]);
    const tickets = await sendPush(toPush.map((n) => ({ to: tokens[n.user_id], title, body: text, sound: 'default', data: { type: 'nudge', nudgeId: n.id } })));
    const pushedIds = toPush.filter((n, i) => tickets[i]?.status === 'ok').map((n) => n.id);
    if (pushedIds.length) {
      await fetch(`${SB()}/rest/v1/user_nudges?id=in.(${pushedIds.join(',')})`, {
        method: 'PATCH', headers: { ...adminHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ pushed: true }),
      }).catch(() => {});
    }
    return res.status(200).json({ ok: true, saved: rows.length, pushed: pushedIds.length });
  }

  if (mode === 'admin_revenue' || mode === 'admin_plans' || mode === 'admin_customer') {
    if (!rcConfigured()) return res.status(200).json({ configured: false });
    try {
      if (mode === 'admin_revenue') {
        const j = await rc('/metrics/overview');
        const metrics = {};
        (j?.metrics || []).forEach((m) => { metrics[m.id] = { value: m.value, unit: m.unit, name: m.name, period: m.period }; });
        return res.status(200).json({ configured: true, metrics });
      }
      if (mode === 'admin_plans') {
        const ids = (Array.isArray(body.userIds) ? body.userIds : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300);
        const plans = {};
        await pool(ids, 6, async (id) => {
          const ent = await rc(`/customers/${id}/active_entitlements`).catch(() => null);
          plans[id] = ent?.items?.length ? 'Pro' : 'Free';
        });
        return res.status(200).json({ configured: true, plans });
      }
      // admin_customer
      const id = String(body.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Missing user' });
      const [ent, subs] = await Promise.all([rc(`/customers/${id}/active_entitlements`), rc(`/customers/${id}/subscriptions`)]);
      let spend = 0, currency = 'USD';
      const list = (subs?.items || []).map((s) => {
        const rev = s.total_revenue_in_usd || {};
        spend += Number(rev.gross || 0); currency = rev.currency || currency;
        return { product: s.product_id || s.product?.store_identifier || '', status: s.status, store: s.store, startsAt: s.starts_at, endsAt: s.current_period_ends_at, autoRenew: s.auto_renewal_status, gross: rev.gross || 0 };
      });
      return res.status(200).json({ configured: true, plan: ent?.items?.length ? 'Pro' : 'Free', spend: Math.round(spend * 100) / 100, currency, subscriptions: list });
    } catch (e) {
      return res.status(502).json({ configured: true, error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown admin action' });
}
