// Smart (data-aware) notifications. Everything here is scheduled on the phone (no server), so the
// app re-plans the next few days every time the user's data changes -- each re-plan cancels the
// previous smart notifications first, so a nudge for something you've already done disappears the
// moment you log it. Today's nudges are judged on real data; later days are provisional and get
// corrected by the next re-plan (any log happens inside the app, which triggers one).
//
// Everything is written in Lumi's voice (profiles.coach_tone, see lumiVoice.js) and follows "How should I
// nudge you" (profiles.accountability):
//   - gentle: one meal reminder a day (at the Settings time), at most 1 other nudge a day
//   - firm:   a reminder for every meal of their eating style, up to 3 other nudges a day
//   - auto:   their eating style's meals, each moved to when they usually log it, up to 2 other nudges a day
//   - alone:  nothing (the app also turns both switches off; see FastingApp)
// A meal reminder is skipped when a meal was already logged shortly before it.
//
// Other nudges (nothing before 08:00 or after 21:30):
//   - Daily insight: one teaser ping at 10:00 per new insight, written from the insight itself (none without one).
//   - Streak at risk: 20:30, only if you have a >=3-day logging streak and nothing logged today.
//   - Water: 15:00, only if you track water and you're under half your goal.
//   - Movement: 17:30, only if you track steps/activity and today is still quiet.
//   - Burnout heads-up: 09:00, only when the burnout trend projects a crash within a few days.
//
// Journey messages (one a day at most, taking the place of that day's first or last meal reminder so the
// count never goes up; at the same meal time when meal reminders are off). Worked out from their logs:
//   - New: the evening of the sign-up day if nothing is logged yet, then day 2 (morning) and day 3 (evening).
//   - Slipping: after 2 and after 3 empty days (the second names their most-logged meal when there is one).
//   - Gone quiet: 14 and 30 days after the last log, then nothing more from these.
//   - Comeback: the day after they log again following 5+ quiet days.
// A later day's message is provisional like the rest: any log re-plans and moves it.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeCurrentMealStreak } from './mealStreak';
import { getCachedJustForYou } from './claudeInsights';
import { mealReminderCopy, waterCopy, streakCopy, moveCopy, burnoutCopy, lifecycleCopy } from './lumiVoice';

const ID_PREFIX = 'smart-';
const DAYS_AHEAD = 3;
const MAX_PER_DAY = 3;
const MAX_PER_DAY_BY_MODE = { gentle: 1, firm: 3, auto: 2 };
// Meal reminders are planned a week ahead, so they keep coming even if the app isn't opened for a few days.
const MEAL_DAYS_AHEAD = 7;
// A meal logged this long before a reminder counts as that meal (gentle's one reminder covers a longer stretch).
const MEAL_COVER_MS = { gentle: 5 * 3600000, default: 3 * 3600000 };

// When each eating style's meals happen (reminders land a little after the usual eating time), minutes of the day.
const MEAL_SLOTS = {
  omad: [{ slot: 'dinner', min: 19 * 60 }],
  '2x': [{ slot: 'lunch', min: 13 * 60 + 30 }, { slot: 'dinner', min: 19 * 60 + 30 }],
  '3x': [{ slot: 'breakfast', min: 9 * 60 }, { slot: 'lunch', min: 13 * 60 + 30 }, { slot: 'dinner', min: 19 * 60 + 30 }],
  '4x': [{ slot: 'breakfast', min: 9 * 60 }, { slot: 'lunch', min: 13 * 60 }, { slot: 'snack', min: 16 * 60 + 30 }, { slot: 'dinner', min: 19 * 60 + 30 }],
  flexible: [{ slot: 'lunch', min: 13 * 60 + 30 }, { slot: 'dinner', min: 19 * 60 + 30 }],
};

const slotForMinute = (min) => (min < 11 * 60 ? 'breakfast' : min < 16 * 60 ? 'lunch' : 'dinner');
const clampMin = (min) => Math.max(8 * 60, Math.min(21 * 60 + 30, Math.round(min)));

