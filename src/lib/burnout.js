// Burnout / Crash-Out Risk engine — predicts diet abandonment risk from four
// psychological/physiological vectors, not just "did you hit your calorie goal."
// Computed client-side, day-by-day, same pattern as momentum.js: each day's score
// uses a rolling 7-day window ENDING that day, so it evolves as the week plays out
// rather than being fixed once computed.

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (v, x0, y0, x1, y1) => y0 + ((clamp(v, x0, x1) - x0) / (x1 - x0)) * (y1 - y0);

function bandFor(score) {
  if (score <= 25) return { label: 'Low Risk', tone: 'good' };
  if (score <= 55) return { label: 'Moderate Risk', tone: 'warn' };
  if (score <= 80) return { label: 'High Risk', tone: 'high' };
  return { label: 'Critical Crash Risk', tone: 'critical' };
}

/**
 * @param recentMeals - meal log entries with .date, .calories, .protein, .fats, .fiber, .foods
 * @param tdee - kcal/day, or null if profile incomplete
 * @param weightKg - current (EWMA) weight in kg, for g/kg protein target
 * @param now - epoch ms
 */
export function computeBurnoutTimeline({ recentMeals = [], tdee, weightKg, now = Date.now() }) {
  const mealsByDate = {};
  recentMeals.forEach((m) => {
    if (!m.date) return;
    if (!mealsByDate[m.date]) mealsByDate[m.date] = { calories: 0, protein: 0, fats: 0, fiber: 0, foods: [] };
    const d = mealsByDate[m.date];
    d.calories += m.calories || 0;
    d.protein += m.protein || 0;
    d.fats += m.fats || 0;
    d.fiber += m.fiber || 0;
    if (Array.isArray(m.foods)) d.foods.push(...m.foods.map((f) => (f?.name || '').trim().toLowerCase()).filter(Boolean));
  });

  const dayTotals = (ds) => mealsByDate[ds] || { calories: 0, protein: 0, fats: 0, fiber: 0, foods: [] };

  // Compute the 4-vector score for the 7-day window ending at `endDate`
  const scoreWindowEnding = (endDate) => {
    const window = [];
    for (let i = 6; i >= 0; i--) window.push(new Date(endDate.getTime() - i * DAY_MS).toDateString());
    const days = window.map(dayTotals);
    const loggedDays = days.filter((d) => d.calories > 0);

    // 1. Severe Deficit Depth (max 35) — unlogged days count as the full TDEE deficit,
    // same convention as the Weekly Pace engine.
    let deficitPts = 0;
    if (tdee != null) {
      const avgDeficit = window.reduce((s, ds) => s + (tdee - dayTotals(ds).calories), 0) / 7;
      deficitPts = avgDeficit <= 550 ? 0
        : avgDeficit <= 750 ? lerp(avgDeficit, 550, 0, 750, 20)
        : avgDeficit <= 1000 ? lerp(avgDeficit, 750, 20, 1000, 35)
        : 35;
    }

    // 2. Food Monotony Index (max 25) — unique ingredient names across the week
    const uniqueFoods = new Set(days.flatMap((d) => d.foods));
    const monotonyPts = uniqueFoods.size < 5 ? 25 : uniqueFoods.size <= 10 ? 12 : 0;

    // 3. Satiety & Volume Deficit (max 25) — protein g/kg + fiber g/day, averaged over logged days
    let satietyPts = 0;
    if (loggedDays.length && weightKg) {
      const avgProteinPerKg = loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length / weightKg;
      const avgFiber = loggedDays.reduce((s, d) => s + d.fiber, 0) / loggedDays.length;
      satietyPts = (avgProteinPerKg < 1.2 || avgFiber < 15) ? 25 : avgProteinPerKg < 1.6 ? 10 : 0;
    }

    // 4. Low-Fat / Hormonal Strain (max 15) — 3+ days this week under 20% of calories from fat
    const lowFatDays = loggedDays.filter((d) => d.calories > 0 && (d.fats * 9) / d.calories < 0.20).length;
    const fatPts = lowFatDays >= 3 ? 15 : 0;

    const score = Math.round(clamp(deficitPts + monotonyPts + satietyPts + fatPts, 0, 100));
    return { score, deficitPts: Math.round(deficitPts), monotonyPts, satietyPts, fatPts, uniqueFoodCount: uniqueFoods.size, lowFatDays, loggedDays: loggedDays.length };
  };

  // Build the current Sun-Sat calendar week: real scores for days up to today, nothing for
  // future days (no fake projection — matches how the weight trend chart treats gaps).
  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

  const week = [];
  for (let offset = 0; offset <= 6; offset++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + offset);
    if (d.getTime() > startOfToday.getTime()) {
      week.push({ date: d, isFuture: true });
    } else {
      week.push({ date: d, isFuture: false, ...scoreWindowEnding(d) });
    }
  }

  const today = scoreWindowEnding(startOfToday);
  const band = bandFor(today.score);
  const daysToCrash = Math.max(1, Math.round(14 * (1 - today.score / 100)));
  const crashDate = new Date(now + daysToCrash * DAY_MS);

  return { week, today: { ...today, band }, daysToCrash, crashDate };
}
