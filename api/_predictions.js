// The daily weight prediction, run on the server for every user (called from api/cron/user-onboarding.js, since
// the Hobby plan allows only 12 serverless functions). Uses the same engine as the app (src/lib/predictionEngine.js),
// so a prediction is saved for every day whether or not the person opened the app. Days in the last
// BACKFILL_DAYS with no saved prediction are filled in from the logs as they stood at the end of that day.
// Rows the app already saved are never overwritten (insert with ignore-duplicates).
import { adminHeaders } from './_authEmail.js';
import { buildDailyLedgerMap } from '../src/lib/goalHistory.js';
import { computePredictionSnapshot } from '../src/lib/predictionEngine.js';

const DAY = 24 * 60 * 60 * 1000;
const BACKFILL_DAYS = 90;
const url = (path) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;

async function rows(path) {
  const out = [];
  for (let from = 0; from < 50000; from += 1000) {
    const r = await fetch(url(path), { headers: { ...adminHeaders(), Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path.split('?')[0]} ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

// Same as FastingApp's normalizeMealDate: "2026-10-24" -> that day's toDateString()
const mealDate = (d) => {
  const m = d && String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toDateString() : d;
};

async function predictForUser(p, now) {
  const id = p.id;
  const [meals, weights, water, steps, acts, ledger, saved] = await Promise.all([
    rows(`meals?user_id=eq.${id}&select=id,calories,protein,carbs,fats,fiber,date,logged_at`),
    rows(`weight_logs?user_id=eq.${id}&select=id,date,weight,unit`),
    rows(`water_logs?user_id=eq.${id}&select=id,date,display_date,amount,unit`),
    rows(`step_logs?user_id=eq.${id}&select=id,date,display_date,steps`),
    rows(`activities?user_id=eq.${id}&select=id,type,name,date,timestamp,duration_min`),
    rows(`daily_goal_ledger?user_id=eq.${id}&select=log_date,calories_eaten,calorie_goal,status&order=log_date.asc`),
    rows(`weight_predictions?user_id=eq.${id}&select=date`),
  ]);
  if (!meals.length) return 0;
  const input = {
    recentMeals: meals.map((m) => ({ ...m, date: mealDate(m.date) })),
    weightLogs: weights.map((r) => ({ id: r.id, date: r.date, timestamp: r.id, weight: r.weight, unit: r.unit })),
    waterLogs: water.map((r) => ({ id: r.id, date: r.date, displayDate: r.display_date, amount: r.amount, unit: r.unit })),
    stepLogs: steps.map((r) => ({ id: r.id, date: r.date, displayDate: r.display_date, steps: r.steps })),
    activities: acts.map((r) => ({ id: r.id, type: r.type, name: r.name, date: r.date, timestamp: r.timestamp, durationMin: r.duration_min })),
    ledgerMap: buildDailyLedgerMap(ledger),
    profile: {
      startingWeight: p.starting_weight != null ? parseFloat(p.starting_weight) : null,
      targetWeight: p.target_weight != null ? parseFloat(p.target_weight) : null,
      height: p.height ?? '', heightUnit: p.height_unit || 'cm', weightUnit: p.weight_unit || 'kg',
      age: p.age ?? null, sex: p.sex || null, activityLevel: p.activity_level || null, pacePreference: p.pace_preference || null,
      dailyCalorieGoal: p.daily_calorie_goal ?? 2000, proteinGoal: p.protein_goal ?? 120, carbsGoal: p.carbs_goal ?? 200,
      fatsGoal: p.fats_goal ?? 65, goalHistory: p.goal_history || [],
    },
  };
  const have = new Set(saved.map((r) => r.date));
  const firstMeal = Math.min(...input.recentMeals.map((m) => new Date(m.date).getTime()).filter(Number.isFinite));
  const out = [];
  for (let i = BACKFILL_DAYS; i >= 0; i--) {
    const day = new Date(now - i * DAY);
    const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toDateString();
    if (have.has(ds) || new Date(ds).getTime() < firstMeal) continue;
    // today: as of now; a missed past day: as of the end of that day
    const at = i === 0 ? now : new Date(ds).getTime() + DAY - 60 * 1000;
    const snap = computePredictionSnapshot({ ...input, now: at });
    if (!snap) continue;
    out.push({
      user_id: id, date: snap.date, predictions: snap.predictions,
      anchor_weight_kg: snap.anchorWeightKg, daily_rate_kg: snap.dailyRateKg, confidence: snap.confidence,
      days_since_weigh_in: Number.isFinite(snap.daysSinceWeighIn) ? snap.daysSinceWeighIn : null,
      tdee: snap.tdee, bmr: snap.bmr, pace_preference: snap.pacePreference,
      avg_daily_deficit_kcal: snap.avgDailyDeficitKcal, pace_ratio: snap.paceRatio, badge_label: snap.badgeLabel,
    });
  }
  if (!out.length) return 0;
  const r = await fetch(url('weight_predictions?on_conflict=user_id,date'), {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(out),
  });
  if (!r.ok) throw new Error(`save ${r.status} ${(await r.text()).slice(0, 200)}`);
  return out.length;
}

export async function savePredictionsForEveryone(now = Date.now()) {
  const profiles = await rows('profiles?select=id,starting_weight,target_weight,height,height_unit,weight_unit,age,sex,activity_level,pace_preference,daily_calorie_goal,protein_goal,carbs_goal,fats_goal,goal_history');
  const result = { users: profiles.length, saved: 0, errors: [] };
  for (const p of profiles) {
    try { result.saved += await predictForUser(p, now); } catch (e) { result.errors.push(`${p.id}: ${e.message}`); }
  }
  return result;
}
