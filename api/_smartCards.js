// Smart cards: Logga watches each person's logs once a day (from api/cron/user-onboarding.js) and, when it finds
// something genuinely worth saying, leaves ONE card on their Insights tab, a dot on the tab, one bell item and at
// most one push. Rules the owner set (2026-11-05):
//   - one card at a time; safety first, then whatever is most useful;
//   - a new non-safety card no more than once every few days (MIN_GAP_DAYS);
//   - a card stays until the person taps "Got it" or it goes out of date, then it's dropped;
//   - connected things go into one card (the AI gets every fact at once and writes one card).
// Code works out the facts. Fixed rules handle safety only, with fixed wording. For everything else the AI decides
// whether anything is worth saying, or stays silent. AI only ever sees the facts of people who said yes to AI.
//
// Stored on the account (profiles.app_prefs), so no new table is needed:
//   smart_card       { id, kind, safety, title, body, why[], button, createdAt, expiresAt }
//   smart_card_done  the id the person dealt with ("Got it")
//   smart_card_seen  the id whose dot has been seen (the app sets it)
//   smart_card_log   the last few cards [{ id, kind, title, createdAt }], for pacing and to avoid repeats
import { adminHeaders } from './_authEmail.js';
import { callGemini, parseJson } from './_gemini.js';
import { MEDICAL_SAFETY } from './_safety.js';
import { worryLevel, SUPPORT_TEXT } from '../src/lib/worry.js';

const DAY = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;
const MIN_GAP_DAYS = 3;
const QUIET_AFTER_HARD_NOTE_DAYS = 3;
const QUIET_AFTER_URGENT_NOTE_DAYS = 7;
const LOW_INTAKE_KCAL = 1000;
const MIN_LOGGED_DAYS_FOR_LOW = 4;
// AI-written cards start on the owner's account only, so the wording can be checked on real data first. Safety
// cards (fixed wording) go to everyone. Set SMART_CARDS_FOR_ALL=1 in Vercel to open AI cards to everyone.
const OWNER_ID = '25c55375-b7d7-45b1-a7d7-7658e39c3142';
const aiCardsFor = (id) => process.env.SMART_CARDS_FOR_ALL === '1' || id === OWNER_ID;
const url = (path) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;

async function rows(path) {
  const r = await fetch(url(path), { headers: adminHeaders() });
  if (!r.ok) throw new Error(`${path.split('?')[0]} ${r.status}`);
  return r.json();
}

// "2026-10-24" or "Sat Oct 24 2026" -> local-midnight ms
const dayMs = (d) => {
  const m = d && String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
};
const toKg = (w, unit) => (unit === 'lbs' ? w / 2.20462 : w);
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

// ── Facts ────────────────────────────────────────────────────────────────────

function noteWorry(checkIns, now) {
  let urgentAt = null, hardAt = null;
  for (const c of checkIns) {
    const entries = c.v2_data?.noteEntries?.length
      ? c.v2_data.noteEntries.map((e) => ({ text: e.text, at: Date.parse(e.savedAt) || Date.parse(c.logged_at) }))
      : [{ text: c.notes, at: Date.parse(c.logged_at) }];
    for (const e of entries) {
      if (!e.at || now - e.at > QUIET_AFTER_URGENT_NOTE_DAYS * DAY) continue;
      const level = worryLevel(e.text);
      if (level === 'urgent') urgentAt = Math.max(urgentAt || 0, e.at);
      if (level === 'hard') hardAt = Math.max(hardAt || 0, e.at);
    }
  }
  return { urgentAt, hardAt };
}

function intakeByDay(meals, now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const byDay = {};
  meals.forEach((m) => {
    const t = dayMs(m.date);
    if (t == null || t >= today.getTime()) return; // today isn't finished
    byDay[t] = (byDay[t] || 0) + (Number(m.calories) || 0);
  });
  return { byDay, todayMs: today.getTime() };
}

