// Persisted daily snapshots of the Prediction chart -- the chart itself is always recomputed live
// from current data (see ProgressTab's `chart`/`predictionSnapshot`), so without this there'd be no
// record of what was actually predicted on a given day once tomorrow's numbers overwrite it. Each
// snapshot also carries the parameters that produced it (anchor weight, rate, confidence, TDEE/BMR,
// pace), so a later predicted-vs-actual comparison can also explain *why* a prediction was off, not
// just that it was.
import { supabase } from './supabase';

const TABLE = 'weight_predictions';

/** All saved snapshots for a user, as { [dateString]: snapshot }. */
export async function fetchSavedPredictions(userId) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error || !data) return {};
    const byDate = {};
    data.forEach((row) => {
      byDate[row.date] = {
        predictions: row.predictions,
        anchorWeightKg: row.anchor_weight_kg, dailyRateKg: row.daily_rate_kg,
        confidence: row.confidence, daysSinceWeighIn: row.days_since_weigh_in,
        tdee: row.tdee, bmr: row.bmr, pacePreference: row.pace_preference,
        avgDailyDeficitKcal: row.avg_daily_deficit_kcal, paceRatio: row.pace_ratio,
        badgeLabel: row.badge_label,
      };
    });
    return byDate;
  } catch (_) {
    return {};
  }
}

/** Upserts today's prediction snapshot -- always reflects the latest computation for `date`; once
 * the date rolls over this row stops being touched and becomes the frozen historical record. */
export async function savePredictionSnapshot(userId, date, snapshot) {
  if (!userId || !date || !snapshot) return;
  try {
    await supabase.from(TABLE).upsert({
      user_id: userId,
      date,
      predictions: snapshot.predictions,
      anchor_weight_kg: snapshot.anchorWeightKg, daily_rate_kg: snapshot.dailyRateKg,
      confidence: snapshot.confidence, days_since_weigh_in: snapshot.daysSinceWeighIn,
      tdee: snapshot.tdee, bmr: snapshot.bmr, pace_preference: snapshot.pacePreference,
      avg_daily_deficit_kcal: snapshot.avgDailyDeficitKcal, pace_ratio: snapshot.paceRatio,
      badge_label: snapshot.badgeLabel,
    }, { onConflict: 'user_id,date' });
  } catch (_) {
    // Offline or transient error -- today's snapshot just stays unsaved until the next successful attempt.
  }
}
