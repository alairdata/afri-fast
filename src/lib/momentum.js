// Momentum Score engine — computed client-side from existing logs (no persisted state).
// EWMA gives the "hard to build, quick to lose" feel without needing a stored daily
// snapshot: each day's sub-score is derived purely from raw inputs + the recurrence.

const DAY_MS = 24 * 60 * 60 * 1000;
const ALPHA = 0.3; // EWMA decay factor (~7-day half-life)
const WORKOUT_TARGET_PER_WEEK = 3;

const BASE_WEIGHTS = { calorie: 0.40, pace: 0.25, activity: 0.20, logging: 0.15 };
const NO_WEIGHIN_WEIGHTS = { calorie: 0.50, pace: 0.05, activity: 0.20, logging: 0.25 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function calorieRawScore(actual, budget) {
  if (!budget || actual == null) return 0;
  const dev = Math.abs(actual - budget) / budget;
  return clamp(100 - dev * 150, 0, 100);
}

// ratio = observed weekly rate / required weekly rate (both signed kg/week, same direction)
function paceScoreFromRatio(ratio) {
  if (ratio == null) return null;
  if (ratio >= 1) return 100;
  if (ratio >= 0.5) return 60 + ((ratio - 0.5) / 0.5) * 30; // 60..90
  if (ratio >= 0) return 40 + (ratio / 0.5) * 20; // 40 (stalled) .. 60
  return clamp(20 * (1 + Math.max(ratio, -1)), 0, 20); // 0..20, gaining during a deficit
}

function activityRawScore(avgSteps7, stepGoal, workouts7) {
  const stepsPart = stepGoal ? Math.min(1, avgSteps7 / stepGoal) : 0;
  const workoutsPart = Math.min(1, workouts7 / WORKOUT_TARGET_PER_WEEK);
  return clamp((0.6 * stepsPart + 0.4 * workoutsPart) * 100, 0, 100);
}

function loggingScore(streak, loggedToday) {
  if (!loggedToday) return 0;
  if (streak <= 1) return 60;
  if (streak <= 3) return 60 + ((streak - 1) / 2) * 15; // 60..75
  if (streak < 7) return 75 + ((streak - 3) / 4) * 25; // 75..100
  return 100;
}

function bandFor(score) {
  if (score >= 80) return { label: 'STRONG', tone: 'strong' };
  if (score >= 60) return { label: 'DRIFTING', tone: 'drifting' };
  return { label: 'STALLED', tone: 'stalled' };
}

/**
 * Walks day-by-day from `windowDays` ago to today, computing the EWMA-smoothed
 * Momentum Score at each step. Returns the full timeline; callers typically
 * only need the last entry, but the history is there for a trend view later.
 */
export function computeMomentumTimeline({
  weightLogs = [],
  recentMeals = [],
  stepLogs = [],
  activities = [],
  dailyCalorieGoal,
  stepGoal,
  requiredWeeklyRateKg, // signed kg/week, negative = need to lose; null if no goal_date set
  toKg,
  windowDays = 60,
  now = Date.now(),
}) {
  const sortedWeights = weightLogs
    .map((w) => ({ ...w, ts: w.timestamp || new Date(w.date).getTime(), weightKg: toKg(w.weight) }))
    .filter((w) => !isNaN(w.ts))
    .sort((a, b) => a.ts - b.ts);

  const mealsByDate = {};
  recentMeals.forEach((m) => {
    if (!m.date) return;
    mealsByDate[m.date] = (mealsByDate[m.date] || 0) + (m.calories || 0);
  });

  const stepsByDate = {};
  stepLogs.forEach((s) => { stepsByDate[s.date] = (stepsByDate[s.date] || 0) + (s.steps || 0); });

  const activityDates = new Set(activities.map((a) => a.date));

  const observedRateAsOf = (cutoffTs) => {
    const upTo = sortedWeights.filter((w) => w.ts <= cutoffTs);
    if (upTo.length < 4) return null;
    const thisWeek = upTo.slice(-7);
    const priorWeek = upTo.slice(Math.max(0, upTo.length - 14), Math.max(0, upTo.length - 7));
    if (!priorWeek.length) return null;
    const avgThis = thisWeek.reduce((s, w) => s + w.weightKg, 0) / thisWeek.length;
    const avgPrior = priorWeek.reduce((s, w) => s + w.weightKg, 0) / priorWeek.length;
    return avgThis - avgPrior;
  };

  const daysSinceLastWeighIn = (cutoffTs) => {
    const upTo = sortedWeights.filter((w) => w.ts <= cutoffTs);
    if (!upTo.length) return Infinity;
    return Math.floor((cutoffTs - upTo[upTo.length - 1].ts) / DAY_MS);
  };

  const timeline = [];
  let calEwma = null, actEwma = null, streak = 0;

  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS);
    const ds = day.toDateString();
    const cutoffTs = day.getTime();

    const loggedToday = (mealsByDate[ds] || 0) > 0;

    // Calorie
    const calRaw = calorieRawScore(mealsByDate[ds] || 0, dailyCalorieGoal);
    calEwma = calEwma == null ? calRaw : ALPHA * calRaw + (1 - ALPHA) * calEwma;

    // Pace / trend
    const observedRate = observedRateAsOf(cutoffTs);
    const paceRatio = (observedRate != null && requiredWeeklyRateKg) ? observedRate / requiredWeeklyRateKg : null;
    const paceScore = paceScoreFromRatio(paceRatio);

    // Activity (7-day trailing window ending today)
    let stepsSum = 0, stepsCount = 0, workoutDays = 0;
    for (let d = 0; d < 7; d++) {
      const dd = new Date(cutoffTs - d * DAY_MS).toDateString();
      if (stepsByDate[dd] != null) { stepsSum += stepsByDate[dd]; stepsCount++; }
      if (activityDates.has(dd)) workoutDays++;
    }
    const avgSteps7 = stepsCount ? stepsSum / stepsCount : 0;
    const actRaw = activityRawScore(avgSteps7, stepGoal, workoutDays);
    actEwma = actEwma == null ? actRaw : ALPHA * actRaw + (1 - ALPHA) * actEwma;

    // Logging streak
    streak = loggedToday ? streak + 1 : 0;
    const logScore = loggingScore(streak, loggedToday);

    // Confidence shift — stale weigh-in reduces trust in the pace term
    const staleWeighIn = daysSinceLastWeighIn(cutoffTs) > 7;
    const weights = (paceScore != null && staleWeighIn) ? NO_WEIGHIN_WEIGHTS : BASE_WEIGHTS;

    // Graceful degrade: if there's no goal_date at all (paceScore null outright),
    // drop it and redistribute proportionally across whatever's available.
    const parts = [
      { key: 'calorie', w: weights.calorie, v: calEwma },
      { key: 'activity', w: weights.activity, v: actEwma },
      { key: 'logging', w: weights.logging, v: logScore },
    ];
    if (paceScore != null) parts.push({ key: 'pace', w: weights.pace, v: paceScore });
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    const momentum = Math.round(parts.reduce((s, p) => s + p.v * (p.w / totalW), 0));

    const confidence = clamp((logScore / 100) * (staleWeighIn ? 0.65 : 1), 0, 1);

    timeline.push({
      date: day,
      ds,
      calorieSubscore: Math.round(calEwma),
      paceSubscore: paceScore != null ? Math.round(paceScore) : null,
      activitySubscore: Math.round(actEwma),
      loggingSubscore: Math.round(logScore),
      momentum: clamp(momentum, 0, 100),
      confidence,
      band: bandFor(momentum),
      staleWeighIn,
    });
  }

  return timeline;
}
