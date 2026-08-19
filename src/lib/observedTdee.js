// Observed TDEE Engine — calibrates a person's real energy expenditure from their own logged
// history (weight change over a window + average logged calorie intake over that same window),
// instead of relying solely on the Mifflin-St Jeor formula. A population-average equation is a
// starting guess; a few weeks of someone's own weigh-ins and meal logs is a direct measurement
// of how their specific body actually responds -- exactly the "your body already gave us 3
// months of experimental data" idea.
//
// deficit = -(weightChangeKg * KCAL_PER_KG) / spanDays   (positive deficit = was losing)
// observedTdee = avgDailyCalories + deficit

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;

const MIN_SPAN_DAYS = 14; // need at least 2 weeks between first and last weigh-in to mean anything
const MIN_LOGGED_RATIO = 0.4; // at least 40% of days in the window need a real logged calorie total

/**
 * @param weightLogs - [{date, weight, timestamp?}], any order, any unit (pass toKg to convert)
 * @param recentMeals - [{date, calories}], any order
 * @param toKg - (weight) => kg, same conversion used elsewhere in the app
 * @param now - Date.now()-style ms timestamp
 */
export function computeObservedTdee({ weightLogs = [], recentMeals = [], toKg, now = Date.now() }) {
  const sortedWeights = weightLogs
    .map((w) => ({ ts: w.timestamp || new Date(w.date).getTime(), kg: toKg(w.weight) }))
    .filter((w) => !isNaN(w.ts))
    .sort((a, b) => a.ts - b.ts);

  if (sortedWeights.length < 2) {
    return { available: false, reason: 'not_enough_weigh_ins' };
  }

  const first = sortedWeights[0];
  const last = sortedWeights[sortedWeights.length - 1];
  const spanDays = (last.ts - first.ts) / DAY_MS;
  if (spanDays < MIN_SPAN_DAYS) {
    return { available: false, reason: 'span_too_short', spanDays: Math.round(spanDays) };
  }

  const mealsByDate = {};
  recentMeals.forEach((m) => {
    if (!m.date) return;
    mealsByDate[m.date] = (mealsByDate[m.date] || 0) + (m.calories || 0);
  });

  // Only count days strictly inside [first weigh-in, last weigh-in] that were actually logged --
  // an unlogged day contributes nothing to the average rather than being counted as a 0-kcal day.
  const totalDaysInWindow = Math.round(spanDays);
  let loggedDayCount = 0, loggedCalorieTotal = 0;
  for (let i = 0; i <= totalDaysInWindow; i++) {
    const d = new Date(first.ts + i * DAY_MS);
    const cal = mealsByDate[d.toDateString()];
    if (cal > 0) { loggedDayCount++; loggedCalorieTotal += cal; }
  }

  const loggedRatio = totalDaysInWindow > 0 ? Math.min(1, loggedDayCount / totalDaysInWindow) : 0;
  if (loggedRatio < MIN_LOGGED_RATIO) {
    return { available: false, reason: 'not_enough_logged_days', loggedRatio: Math.round(loggedRatio * 100) / 100, loggedDayCount, totalDaysInWindow };
  }

  const avgDailyCalories = loggedCalorieTotal / loggedDayCount;
  const weightChangeKg = last.kg - first.kg; // negative = lost weight, matches the sign
  // convention used everywhere else in this app (trajectory.js's dailyRateKg, etc).
  const dailyDeficit = -(weightChangeKg * KCAL_PER_KG) / spanDays; // positive = was in a deficit
  const observedTdee = avgDailyCalories + dailyDeficit;

  return {
    available: true,
    observedTdee: Math.round(observedTdee),
    avgDailyCalories: Math.round(avgDailyCalories),
    dailyDeficit: Math.round(dailyDeficit),
    weightChangeKg: Math.round(weightChangeKg * 10) / 10,
    spanDays: totalDaysInWindow,
    loggedDayCount,
    totalDaysInWindow,
    loggedRatio: Math.round(loggedRatio * 100) / 100,
    // Confidence scales with how much of the window was actually logged and how long the span
    // is -- more real data, more trust in this estimate over the formula-based one. Caps at 1.
    confidence: Math.round(Math.min(1, loggedRatio * Math.min(1, spanDays / 60)) * 100) / 100,
  };
}