// The meal times to remind at, for a nudge mode. Gentle (and no choice yet) = the one Settings time.
function mealTimes(mode, eatingStyle, mealReminderTime, recentMeals, now) {
  if (mode !== 'firm' && mode !== 'auto') {
    const min = (mealReminderTime?.hour ?? 19) * 60 + (mealReminderTime?.minute ?? 0);
    return [{ slot: slotForMinute(min), min }];
  }
  const base = MEAL_SLOTS[eatingStyle === 'flex' ? 'flexible' : eatingStyle] || MEAL_SLOTS.flexible;
  if (mode !== 'auto') return base;
  // "Decide for me": each meal moves to 30 minutes after they usually log it (the middle of their logs
  // within 2.5 hours of it over the last 3 weeks), once there are at least 3 of them.
  const logs = recentMeals
    .map((m) => (m.logged_at ? new Date(m.logged_at) : null))
    .filter((d) => d && !isNaN(d) && now.getTime() - d.getTime() < 21 * DAY_MS)
    .map((d) => d.getHours() * 60 + d.getMinutes());
  return base.map((s) => {
    const near = logs.filter((m) => Math.abs(m - s.min) <= 150).sort((a, b) => a - b);
    return near.length < 3 ? s : { ...s, min: clampMin(near[Math.floor(near.length / 2)] + 30) };
  });
}
const DAY_MS = 86400000;
export const BURNOUT_SUMMARY_KEY = 'logga-burnout-summary-v1';
const BURNOUT_NOTIFIED_KEY = 'logga-burnout-notified-v1';
const BURNOUT_SUMMARY_MAX_AGE_DAYS = 3;

// Notification title per insight lens (the lens names come from api/ai.js).
const HOOK_TITLES = {
  MEAL_COMPOSITION: 'About your meals',
  HYDRATION: 'About your water',
  MOOD_AND_FOOD: 'Food and feelings',
  MOVEMENT: 'About your movement',
  WEIGHT_TREND: 'About your weight',
  CONSISTENCY: 'About your routine',
  PROGRESS_REFRAME: 'Look how far you came',
};

