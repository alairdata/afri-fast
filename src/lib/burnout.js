// Burnout / Crash-Out Risk engine — predicts diet abandonment risk from statistical ratios
// relative to the person's own TDEE/protein target, not hardcoded kcal/gram cutoffs that don't
// scale with body size or account for simple, repetitive-but-healthy traditional meals.
// Computed client-side, day-by-day: each day's score uses a rolling 7-day window ENDING that
// day, so it evolves as the week plays out rather than being fixed once computed.
//
// Also used as a building block by momentum.js (Satiety pillar = 100 - burnout score for that
// day) via the exported computeBurnoutScore single-day function.

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function bandFor(score) {
  if (score <= 25) return { label: 'Low Risk', tone: 'good' };
  if (score <= 55) return { label: 'Moderate Risk', tone: 'warn' };
  if (score <= 80) return { label: 'High Risk', tone: 'high' };
  return { label: 'Critical Crash Risk', tone: 'critical' };
}

const EMPTY_DAY = { calories: 0, protein: 0, fats: 0, foods: [], mealCount: 0 };

// Shared setup: builds the per-day meal lookup, the "if this keeps up" projection pattern for
// future dates, and a scoreWindowEnding(endDate) closure that computes the 5-vector score for
// the 7-day window ending at any date. Used by both exported functions below.
function buildScorer({ recentMeals = [], tdee, proteinGoal, now = Date.now() }) {
  const mealsByDate = {};
  recentMeals.forEach((m) => {
    if (!m.date) return;
    if (!mealsByDate[m.date]) mealsByDate[m.date] = { ...EMPTY_DAY, foods: [] };
    const d = mealsByDate[m.date];
    d.calories += m.calories || 0;
    d.protein += m.protein || 0;
    d.fats += m.fats || 0;
    d.mealCount += 1;
    // Prefer the per-item foods array; recipe-logged meals don't have one, only an
    // `items` string list -- fall back to that so they still count toward variety.
    const names = Array.isArray(m.foods) && m.foods.length
      ? m.foods.map((f) => (f?.name || '').trim().toLowerCase())
      : Array.isArray(m.items) ? m.items.map((i) => String(i || '').trim().toLowerCase()) : [];
    d.foods.push(...names.filter(Boolean));
  });

  const dayTotals = (ds) => mealsByDate[ds] || EMPTY_DAY;

  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  // "If this keeps up" pattern for projecting future days -- the average of the last 7
  // actually logged days. A likelihood score that goes blank looking forward isn't predicting
  // anything; the crash-date estimate already assumes the current pattern continues.
  const recentPattern = (() => {
    const window = [];
    for (let i = 6; i >= 0; i--) window.push(dayTotals(new Date(startOfToday.getTime() - i * DAY_MS).toDateString()));
    const logged = window.filter((d) => d.calories > 0);
    if (!logged.length) return null;
    return {
      calories: logged.reduce((s, d) => s + d.calories, 0) / logged.length,
      protein: logged.reduce((s, d) => s + d.protein, 0) / logged.length,
      fats: logged.reduce((s, d) => s + d.fats, 0) / logged.length,
      mealCount: logged.reduce((s, d) => s + d.mealCount, 0) / logged.length,
      foods: Array.from(new Set(logged.flatMap((d) => d.foods))),
    };
  })();

  const scoreWindowEnding = (endDate) => {
    const window = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * DAY_MS);
      window.push(d.getTime() <= startOfToday.getTime() ? d.toDateString() : null);
    }
    const days = window.map((ds) => (ds != null ? dayTotals(ds) : (recentPattern || { ...EMPTY_DAY, foods: [] })));

    // 1. Deficit Depth (max 35) -- deficit as a % of TDEE, not a fixed kcal cliff.
    let deficitPts = 0;
    if (tdee) {
      const avgCalories = days.reduce((s, d) => s + d.calories, 0) / 7;
      const rD = (tdee - avgCalories) / tdee;
      deficitPts = rD <= 0 ? 0 : clamp(Math.round(35 * (rD / 0.40)), 0, 35);
    }

    // 2. Food Monotony (max 25) -- unique ingredients as a ratio of total meals logged.
    const uniqueFoods = new Set(days.flatMap((d) => d.foods));
    const totalMealsLogged = days.reduce((s, d) => s + d.mealCount, 0);
    let monotonyPts = 0;
    if (totalMealsLogged > 0) {
      const rV = uniqueFoods.size / totalMealsLogged;
      monotonyPts = rV >= 0.50 ? 0 : clamp(Math.round(25 * (1 - rV / 0.50)), 0, 25);
    }

    // 3. Satiety (max 25) -- protein logged vs the user's own set protein target.
    let satietyPts = 0;
    if (proteinGoal) {
      const avgProtein = days.reduce((s, d) => s + d.protein, 0) / 7;
      const aP = avgProtein / proteinGoal;
      satietyPts = aP >= 1.0 ? 0 : clamp(Math.round(25 * (1 - aP)), 0, 25);
    }

    // 4. Low-Fat Strain (max 15) -- fat's share of total calories, smoothly scaled.
    let fatPts = 0;
    const avgCalories = days.reduce((s, d) => s + d.calories, 0) / 7;
    if (avgCalories > 0) {
      const avgFat = days.reduce((s, d) => s + d.fats, 0) / 7;
      const sF = (avgFat * 9) / avgCalories;
      fatPts = sF >= 0.20 ? 0 : clamp(Math.round(15 * (1 - sF / 0.20)), 0, 15);
    }

    // 5. Calorie Volatility (max 10) -- coefficient of variation.
    let volatilityPts = 0;
    const calArr = days.map((d) => d.calories);
    const mean = calArr.reduce((s, v) => s + v, 0) / 7;
    if (mean > 0) {
      const variance = calArr.reduce((s, v) => s + (v - mean) ** 2, 0) / 7;
      const cv = Math.sqrt(variance) / mean;
      volatilityPts = cv <= 0.15 ? 0 : clamp(Math.round(10 * ((cv - 0.15) / 0.20)), 0, 10);
    }

    const score = Math.round(clamp(deficitPts + monotonyPts + satietyPts + fatPts + volatilityPts, 0, 100));
    return { score, deficitPts, monotonyPts, satietyPts, fatPts, volatilityPts, uniqueFoodCount: uniqueFoods.size, totalMealsLogged };
  };

  return { scoreWindowEnding, startOfToday, recentPattern };
}

/** Single-day entry point -- used by momentum.js's Satiety pillar. */
export function computeBurnoutScore({ recentMeals = [], tdee, proteinGoal, endDate, now = Date.now() }) {
  const { scoreWindowEnding } = buildScorer({ recentMeals, tdee, proteinGoal, now });
  return scoreWindowEnding(endDate);
}

/** Full-week entry point -- used by the Burnout Likelihood card. */
export function computeBurnoutTimeline({ recentMeals = [], tdee, proteinGoal, now = Date.now() }) {
  const { scoreWindowEnding, startOfToday, recentPattern } = buildScorer({ recentMeals, tdee, proteinGoal, now });

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

  const week = [];
  for (let offset = 0; offset <= 6; offset++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + offset);
    const isFuture = d.getTime() > startOfToday.getTime();
    week.push({ date: d, isFuture, isProjected: isFuture && !!recentPattern, ...scoreWindowEnding(d) });
  }

  const today = scoreWindowEnding(startOfToday);
  const band = bandFor(today.score);
  const daysToCrash = Math.max(1, Math.round(14 * (1 - today.score / 100)));
  const crashDate = new Date(now + daysToCrash * DAY_MS);

  return { week, today: { ...today, band }, daysToCrash, crashDate };
}
