// Resolves what a tracked goal value (calorie/protein/carbs/fats/hydration) actually was on a
// given date, using the sparse change-log goalHistory keeps (see recordGoalChange in
// FastingApp.jsx) — each entry says "starting from this date, the goal became these values", not
// a per-day record. To find the goal on date D, take the latest entry whose `from` is on or
// before D. A date older than every recorded change has no history to check — it falls back to
// the EARLIEST known value as the closest available approximation, since there's no way to know
// what came before the very first recorded change.
//
// This matters everywhere the app judges a PAST day or week against "the goal" — Momentum,
// Burnout, streaks, hit-rate dots, recommendations — all of it must grade old days against the
// goal that was actually active then, not whatever the goal happens to be right now. Changing
// your goal today must never retroactively repaint your history as on-target (or off-target).
export const resolveGoalForDate = (goalHistory, dateStr, currentValue, field = 'dailyCalorieGoal') => {
  const withField = (goalHistory || []).filter(e => e[field] != null);
  if (!withField.length) return currentValue;
  const targetTime = new Date(dateStr).getTime();
  const inEffectBy = withField.filter(e => new Date(e.from).getTime() <= targetTime);
  if (inEffectBy.length) {
    return inEffectBy.reduce((latest, e) => (new Date(e.from) > new Date(latest.from) ? e : latest))[field];
  }
  return withField.reduce((earliest, e) => (new Date(e.from) < new Date(earliest.from) ? e : earliest))[field];
};