function buildFacts({ p, meals, weights, prediction, now }) {
  const unit = p.weight_unit || 'kg';
  const { byDay, todayMs } = intakeByDay(meals, now);
  const days = (n) => Object.entries(byDay).filter(([t, c]) => +t >= todayMs - n * DAY && c > 0).map(([, c]) => c);
  const last14 = days(14), last28 = days(28);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const sortedW = weights
    .map((w) => ({ ts: Number(w.id) || Date.parse(w.date), kg: toKg(Number(w.weight), w.unit || unit) }))
    .filter((w) => Number.isFinite(w.ts) && Number.isFinite(w.kg)).sort((a, b) => a.ts - b.ts);
  const recentW = sortedW.filter((w) => w.ts >= now - 28 * DAY);

  const typical = last28.length ? [...last28].sort((a, b) => a - b)[Math.floor(last28.length / 2)] : 0;
  const big = last28.filter((c) => c >= typical * 1.3), rest = last28.filter((c) => c < typical * 1.3);
  const restAvg = avg(rest);

  const targets = (p.goal_history || [])
    .filter((e) => e.dailyCalorieGoal != null && dayMs(e.from) >= now - 28 * DAY)
    .map((e) => ({ from: e.from, kcal: e.dailyCalorieGoal }));

  if (last14.length < 5) return null; // too little to say anything useful
  return {
    weightUnit: unit,
    goalWeight: p.target_weight,
    pace: p.pace_preference || null,
    calorieTargetNow: p.daily_calorie_goal,
    calorieTargetChangesLast4Weeks: targets.length,
    calorieTargetsLast4Weeks: targets,
    daysLoggedLast14: last14.length,
    averageLoggedKcalLast14: avg(last14) != null ? round(avg(last14)) : null,
    bigDaysLast4Weeks: big.length >= 2 && restAvg ? {
      count: big.length, averageKcal: round(avg(big)), otherDaysAverageKcal: round(restAvg),
      extraKgOffset: round(big.reduce((s, c) => s + (c - restAvg), 0) / KCAL_PER_KG, 1),
    } : null,
    weighInsLast4Weeks: recentW.length,
    weighInRangeLast4WeeksKg: recentW.length >= 2 ? [round(Math.min(...recentW.map((w) => w.kg)), 1), round(Math.max(...recentW.map((w) => w.kg)), 1)] : null,
    latestWeighInKg: sortedW.length ? round(sortedW[sortedW.length - 1].kg, 1) : null,
    daysSinceLastWeighIn: sortedW.length ? Math.floor((now - sortedW[sortedW.length - 1].ts) / DAY) : null,
    forecast: prediction ? {
      weeklyChangeKg: prediction.daily_rate_kg != null ? round(prediction.daily_rate_kg * 7, 2) : null,
      paceBadge: prediction.badge_label || null,
      estimatedDailyBurnKcal: prediction.tdee != null ? round(prediction.tdee) : null,
      restingBurnKcal: prediction.bmr != null ? round(prediction.bmr) : null,
    } : null,
  };
}

// ── The AI's one card (or silence) ───────────────────────────────────────────

const CARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    say: { type: 'BOOLEAN' },
    title: { type: 'STRING' },
    body: { type: 'STRING' },
    why: { type: 'ARRAY', items: { type: 'STRING' } },
    days_valid: { type: 'INTEGER' },
  },
  required: ['say'],
};

async function aiCard(facts, previous) {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) return null;
  const floor = Math.max(1200, facts.forecast?.restingBurnKcal || 0);
  const system = `You are Logga, a calm, warm food and weight companion. Once a day you look at one person's facts and decide whether there is ONE thing genuinely worth telling them first, before they notice it themselves. Most days the answer is no: then return {"say": false}.

Say something only when it is new, specific to this person, and useful: it explains something confusing (for example weight not moving), points out a pattern they likely haven't seen, or recognises real progress they may be missing. Connected facts belong in the same card. Never repeat a card they already had (listed below) unless something has clearly changed.

Rules:
- Use only these facts. Never invent causes, feelings or events. If something is a guess, say it is a guess.
- Never tell them to eat less, and never suggest a daily target below ${floor} calories. Steadier habits, logging, weighing, movement and patience are fine to suggest.
- Never shame. No guilt words (bad, cheat, failed, ruined). Weight swings of a few kg are mostly water.
- Plain, everyday English. Short sentences. No emojis, no exclamation marks, no medical claims. Never mention AI or any company.
- Give weights in ${facts.weightUnit} (convert from kg if needed, 1 kg = 2.2 lb).
- title: at most 60 characters. body: one or two sentences, at most 200 characters, stating what you noticed. why: 1 to 3 short items with the specific numbers behind it, at most 200 characters each. days_valid: how many days this stays true and useful (2 to 10).

${MEDICAL_SAFETY}`;
  const prompt = `FACTS (JSON):\n${JSON.stringify(facts)}\n\nCARDS THEY ALREADY HAD (newest first):\n${previous.map((c) => `- ${c.title}`).join('\n') || '- none'}\n\nReturn JSON only.`;
  const out = parseJson(await callGemini(key, [{ text: prompt }], { systemInstruction: system, schema: CARD_SCHEMA }));
  if (!out?.say || !out.title || !out.body) return null;
  return {
    kind: 'insight', safety: false,
    title: String(out.title).slice(0, 70), body: String(out.body).slice(0, 240),
    why: (Array.isArray(out.why) ? out.why : []).map((w) => String(w).slice(0, 240)).filter(Boolean).slice(0, 3),
    days: Math.min(10, Math.max(2, Number(out.days_valid) || 5)),
  };
}

// ── Safety cards (fixed wording) ─────────────────────────────────────────────

