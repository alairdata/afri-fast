// Persisted daily snapshots of the Burnout Likelihood chart's forward-looking half (today through
// 3 days out) -- mirrors predictionHistory.js for the weight Prediction chart. The past-day half of
// this chart is already frozen by burnoutHistory.js once a day is over; this table is only the
// forecast, saved before it's known to be right or wrong, so it can be checked later once those
// same target dates get their own frozen actual score.
import { supabase } from './supabase';

const TABLE = 'burnout_predictions';

/** All saved snapshots for a user, as { [dateString]: snapshot }. */
export async function fetchSavedBurnoutPredictions(userId) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error || !data) return {};
    const byDate = {};
    data.forEach((row) => {
      byDate[row.date] = {
        predictions: row.predictions,
        bmr: row.bmr, tdee: row.tdee, pacePreference: row.pace_preference,
        dailyCalorieGoal: row.daily_calorie_goal, proteinGoal: row.protein_goal,
        carbsGoal: row.carbs_goal, fatsGoal: row.fats_goal, weightKg: row.weight_kg,
        daysToCrash: row.days_to_crash, crashDate: row.crash_date,
      };
    });
    return byDate;
  } catch (_) {
    return {};
  }
}

/** Upserts today's burnout prediction snapshot -- always reflects the latest computation for
 * `date`; once the date rolls over this row stops being touched and becomes the frozen record of
 * what was forecast. */
export async function saveBurnoutPredictionSnapshot(userId, date, snapshot) {
  if (!userId || !date || !snapshot) return;
  try {
    await supabase.from(TABLE).upsert({
      user_id: userId,
      date,
      predictions: snapshot.predictions,
      bmr: snapshot.bmr, tdee: snapshot.tdee, pace_preference: snapshot.pacePreference,
      daily_calorie_goal: snapshot.dailyCalorieGoal, protein_goal: snapshot.proteinGoal,
      carbs_goal: snapshot.carbsGoal, fats_goal: snapshot.fatsGoal, weight_kg: snapshot.weightKg,
      days_to_crash: snapshot.daysToCrash, crash_date: snapshot.crashDate,
    }, { onConflict: 'user_id,date' });
  } catch (_) {
    // Offline or transient error -- today's snapshot just stays unsaved until the next successful attempt.
  }
}
