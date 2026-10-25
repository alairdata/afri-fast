// The weight prediction engine on its own, with no screen attached: the same steps the Insights tab runs
// (one weigh-in per day, BMR from the checkpointed weight, TDEE blended with the burn learned from past
// weigh-ins, the momentum timeline, today's weight carried forward from the food logged since the last
// weigh-in, then the weekly pace), ending in the snapshot saved to weight_predictions.
// The app saves it when Insights is open; api/cron/user-onboarding.js runs it every day on the server for
// everyone, so a prediction is saved for every day whether or not the person opened the app, and missed days
// are filled in from the logs as they stood at the end of that day.
import { computeMomentumTimeline, MET } from './momentum';
import { computeWeeklyPace, estimateChangeSinceWeighInKg } from './trajectory';
import { computeObservedTdee } from './observedTdee';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const CHECKPOINT_STEP_KG = 6;
// Same unit helpers as ProgressTab, so the numbers match what the app shows
const toKg = (w, unit) => (unit === 'lbs' ? w / 2.20462 : w);
const toCm = (h, unit) => (unit === 'ft' ? h * 30.48 : h);

const tsOf = (r) => (r.timestamp != null ? Number(r.timestamp) : new Date(r.date).getTime());

/**
 * @param profile { startingWeight, targetWeight, height, heightUnit, weightUnit, age, sex, activityLevel,
 *   pacePreference, dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, goalHistory }
 * @param now the moment the prediction is made; logs after the end of that day are ignored
 * @returns the weight_predictions snapshot (see predictionHistory.js), or null when there isn't enough to predict
 */