function safetyCard({ worry, meals, now }) {
  if (worry.urgentAt) {
    return {
      kind: 'support', safety: true, button: 'helpline', days: 7,
      title: 'Checking in on you',
      body: 'You wrote something hard recently. How are you doing? If things still feel heavy, please talk to someone: a doctor, someone you trust, or a free helpline.',
      why: [SUPPORT_TEXT.urgent.body],
      push: { title: 'A note from Logga', body: 'Open Logga when you have a moment.' },
    };
  }
  const { byDay, todayMs } = intakeByDay(meals, now);
  const week = Object.entries(byDay).filter(([t, c]) => +t >= todayMs - 7 * DAY && c > 0).map(([, c]) => c);
  if (week.length >= MIN_LOGGED_DAYS_FOR_LOW) {
    const avg = week.reduce((a, b) => a + b, 0) / week.length;
    if (avg < LOW_INTAKE_KCAL) {
      return {
        kind: 'low_intake', safety: true, days: 7,
        title: 'Your body may need more food',
        body: `Your logged days this week average about ${Math.round(avg / 10) * 10} calories. If that's really what you're eating, it's less than your body needs.`,
        why: [
          'Eating this little for long can leave you tired, dizzy and very hungry, and it makes weight loss harder to keep.',
          "If some meals just didn't get logged, you can ignore this.",
          'If you feel unwell or find it hard to eat more, please talk to a doctor.',
        ],
      };
    }
  }
  return null;
}

// ── Saving and telling ───────────────────────────────────────────────────────

async function postCard(p, card, now) {
  // Re-read the account's prefs right before writing, so keys the phone saved a moment ago are kept.
  const fresh = (await rows(`profiles?id=eq.${p.id}&select=app_prefs`))[0]?.app_prefs || {};
  const id = String(now);
  const saved = {
    id, kind: card.kind, safety: !!card.safety, title: card.title, body: card.body, why: card.why || [],
    button: card.button || null, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + card.days * DAY).toISOString(),
  };
  const log = [{ id, kind: card.kind, title: card.title, createdAt: saved.createdAt }, ...(fresh.smart_card_log || [])].slice(0, 10);
  const r = await fetch(url(`profiles?id=eq.${p.id}`), {
    method: 'PATCH', headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ app_prefs: { ...fresh, smart_card: saved, smart_card_log: log } }),
  });
  if (!r.ok) throw new Error(`save card ${r.status}`);

  // One bell item and at most one push. Tapping either opens Insights.
  const push = card.push || { title: card.title, body: card.body };
  const ins = await fetch(url('user_nudges'), {
    method: 'POST', headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: p.id, title: push.title, body: push.body, sent_by: 'logga' }),
  });
  const nudge = ins.ok ? (await ins.json())[0] : null;
  const token = fresh.pushToken?.token;
  if (nudge && token) {
    const pr = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ to: token, title: push.title, body: push.body, sound: 'default', data: { type: 'smart', cardId: id, nudgeId: nudge.id } }]),
    }).then((x) => x.json()).catch(() => ({}));
    if (pr?.data?.[0]?.status === 'ok') {
      await fetch(url(`user_nudges?id=eq.${nudge.id}`), {
        method: 'PATCH', headers: { ...adminHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ pushed: true }),
      }).catch(() => {});
    }
  }
  return saved;
}

// opts.post: how a card is delivered (postCard; a preview passes one that only keeps it).
// opts.skipRules: ignore the pacing rules (one at a time, every few days, quiet after a hard note, owner-only AI),
// for the admin's test button. AI consent is never skipped.
async function cardForUser(p, now, opts = {}) {
  const post = opts.post || postCard;
  const skip = !!opts.skipRules;
  const prefs = p.app_prefs || {};
  const current = prefs.smart_card;
  const active = current && prefs.smart_card_done !== current.id && Date.parse(current.expiresAt) > now;
  const log = prefs.smart_card_log || [];
  const since28 = new Date(now - 28 * DAY).toISOString();

  const [checkIns, meals] = await Promise.all([
    rows(`check_ins?user_id=eq.${p.id}&logged_at=gte.${new Date(now - QUIET_AFTER_URGENT_NOTE_DAYS * DAY).toISOString()}&select=notes,v2_data,logged_at`),
    // by the day eaten (meals are often logged later), so read them all and filter in code
    rows(`meals?user_id=eq.${p.id}&select=calories,date`).then((all) => all.filter((m) => (dayMs(m.date) ?? 0) >= Date.parse(since28))),
  ]);
  const worry = noteWorry(checkIns, now);

  // 1. Safety first: it replaces any other card, but the same safety card never comes back within a week.
  const safety = safetyCard({ worry, meals, now });
  if (safety) {
    if (!skip && active && current.kind === safety.kind) return 'kept';
    if (!skip && log.some((c) => c.kind === safety.kind && now - Date.parse(c.createdAt) < 7 * DAY)) return 'quiet';
    await post(p, safety, now);
    return 'safety';
  }

  // 2. Everything else waits its turn.
  if (!skip && active) return 'kept';
  if (!skip && log.length && now - Date.parse(log[0].createdAt) < MIN_GAP_DAYS * DAY) return 'wait';
  if (!skip && (worry.urgentAt || (worry.hardAt && now - worry.hardAt < QUIET_AFTER_HARD_NOTE_DAYS * DAY))) return 'quiet';
  if (!skip && !aiCardsFor(p.id)) return 'not_yet';
  if (prefs.consent?.ai !== true) return 'no_ai_consent';

  const [weights, preds] = await Promise.all([
    rows(`weight_logs?user_id=eq.${p.id}&select=id,date,weight,unit`),
    rows(`weight_predictions?user_id=eq.${p.id}&select=daily_rate_kg,badge_label,tdee,bmr&order=created_at.desc&limit=1`),
  ]);
  const facts = buildFacts({ p, meals, weights, prediction: preds[0], now });
  if (opts.onFacts) opts.onFacts(facts);
  if (!facts) return 'no_data';
  const card = await aiCard(facts, log.slice(0, 5));
  if (!card) return 'silent';
  await post(p, card, now);
  return 'insight';
}

