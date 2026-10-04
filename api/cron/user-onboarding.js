// Daily drip emails for new users, modelled on So-UnFiltered AI's /api/cron/user-onboarding:
//  - Day 2: signed up 2-3 days ago, confirmed their email, has still not logged a meal.
//  - Day 7: signed up 7-8 days ago and has still not logged a meal.
// (SUAI's third flow, the upgrade nudge, doesn't apply: Logga has no paid plan.)
// Runs once a day from vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
import { configured, adminHeaders, sendDripEmail } from '../_authEmail.js';
import { trackServerEvent } from '../_analytics.js';

const DAY = 24 * 60 * 60 * 1000;
const APP_LINK = 'https://www.logga.space/auth-callback';

// Confirmed users who signed up between (now - maxAgeDays) and (now - minAgeDays).
async function usersInWindow(minAgeDays, maxAgeDays) {
  const from = Date.now() - maxAgeDays * DAY;
  const to = Date.now() - minAgeDays * DAY;
  const found = [];
  // The admin API lists newest first, so stop paging once we are past the window.
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: adminHeaders() });
    if (!r.ok) break;
    const { users = [] } = await r.json();
    if (!users.length) break;
    for (const u of users) {
      const created = new Date(u.created_at).getTime();
      if (created >= from && created < to && u.email && u.email_confirmed_at && !u.app_metadata?.deletion_scheduled_at) found.push(u);
    }
    if (new Date(users[users.length - 1].created_at).getTime() < from) break;
  }
  return found;
}

async function hasLoggedAMeal(userId) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/meals?user_id=eq.${userId}&select=id&limit=1`, { headers: adminHeaders() });
  if (!r.ok) return true; // if we can't tell, don't email
  return (await r.json()).length > 0;
}

const firstName = (u) => String(u.user_metadata?.name || u.user_metadata?.full_name || '').trim().split(/\s+/)[0] || 'there';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || '') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  if (!configured()) return res.status(500).json({ error: 'Not configured' });

  const results = { day2: { checked: 0, emailed: 0 }, day7: { checked: 0, emailed: 0 }, errors: [] };
  try {
    for (const u of await usersInWindow(2, 3)) {
      results.day2.checked++;
      if (await hasLoggedAMeal(u.id)) continue;
      const name = firstName(u);
      const ok = await sendDripEmail(
        u.email, 'Your first meal takes 10 seconds',
        'Ready when you are.',
        `Hey ${name},<br><br>You set up Logga a couple of days ago but haven't logged anything yet. Snap a photo of your next plate, or just type what you ate, and Logga will estimate the calories. You can adjust it in a tap.`,
        'Log my first meal', APP_LINK,
      );
      if (ok) { results.day2.emailed++; await trackServerEvent(u.id, 'email_sent', { email_type: 'day2_first_meal' }); }
      else results.errors.push(`day2 failed for ${u.id}`);
    }

    for (const u of await usersInWindow(7, 8)) {
      results.day7.checked++;
      if (await hasLoggedAMeal(u.id)) continue;
      const name = firstName(u);
      const ok = await sendDripEmail(
        u.email, "Hey, you still around?",
        "It's been a week.",
        `Hey ${name},<br><br>We noticed you haven't logged a meal in Logga yet. No pressure, and no shaming here. Even one entry is enough to start seeing your pattern. Whenever you're ready, we're here.`,
        'Open Logga', APP_LINK,
      );
      if (ok) { results.day7.emailed++; await trackServerEvent(u.id, 'email_sent', { email_type: 'day7_check_in' }); }
      else results.errors.push(`day7 failed for ${u.id}`);
    }
    return res.status(200).json({ message: 'User onboarding cron complete', results });
  } catch (e) {
    console.error('[cron user-onboarding]', e);
    return res.status(500).json({ error: 'Cron job failed' });
  }
}
