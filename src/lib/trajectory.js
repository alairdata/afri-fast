// Weekly Pace & Trajectory Engine — purely calorie/energy-driven (not scale-weight-driven).
// Answers "are you eating at the deficit you signed up for," which is a different, complementary
// question to Momentum's scale-based Pace subscore ("is the scale actually moving as expected").

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;

// kcal/day target deficit per chosen pace, and the weekly rate it implies
export const PACE_TARGET_DEFICIT = { slow: 275, moderate: 550, aggressive: 825, extreme: 1100 };
export const PACE_TARGET_RATE_KG = { slow: 0.25, moderate: 0.5, aggressive: 0.75, extreme: 1.0 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param tdee - Total Daily Energy Expenditure (kcal/day), or null if profile incomplete
 * @param bmr - Basal Metabolic Rate (kcal/day), or null
 * @param recentMeals - meal log entries with .date and .calories
 * @param pacePreference - 'slow' | 'moderate' | 'aggressive' | 'extreme' | null
 * @param weightEwmaTodayKg - anchor weight for projection (EWMA-smoothed), or null
 * @param confidence - 0-1, from the Momentum engine's logging-based confidence
 * @param daysSinceWeighIn - integer days since last scale log (Infinity if none ever)
 */
export function computeWeeklyPace({
  tdee, bmr, recentMeals = [], pacePreference, weightEwmaTodayKg, confidence, daysSinceWeighIn, now = Date.now(),
}) {
  const dTarget = PACE_TARGET_DEFICIT[pacePreference] || null;

  const mealsByDate = {};
  recentMeals.forEach((m) => { if (m.date) mealsByDate[m.date] = (mealsByDate[m.date] || 0) + (m.calories || 0); });

  let d7d = 0;
  let underBmrDays = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const logged = mealsByDate[d.toDateString()] || 0;
    const deficit = tdee != null ? tdee - logged : 0;
    d7d += deficit;
    if (bmr != null && logged > 0 && logged < bmr) underBmrDays++;
  }
  const dBar = d7d / 7; // average daily deficit
  const vEnergyKg = d7d / KCAL_PER_KG; // expected 7-day loss from food energy alone (positive = loss)
  const pRatio = (tdee != null && dTarget) ? dBar / dTarget : null;

  const unsafe = underBmrDays >= 3 || (pRatio != null && pRatio > 1.30);

  let badge = null;
  if (daysSinceWeighIn > 14) badge = { label: 'Tracking Only', tone: 'neutral' };
  else if (daysSinceWeighIn > 7) badge = { label: 'Needs Weigh-in', tone: 'warn' };
  else if (unsafe) badge = { label: 'Too Aggressive', tone: 'danger' };
  else if (pRatio != null) {
    if (pRatio >= 0.90 && pRatio <= 1.30) badge = { label: 'On Pace', tone: 'good' };
    else if (pRatio >= 0.50) badge = { label: 'Off Pace', tone: 'warn' };
    else badge = { label: 'Stalled', tone: 'danger' };
  }

  // Negative = losing weight, to match the sign convention used everywhere else in this app
  // (weeklyWeightChangeKg, requiredWeeklyRateKg, etc: negative delta = weight went down).
  const dailyRateKg = tdee != null ? -dBar / KCAL_PER_KG : null;

  const projectDay = (k) => {
    if (weightEwmaTodayKg == null || dailyRateKg == null) return null;
    const projectedKg = weightEwmaTodayKg + dailyRateKg * k;
    const marginKg = k * 0.15 * (2 - clamp(confidence ?? 0.5, 0, 1));
    return { projectedKg, upperKg: projectedKg + marginKg, lowerKg: projectedKg - marginKg };
  };

  return { dTarget, d7d, dBar, vEnergyKg, pRatio, unsafe, underBmrDays, badge, dailyRateKg, projectDay };
}