export function computePredictionSnapshot({
  weightLogs = [], recentMeals = [], waterLogs = [], stepLogs = [], activities = [], ledgerMap = null,
  profile = {}, now = Date.now(),
}) {
  const {
    startingWeight = null, height = '', heightUnit = 'cm', weightUnit = 'kg', age = null, sex = null,
    activityLevel = null, pacePreference = null, dailyCalorieGoal = 2000, proteinGoal = 120, carbsGoal = 200,
    fatsGoal = 65, goalHistory = [],
  } = profile;

  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const endOfToday = startOfToday.getTime() + DAY_MS - 1;
  const upToToday = (rows) => rows.filter((r) => { const t = tsOf(r); return !Number.isFinite(t) || t <= endOfToday; });
  const meals = upToToday(recentMeals);
  const weights = upToToday(weightLogs);
  const water = upToToday(waterLogs);
  const steps = upToToday(stepLogs);
  const acts = upToToday(activities);

  // one weigh-in per day, the last of the day
  const byDay = {};
  weights
    .map((w) => ({ ...w, ts: w.timestamp || new Date(w.date).getTime(), weightKg: toKg(w.weight, weightUnit) }))
    .filter((w) => !isNaN(w.ts) && typeof w.weight === 'number')
    .forEach((w) => { const day = new Date(w.ts).toDateString(); if (!byDay[day] || w.ts >= byDay[day].ts) byDay[day] = w; });
  const sortedWeights = Object.values(byDay).sort((a, b) => a.ts - b.ts);

  const currentWeight = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : startingWeight;
  const currentWeightKg = currentWeight != null ? toKg(currentWeight, weightUnit) : null;
  const startingWeightKg = startingWeight != null ? toKg(startingWeight, weightUnit) : null;
  const h = parseFloat(height);
  const heightCm = !isNaN(h) && h > 0 ? toCm(h, heightUnit) : null;

  const ewmaSeries = [];
  let ewma = null, ewmaTs = null;
  sortedWeights.forEach((w) => {
    if (ewma == null) ewma = w.weightKg;
    else { const decay = Math.pow(0.7, Math.max(0, (w.ts - ewmaTs) / DAY_MS)); ewma = decay * ewma + (1 - decay) * w.weightKg; }
    ewmaTs = w.ts;
    ewmaSeries.push(ewma);
  });
  let checkpointKg = null;
  if (ewmaSeries.length) {
    checkpointKg = startingWeightKg != null ? startingWeightKg : ewmaSeries[0];
    ewmaSeries.forEach((e) => { if (Math.abs(e - checkpointKg) >= CHECKPOINT_STEP_KG) checkpointKg = e; });
  }

  const weightForBmr = checkpointKg != null ? checkpointKg : currentWeightKg;
  let bmr = null;
  if (age && sex && heightCm && weightForBmr != null) {
    const base = 10 * weightForBmr + 6.25 * heightCm - 5 * age;
    bmr = sex === 'Male' ? base + 5 : sex === 'Female' ? base - 161 : base - 78;
  }
  const formulaTdee = bmr != null ? bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.light) : null;
  const observed = computeObservedTdee({ weightLogs: weights, recentMeals: meals, toKg: (w) => toKg(w, weightUnit), now });
  const tdee = !observed.available || formulaTdee == null
    ? formulaTdee
    : observed.confidence * observed.observedTdee + (1 - observed.confidence) * formulaTdee;

  const timeline = computeMomentumTimeline({
    weightLogs: weights, recentMeals: meals, waterLogs: water, stepLogs: steps, activities: acts,
    dailyCalorieGoal, goalHistory, ledgerMap, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal,
    fallbackWeightKg: currentWeightKg, toKg: (w) => toKg(w, weightUnit), now,
  });
  const today = timeline[timeline.length - 1];
  if (!today) return null;

  const activityKcalByDate = {};
  const bodyKg = currentWeightKg || 70;
  for (let i = 0; i <= 6; i++) activityKcalByDate[new Date(now - i * DAY_MS).toDateString()] = 0;
  acts.forEach((a) => {
    const ds = new Date(a.timestamp || new Date(a.date).getTime()).toDateString();
    if (!(ds in activityKcalByDate)) return;
    activityKcalByDate[ds] += (a.durationMin || 0) * (MET[a.type] || MET.other) * 3.5 * bodyKg / 200;
  });
  steps.forEach((s) => {
    const ds = new Date(s.timestamp || new Date(s.date).getTime()).toDateString();
    if (!(ds in activityKcalByDate)) return;
    activityKcalByDate[ds] += (s.steps || 0) * bodyKg * 0.0005;
  });

  const baseAnchorKg = currentWeightKg != null ? currentWeightKg : today.weightEwmaKg;
  const daysSinceWeighIn = Number.isFinite(today.daysSinceWeighIn) ? today.daysSinceWeighIn : null;
  const since = daysSinceWeighIn == null ? null : estimateChangeSinceWeighInKg({
    tdee, bmr, recentMeals: meals, activityKcalByDate, daysSinceWeighIn, calorieGoal: dailyCalorieGoal, now,
  });
  const anchorKg = baseAnchorKg != null && since != null ? baseAnchorKg + since.kg : baseAnchorKg;

  const pace = computeWeeklyPace({
    tdee, bmr, recentMeals: meals, pacePreference, weightEwmaTodayKg: anchorKg, confidence: today.confidence,
    daysSinceWeighIn: today.daysSinceWeighIn, activityKcalByDate, calorieGoal: dailyCalorieGoal, now,
  });
  if (anchorKg == null || pace.dailyRateKg == null) return null;

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const predictions = [];
  for (let offset = 0; offset <= 6; offset++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + offset);
    const daysOut = Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
    const proj = pace.projectDay(daysOut);
    if (!proj) continue;
    predictions.push({ targetDate: d.toDateString(), daysOut, predictedKg: proj.projectedKg, marginKg: proj.upperKg - proj.projectedKg });
  }
  if (!predictions.length) return null;

  return {
    date: startOfToday.toDateString(),
    predictions,
    anchorWeightKg: anchorKg,
    dailyRateKg: pace.dailyRateKg,
    confidence: today.confidence,
    daysSinceWeighIn: today.daysSinceWeighIn,
    tdee, bmr, pacePreference,
    avgDailyDeficitKcal: pace.dBar,
    paceRatio: pace.pRatio,
    badgeLabel: pace.badge?.label ?? null,
  };
}
