// Smart (data-aware) notifications. Everything here is scheduled on the phone (no server), so the
// app re-plans the next few days every time the user's data changes -- each re-plan cancels the
// previous smart notifications first, so a nudge for something you've already done disappears the
// moment you log it. Today's nudges are judged on real data; later days are provisional and get
// corrected by the next re-plan (any log happens inside the app, which triggers one).
//
// Rules (calm tone, max MAX_PER_DAY a day, nothing before 08:00 or after 21:30):
//   - Daily insight: one short "insight ready" ping at 10:00.
//   - Streak at risk: 20:30, only if you have a >=3-day logging streak and nothing logged today.
//   - Water: 15:00, only if you track water and you're under half your goal.
//   - Movement: 17:30, only if you track steps/activity and today is still quiet.
//   - Burnout heads-up: 09:00, only when the burnout trend projects a crash within a few days.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeCurrentMealStreak } from './mealStreak';

const ID_PREFIX = 'smart-';
const DAYS_AHEAD = 3;
const MAX_PER_DAY = 3;
const DAY_MS = 86400000;
export const BURNOUT_SUMMARY_KEY = 'logga-burnout-summary-v1';
const BURNOUT_NOTIFIED_KEY = 'logga-burnout-notified-v1';
const BURNOUT_SUMMARY_MAX_AGE_DAYS = 3;

const at = (base, dayOffset, hour, minute = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const sameDay = (a, b) => a.toDateString() === b.toDateString();

const weekdayName = (d) => d.toLocaleDateString('en-US', { weekday: 'long' });

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
export const syncSmartNotifications = async (ctx) => {
  const now = new Date();
  await cancelSmart();

  const { recentMeals = [], waterLogs = [], stepLogs = [], activities = [], hydrationGoal = 0, volumeUnit } = ctx;
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

  for (let day = 0; day <= DAYS_AHEAD; day++) {
    const isToday = day === 0;
    const candidates = [];

    // Daily insight -- deliberately one short line.
    candidates.push({ key: 'insight', date: at(now, day, 10, 0), title: 'Logga', body: 'Insight ready ✨', data: { type: 'insight' }, prio: 3 });

    // Streak at risk.
    if (streak >= 3 && !(isToday && loggedMealToday)) {
      candidates.push({
        key: 'streak', date: at(now, day, 20, 30), prio: 1,
        title: `${streak}-day streak 🔥`, body: 'Log something small to keep it going.', data: { type: 'streak' },
      });
    }

    // Water.
    if (tracksWater && (!isToday || waterPct < 50)) {
      candidates.push({
        key: 'water', date: at(now, day, 15, 0), prio: 4,
        title: 'Water check 💧', body: isToday ? `You're at ${waterPct}% of today's goal.` : 'How is your water today?', data: { type: 'water' },
      });
    }

    // Movement.
    if (tracksMovement && (!isToday || (stepsToday < 4000 && !activityToday))) {
      candidates.push({
        key: 'move', date: at(now, day, 17, 30), prio: 5,
        title: 'A short walk? 🚶', body: isToday && stepsToday > 0 ? `${stepsToday.toLocaleString()} steps so far.` : 'Even 10 minutes counts.', data: { type: 'movement' },
      });
    }

    candidates
      .filter((c) => c.date.getTime() > now.getTime() + 60 * 1000)
      .sort((a, b) => a.prio - b.prio)
      .slice(0, MAX_PER_DAY)
      .forEach((c) => planned.push({ ...c, day }));
  }

  // Burnout heads-up: one warning per predicted crash day. The first re-plan picks a morning
  // (tomorrow 09:00, or today if still before 09:00) and remembers it; later re-plans keep that
  // same time while it's pending, and stop once it has fired.
  if (burnout) {
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
      const daysBetween = Math.round((crash.getTime() - fireAt.getTime()) / DAY_MS);
      planned.push({
        key: 'burnout', day: Math.max(0, Math.round((fireAt.getTime() - now.getTime()) / DAY_MS)), date: fireAt, prio: 0,
        title: 'Heads up 🌤️',
        body: daysBetween <= 1
          ? 'You may hit a rough patch soon. A proper meal and some water today will help.'
          : `You may hit a rough patch around ${weekdayName(crash)}. Eating well today helps.`,
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

export const publishBurnoutSummary = async ({ daysToCrash, crashDate, score }) => {
  try {
    await AsyncStorage.setItem(BURNOUT_SUMMARY_KEY, JSON.stringify({
      daysToCrash: daysToCrash ?? null,
      crashDate: crashDate ? new Date(crashDate).toISOString() : null,
      score: score ?? null,
      at: Date.now(),
    }));
  } catch (_) {}
};
