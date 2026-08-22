// Burnout / Crash-Out Risk engine — predicts diet abandonment risk from statistical ratios
// relative to the person's own targets, not hardcoded kcal/gram cutoffs that don't scale with
// body size or account for simple, repetitive-but-healthy traditional meals.
// Computed client-side, day-by-day. Three top-level factors, all out of a 100-point risk budget
// (higher = more at risk):
//   - Deficit Depth (20) -- 28-day window, since real under/over-eating burnout is a multi-week
//     pattern a 7-day snapshot can't distinguish from a single hard week.
//   - Calorie Volatility (20) -- 14-day window, long enough that one unusual day doesn't
//     masquerade as a pattern, short enough to still catch a new problem within two weeks.
//   - Nutrition (60) -- 7-day window, split across Protein (15), Water (20), Carbs (10),
//     Fiber (10), Fat (5). Each is a pure floor check: 0 risk anywhere AT OR ABOVE the floor (no
//     penalty for having more than the floor -- these aren't targets to hit, they're minimums not
//     to fall under), risk scaling smoothly the further under the floor you are. Floors are 80% of
//     the person's own protein/carb/fat goals (which already vary by their chosen macro style --
//     e.g. a low-carb goal naturally produces a low carb floor, no special-casing needed) or, for
//     fiber and water where no stored goal exists, an evidence-based default (14g fiber per
//     1,000kcal; 35ml water per kg body weight).
//
// No longer tracks food repetition as its own factor -- eating the same staple combo repeatedly
// isn't inherently a crash-out signal (that assumption came from Western fad-diet psychology and
// doesn't hold for a diet built around real staples people actually like), and nutrient adequacy
// is covered directly by Nutrition above. If that's being met, repetition on its own isn't a problem.
//
// Also used as a building block by momentum.js (Satiety pillar = 100 - burnout score for that
// day) via the exported computeBurnoutScore single-day function.

import { PACE_TARGET_DEFICIT, BMR_SAFETY_FLOOR_RATIO } from './trajectory';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFICIT_DEPTH_WINDOW_DAYS = 28;
const VOLATILITY_WINDOW_DAYS = 14;
const FLOOR_RATIO = 0.80; // same "80% of the real number" methodology as the BMR safety floor
const FIBER_G_PER_1000_KCAL = 14; // Dietary Guidelines / EFSA baseline
const WATER_ML_PER_KG = 35; // EFSA baseline total water intake

// Water logs store amount + whatever unit the person picked -- mirrors FastingApp.jsx's own
// HYDRATION_UNIT_TO_ML table so a sachet/bottle/oz log converts to the same ml everywhere.
const HYDRATION_UNIT_TO_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function bandFor(score) {
  if (score <= 25) return { label: 'Low Risk', tone: 'good' };
  if (score <= 55) return { label: 'Moderate Risk', tone: 'warn' };
  if (score <= 80) return { label: 'High Risk', tone: 'high' };
  return { label: 'Critical Crash Risk', tone: 'critical' };
}

// Pure floor check, shared by every Nutrition sub-factor: 0 risk at or above the floor, however
// far above it -- none of these have a "too much" penalty. Below the floor, risk scales smoothly
// using the floor's own size as the reference, so a small floor (fiber, grams) and a large one
// (water, ml) both scale sensibly on their own terms without needing separate tuning.
function floorScore(actual, floor, maxPts) {
  if (!floor || actual >= floor) return 0;
  return clamp(Math.round(maxPts * (floor - actual) / floor), 0, maxPts);
}

const EMPTY_DAY = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, mealCount: 0 };

