// Observed TDEE Engine — calibrates a person's real energy expenditure from their own logged
// history (weight change over a window + average logged calorie intake over that same window),
// instead of relying solely on the Mifflin-St Jeor formula. A population-average equation is a
// starting guess; a few weeks of someone's own weigh-ins and meal logs is a direct measurement
// of how their specific body actually responds -- exactly the "your body already gave us 3
// months of experimental data" idea.
//
// Most people don't weigh in daily -- some log 3x/week, some once a month. So instead of one
// giant window from the first-ever weigh-in to the latest, this replays history gap-by-gap
// between *consecutive* weigh-ins, computes each gap's own implied TDEE, and combines them as a
// confidence-weighted average:
//
//   impliedTdee(gap) = avgDailyCalories(gap) + -(weightChangeKg(gap) * 7,700) / spanDays(gap)
//   observedTdee = Σ(beta(gap) * impliedTdee(gap)) / Σ(beta(gap))
//
// beta scales with the gap's length and how well-logged it was: a lone weigh-in after a 3-week
// gap is gold dust (near-total tissue signal, negligible water noise) and gets weighted hard; a
// string of daily weigh-ins each contributes almost nothing individually and only matters in
// aggregate, via EWMA-smoothed endpoints damping the noise. This is a weighted average rather
// than folding gaps sequentially into a running "old vs new" blend -- sequential blending would
// let whichever gap happens to be first fully seed the estimate regardless of its own confidence,
// which is exactly backwards. A weighted average has no such order-dependence, and fits a function
// with no persisted state that replays the whole history fresh on every call.

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;
const ALPHA = 0.3; // same EWMA decay used everywhere else in this app (momentum.js, InsightsTab.jsx)
const BETA_FULL_CONFIDENCE_DAYS = 21; // a 3-week+ gap gets full weight if it's well-logged

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

  const caloriesLoggedBetween = (startTs, endTs) => {
    const days = Math.max(1, Math.round((endTs - startTs) / DAY_MS));
    let loggedDayCount = 0, loggedCalorieTotal = 0;
    for (let i = 1; i <= days; i++) { // strictly after the gap's start weigh-in, through its end
      const d = new Date(startTs + i * DAY_MS);
      const cal = mealsByDate[d.toDateString()];
      if (cal > 0) { loggedDayCount++; loggedCalorieTotal += cal; }
    }
    return { loggedDayCount, loggedCalorieTotal, totalDays: days };
  };

  // Overall "is this trustworthy at all" gate -- unchanged from before: total logged coverage
  // across the whole history span the person has.
  const overall = caloriesLoggedBetween(first.ts, last.ts);
  const loggedRatio = overall.totalDays > 0 ? Math.min(1, overall.loggedDayCount / overall.totalDays) : 0;
  if (loggedRatio < MIN_LOGGED_RATIO) {
    return { available: false, reason: 'not_enough_logged_days', loggedRatio: Math.round(loggedRatio * 100) / 100, loggedDayCount: overall.loggedDayCount, totalDaysInWindow: overall.totalDays };
  }

  // EWMA-smoothed weight at each weigh-in -- gaps are measured trend-to-trend, not raw-to-raw, so
  // a single noisy reading right at a gap's edge (water retention, time of day) doesn't get
  // mistaken for real tissue change.
  const ewmaSeries = [];
  // Decay scales with elapsed days between weigh-ins, not sample count -- see momentum.js, which
  // uses the identical formula for the same reason: a reading after a long gap should land close
  // to itself, not get smoothed as if it arrived the very next day.
  let ewma = null, ewmaTs = null;
  sortedWeights.forEach((w) => {
    if (ewma == null) { ewma = w.kg; } else {
      const gapDays = Math.max(0, (w.ts - ewmaTs) / DAY_MS);
      const decay = Math.pow(1 - ALPHA, gapDays);
      ewma = decay * ewma + (1 - decay) * w.kg;
    }
    ewmaTs = w.ts;
    ewmaSeries.push(ewma);
  });

  // Confidence-weighted average across every gap's implied TDEE, weight = beta. A plain weighted
  // average (rather than folding each gap sequentially into a running "old vs new" blend) avoids
  // an order-dependence bug: sequential blending would let gap #1 -- whatever its own confidence
  // -- fully seed the estimate just because there's no prior yet, when a single early low-beta
  // gap deserves barely any say at all. Order-independence is also just a better fit here: this
  // function has no persisted state and replays the whole history fresh on every call.
  let weightedSum = 0, weightTotal = 0, lastGap = null;
  for (let i = 1; i < sortedWeights.length; i++) {
    const gapSpanDays = (sortedWeights[i].ts - sortedWeights[i - 1].ts) / DAY_MS;
    if (gapSpanDays < 0.5) continue; // same-day correction, not a real gap

    const { loggedDayCount, loggedCalorieTotal, totalDays } = caloriesLoggedBetween(sortedWeights[i - 1].ts, sortedWeights[i].ts);
    if (loggedDayCount === 0) continue; // no calorie data in this gap -- can't imply a TDEE from it

    const gapLoggedRatio = loggedDayCount / totalDays;
    const avgDailyCalories = loggedCalorieTotal / loggedDayCount;
    const weightChangeKg = ewmaSeries[i] - ewmaSeries[i - 1]; // negative = lost weight
    const dailyDeficit = -(weightChangeKg * KCAL_PER_KG) / gapSpanDays; // positive = was in a deficit
    const impliedTdee = avgDailyCalories + dailyDeficit;

    // Longer, better-logged gaps are closer to a true measurement (multi-week tissue change, not
    // day-to-day water noise) and get weighted harder into the average.
    const beta = Math.max(0, Math.min(1, gapLoggedRatio * Math.min(1, gapSpanDays / BETA_FULL_CONFIDENCE_DAYS)));

    weightedSum += beta * impliedTdee;
    weightTotal += beta;
    lastGap = { impliedTdee: Math.round(impliedTdee), spanDays: Math.round(gapSpanDays * 10) / 10, weightChangeKg: Math.round(weightChangeKg * 10) / 10, beta: Math.round(beta * 100) / 100 };
  }

  if (weightTotal === 0) {
    return { available: false, reason: 'not_enough_logged_days', loggedRatio: Math.round(loggedRatio * 100) / 100 };
  }
  const tdeeEstimate = weightedSum / weightTotal;

  return {
    available: true,
    observedTdee: Math.round(tdeeEstimate),
    avgDailyCalories: Math.round(overall.loggedCalorieTotal / overall.loggedDayCount),
    weightChangeKg: Math.round((ewmaSeries[ewmaSeries.length - 1] - first.kg) * 10) / 10,
    spanDays: overall.totalDays,
    loggedDayCount: overall.loggedDayCount,
    totalDaysInWindow: overall.totalDays,
    loggedRatio: Math.round(loggedRatio * 100) / 100,
    // Most recent gap's own implied TDEE + how much it was weighted -- e.g. for a "your last
    // weigh-in adjusted your TDEE estimate" note. null if no gap had calorie data to imply from.
    lastGap,
    // Confidence scales with how much of the window was actually logged and how long the span
    // is -- more real data, more trust in this estimate over the formula-based one. Caps at 1.
    confidence: Math.round(Math.min(1, loggedRatio * Math.min(1, spanDays / 60)) * 100) / 100,
  };
}
