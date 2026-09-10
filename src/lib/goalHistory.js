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
  // Entries are appended in chronological order (recordGoalChange always does [...prev, snapshot]),
  // so walking forward and keeping the LAST entry that still qualifies naturally resolves same-day
  // ties to the most recent edit of that day, not whichever tied entry happened to come first — a
  // real bug the previous min/max-reduce version had (`>` never replaces on an exact tie, so it
  // silently kept the first of several same-day changes instead of the last).
  let resolved = null;
  for (const e of withField) {
    if (new Date(e.from).getTime() <= targetTime) resolved = e;
  }
  if (resolved) return resolved[field];
  // Date predates every recorded change — no record of what came before the first one, so the
  // earliest known value (first in array order) is the closest approximation available.
  return withField[0][field];
};
