// Burnout / Crash-Out Risk engine — predicts diet abandonment risk from statistical ratios
// relative to the person's own TDEE/protein target, not hardcoded kcal/gram cutoffs that don't
// scale with body size or account for simple, repetitive-but-healthy traditional meals.
// Computed client-side, day-by-day: most factors use a rolling 7-day window ENDING that day, so
// the score evolves as the week plays out rather than being fixed once computed. Deficit Depth is
// the exception -- it looks back 28 days, since real under-eating burnout is a multi-week
// phenomenon a 7-day snapshot can't distinguish from a single hard week.
//
// Also used as a building block by momentum.js (Satiety pillar = 100 - burnout score for that
// day) via the exported computeBurnoutScore single-day function.

import { PACE_TARGET_DEFICIT, BMR_SAFETY_FLOOR_RATIO } from './trajectory';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFICIT_DEPTH_WINDOW_DAYS = 28;

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
function buildScorer({ recentMeals = [], tdee, bmr, pacePreference, proteinGoal, now = Date.now() }) {
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

  // Deficit Depth (max 10) -- looks back 28 days, not 7: real metabolic/satiety burnout from
  // under-eating is a multi-week phenomenon, and a 7-day average can't tell "day 4 of a diet"
  // from "day 60." Deliberately has no fixed "% of BMR" cutoff above the floor -- someone running
  // a bigger deficit than average isn't doing anything wrong, and a flat line (e.g. "100% of BMR")
  // would flag plenty of people for correctly hitting their own, more aggressive, intentional
  // target. Instead each logged day gets a severity from 0 to 1 based on where it falls in THIS
  // person's own floor-to-target range: right at their target = 0 (no strain, that's the plan
  // working), right at (or below) the 80%-BMR floor = 1 (max strain), linear in between. Eating
  // at or above target isn't strain at all, whatever the number is.
  // Unlogged days are skipped entirely rather than counted as strain -- silence isn't under-eating.
  // A recent (last-7-of-the-28) run of 4+ days at 0.5+ severity adds an extra bump, since satiety
  // debt compounds fast once it's back-to-back.
  const deficitDepthScore = (endDate) => {
    if (bmr == null || tdee == null) return 0;
    const floor = bmr * BMR_SAFETY_FLOOR_RATIO;
    const paceDeficit = PACE_TARGET_DEFICIT[pacePreference] || PACE_TARGET_DEFICIT.moderate;
    const target = Math.max(floor + 1, tdee - paceDeficit); // guard divide-by-zero if the pace itself asks for less than the floor

    const severityFor = (cal) => {
      if (cal >= target) return 0;
      if (cal <= floor) return 1;
      return (target - cal) / (target - floor);
    };

    let strainSum = 0;
    const recentSeverities = []; // last 7 of the 28, oldest first -- for the back-to-back check
    for (let i = DEFICIT_DEPTH_WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * DAY_MS);
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (dMidnight.getTime() > startOfToday.getTime()) continue; // can't classify a future day
      const cal = dayTotals(d.toDateString()).calories;
      const severity = cal > 0 ? severityFor(cal) : 0; // unlogged day -- skip, don't count as strain
      strainSum += severity * 0.5;
      if (i < 7) recentSeverities.push(severity);
    }

    let longestRun = 0, currentRun = 0;
    recentSeverities.forEach((s) => {
      currentRun = s >= 0.5 ? currentRun + 1 : 0;
      longestRun = Math.max(longestRun, currentRun);
    });
    const backToBackBonus = longestRun >= 4 ? 2 : 0;

    return clamp(Math.round(strainSum + backToBackBonus), 0, 10);
  };

  const scoreWindowEnding = (endDate) => {
    const window = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * DAY_MS);
      // Compare calendar days, not raw timestamps -- endDate can carry today's actual
      // clock time (momentum.js passes `now` verbatim as endDate for the current day), and
      // comparing that directly against a midnight-normalized startOfToday would wrongly
      // mark today "future" for any time after midnight, silently swapping its real data
      // for the projected average.
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      window.push(dMidnight.getTime() <= startOfToday.getTime() ? d.toDateString() : null);
    }
    const days = window.map((ds) => (ds != null ? dayTotals(ds) : (recentPattern || { ...EMPTY_DAY, foods: [] })));

    // 1. Deficit Depth (max 10) -- see deficitDepthScore above (28-day zone-based, not this
    // window's 7-day average). Weighted down from an earlier max of 35: an isolated deep-deficit
    // week matters less to crash-out risk than day-to-day binge-restrict volatility (below),
    // which is the sharper predictor.
    const deficitPts = deficitDepthScore(endDate);
    const avgCaloriesAll = days.reduce((s, d) => s + d.calories, 0) / 7;

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
    const avgProtein = days.reduce((s, d) => s + d.protein, 0) / 7;
    if (proteinGoal) {
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

    // 5. Calorie Volatility (max 25) -- coefficient of variation. Weighted up from an earlier
    // max of 10: this is the actual signature of a binge-restrict loop (e.g. 1,400kcal days
    // alternating with 3,500+kcal days), which a simple 7-day average calorie figure hides
    // completely even though it's what precedes giving up, not just running a steady deficit.
    let volatilityPts = 0;
    const calArr = days.map((d) => d.calories);
    const mean = calArr.reduce((s, v) => s + v, 0) / 7;
    if (mean > 0) {
      const variance = calArr.reduce((s, v) => s + (v - mean) ** 2, 0) / 7;
      const cv = Math.sqrt(variance) / mean;
      volatilityPts = cv <= 0.15 ? 0 : clamp(Math.round(25 * ((cv - 0.15) / 0.20)), 0, 25);
    }

    const score = Math.round(clamp(deficitPts + monotonyPts + satietyPts + fatPts + volatilityPts, 0, 100));
    return {
      score, deficitPts, monotonyPts, satietyPts, fatPts, volatilityPts,
      uniqueFoodCount: uniqueFoods.size, totalMealsLogged,
      // Raw 7-day averages -- so callers can cite an exact gap ("62g vs your 120g target")
      // instead of just a points breakdown.
      avgCalories: Math.round(avgCaloriesAll), avgProtein: Math.round(avgProtein),
    };
  };

  return { scoreWindowEnding, startOfToday, recentPattern };
}

/** Single-day entry point -- used by momentum.js's Satiety pillar. */
export function computeBurnoutScore({ recentMeals = [], tdee, bmr, pacePreference, proteinGoal, endDate, now = Date.now() }) {
  const { scoreWindowEnding } = buildScorer({ recentMeals, tdee, bmr, pacePreference, proteinGoal, now });
  return scoreWindowEnding(endDate);
}

/** Full-week entry point -- used by the Burnout Likelihood card. */
export function computeBurnoutTimeline({ recentMeals = [], tdee, bmr, pacePreference, proteinGoal, now = Date.now() }) {
  const { scoreWindowEnding, startOfToday, recentPattern } = buildScorer({ recentMeals, tdee, bmr, pacePreference, proteinGoal, now });

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
