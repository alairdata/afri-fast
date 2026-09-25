import { resolveCalorieGoal, resolveCaloriesEaten } from './goalHistory';

const DAY_MS = 24 * 60 * 60 * 1000;
const HYDRATION_STREAK_DAYS = 7;
const WEIGHT_DROP_KG = 5;
const MAX_LOOKBACK_DAYS = 400;

const HYDRATION_UNIT_TO_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750 };
const toKg = (w, unit) => (unit === 'lb' || unit === 'lbs' ? w / 2.20462 : w);

// Consecutive days on the calorie goal (something logged, and at or under that day's goal), counted
// back from today. A today with nothing logged yet doesn't break the run (the day isn't over); a today
// that's already over goal does. Returns { length, startDs } where startDs identifies the run.
export function computeGoalStreak({ recentMeals, ledgerMap, goalHistory, dailyCalorieGoal, now = Date.now() }) {
  const liveByDate = {};
  (recentMeals || []).forEach((m) => {
    if (!m.date) return;
    liveByDate[m.date] = (liveByDate[m.date] || 0) + (m.calories || 0);
  });
  const todayDs = new Date(now).toDateString();

  let length = 0;
  let startDs = null;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const ds = new Date(now - i * DAY_MS).toDateString();
    const live = liveByDate[ds] || 0;
    const eaten = ds === todayDs ? live : resolveCaloriesEaten(ledgerMap, ds, live);
    const goal = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
    const onGoal = eaten > 0 && eaten <= goal;
    if (onGoal) { length += 1; startDs = ds; continue; }
    if (i === 0 && eaten === 0) continue;
    break;
  }
  return { length, startDs };
}

// Consecutive days the water goal was met, counted back from today (same "today isn't over yet" rule).
export function computeHydrationStreak({ waterLogs, hydrationGoal, volumeUnit, now = Date.now() }) {
  if (!hydrationGoal) return { length: 0, startDs: null };
  const perUnit = HYDRATION_UNIT_TO_ML[volumeUnit] ?? 1;
  const goalMl = hydrationGoal * perUnit;
  const mlByDate = {};
  (waterLogs || []).forEach((w) => {
    if (!w.date) return;
    mlByDate[w.date] = (mlByDate[w.date] || 0) + (w.amount || 0) * (HYDRATION_UNIT_TO_ML[w.unit] ?? perUnit);
  });
  const todayDs = new Date(now).toDateString();

  let length = 0;
  let startDs = null;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const ds = new Date(now - i * DAY_MS).toDateString();
    const ml = mlByDate[ds] || 0;
    if (ml >= goalMl) { length += 1; startDs = ds; continue; }
    if (i === 0) continue;
    break;
  }
  return { length, startDs };
}

// Returns the celebrations currently earned, each with a stable `key` so the caller can make sure a
// given one is only ever announced once.
export function evaluateMilestones({
  config, recentMeals, ledgerMap, goalHistory, dailyCalorieGoal,
  waterLogs, hydrationGoal, volumeUnit, weightLogs, startingWeight, weightUnit, now = Date.now(),
}) {
  const out = [];

  if (config?.streak) {
    const days = config.streakDays || 7;
    const { length, startDs } = computeGoalStreak({ recentMeals, ledgerMap, goalHistory, dailyCalorieGoal, now });
    const reached = Math.floor(length / days);
    if (reached >= 1) {
      const shown = reached * days;
      out.push({
        key: `streak-${days}-${startDs}-${reached}`,
        title: `${shown}-day streak`,
        body: `You've stayed within your calorie goal ${shown} days in a row. Keep it going!`,
      });
    }
  }

  if (config?.hydration) {
    const { length, startDs } = computeHydrationStreak({ waterLogs, hydrationGoal, volumeUnit, now });
    const reached = Math.floor(length / HYDRATION_STREAK_DAYS);
    if (reached >= 1) {
      const shown = reached * HYDRATION_STREAK_DAYS;
      out.push({
        key: `hydration-${startDs}-${reached}`,
        title: `${shown} days of hydration`,
        body: `You've hit your water goal ${shown} days in a row. Your body says thank you.`,
      });
    }
  }

  if (config?.weight && startingWeight != null && weightLogs?.length) {
    const start = parseFloat(startingWeight);
    const latest = [...weightLogs].sort((a, b) => (b.timestamp || new Date(b.date).getTime() || 0) - (a.timestamp || new Date(a.date).getTime() || 0))[0];
    const latestW = parseFloat(latest?.weight);
    if (!Number.isNaN(start) && !Number.isNaN(latestW)) {
      const dropKg = toKg(start, weightUnit) - toKg(latestW, latest.unit || weightUnit);
      if (dropKg >= WEIGHT_DROP_KG) {
        out.push({
          key: `weight-drop-${WEIGHT_DROP_KG}-${Math.round(toKg(start, weightUnit) * 10)}`,
          title: `${WEIGHT_DROP_KG} kg down`,
          body: `You've dropped ${WEIGHT_DROP_KG} kg from your starting weight. That's real progress, well done!`,
        });
      }
    }
  }

  return out;
}
