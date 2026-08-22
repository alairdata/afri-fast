// Persisted per-day Burnout Risk scores -- the one piece of state in this whole app that isn't
// recomputed fresh from raw logs every render. A past day's score is written exactly once, the
// moment it's first seen as "no longer today," and never touched again -- no later change (a new
// weigh-in shifting a BMR checkpoint, a backdated log, a goal edit) can move it. See burnout.js's
// computeBurnoutTimeline, which reads these in for any day strictly before today instead of
// recalculating them live.
import { supabase } from './supabase';

const TABLE = 'burnout_daily_scores';

/** All saved days for a user, as { [dateString]: { score, deficitPts, ... } }. */
export async function fetchSavedBurnoutDays(userId) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error || !data) return {};
    const byDate = {};
    data.forEach((row) => {
      byDate[row.date] = {
        score: row.score,
        deficitPts: row.deficit_pts, volatilityPts: row.volatility_pts,
        proteinPts: row.protein_pts, waterPts: row.water_pts, carbsPts: row.carbs_pts,
        fiberPts: row.fiber_pts, fatPts: row.fat_pts,
        avgCalories: row.avg_calories, avgProtein: row.avg_protein, avgCarbs: row.avg_carbs,
        avgFats: row.avg_fats, avgFiber: row.avg_fiber, avgWaterMl: row.avg_water_ml,
      };
    });
    return byDate;
  } catch (_) {
    return {};
  }
}

/** Writes one day's score, once. Silently ignored if that day is already saved (unique
 * user_id+date) -- finalizing is a one-time, write-once event, never an update. */
export async function saveBurnoutDay(userId, date, day) {
  if (!userId || !date || day == null) return;
  try {
    await supabase.from(TABLE).insert({
      user_id: userId,
      date,
      score: day.score,
      deficit_pts: day.deficitPts, volatility_pts: day.volatilityPts,
      protein_pts: day.proteinPts, water_pts: day.waterPts, carbs_pts: day.carbsPts,
      fiber_pts: day.fiberPts, fat_pts: day.fatPts,
      avg_calories: day.avgCalories, avg_protein: day.avgProtein, avg_carbs: day.avgCarbs,
      avg_fats: day.avgFats, avg_fiber: day.avgFiber, avg_water_ml: day.avgWaterMl,
    });
  } catch (_) {
    // Unique constraint violation (already saved) or offline -- either way, nothing to do here.
    // A failed save just means this day stays "live" until the next successful attempt.
  }
}
