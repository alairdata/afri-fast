// Momentum Score engine — computed client-side from existing logs (no persisted state).
// EWMA gives the "hard to build, quick to lose" feel without needing a stored daily
// snapshot: each day's sub-score is derived purely from raw inputs + the recurrence.
//
// v2: three pillars only -- Calorie (40%), Satiety (35%, = 100 - that day's Burnout Risk
// score), Movement (25%, MET-based active energy vs a physiological target). Pace and Logging
// are no longer separate weighted terms: Pace lives on its own "Pace to Goal" card instead, and
// Logging's old role (don't let a single missed day double-penalize) is now handled by having
// unlogged days decay the Calorie/Movement EWMA by 5% instead of injecting a raw-zero score.

import { computeBurnoutScore } from './burnout';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALPHA = 0.3; // EWMA decay factor (~7-day half-life)

const WEIGHTS = { calorie: 0.40, satiety: 0.35, movement: 0.25 };

// MET (Metabolic Equivalent of Task) per activity type -- shared with AddActivityModal.jsx's
// own estimate so the two don't silently disagree.
const MET = { walking: 3.5, running: 9.8, cycling: 7.5, swimming: 6, strength: 6, sports: 7, other: 4 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// R_C = 1 - |logged - target| / target
function calorieRawScore(actual, target) {
  if (!target) return 0;
  const rC = 1 - Math.abs(actual - target) / target;
  return Math.max(0, Math.round(100 * rC));
}

// E_active (kcal) for the day: gym/activity sessions via MET formula, steps via a flat
// per-step-per-kg estimate. R_M = E_active / E_target, where E_target = TDEE - BMR
// (the "activity" slice of TDEE implied by the person's PAL/activity multiplier).
function movementRawScore({ dayActivities, steps, weightKg, bmr, tdee }) {
  if (!weightKg || !bmr || !tdee) return null;
  const eTarget = tdee - bmr;
  if (eTarget <= 0) return null;
  let eActive = 0;
  dayActivities.forEach((a) => {
    const met = MET[a.type] || MET.other;
    eActive += (a.durationMin || 0) * met * 3.5 * weightKg / 200;
  });
  eActive += (steps || 0) * weightKg * 0.0005;
  return clamp(Math.round(100 * (eActive / eTarget)), 0, 100);
}

// Shared EWMA step for Calorie/Movement: blend today's raw score in if there's real data for
// today, otherwise gently decay yesterday's smoothed value (never re-inject a raw zero -- an
// unlogged day isn't the same as "definitely failed today"). Decay only applies once there's
// an actual smoothed value to decay -- a day with no history yet isn't "momentum lost", it's
// "nothing built yet", so it stays null (displayed as neutral) rather than drifting toward 0.
function ewmaStep(prev, rawToday, hasDataToday) {
  if (hasDataToday) return prev == null ? rawToday : ALPHA * rawToday + (1 - ALPHA) * prev;
  return prev == null ? null : prev * 0.95;
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
  tdee,
  bmr,
  proteinGoal,
  fallbackWeightKg, // used for the movement calc on days before any weigh-in exists
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

  const activitiesByDate = {};
  activities.forEach((a) => {
    if (!a.date) return;
    if (!activitiesByDate[a.date]) activitiesByDate[a.date] = [];
    activitiesByDate[a.date].push({ type: a.type, durationMin: a.durationMin });
  });

  const daysSinceLastWeighIn = (cutoffTs) => {
    const upTo = sortedWeights.filter((w) => w.ts <= cutoffTs);
    if (!upTo.length) return Infinity;
    return Math.floor((cutoffTs - upTo[upTo.length - 1].ts) / DAY_MS);
  };

  const timeline = [];
  let calEwma = null, moveEwma = null, weightEwma = null, loggedStreak7 = [];

  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS);
    const ds = day.toDateString();
    const cutoffTs = day.getTime();

    const caloriesToday = mealsByDate[ds] || 0;
    const loggedToday = caloriesToday > 0;

    // Weight EWMA — smooths day-to-day water-weight noise. Only emitted on real weigh-in days,
    // but also used internally as the body-weight input to today's movement calc.
    const rawWeighInToday = sortedWeights.find((w) => new Date(w.ts).toDateString() === ds);
    if (rawWeighInToday) {
      weightEwma = weightEwma == null ? rawWeighInToday.weightKg : ALPHA * rawWeighInToday.weightKg + (1 - ALPHA) * weightEwma;
    }
    const daysSinceWeighIn = daysSinceLastWeighIn(cutoffTs);
    const weightForToday = weightEwma != null ? weightEwma : fallbackWeightKg;

    // Pillar 1: Calorie (40%)
    const calRaw = calorieRawScore(caloriesToday, dailyCalorieGoal);
    calEwma = ewmaStep(calEwma, calRaw, loggedToday);

    // Pillar 2: Satiety (35%) = 100 - that day's Burnout Risk score. No separate EWMA layer --
    // Burnout is already a rolling 7-day-window calculation, so it's inherently smoothed.
    const burnout = computeBurnoutScore({ recentMeals, tdee, proteinGoal, endDate: day, now });
    const satietyScore = clamp(100 - burnout.score, 0, 100);

    // Pillar 3: Movement (25%) — MET-based active energy vs a physiological target (TDEE - BMR)
    const dayActivities = activitiesByDate[ds] || [];
    const stepsToday = stepsByDate[ds] || 0;
    const hasMovementDataToday = dayActivities.length > 0 || stepsToday > 0;
    const moveRaw = movementRawScore({ dayActivities, steps: stepsToday, weightKg: weightForToday, bmr, tdee });
    moveEwma = moveRaw == null ? moveEwma : ewmaStep(moveEwma, moveRaw, hasMovementDataToday);

    const momentum = Math.round(clamp(
      WEIGHTS.calorie * (calEwma ?? 50) + WEIGHTS.satiety * satietyScore + WEIGHTS.movement * (moveEwma ?? 50),
      0, 100,
    ));

    // Confidence (used by the trajectory chart's cone + Weekly Pace engine) -- how many of the
    // last 7 days had any meal logged, discounted if the last weigh-in has gone stale.
    loggedStreak7.push(loggedToday);
    if (loggedStreak7.length > 7) loggedStreak7.shift();
    const loggingRatio = loggedStreak7.filter(Boolean).length / loggedStreak7.length;
    const staleWeighIn = daysSinceWeighIn > 7;
    const confidence = clamp(loggingRatio * (staleWeighIn ? 0.65 : 1), 0, 1);

    timeline.push({
      date: day,
      ds,
      calorieSubscore: Math.round(calEwma ?? 50),
      satietySubscore: Math.round(satietyScore),
      movementSubscore: moveEwma != null ? Math.round(moveEwma) : null,
      momentum,
      confidence,
      band: bandFor(momentum),
      staleWeighIn,
      daysSinceWeighIn,
      weightEwmaKg: rawWeighInToday ? weightEwma : null,
      hasWeighInToday: !!rawWeighInToday,
    });
  }

  return timeline;
}
