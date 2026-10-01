// Daily burn (TDEE) and "when will I get there" maths for the Daily calorie target page.
//
// The TDEE here is the SAME number the Insights tab shows: a Mifflin-St Jeor estimate off the person's
// (smoothed, checkpointed) weight, blended with the burn their own weigh-ins and meal logs imply once
// there is enough history. This mirrors the derivation in ProgressTab.jsx; if that changes, change this.
import { computeObservedTdee } from './observedTdee';

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;
const CHECKPOINT_STEP_KG = 6;
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

// Daily deficit each pace choice means (the same table the onboarding plan uses).
export const PACE_DEFICIT = { slow: 275, moderate: 550, aggressive: 825, extreme: 1100 };

export const toKg = (w, unit) => (unit === 'lbs' ? w / 2.20462 : w);
export const fromKg = (kg, unit) => (unit === 'lbs' ? kg * 2.20462 : kg);
const toCm = (h, unit) => (unit === 'ft' ? h * 30.48 : h);

// Limits on a daily target someone can SET on the Daily calorie target page. Low: 1,200 for everyone (people
// following a plan can use it). High: more than +1,000 over their daily burn is about +1 kg of weight gain
// a week, which is beyond what is considered healthy by any standard.
export const MIN_CALORIES = 1200;
export const MAX_SURPLUS = 1000;
export const MAX_TARGET_NO_TDEE = 4500;
export const calorieFloor = () => MIN_CALORIES;

export function computeTdeeSummary({
  weightLogs = [], recentMeals = [], weightUnit = 'kg', startingWeight, targetWeight,
  age, sex, height, heightUnit, activityLevel, now = Date.now(),
}) {
  const sorted = (weightLogs || [])
    .map((w) => ({ ts: w.timestamp || new Date(w.date).getTime(), weight: w.weight, weightKg: toKg(w.weight, weightUnit) }))
    .filter((w) => !isNaN(w.ts) && typeof w.weight === 'number')
    .sort((a, b) => a.ts - b.ts);

  const currentWeight = sorted.length ? sorted[sorted.length - 1].weight : startingWeight;
  const currentWeightKg = currentWeight != null ? toKg(currentWeight, weightUnit) : null;
  const startingWeightKg = startingWeight != null ? toKg(startingWeight, weightUnit) : null;
  const targetWeightKg = targetWeight != null ? toKg(targetWeight, weightUnit) : null;

  const h = parseFloat(height);
  const heightCm = !isNaN(h) && h > 0 ? toCm(h, heightUnit) : null;

  // Time-decayed EWMA of the weigh-ins, then a checkpoint that only moves after a 6 kg shift.
  const ewma = [];
  let e = null; let eTs = null;
  sorted.forEach((w) => {
    if (e == null) e = w.weightKg;
    else {
      const decay = Math.pow(0.7, Math.max(0, (w.ts - eTs) / DAY_MS));
      e = decay * e + (1 - decay) * w.weightKg;
    }
    eTs = w.ts;
    ewma.push(e);
  });
  let anchor = null;
  if (ewma.length) {
    anchor = startingWeightKg != null ? startingWeightKg : ewma[0];
    ewma.forEach((v) => { if (Math.abs(v - anchor) >= CHECKPOINT_STEP_KG) anchor = v; });
  }

  const weightForBmr = anchor != null ? anchor : currentWeightKg;
  let bmr = null;
  if (age && sex && heightCm && weightForBmr != null) {
    const base = 10 * weightForBmr + 6.25 * heightCm - 5 * age;
    bmr = sex === 'Male' ? base + 5 : sex === 'Female' ? base - 161 : base - 78;
  }
  const formulaTdee = bmr != null ? bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.light) : null;

  const observed = computeObservedTdee({ weightLogs, recentMeals, toKg: (w) => toKg(w, weightUnit), now });
  let tdee = formulaTdee;
  const usesLogs = !!(observed.available && formulaTdee != null);
  if (usesLogs) tdee = observed.confidence * observed.observedTdee + (1 - observed.confidence) * formulaTdee;

  return {
    currentWeightKg, targetWeightKg,
    tdee: tdee != null ? Math.round(tdee) : null,
    usesLogs,
    floor: calorieFloor(sex),
  };
}

// What a given daily target means for reaching the goal weight.
//   kind: 'maintain' | 'lose' | 'gain' | 'away' | 'stalled' | 'unknown'
//   'away' = the target moves them the opposite way from their goal (a surplus when they want to lose,
//   a deficit when they want to gain). We can say how fast, not where it would stop.
export function projectGoal({ currentKg, targetKg, tdee, calories }) {
  if (currentKg == null || targetKg == null || tdee == null || !calories) return { kind: 'unknown' };
  const gapKg = currentKg - targetKg; // > 0: wants to lose
  if (Math.abs(gapKg) < 0.5) return { kind: 'maintain' };
  const weeklyKg = ((tdee - calories) * 7) / KCAL_PER_KG; // > 0: losing
  const wantsLoss = gapKg > 0;
  const moving = wantsLoss ? weeklyKg : -weeklyKg;
  if (moving <= -0.02) return { kind: 'away', wantsLoss, weeklyKg: Math.abs(weeklyKg) };
  if (moving < 0.02) return { kind: 'stalled', wantsLoss, weeklyKg };
  const weeks = Math.max(1, Math.ceil(Math.abs(gapKg) / moving));
  return {
    kind: wantsLoss ? 'lose' : 'gain',
    weeks, weeklyKg: Math.abs(weeklyKg),
    date: new Date(Date.now() + weeks * 7 * DAY_MS),
    fast: wantsLoss && currentKg > 0 && Math.abs(weeklyKg) > currentKg * 0.01,
  };
}