const at = (base, dayOffset, hour, minute = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const sameDay = (a, b) => a.toDateString() === b.toDateString();

const weekdayName = (d) => d.toLocaleDateString('en-US', { weekday: 'long' });

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
// Whole calendar days from a to b.
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

// A day named the way it reads on the day the message arrives: today, tomorrow, around Thursday, around next Tuesday.
const dayPhrase = (day, from) => {
  const n = daysBetween(from, day);
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `around ${n >= 7 ? 'next ' : ''}${weekdayName(day)}`;
};

// Their most-logged meal over the last 30 days (3+ times), short enough for a notification title.
function usualMeal(recentMeals, now) {
  const counts = new Map();
  for (const m of recentMeals) {
    const d = new Date(m.logged_at || m.date);
    const name = String(m.name || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 28 || isNaN(d) || now.getTime() - d.getTime() > 30 * DAY_MS) continue;
    const key = name.toLowerCase();
    const c = counts.get(key) || { name, n: 0 };
    c.n += 1;
    counts.set(key, c);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best && best.n >= 3 ? best.name : null;
}

// Where someone is in their journey: [{ offset (days from today), kind, slot: 'first' | 'last' }], one per day.
function lifecycleMoments(recentMeals, joinedAt, now) {
  const logDays = [...new Set(recentMeals
    .map((m) => new Date(m.logged_at || m.date))
    .filter((d) => !isNaN(d))
    .map(startOfDay))].sort((a, b) => b - a);
  const joined = joinedAt && !isNaN(new Date(joinedAt)) ? startOfDay(joinedAt) : null;
  const offset = (dayStart, plus) => daysBetween(now, dayStart + plus * DAY_MS + DAY_MS / 2);
  const byDay = new Map(); // offset -> moment; the first one added for a day wins
  const add = (off, kind, slot) => { if (off >= 0 && !byDay.has(off)) byDay.set(off, { offset: off, kind, slot }); };

  // New: the first three days of the account.
  const addNew = () => {
    if (joined == null) return;
    if (!logDays.length) add(offset(joined, 0), 'firstLog', 'last');
    add(offset(joined, 1), 'new1', 'first');
    add(offset(joined, 2), 'new2', 'last');
  };
  // Nothing logged yet: the new-user messages come first (slipping lines would read wrong).
  if (!logDays.length) addNew();

  // Comeback: they just logged after 5+ quiet days; the day after gets a follow-up (unless they log that day too).
  if (logDays.length >= 2 && daysBetween(logDays[1], logDays[0]) >= 5) add(offset(logDays[0], 1), 'comeback', 'first');

  // Slipping (the mornings after 2 and 3 empty days) and gone quiet, counted from the last log, or from
  // sign-up when nothing is logged yet.
  const base = logDays[0] ?? joined;
  if (base != null) {
    add(offset(base, 3), 'slip2', 'first');
    add(offset(base, 4), 'slip3', 'first');
    add(offset(base, 14), 'quiet14', 'first');
    add(offset(base, 30), 'quiet30', 'first');
  }

  addNew();
  return [...byDay.values()];
}

// Same unit table as milestones.js / burnout.js, so a sachet/bottle/oz log counts the same everywhere.
const UNIT_TO_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750 };
const waterMl = (l, volumeUnit) => (Number(l.amount) || 0) * (UNIT_TO_ML[l.unit] ?? UNIT_TO_ML[volumeUnit] ?? 1);

const cancelSmart = async () => {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => String(n.identifier).startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
};

export const clearSmartNotifications = async () => { await cancelSmart().catch(() => {}); };

/**
 * Re-plans smart notifications. ctx: { recentMeals, waterLogs, stepLogs, activities,
 * hydrationGoal (in volumeUnit; 0 = not tracking), volumeUnit }. Safe to call often.
 */
// Re-plans run one after another, never side by side: two overlapping runs could finish in the wrong order and
// leave the older plan (say, "You're at 0%" from before a water log) scheduled.
let planQueue = Promise.resolve();
export const syncSmartNotifications = (ctx) => {
  const run = planQueue.then(() => planSmartNotifications(ctx));
  planQueue = run.catch(() => {});
  return run;
};

const planSmartNotifications = async (ctx) => {
  const now = new Date();
  await cancelSmart();

  const {
    recentMeals = [], waterLogs = [], stepLogs = [], activities = [], hydrationGoal = 0, volumeUnit, userId,
    tone = null, userName = '', nudgeMode = null, eatingStyle = 'flexible', mealReminderTime = null,
    meals: mealsOn = false, smart: smartOn = true, joinedAt = null,
  } = ctx;
  if (nudgeMode === 'alone') return 0;
  const maxPerDay = MAX_PER_DAY_BY_MODE[nudgeMode] ?? MAX_PER_DAY;
  // A number per calendar day, so the wording rotates day to day.
  const dayNo = (offset) => Math.floor(at(now, offset, 12).getTime() / DAY_MS);

  // The insight notification is scheduled ahead of time, so tomorrow's insight does not exist yet. For a ping that
  // fires today we can quote today's real insight (first sentence); for later days we say what is waiting.
  // The notification is a teaser written by the AI from the insight itself (the "hook"); the title names the
  // area (meals, water, ...). No generic fallback: if there is no real insight with a hook, nothing is sent.
  // One ping per insight, at the first 10:00 after it was written.
  let insightPing = null;
  try {
    const card = userId ? await getCachedJustForYou(userId) : null;
    const hook = String(card?.hook || '').replace(/\s+/g, ' ').trim();
    if (hook && card?.createdAt && !/insight|ready/i.test(hook)) {
      const fireAt = new Date(card.createdAt);
      if (fireAt.getHours() >= 10) fireAt.setDate(fireAt.getDate() + 1);
      fireAt.setHours(10, 0, 0, 0);
      insightPing = { date: fireAt, title: HOOK_TITLES[card.lens] || 'Something stood out', body: hook };
    }
  } catch (_) {}

  const hydrationGoalMl = hydrationGoal * (UNIT_TO_ML[volumeUnit] ?? 1);
  const todayStr = now.toDateString();
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const inLastWeek = (dateStr) => { const t = new Date(dateStr).getTime(); return !isNaN(t) && t >= weekAgo; };

  const loggedMealToday = recentMeals.some((m) => m.date === todayStr);
  const streak = computeCurrentMealStreak(recentMeals, now);

  const tracksWater = hydrationGoalMl > 0 && waterLogs.some((l) => inLastWeek(l.date));
  const waterToday = waterLogs.filter((l) => l.date === todayStr).reduce((s, l) => s + waterMl(l, volumeUnit), 0);
  const waterPct = hydrationGoalMl > 0 ? Math.round((waterToday / hydrationGoalMl) * 100) : 0;

  const tracksMovement = stepLogs.some((s) => inLastWeek(s.date)) || activities.some((a) => inLastWeek(a.date));
  const stepsToday = stepLogs.filter((s) => s.date === todayStr).reduce((s, l) => s + (l.steps || 0), 0);
  const activityToday = activities.some((a) => a.date === todayStr);

  // Burnout heads-up (published by the Insights tab's burnout calculation).
  let burnout = null;
  try {
    const raw = await AsyncStorage.getItem(BURNOUT_SUMMARY_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const fresh = s.at && now.getTime() - s.at < BURNOUT_SUMMARY_MAX_AGE_DAYS * DAY_MS;
      if (fresh && s.daysToCrash != null && s.crashDate) burnout = s;
    }
  } catch (_) {}

  const planned = []; // { day, date, id, title, body, data }
  const times = mealTimes(nudgeMode, eatingStyle, mealReminderTime, recentMeals, now);

  // Journey messages, each at that day's first or last meal time, in place of the meal reminder there.
  const takenSlots = new Set(); // `${day}-${minute of the day}`
  if (mealsOn || smartOn) {
    const meal = usualMeal(recentMeals, now);
    for (const m of lifecycleMoments(recentMeals, joinedAt, now)) {
      const t = m.slot === 'last' ? times[times.length - 1] : times[0];
      const date = at(now, m.offset, Math.floor(t.min / 60), t.min % 60);
      if (date.getTime() <= now.getTime() + 60 * 1000) continue;
      takenSlots.add(`${m.offset}-${t.min}`);
      planned.push({
        key: `journey-${m.kind}`, day: m.offset, date,
        ...lifecycleCopy(tone, m.kind, userName, m.kind === 'slip3' ? meal : null), data: { type: 'meal' },
      });
    }
  }

  // Meal reminders. Today's are skipped when a meal was logged shortly before the reminder.
  if (mealsOn) {
    const cover = MEAL_COVER_MS[nudgeMode] || MEAL_COVER_MS.default;
    const loggedToday = recentMeals
      .filter((m) => m.date === todayStr)
      .map((m) => (m.logged_at ? new Date(m.logged_at).getTime() : now.getTime()));
    for (let day = 0; day <= MEAL_DAYS_AHEAD; day++) {
      for (const t of times) {
        const date = at(now, day, Math.floor(t.min / 60), t.min % 60);
        if (date.getTime() <= now.getTime() + 60 * 1000) continue;
        if (takenSlots.has(`${day}-${t.min}`)) continue;
        if (day === 0 && loggedToday.some((ts) => ts > date.getTime() - cover)) continue;
        const c = mealReminderCopy(tone, t.slot, userName, dayNo(day) + t.min);
        planned.push({ key: `meal-${t.slot}`, day, date, title: c.title, body: c.body, data: { type: 'meal' } });
      }
    }
  }

  for (let day = 0; smartOn && day <= DAYS_AHEAD; day++) {
    const isToday = day === 0;
    const candidates = [];

    // Insight teaser -- only on the day its real insight is due (see insightPing above).
    if (insightPing && sameDay(insightPing.date, at(now, day, 10, 0))) {
      candidates.push({
        key: 'insight', date: insightPing.date, prio: 3,
        title: insightPing.title, body: insightPing.body,
        data: { type: 'insight' },
      });
    }

    // Streak at risk.
    if (streak >= 3 && !(isToday && loggedMealToday)) {
      candidates.push({
        key: 'streak', date: at(now, day, 20, 30), prio: 1,
        ...streakCopy(tone, streak, dayNo(day)), data: { type: 'streak' },
      });
    }

    // Water.
    if (tracksWater && (!isToday || waterPct < 50)) {
      candidates.push({
        key: 'water', date: at(now, day, 15, 0), prio: 4,
        ...waterCopy(tone, isToday ? waterPct : null, dayNo(day)), data: { type: 'water' },
      });
    }

    // Movement.
    if (tracksMovement && (!isToday || (stepsToday < 4000 && !activityToday))) {
      candidates.push({
        key: 'move', date: at(now, day, 17, 30), prio: 5,
        ...moveCopy(tone, isToday ? stepsToday : 0, dayNo(day)), data: { type: 'movement' },
      });
    }

    candidates
      .filter((c) => c.date.getTime() > now.getTime() + 60 * 1000)
      .sort((a, b) => a.prio - b.prio)
      .slice(0, maxPerDay)
      .forEach((c) => planned.push({ ...c, day }));
  }

  // Burnout heads-up: one warning per predicted crash day. The first re-plan picks a morning
  // (tomorrow 09:00, or today if still before 09:00) and remembers it; later re-plans keep that
  // same time while it's pending, and stop once it has fired.
  if (burnout && smartOn) {
    const crash = new Date(burnout.crashDate);
    const crashStr = crash.toDateString();
    let stored = null;
    try { stored = JSON.parse(await AsyncStorage.getItem(BURNOUT_NOTIFIED_KEY)); } catch (_) {}
    let fireAt = null;
    if (stored && stored.crash === crashStr) {
      if (stored.fireAt > now.getTime()) fireAt = new Date(stored.fireAt); // still pending: keep it
    } else {
      const today9 = at(now, 0, 9, 0);
      fireAt = today9.getTime() > now.getTime() + 60000 ? today9 : at(now, 1, 9, 0);
      AsyncStorage.setItem(BURNOUT_NOTIFIED_KEY, JSON.stringify({ crash: crashStr, fireAt: fireAt.getTime() })).catch(() => {});
    }
    if (fireAt && fireAt.getTime() < crash.getTime() + DAY_MS) {
      planned.push({
        key: 'burnout', day: Math.max(0, Math.round((fireAt.getTime() - now.getTime()) / DAY_MS)), date: fireAt, prio: 0,
        ...burnoutCopy(tone, dayPhrase(crash, fireAt)),
        data: { type: 'burnout' },
      });
    }
  }

  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${p.key}-${p.day}`,
      content: { title: p.title, body: p.body, data: p.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date },
    }).catch(() => {});
  }
  return planned.length;
};

const burnoutSummaryListeners = new Set();
// Lets the home-screen widget sync re-run the moment a fresh burnout score is saved.
export const onBurnoutSummaryPublished = (fn) => {
  burnoutSummaryListeners.add(fn);
  return () => burnoutSummaryListeners.delete(fn);
};

export const publishBurnoutSummary = async ({ daysToCrash, crashDate, score }) => {
  try {
    await AsyncStorage.setItem(BURNOUT_SUMMARY_KEY, JSON.stringify({
      daysToCrash: daysToCrash ?? null,
      crashDate: crashDate ? new Date(crashDate).toISOString() : null,
      score: score ?? null,
      at: Date.now(),
    }));
    burnoutSummaryListeners.forEach((fn) => { try { fn(); } catch (_) {} });
  } catch (_) {}
};