// Shared setup: builds the per-day meal + water lookups, the "if this keeps up" projection
// pattern for future dates, and a scoreWindowEnding(endDate) closure that computes the score for
// the 7-day window ending at any date. Used by both exported functions below.
function buildScorer({
  recentMeals = [], waterLogs = [], tdee, bmr, weightKg, pacePreference,
  dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, now = Date.now(),
}) {
  const mealsByDate = {};
  recentMeals.forEach((m) => {
    if (!m.date) return;
    if (!mealsByDate[m.date]) mealsByDate[m.date] = { ...EMPTY_DAY };
    const d = mealsByDate[m.date];
    d.calories += m.calories || 0;
    d.protein += m.protein || 0;
    d.carbs += m.carbs || 0;
    d.fats += m.fats || 0;
    d.fiber += m.fiber || 0;
    d.mealCount += 1;
  });

  const waterByDate = {};
  waterLogs.forEach((w) => {
    if (!w.date) return;
    const toMl = HYDRATION_UNIT_TO_ML[w.unit] ?? 1;
    waterByDate[w.date] = (waterByDate[w.date] || 0) + (w.amount || 0) * toMl;
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
      carbs: logged.reduce((s, d) => s + d.carbs, 0) / logged.length,
      fats: logged.reduce((s, d) => s + d.fats, 0) / logged.length,
      fiber: logged.reduce((s, d) => s + d.fiber, 0) / logged.length,
      mealCount: logged.reduce((s, d) => s + d.mealCount, 0) / logged.length,
    };
  })();

  // Deficit Depth (max 20) -- looks back 28 days, not 7: real burnout from under- or over-eating
  // is a multi-week pattern, and a 7-day average can't tell "day 4 of a diet" from "day 60."
  // Despite the name, it scores BOTH directions -- eating way over target is just as much a sign
  // of being "off the bandwagon" as eating dangerously under it, and both should raise crash-out
  // risk, not just one of them. Each logged day gets 0-20+ points:
  //   - Anywhere from the 80%-BMR floor up to target: 0 points, flat, no gradient. There's
  //     nothing wrong with running a bigger deficit than average -- someone eating right at their
  //     own floor isn't in worse shape than someone eating right at their own target, as long as
  //     neither crosses the line.
  //   - Under the floor: flat 20 (max), however far under -- this is the hard safety line.
  //   - Over target: scales with how far over, same shape as the Momentum Calorie pillar's
  //     overeating penalty, uncapped per-day so a real binge shows up, though the final score is
  //     still clamped to 20 overall.
  // Unlogged days are excluded from the average entirely -- silence isn't a signal either way.
  // A recent (last-7-of-the-28) run of 4+ days scoring at least half of max (from either
  // direction) adds a bonus, since going off-plan several days running compounds faster than the
  // same days scattered out.
  const deficitDepthScore = (endDate) => {
    if (bmr == null || tdee == null) return 0;
    const floor = bmr * BMR_SAFETY_FLOOR_RATIO;
    const paceDeficit = PACE_TARGET_DEFICIT[pacePreference] || PACE_TARGET_DEFICIT.moderate;
    const target = Math.max(floor + 1, tdee - paceDeficit); // guard divide-by-zero if the pace itself asks for less than the floor

    const pointsFor = (cal) => {
      if (cal < floor) return 20;
      if (cal <= target) return 0;
      return 20 * (cal - target) / target;
    };

    let pointsSum = 0, loggedCount = 0;
    const recentPoints = []; // last 7 of the 28, oldest first -- for the back-to-back check
    for (let i = DEFICIT_DEPTH_WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * DAY_MS);
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (dMidnight.getTime() > startOfToday.getTime()) continue; // can't classify a future day
      const cal = dayTotals(d.toDateString()).calories;
      const logged = cal > 0;
      const points = logged ? pointsFor(cal) : null;
      if (logged) { pointsSum += points; loggedCount++; }
      if (i < 7) recentPoints.push(points);
    }
    if (loggedCount === 0) return 0;

    let longestRun = 0, currentRun = 0;
    recentPoints.forEach((p) => {
      currentRun = (p != null && p >= 10) ? currentRun + 1 : 0;
      longestRun = Math.max(longestRun, currentRun);
    });
    const backToBackBonus = longestRun >= 4 ? 4 : 0;

    return clamp(Math.round(pointsSum / loggedCount + backToBackBonus), 0, 20);
  };

  // Calorie Volatility (max 20) -- coefficient of variation over a 14-day window, not 7. A single
  // unusual day (a one-off celebration, a bad day) has outsized influence over just 7 days --
  // widening to 14 dilutes a genuine one-off down to a minor nudge instead of a false "erratic
  // eating" flag, while a truly sustained binge-restrict pattern scores just as high regardless of
  // window size, since it keeps recurring either way -- so this loses no real detection power.
  // Unlogged days still count as 0 here (unlike Deficit Depth's 28-day average, which excludes
  // them) -- deliberately: the prediction is only as good as what's actually logged, and silently
  // excluding unlogged days would let someone dodge this signal just by not logging a bad stretch.
  const volatilityScore = (endDate) => {
    const calArr = [];
    for (let i = VOLATILITY_WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * DAY_MS);
      const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (dMidnight.getTime() > startOfToday.getTime()) continue; // can't classify a future day
      calArr.push(dayTotals(d.toDateString()).calories);
    }
    if (!calArr.length) return 0;
    const mean = calArr.reduce((s, v) => s + v, 0) / calArr.length;
    if (mean <= 0) return 0;
    const variance = calArr.reduce((s, v) => s + (v - mean) ** 2, 0) / calArr.length;
    const cv = Math.sqrt(variance) / mean;
    return cv <= 0.15 ? 0 : clamp(Math.round(20 * ((cv - 0.15) / 0.20)), 0, 20);
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
    const days = window.map((ds) => (ds != null ? dayTotals(ds) : (recentPattern || EMPTY_DAY)));
    const avgWaterMl = window.reduce((s, ds) => s + (ds != null ? (waterByDate[ds] || 0) : 0), 0) / 7;

    // Deficit Depth (max 20) -- see deficitDepthScore above (28-day window, not this window's 7).
    const deficitPts = deficitDepthScore(endDate);
    const avgCaloriesAll = days.reduce((s, d) => s + d.calories, 0) / 7;

    // Calorie Volatility (max 20) -- see volatilityScore above (14-day window, not this window's 7).
    const volatilityPts = volatilityScore(endDate);

    // Nutrition (max 60) -- five pure floor checks, see floorScore above. Floors are 80% of the
    // person's own goals (already macro-style-aware for protein/carbs/fat) or an evidence-based
    // default where no goal exists (fiber, water).
    const avgProtein = days.reduce((s, d) => s + d.protein, 0) / 7;
    const avgCarbs = days.reduce((s, d) => s + d.carbs, 0) / 7;
    const avgFats = days.reduce((s, d) => s + d.fats, 0) / 7;
    const avgFiber = days.reduce((s, d) => s + d.fiber, 0) / 7;

    const proteinFloor = proteinGoal ? proteinGoal * FLOOR_RATIO : null;
    const carbsFloor = carbsGoal ? carbsGoal * FLOOR_RATIO : null;
    const fatsFloor = fatsGoal ? fatsGoal * FLOOR_RATIO : null;
    const fiberFloor = Math.max(20, ((dailyCalorieGoal || 0) / 1000) * FIBER_G_PER_1000_KCAL);
    const waterFloorMl = weightKg ? weightKg * WATER_ML_PER_KG * FLOOR_RATIO : null;

    const proteinPts = floorScore(avgProtein, proteinFloor, 15);
    const waterPts = floorScore(avgWaterMl, waterFloorMl, 20);
    const carbsPts = floorScore(avgCarbs, carbsFloor, 10);
    const fiberPts = floorScore(avgFiber, fiberFloor, 10);
    const fatPts = floorScore(avgFats, fatsFloor, 5);

    const score = Math.round(clamp(deficitPts + volatilityPts + proteinPts + waterPts + carbsPts + fiberPts + fatPts, 0, 100));
    return {
      score, deficitPts, volatilityPts, proteinPts, waterPts, carbsPts, fiberPts, fatPts,
      // Raw 7-day averages -- so callers can cite an exact gap ("62g vs your 120g target")
      // instead of just a points breakdown.
      avgCalories: Math.round(avgCaloriesAll), avgProtein: Math.round(avgProtein),
      avgCarbs: Math.round(avgCarbs), avgFats: Math.round(avgFats), avgFiber: Math.round(avgFiber),
      avgWaterMl: Math.round(avgWaterMl),
    };
  };

  return { scoreWindowEnding, startOfToday, recentPattern };
}