export async function runSmartCards(now = Date.now()) {
  const profiles = await rows(`profiles?select=${PROFILE_COLS}`);
  const result = { users: profiles.length, outcomes: {}, errors: [] };
  for (const p of profiles) {
    try {
      const o = await cardForUser(p, now);
      result.outcomes[o] = (result.outcomes[o] || 0) + 1;
    } catch (e) { result.errors.push(`${p.id}: ${e.message}`); }
  }
  return result;
}

const PROFILE_COLS = 'id,app_prefs,goal_history,daily_calorie_goal,target_weight,weight_unit,pace_preference';
const OUTCOME_TEXT = {
  safety: 'A safety card is due.', insight: 'A card is due.', kept: 'They already have a card that is still showing.',
  wait: 'Their last card was less than 3 days ago, so it waits.', quiet: 'They wrote a hard note recently, so Logga stays quiet for a few days.',
  not_yet: 'AI cards are only on for the owner account so far.', no_ai_consent: 'They have not said yes to AI, so no AI card.',
  no_data: 'Not enough logs in the last 2 weeks (needs 5 logged days).', silent: 'Logga looked and found nothing worth saying.',
};

/** Admin test button: what today's check decides for one person, and the card it would write if the pacing
 *  rules were set aside. With send, that card is really delivered (Insights, bell, one push). */
export async function testSmartCard(userId, { send = false, card: previewed = null } = {}, now = Date.now()) {
  const p = (await rows(`profiles?id=eq.${userId}&select=${PROFILE_COLS}`))[0];
  if (!p) throw new Error('No such user');
  // Send exactly the card the admin was shown (cleaned), rather than asking the AI again.
  if (send && previewed && previewed.title && previewed.body) {
    const card = {
      kind: String(previewed.kind || 'insight').slice(0, 20), safety: !!previewed.safety, button: previewed.button === 'helpline' ? 'helpline' : null,
      title: String(previewed.title).slice(0, 70), body: String(previewed.body).slice(0, 240),
      why: (Array.isArray(previewed.why) ? previewed.why : []).map((w) => String(w).slice(0, 400)).slice(0, 3),
      days: Math.min(10, Math.max(2, Number(previewed.days) || 5)),
      ...(previewed.push?.title ? { push: { title: String(previewed.push.title).slice(0, 80), body: String(previewed.push.body || '').slice(0, 200) } } : {}),
    };
    await postCard(p, card, now);
    return { outcome: 'sent', outcomeText: 'Sent by hand from the admin portal.', card, sent: true };
  }
  let wouldSend = null, facts = null;
  const outcome = await cardForUser(p, now, { post: async (_p, card) => { wouldSend = card; }, onFacts: (f) => { facts = f; } });
  let suggestion = wouldSend;
  if (!suggestion) {
    const again = await cardForUser(p, now, { skipRules: true, post: async (_p, card) => { suggestion = card; }, onFacts: (f) => { facts = f; } });
    if (!suggestion) return { outcome, outcomeText: OUTCOME_TEXT[outcome] || outcome, card: null, emptyReason: OUTCOME_TEXT[again] || again, facts };
  }
  const sent = send ? await postCard(p, suggestion, now) : null;
  return { outcome, outcomeText: OUTCOME_TEXT[outcome] || outcome, card: suggestion, sent: !!sent, facts };
}

// For dry runs on real data without saving anything.
export const __test = { buildFacts, aiCard, safetyCard, noteWorry };
