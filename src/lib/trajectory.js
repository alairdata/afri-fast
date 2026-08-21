// Weekly Pace & Trajectory Engine — purely calorie/energy-driven (not scale-weight-driven).
// Answers "are you eating at the deficit you signed up for," which is a different, complementary
// question to Momentum's scale-based Pace subscore ("is the scale actually moving as expected").

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;

// kcal/day target deficit per chosen pace, and the weekly rate it implies
export const PACE_TARGET_DEFICIT = { slow: 275, moderate: 550, aggressive: 825, extreme: 1100 };
export const PACE_TARGET_RATE_KG = { slow: 0.25, moderate: 0.5, aggressive: 0.75, extreme: 1.0 };

// Organ-survival floor as a fraction of BMR, not the raw number -- BMR formulas are population
// estimates, not a lab measurement, so a small buffer avoids flagging perfectly normal high-protein
// deficits as dangerous. Shared with momentum.js's Calorie pillar for the same reason.
export const BMR_SAFETY_FLOOR_RATIO = 0.80;

// Thermic Effect of Food -- ~10% of TDEE spent digesting, regardless of activity. Shared with
// momentum.js's Movement target for the same reason: BMR + measured activity alone omits it, and
// TEF can never be "earned" through movement, so leaving it out understates real expenditure on
// any day where activity data is available.
export const TEF_RATIO = 0.10;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param tdee - Total Daily Energy Expenditure (kcal/day), or null if profile incomplete
 * @param bmr - Basal Metabolic Rate (kcal/day), or null
 * @param recentMeals - meal log entries with .date and .calories
 * @param pacePreference - 'slow' | 'moderate' | 'aggressive' | 'extreme' | null
 * @param weightEwmaTodayKg - anchor weight for projection (EWMA-smoothed), or null
 * @param confidence - 0-1, from the Momentum engine's logging-based confidence
 * @param daysSinceWeighIn - integer days since last scale log (Infinity if none ever)
 * @param activityKcalByDate - { [dateString]: kcal } measured gym+steps energy for recent days.
 *   On a day with real movement data, expenditure is BMR + that measured activity instead of the
 *   PAL-multiplier guess baked into `tdee` -- more accurate, and it's exactly the "real logs feed
 *   the prediction" idea. Days with no movement data logged (map entry missing/0) fall back to
 *   `tdee`, since a silent 0 there usually means "didn't sync," not "didn't move."
 */
export function computeWeeklyPace({
  tdee, bmr, recentMeals = [], pacePreference, weightEwmaTodayKg, confidence, daysSinceWeighIn,
  activityKcalByDate = {}, now = Date.now(),
}) {
  const dTarget = PACE_TARGET_DEFICIT[pacePreference] || null;

  const mealsByDate = {};
  recentMeals.forEach((m) => { if (m.date) mealsByDate[m.date] = (mealsByDate[m.date] || 0) + (m.calories || 0); });

  // Unlogged days are excluded entirely, not counted as a fake full-expenditure deficit -- a day
  // with nothing logged isn't "ate zero calories," it's "we don't know," and averaging it in as a
  // 2,000+kcal deficit would falsely crater the projected line every time a day goes unlogged.
  let d7d = 0, loggedDaysCount = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const ds = d.toDateString();
    const logged = mealsByDate[ds] || 0;
    if (logged <= 0) continue;
    const activityKcal = activityKcalByDate[ds] || 0;
    // + TEF: BMR + measured activity alone omits the Thermic Effect of Food (~10% of TDEE spent
    // digesting regardless of activity) -- same gap, same fix, as Momentum's Movement target.
    const expenditure = (activityKcal > 0 && bmr != null) ? bmr + bmr * TEF_RATIO + activityKcal : tdee;
    const deficit = expenditure != null ? expenditure - logged : 0;
    d7d += deficit;
    loggedDaysCount++;
  }
  const dBar = loggedDaysCount > 0 ? d7d / loggedDaysCount : null; // average daily deficit, over days actually logged
  const vEnergyKg = dBar != null ? (dBar * 7) / KCAL_PER_KG : null; // expected 7-day loss if this average holds for a full week
  const pRatio = (dBar != null && tdee != null && dTarget) ? dBar / dTarget : null;

  // Safety floor: a 3-day rolling AVERAGE (only counting days actually logged) below 80% of BMR,
  // not a single-day or full-BMR threshold. BMR formulas are population estimates -- flagging
  // every day under the raw number, or any one light day, produces false "Too Aggressive" alarms
  // on perfectly normal, high-protein deficits.
  let recentLoggedTotal = 0, recentLoggedCount = 0;
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const logged = mealsByDate[d.toDateString()] || 0;
    if (logged > 0) { recentLoggedTotal += logged; recentLoggedCount++; }
  }
  const threeDayAvgCalories = recentLoggedCount > 0 ? recentLoggedTotal / recentLoggedCount : null;
  const bmrSafetyFloor = bmr != null ? bmr * BMR_SAFETY_FLOOR_RATIO : null;
  const belowBmrFloor = threeDayAvgCalories != null && bmrSafetyFloor != null && threeDayAvgCalories < bmrSafetyFloor;

  const unsafe = belowBmrFloor || (pRatio != null && pRatio > 1.30);

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
  // (weeklyWeightChangeKg, requiredWeeklyRateKg, etc: negative delta = weight went down). null
  // (not 0) when nothing was logged this week -- a flat-line guess would be worse than no guess.
  const dailyRateKg = (tdee != null && dBar != null) ? -dBar / KCAL_PER_KG : null;

  // k is days from today -- positive for a forward forecast, negative to backfill a day this
  // week that has no real weigh-in yet. Margin widens with distance from today in either direction.
  const projectDay = (k) => {
    if (weightEwmaTodayKg == null || dailyRateKg == null) return null;
    const projectedKg = weightEwmaTodayKg + dailyRateKg * k;
    const marginKg = Math.abs(k) * 0.15 * (2 - clamp(confidence ?? 0.5, 0, 1));
    return { projectedKg, upperKg: projectedKg + marginKg, lowerKg: projectedKg - marginKg };
  };

  return { dTarget, d7d, dBar, vEnergyKg, pRatio, unsafe, belowBmrFloor, threeDayAvgCalories, bmrSafetyFloor, badge, dailyRateKg, projectDay };
}