/** Single-day entry point -- used by momentum.js's Satiety pillar. */
export function computeBurnoutScore({
  recentMeals = [], waterLogs = [], tdee, bmr, weightKg, pacePreference,
  dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, endDate, now = Date.now(),
}) {
  const { scoreWindowEnding } = buildScorer({
    recentMeals, waterLogs, tdee, bmr, weightKg, pacePreference,
    dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, now,
  });
  return scoreWindowEnding(endDate);
}

/**
 * Full-week entry point -- used by the Burnout Likelihood card.
 * @param savedDays - { [dateString]: dayResult } previously-finalized scores (see
 *   src/lib/burnoutHistory.js). Any day strictly before today that has a saved entry uses it
 *   verbatim instead of recalculating -- once a day is over, its number is permanent, and no
 *   later change (a new weigh-in, a backdated log, a goal edit) can move it again. Days without a
 *   saved entry yet (never seen as "past" before, or from before this existed) fall back to a
 *   live calculation -- it's the caller's job to then persist that result via saveBurnoutDay so
 *   it's frozen from here on.
 */
export function computeBurnoutTimeline({
  recentMeals = [], waterLogs = [], tdee, bmr, weightKg, pacePreference,
  dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, savedDays = {}, now = Date.now(),
}) {
  const { scoreWindowEnding, startOfToday, recentPattern } = buildScorer({
    recentMeals, waterLogs, tdee, bmr, weightKg, pacePreference,
    dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, now,
  });

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

  const week = [];
  for (let offset = 0; offset <= 6; offset++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + offset);
    const isFuture = d.getTime() > startOfToday.getTime();
    const isPast = d.getTime() < startOfToday.getTime();
    const ds = d.toDateString();
    const saved = isPast ? savedDays[ds] : null;
    week.push({ date: d, ds, isFuture, isPast, isFinalized: !!saved, isProjected: isFuture && !!recentPattern, ...(saved || scoreWindowEnding(d)) });
  }

  const today = scoreWindowEnding(startOfToday);
  const band = bandFor(today.score);
  const daysToCrash = Math.max(1, Math.round(14 * (1 - today.score / 100)));
  const crashDate = new Date(now + daysToCrash * DAY_MS);

  return { week, today: { ...today, band }, daysToCrash, crashDate };
}
