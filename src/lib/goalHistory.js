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

// daily_goal_ledger (see supabase/migrations/20260910_add_daily_goal_ledger.sql) is the
// precomputed, hourly-refreshed source of truth for "what was the calorie goal on this day" —
// it mirrors resolveGoalForDate's own logic server-side, so it should agree with it, but reading
// a flat table beats every consumer independently re-deriving the same answer and risking a
// different bug in each place, which is exactly what kept happening across this fix.
//
// log_date comes back from Supabase as a Postgres `date` in "YYYY-MM-DD" form — never parse that
// with `new Date(iso)` directly, it's interpreted as UTC midnight and can silently land on the
// wrong calendar day once converted to local time. The (year, monthIndex, day) constructor form
// is always local, matching normalizeMealDate's same precaution elsewhere in this app.
export const isoDateToDateString = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toDateString();
};

export const buildLedgerGoalMap = (dailyGoalLedger) => {
  const map = new Map();
  (dailyGoalLedger || []).forEach(r => {
    if (r.calorie_goal != null) map.set(isoDateToDateString(r.log_date), r.calorie_goal);
  });
  return map;
};

// Ledger takes priority when it has an entry for this date; falls back to the live resolver only
// for a date the ledger hasn't caught up to yet (today, before the next hourly refresh, or
// before any meal is logged today at all). Calorie-goal only — the ledger doesn't track
// protein/carbs/fats, so those still go through resolveGoalForDate directly.
export const resolveCalorieGoal = (ledgerGoalMap, goalHistory, dateStr, currentValue) => {
  const fromLedger = ledgerGoalMap?.get(dateStr);
  if (fromLedger != null) return fromLedger;
  return resolveGoalForDate(goalHistory, dateStr, currentValue, 'dailyCalorieGoal');
};
