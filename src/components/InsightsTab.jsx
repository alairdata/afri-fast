import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { computeMomentumTimeline, MET } from '../lib/momentum';
import { computeWeeklyPace } from '../lib/trajectory';
import { computeObservedTdee } from '../lib/observedTdee';
import { computeBurnoutTimeline } from '../lib/burnout';

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN = '#F59E0B';
const DANGER = '#EF4444';
const WARN_BG = '#FFF7ED';
const DANGER_BG = '#FEF2F2';
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

const toKg = (w, unit) => (unit === 'lbs' ? w / 2.20462 : w);
const fromKg = (kg, unit) => (unit === 'lbs' ? kg * 2.20462 : kg);
const toCm = (h, unit) => (unit === 'ft' ? h * 30.48 : h);

const smooth = (pts) => {
  if (!pts.length) return '';
  if (pts.length < 3) return 'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ');
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) * t} ${p1[1] + (p2[1] - p0[1]) * t}, ${p2[0] - (p3[0] - p1[0]) * t} ${p2[1] - (p3[1] - p1[1]) * t}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dayLabel = (d) => 'SMTWTFS'[d.getDay()];

// ── Momentum gauge (0-100 semicircle) ──────────────────────────────────────
function buildGauge(score, accent) {
  const cx = 110, cy = 100, r = 78, n = 30;
  const stops = [
    { p: 0, c: [224, 82, 82] }, { p: 0.3, c: [240, 138, 60] },
    { p: 0.55, c: [242, 190, 70] }, { p: 0.78, c: [110, 190, 120] }, { p: 1, c: hexToRgb(accent) },
  ];
  const lerp = (t) => {
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1].p < t) i++;
    const a = stops[i], b = stops[i + 1], f = Math.max(0, Math.min(1, (t - a.p) / (b.p - a.p)));
    return a.c.map((v, k) => Math.round(v + (b.c[k] - v) * f));
  };
  const xy = (deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const segments = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = xy(180 + i * (180 / n)), [x1, y1] = xy(180 + (i + 1) * (180 / n));
    const c = lerp(i / n);
    segments.push({ d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, stroke: `rgb(${c[0]},${c[1]},${c[2]})` });
  }
  const rad = ((180 + (score / 100) * 180) * Math.PI) / 180, iR = r - 13, oR = r + 13;
  return {
    segments,
    needle: { x1: cx + iR * Math.cos(rad), y1: cy + iR * Math.sin(rad), x2: cx + oR * Math.cos(rad), y2: cy + oR * Math.sin(rad) },
  };
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#059669');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [5, 150, 105];
}

const InsightsTab = ({
  userId = null,
  userName = '',
  weightLogs = [],
  recentMeals = [],
  waterLogs = [],
  startingWeight = null,
  targetWeight = null,
  weightUnit = 'kg',
  dailyCalorieGoal = 2000,
  goalDate = null,
  userJoinDate = null,
  age = null,
  sex = null,
  height = '',
  heightUnit = 'cm',
  activityLevel = null,
  stepLogs = [],
  stepGoal = 10000,
  activities = [],
  pacePreference = null,
  proteinGoal = null,
  carbsGoal = null,
  fatsGoal = null,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [view, setView] = useState('main');
  const [guardrailDismissed, setGuardrailDismissed] = useState(false);
  const [chartTooltip, setChartTooltip] = useState(null);

  useEffect(() => { if (!chartTooltip) return; const t = setTimeout(() => setChartTooltip(null), 4000); return () => clearTimeout(t); }, [chartTooltip]);
  const accent = colors.accent;

  const now = Date.now();

  // ══════════════════════════════════════════════════════════════════════
  // PROFILE & GOALS — one-time baseline
  // ══════════════════════════════════════════════════════════════════════

  const sortedWeights = useMemo(() => {
    return (weightLogs || [])
      .map((w) => ({ ...w, ts: w.timestamp || new Date(w.date).getTime(), weightKg: toKg(w.weight, weightUnit) }))
      .filter((w) => !isNaN(w.ts) && typeof w.weight === 'number')
      .sort((a, b) => a.ts - b.ts);
  }, [weightLogs, weightUnit]);

  const currentWeight = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : startingWeight;
  const currentWeightKg = currentWeight != null ? toKg(currentWeight, weightUnit) : null;
  const startingWeightKg = startingWeight != null ? toKg(startingWeight, weightUnit) : null;
  const targetWeightKg = targetWeight != null ? toKg(targetWeight, weightUnit) : null;
  const goalIsLoss = targetWeight != null && startingWeight != null ? targetWeight <= startingWeight : true;

  const heightCm = useMemo(() => {
    const h = parseFloat(height);
    return !isNaN(h) && h > 0 ? toCm(h, heightUnit) : null;
  }, [height, heightUnit]);

  // Today's EWMA-smoothed weight — same time-decayed alpha=0.3 recurrence as momentum.js,
  // computed independently here (only depends on raw weight logs) so BMR/TDEE can react to it
  // without waiting on the full momentum timeline. Mathematically identical to momentumTimeline's
  // last entry. Decay scales with elapsed days between weigh-ins, not sample count -- a weigh-in
  // after a long gap should snap the trend close to itself, not get smoothed as gently as a
  // next-day reading would be. Also returns the full series (not just the latest value) -- the
  // BMR checkpoint below needs to walk the whole smoothed trend, not just today's point.
  const weightEwmaSeries = useMemo(() => {
    const series = [];
    let ewma = null, ewmaTs = null;
    sortedWeights.forEach((w) => {
      if (ewma == null) { ewma = w.weightKg; } else {
        const gapDays = Math.max(0, (w.ts - ewmaTs) / DAY_MS);
        const decay = Math.pow(0.7, gapDays);
        ewma = decay * ewma + (1 - decay) * w.weightKg;
      }
      ewmaTs = w.ts;
      series.push(ewma);
    });
    return series;
  }, [sortedWeights]);

  // BMR checkpoint weight — BMR (and everything downstream: TDEE, Momentum, Burnout, the
  // Prediction chart's rate) intentionally does NOT react to the live EWMA weight day to day.
  // Recalculating on every weigh-in makes the displayed TDEE visibly jitter, which reads as
  // untrustworthy even though it's technically more precise. Instead it holds at a fixed anchor
  // -- starting at the person's starting weight -- until the smoothed trend has moved a full 6kg
  // away from that anchor, in either direction, at which point it "checkpoints" onto the new
  // smoothed value and holds there until the next 6kg move. Stateless: walks the full EWMA series
  // fresh every render rather than persisting which checkpoint is "current."
  const CHECKPOINT_STEP_KG = 6;
  const bmrCheckpointWeightKg = useMemo(() => {
    if (!weightEwmaSeries.length) return null;
    let anchor = startingWeightKg != null ? startingWeightKg : weightEwmaSeries[0];
    weightEwmaSeries.forEach((e) => { if (Math.abs(e - anchor) >= CHECKPOINT_STEP_KG) anchor = e; });
    return anchor;
  }, [weightEwmaSeries, startingWeightKg]);

  // BMR — Mifflin-St Jeor, recalculated off the checkpointed weight (not the live day-to-day
  // trend, and not starting weight forever either) so the calorie budget steps down as real
  // milestones are hit, instead of either going stale or jittering constantly.
  const bmr = useMemo(() => {
    const weightForBmr = bmrCheckpointWeightKg != null ? bmrCheckpointWeightKg : currentWeightKg;
    if (!age || !sex || !heightCm || weightForBmr == null) return null;
    const base = 10 * weightForBmr + 6.25 * heightCm - 5 * age;
    if (sex === 'Male') return base + 5;
    if (sex === 'Female') return base - 161;
    return base - 78; // unspecified — midpoint of the two offsets
  }, [age, sex, heightCm, bmrCheckpointWeightKg, currentWeightKg]);

  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.light;
  const formulaTdee = bmr != null ? bmr * activityMultiplier : null; // Mifflin-St Jeor x PAL -- the starting guess

  // Observed TDEE — calibrates real energy expenditure from actual weigh-ins + actual logged
  // calories over the same window, instead of trusting the Mifflin-St Jeor formula alone. Needs
  // at least 2 weeks between first/last weigh-in and at least 40% of that window logged; returns
  // { available: false, reason } otherwise.
  const observedTdee = useMemo(() => computeObservedTdee({
    weightLogs, recentMeals, toKg: (w) => toKg(w, weightUnit), now,
  }), [weightLogs, recentMeals, weightUnit, now]);

  // The TDEE used everywhere below (calorie goal, burnout, momentum, pace, forecast) -- once
  // there's enough real history, it blends toward the observed value, weighted by how much that
  // observation is actually worth trusting (span length + logging coverage). Before that, or if
  // observedTdee can't be computed yet, it's just the formula guess.
  const tdee = useMemo(() => {
    if (!observedTdee.available || formulaTdee == null) return formulaTdee;
    const c = observedTdee.confidence;
    return c * observedTdee.observedTdee + (1 - c) * formulaTdee;
  }, [observedTdee, formulaTdee]);

  // Required Weekly Rate (kg/week, negative = need to lose)
  const requiredWeeklyRateKg = useMemo(() => {
    if (targetWeightKg == null || startingWeightKg == null || !goalDate || !userJoinDate) return null;
    const startTs = new Date(userJoinDate).getTime();
    const goalTs = new Date(goalDate).getTime();
    if (isNaN(startTs) || isNaN(goalTs) || goalTs <= startTs) return null;
    const weeks = (goalTs - startTs) / (7 * DAY_MS);
    return (targetWeightKg - startingWeightKg) / weeks;
  }, [targetWeightKg, startingWeightKg, goalDate, userJoinDate]);

  // ══════════════════════════════════════════════════════════════════════
  // DAILY CALCULATIONS — recomputed from the log every render
  // ══════════════════════════════════════════════════════════════════════

  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      const ds = d.toDateString();
      const total = (recentMeals || []).filter((m) => m.date === ds).reduce((s, m) => s + (m.calories || 0), 0);
      days.push({ date: d, ds, total });
    }
    return days;
  }, [recentMeals, now]);

  const loggedDays = last7.filter((d) => d.total > 0);
  const missingDays = 7 - loggedDays.length;
  const todayCalories = last7[last7.length - 1]?.total || 0;
  const deficitToday = tdee != null ? tdee - todayCalories : null; // positive = deficit, negative = surplus

  // 7 / 14-day rolling average weigh-in (by log count, not calendar days)
  const avgWeightKg = (n) => {
    const logs = sortedWeights.slice(-n);
    if (!logs.length) return null;
    return logs.reduce((s, w) => s + w.weightKg, 0) / logs.length;
  };
  const avg7Kg = useMemo(() => avgWeightKg(7), [sortedWeights]);
  const avg14Kg = useMemo(() => avgWeightKg(14), [sortedWeights]);

  // Weekly Weight Change (observed trajectory) — this week's 7-log avg vs the 7 before it
  const weeklyWeightChangeKg = useMemo(() => {
    const n = sortedWeights.length;
    if (n < 4) return null;
    const thisWeek = sortedWeights.slice(-7);
    const priorWeek = sortedWeights.slice(Math.max(0, n - 14), Math.max(0, n - 7));
    if (!priorWeek.length) return null;
    const avgThis = thisWeek.reduce((s, w) => s + w.weightKg, 0) / thisWeek.length;
    const avgPrior = priorWeek.reduce((s, w) => s + w.weightKg, 0) / priorWeek.length;
    return avgThis - avgPrior;
  }, [sortedWeights]);

  // Deviation vs Required Pace — positive = behind pace, negative = ahead
  const deviationKg = (weeklyWeightChangeKg != null && requiredWeeklyRateKg != null)
    ? weeklyWeightChangeKg - requiredWeeklyRateKg
    : null;

  // Momentum Score — EWMA-smoothed engine (see src/lib/momentum.js): 40% Calorie + 35% Satiety
  // (= 100 - that day's Burnout risk) + 25% Movement (MET-based active energy vs BMR/TDEE gap).
  // Pace lives on its own "Pace to Goal" card below instead of feeding Momentum directly.
  // Computed client-side from existing logs, no persisted state.
  const momentumTimeline = useMemo(() => computeMomentumTimeline({
    weightLogs, recentMeals, waterLogs, stepLogs, activities,
    dailyCalorieGoal, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal,
    fallbackWeightKg: currentWeightKg,
    toKg: (w) => toKg(w, weightUnit),
    now,
  }), [weightLogs, recentMeals, waterLogs, stepLogs, activities, dailyCalorieGoal, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal, currentWeightKg, weightUnit, now]);

  const today = momentumTimeline[momentumTimeline.length - 1];
  const momentumScore = today.momentum;
  const momentumLabel = today.band.label === 'STRONG' ? 'Strong momentum' : today.band.label === 'DRIFTING' ? 'Drifting' : 'Stalled';
  const momentumColor = today.band.tone === 'strong' ? accent : today.band.tone === 'drifting' ? WARN : DANGER;
  const momentumBg = today.band.tone === 'strong' ? colors.accentLight : today.band.tone === 'drifting' ? WARN_BG : DANGER_BG;

  const gauge = useMemo(() => buildGauge(momentumScore, accent), [momentumScore, accent]);

  // Movement modality — classifies whether this person mostly earns active energy through
  // gym/strength sessions or through daily steps (last 14 days), so the template Movement nudge
  // can recommend the kind of activity they actually do instead of defaulting to "go for a
  // walk". The AI nudge gets the raw gymKcal14d/stepsKcal14d split directly instead of this
  // bucket, so it can describe the pattern in its own words rather than a rigid category.
  const movementModality = useMemo(() => {
    const cutoff = now - 14 * DAY_MS;
    const weightKg = currentWeightKg || 70;
    let gymKcal = 0, stepsKcal = 0;
    activities.forEach((a) => {
      const ts = a.timestamp || new Date(a.date).getTime();
      if (isNaN(ts) || ts < cutoff) return;
      const met = MET[a.type] || MET.other;
      gymKcal += (a.durationMin || 0) * met * 3.5 * weightKg / 200;
    });
    stepLogs.forEach((s) => {
      const ts = s.timestamp || new Date(s.date).getTime();
      if (isNaN(ts) || ts < cutoff) return;
      stepsKcal += (s.steps || 0) * weightKg * 0.0005;
    });
    const total = gymKcal + stepsKcal;
    const classification = total < 50 ? 'unknown' : (gymKcal / total) >= 0.6 ? 'gym' : (gymKcal / total) <= 0.4 ? 'steps' : 'mixed';
    return { classification, gymKcal14d: gymKcal, stepsKcal14d: stepsKcal };
  }, [activities, stepLogs, currentWeightKg, now]);

  // Measured gym+steps kcal per day, last 7 days -- lets Weekly Pace use BMR + real activity
  // instead of the PAL guess on days that actually have movement data logged.
  const activityKcalLast7ByDate = useMemo(() => {
    const map = {};
    const weightKg = currentWeightKg || 70;
    for (let i = 0; i <= 6; i++) map[new Date(now - i * DAY_MS).toDateString()] = 0;
    activities.forEach((a) => {
      const ts = a.timestamp || new Date(a.date).getTime();
      const ds = new Date(ts).toDateString();
      if (!(ds in map)) return;
      const met = MET[a.type] || MET.other;
      map[ds] += (a.durationMin || 0) * met * 3.5 * weightKg / 200;
    });
    stepLogs.forEach((s) => {
      const ts = s.timestamp || new Date(s.date).getTime();
      const ds = new Date(ts).toDateString();
      if (!(ds in map)) return;
      map[ds] += (s.steps || 0) * weightKg * 0.0005;
    });
    return map;
  }, [activities, stepLogs, currentWeightKg, now]);

  // Weekly Pace & Trajectory Engine — purely calorie-driven (are you eating at the deficit you
  // signed up for), distinct from Momentum's scale-weight-driven Pace subscore above.
  const weeklyPace = useMemo(() => computeWeeklyPace({
    tdee, bmr, recentMeals, pacePreference,
    weightEwmaTodayKg: today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg,
    confidence: today.confidence,
    daysSinceWeighIn: today.daysSinceWeighIn,
    activityKcalByDate: activityKcalLast7ByDate,
    now,
  }), [tdee, bmr, recentMeals, pacePreference, today, currentWeightKg, activityKcalLast7ByDate, now]);

  // Trajectory Status — bucketed off Deviation relative to Required Rate
  const trajectory = useMemo(() => {
    if (deviationKg == null || !requiredWeeklyRateKg) return null;
    const ratio = deviationKg / Math.abs(requiredWeeklyRateKg);
    if (ratio <= -0.001) return { label: 'Ahead of Pace', color: accent, bg: colors.accentLight };
    if (ratio <= 0.10) return { label: 'On Track', color: accent, bg: colors.accentLight };
    if (ratio <= 0.30) return { label: 'Drifting', color: WARN, bg: WARN_BG };
    return { label: 'Stalled', color: DANGER, bg: DANGER_BG };
  }, [deviationKg, requiredWeeklyRateKg, accent, colors.accentLight]);

  // ══════════════════════════════════════════════════════════════════════
  // DASHBOARD — forecast layer
  // ══════════════════════════════════════════════════════════════════════

  // Forecast now shares the same energy-deficit engine as the This Week chart (weeklyPace),
  // instead of the scale-observed weeklyWeightChangeKg -- so it stays consistent with that card
  // and keeps working even when weigh-ins are stale, as long as calories are being logged.
  const projected7Kg = weeklyPace.projectDay(7)?.projectedKg ?? null;
  const projected14Kg = weeklyPace.projectDay(14)?.projectedKg ?? null;

  const projectedGoalDate = useMemo(() => {
    const anchorKg = today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg;
    if (anchorKg == null || targetWeightKg == null || !weeklyPace.dailyRateKg) return null;
    const remainingKg = targetWeightKg - anchorKg;
    const dailyRateKg = weeklyPace.dailyRateKg;
    if ((remainingKg < 0 && dailyRateKg >= 0) || (remainingKg > 0 && dailyRateKg <= 0)) return null;
    const daysNeeded = remainingKg / dailyRateKg;
    if (!isFinite(daysNeeded) || daysNeeded <= 0) return null;
    return new Date(now + daysNeeded * DAY_MS);
  }, [today, currentWeightKg, targetWeightKg, weeklyPace, now]);

  const confidence = today.confidence >= 0.85 ? 'High' : today.confidence >= 0.5 ? 'Medium' : 'Low';
  const confidenceColor = confidence === 'High' ? accent : confidence === 'Medium' ? WARN : DANGER;
  const confidenceBg = confidence === 'High' ? colors.accentLight : confidence === 'Medium' ? WARN_BG : DANGER_BG;

  // Pace-to-goal card display (converts everything back to the user's own unit)
  const pace = useMemo(() => {
    if (startingWeightKg == null || targetWeightKg == null || currentWeightKg == null) return null;
    const totalGapKg = Math.abs(startingWeightKg - targetWeightKg);
    if (totalGapKg < 0.05) return null;
    const togoKg = Math.abs(targetWeightKg - currentWeightKg);
    if (togoKg < 0.05) return { done: true };
    if (weeklyWeightChangeKg == null) return { insufficientData: true };

    const lostKg = Math.abs(currentWeightKg - startingWeightKg);
    const pct = Math.min(100, Math.round((lostKg / totalGapKg) * 100));
    let planPct = null;
    if (goalDate && userJoinDate) {
      const startTs = new Date(userJoinDate).getTime();
      const goalTs = new Date(goalDate).getTime();
      if (!isNaN(startTs) && !isNaN(goalTs) && goalTs > startTs) {
        planPct = Math.min(100, Math.round(((now - startTs) / (goalTs - startTs)) * 100));
      }
    }

    let note = null;
    if (trajectory && requiredWeeklyRateKg) {
      const sign = requiredWeeklyRateKg < 0 ? '-' : '+';
      const observedRate = fromKg(Math.abs(weeklyWeightChangeKg), weightUnit);
      const requiredRate = fromKg(Math.abs(requiredWeeklyRateKg), weightUnit);
      if (trajectory.label === 'Stalled' || trajectory.label === 'Drifting') {
        note = `You're averaging ${sign}${observedRate.toFixed(2)} ${weightUnit}/week against a required ${sign}${requiredRate.toFixed(2)} ${weightUnit}/week to hit your goal date.${projectedGoalDate ? ` At this pace you'd land around ${fmtShort(projectedGoalDate)}.` : " At this pace it's not clear you'll reach your goal — worth revisiting your target."}`;
      } else if (trajectory.label === 'Ahead of Pace') {
        note = `You're averaging ${sign}${observedRate.toFixed(2)} ${weightUnit}/week, ahead of the ${sign}${requiredRate.toFixed(2)} ${weightUnit}/week you need.${projectedGoalDate ? ` On track to finish around ${fmtShort(projectedGoalDate)}, ahead of schedule.` : ''}`;
      } else {
        note = `Right on your required pace of ${sign}${requiredRate.toFixed(2)} ${weightUnit}/week.${projectedGoalDate ? ` Keep this up and you'll land around ${fmtShort(projectedGoalDate)}.` : ''}`;
      }
    }

    return {
      eta: projectedGoalDate,
      pct, planPct, note,
      lost: fromKg(lostKg, weightUnit),
      togo: fromKg(togoKg, weightUnit),
      weeklyRate: fromKg(Math.abs(weeklyWeightChangeKg), weightUnit),
    };
  }, [startingWeightKg, targetWeightKg, currentWeightKg, weeklyWeightChangeKg, goalDate, userJoinDate, trajectory, requiredWeeklyRateKg, projectedGoalDate, weightUnit, now]);

  // ══════════════════════════════════════════════════════════════════════
  // Supporting cards (calorie-swing guardrail, burnout heuristic, streaks)
  // ══════════════════════════════════════════════════════════════════════

  const spikeDays = loggedDays.filter((d) => d.total > dailyCalorieGoal * 1.5);
  const crashDays = loggedDays.filter((d) => d.total > 0 && d.total < dailyCalorieGoal * 0.5);

  // Burnout / Crash-Out Risk — deficit depth, calorie volatility, and Nutrition (protein, water,
  // carbs, fiber, fat -- each a pure floor check) computed day-by-day over the current week.
  // See src/lib/burnout.js.
  const burnout = useMemo(() => computeBurnoutTimeline({
    recentMeals, waterLogs, tdee, bmr, weightKg: currentWeightKg, pacePreference,
    dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, now,
  }), [recentMeals, waterLogs, tdee, bmr, currentWeightKg, pacePreference, dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, now]);

  const burnoutScore = burnout.today.score;
  const burnoutBand = burnout.today.band;
  const burnoutColor = burnoutBand.tone === 'good' ? accent : burnoutBand.tone === 'warn' ? WARN : DANGER;
  const burnoutBg = burnoutBand.tone === 'good' ? colors.accentLight : burnoutBand.tone === 'warn' ? WARN_BG : DANGER_BG;
  const burnoutWhy = useMemo(() => {
    const t = burnout.today;
    const drivers = [];
    if (t.deficitPts >= 12) drivers.push('your deficit is running deep relative to your TDEE');
    if (t.proteinPts >= 6) drivers.push("protein is running under your floor, so hunger keeps building");
    if (t.waterPts >= 8) drivers.push("water intake is running under your floor");
    if (t.carbsPts >= 4) drivers.push('carbs are running under your floor');
    if (t.fiberPts >= 4) drivers.push('fiber is running low, which tends to leave meals feeling less filling');
    if (t.fatPts >= 2) drivers.push("fat's under your floor, which tends to hit mood and sleep");
    if (t.volatilityPts >= 8) drivers.push('calories are swinging a lot day to day — binge-restrict pattern, not a steady deficit');
    if (!drivers.length) return 'Deficit, nutrition, and day-to-day consistency are all in a sustainable range this week.';
    return `This week: ${drivers.join('; ')}.`;
  }, [burnout]);

  // Momentum "See why" — replaced the AI/template-generated nudge sentence entirely. That text
  // could describe stale or simply wrong state (e.g. "log a meal" after one was already logged),
  // whether from cache staleness or the underlying facts not being fresh at generation time. This
  // shows the same real numbers directly instead of a generated sentence trying to summarize them
  // -- always accurate, since it's just formatting values already computed live everywhere else on
  // this page, not describing them through an extra generation step that can drift from the truth.
  const momentumWhy = useMemo(() => {
    const t = burnout.today;
    return {
      calorie: { subscore: today.calorieSubscore, loggedToday: today.caloriesLoggedToday, targetToday: dailyCalorieGoal },
      satiety: {
        subscore: today.satietySubscore, burnoutScore: t.score,
        rows: [
          { label: 'Deficit Depth', pts: t.deficitPts, max: 20 },
          { label: 'Calorie Volatility', pts: t.volatilityPts, max: 20 },
          { label: 'Protein', pts: t.proteinPts, max: 15, detail: proteinGoal ? `${t.avgProtein}g avg vs ${proteinGoal}g goal` : `${t.avgProtein}g avg` },
          { label: 'Water', pts: t.waterPts, max: 20, detail: `${(t.avgWaterMl / 1000).toFixed(1)}L avg` },
          { label: 'Carbs', pts: t.carbsPts, max: 10, detail: carbsGoal ? `${t.avgCarbs}g avg vs ${carbsGoal}g goal` : `${t.avgCarbs}g avg` },
          { label: 'Fiber', pts: t.fiberPts, max: 10, detail: `${t.avgFiber}g avg` },
          { label: 'Fat', pts: t.fatPts, max: 5, detail: fatsGoal ? `${t.avgFats}g avg vs ${fatsGoal}g goal` : `${t.avgFats}g avg` },
        ],
      },
      movement: {
        subscore: today.movementSubscore,
        gymKcalToday: today.movementGymKcal, stepsKcalToday: today.movementStepsKcal, targetKcalToday: today.movementTargetKcal,
      },
    };
  }, [today, burnout, proteinGoal, carbsGoal, fatsGoal, dailyCalorieGoal]);

  // Trajectory chart: this is a PREDICTION, not a log -- every day of the week gets a guess
  // (anchored to today's EWMA weight, extrapolated via the rolling energy-deficit rate), so a day
  // without a weigh-in still shows an estimate instead of a gap. Real weigh-ins overlay as solid
  // "actual" points wherever they exist and correct the guess for that day; everything else stays
  // a predicted point. Confidence cone widens the further a day sits from today in either direction.
  const chart = useMemo(() => {
    const W = 320, top = 10, bot = 100, padX = 16;

    // Fixed calendar week (Sun-Sat), not a rolling window — history for days up to today,
    // projection for whatever's left of the week.
    const nowDate = new Date(now);
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const anchorKg = today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg;
    const confidence = today.confidence;
    const dailyRateKg = weeklyPace.dailyRateKg;
    if (anchorKg == null || dailyRateKg == null) return null;

    // Every day gets exactly one predicted point -- real weigh-ins already feed this as
    // parameters (they set today's live EWMA anchor and the observed-TDEE-driven rate), they
    // just aren't plotted as a separate "actual" marker. This is a prediction, not a log.
    const data = [];
    for (let offset = 0; offset <= 6; offset++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + offset);
      const dayDiff = Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
      const projectedKg = anchorKg + dailyRateKg * dayDiff;
      const marginKg = Math.abs(dayDiff) * 0.15 * (2 - confidence);
      const proj = fromKg(projectedKg, weightUnit);
      const margin = fromKg(marginKg, weightUnit);
      data.push({ label: dayLabel(d), proj, upper: proj + margin, lower: proj - margin });
    }

    // "This week" headline stat: predicted total change from Sunday to Saturday (end of week),
    // not a rolling week-over-week comparison.
    const weekStartVal = data[0].proj;
    const weekEndVal = data[data.length - 1].proj;
    const weekChange = weekEndVal - weekStartVal;
    const weekEndDate = new Date(startOfWeek);
    weekEndDate.setDate(startOfWeek.getDate() + 6);

    const vals = [];
    data.forEach((p) => ['proj', 'upper', 'lower'].forEach((k) => vals.push(p[k])));
    const min = Math.min(...vals) - 0.15, max = Math.max(...vals) + 0.15;
    const x = (i) => padX + (i * (W - padX * 2)) / (data.length - 1);
    const y = (v) => bot - ((v - min) / (max - min || 1)) * (bot - top);
    const pts = (k) => data.map((p, i) => [x(i), y(p[k])]);
    const ups = pts('upper'), los = pts('lower').reverse();
    const band = smooth(ups) + ` L ${los[0][0]} ${los[0][1]} ` + smooth(los).replace(/^M [^C]*/, '') + ' Z';
    const dots = data.map((p, i) => ({ cx: x(i), cy: y(p.proj), fill: colors.card, stroke: accent }));
    // Per-day tap targets — value + predicted change from Sunday's reference weight.
    const points = data.map((p, i) => ({
      label: p.label, value: p.proj, changeFromStart: p.proj - weekStartVal, xFrac: i / 6,
    }));
    return { proj: smooth(pts('proj')), band, dots, points, labels: data.map((p) => p.label), weekChange, weekEndDate };
  }, [today, currentWeightKg, weeklyPace, accent, colors.card, now, weightUnit]);

  // Trajectory card badge — reflects input fidelity before it reflects pace, per spec:
  // a stale/absent weigh-in shouldn't get badged as "off pace" when the scale just hasn't been used.
  const trendBadge = useMemo(() => {
    if (!weeklyPace.badge) return null;
    const toneStyle = {
      good: { color: accent, bg: colors.accentLight },
      warn: { color: WARN, bg: WARN_BG },
      danger: { color: DANGER, bg: DANGER_BG },
      neutral: { color: colors.textSecondary, bg: colors.cardAlt },
    }[weeklyPace.badge.tone];
    return { label: weeklyPace.badge.label, ...toneStyle };
  }, [weeklyPace, accent, colors.accentLight, colors.textSecondary, colors.cardAlt]);

  // Plain-language explanation for the trend badge — stays quiet when things are fine
  // (matches the Momentum nudge pattern), but "Too Aggressive" especially needs unpacking:
  // it reads like a pace warning when it's actually about under-eating.
  const trendNote = useMemo(() => {
    const label = trendBadge?.label;
    if (!label || label === 'On Pace') return null;
    if (label === 'Too Aggressive') {
      return weeklyPace.belowBmrFloor
        ? `This isn't about going too fast — your last few logged days are averaging ${Math.round(weeklyPace.threeDayAvgCalories).toLocaleString()} kcal, under the safe floor for what your organs need at rest (~${weeklyPace.bmrSafetyFloor ? Math.round(weeklyPace.bmrSafetyFloor).toLocaleString() : ''} kcal). That's under-eating, not overachieving. Bring your calories back up.`
        : "Your average deficit is running well past your target for this pace — that's more aggressive than intended, not a sign it's working better.";
    }
    if (label === 'Needs Weigh-in') return "It's been over a week since your last weigh-in — log one so this pace reading actually means something.";
    if (label === 'Tracking Only') return "No weigh-in in over two weeks. This is running on your meal logs alone, so treat the projection as a rough guess, not a forecast.";
    if (label === 'Off Pace') return "You're behind the deficit your chosen pace needs — nothing urgent, just a nudge to close the gap.";
    if (label === 'Stalled') return "Your average deficit this week is well under target — worth checking your portions, or whether your TDEE still matches your day-to-day.";
    return null;
  }, [trendBadge, weeklyPace, bmr]);

  const guardrail = useMemo(() => {
    if (loggedDays.length < 3 || !dailyCalorieGoal) return null;
    const maxDay = loggedDays.reduce((a, b) => (b.total > a.total ? b : a), loggedDays[0]);
    const others = loggedDays.filter((d) => d !== maxDay);
    if (!others.length) return null;
    const avgOthers = others.reduce((s, d) => s + d.total, 0) / others.length;
    const swing = maxDay.total - avgOthers;
    if (swing > dailyCalorieGoal * 0.5 && maxDay.total > dailyCalorieGoal * 1.3) {
      return {
        title: 'Big swing this week',
        body: `${fmtShort(maxDay.date)} came in around ${Math.round(maxDay.total).toLocaleString()} kcal — about ${Math.round(swing).toLocaleString()} more than your other days. One day like that won't undo your progress. Get back to ${dailyCalorieGoal.toLocaleString()} kcal and keep moving.`,
      };
    }
    return null;
  }, [loggedDays, dailyCalorieGoal]);

  const weeklyHitRates = useMemo(() => {
    const weeks = [];
    for (let w = 5; w >= 0; w--) {
      const weekEnd = new Date(now - w * 7 * DAY_MS);
      const results = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekEnd.getTime() - d * DAY_MS);
        if (day.getTime() > now) continue;
        const ds = day.toDateString();
        const total = (recentMeals || []).filter((m) => m.date === ds).reduce((s, m) => s + (m.calories || 0), 0);
        if (total > 0) results.push(total <= dailyCalorieGoal * 1.15);
      }
      weeks.push(results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : null);
    }
    return weeks;
  }, [recentMeals, dailyCalorieGoal, now]);

  const worstWeekday = useMemo(() => {
    if (!dailyCalorieGoal) return null;
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    const byDate = {};
    (recentMeals || []).forEach((m) => {
      if (!m.date) return;
      byDate[m.date] = (byDate[m.date] || 0) + (m.calories || 0);
    });
    Object.entries(byDate).forEach(([ds, total]) => {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return;
      const wd = d.getDay();
      byWeekday[wd].sum += total - dailyCalorieGoal;
      byWeekday[wd].count += 1;
    });
    let best = null;
    byWeekday.forEach((b, wd) => {
      if (b.count < 2) return;
      const avgOverage = b.sum / b.count;
      if (avgOverage > dailyCalorieGoal * 0.15 && (!best || avgOverage > best.avgOverage)) {
        best = { wd, avgOverage, count: b.count };
      }
    });
    if (!best) return null;
    const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    return { name: names[best.wd], avgOverage: Math.round(best.avgOverage) };
  }, [recentMeals, dailyCalorieGoal]);

  const recs = useMemo(() => {
    const items = [];
    if (spikeDays.length > 0 || crashDays.length > 0) {
      items.push({ title: `Aim for ${dailyCalorieGoal.toLocaleString()} kcal for the next 3 days`, sub: 'Steady days get your average back where it needs to be.' });
    }
    if (missingDays >= 2) {
      items.push({ title: 'Log every meal, even small ones', sub: `${missingDays} of the last 7 days had nothing logged.` });
    }
    if (!items.length) {
      items.push({ title: `Stay at ${dailyCalorieGoal ? dailyCalorieGoal.toLocaleString() + ' kcal' : 'your current target'}`, sub: "It's working — no need to change what's working." });
    }
    return items;
  }, [spikeDays, crashDays, missingDays, dailyCalorieGoal]);

  return (
    <View style={styles.wrapper}>
      {view === 'main' && (
        <>
          <View style={styles.headerCompact}>
            <Text style={styles.headerTitle}>Insights</Text>
          </View>

          {Platform.OS === 'web' && <View style={{ height: 12 }} />}

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Momentum gauge */}
            <View style={[styles.card, { alignItems: 'center', paddingTop: 18 }]}>
              <Text style={styles.cardHeadline}>
                {momentumScore >= 80 ? `Looking good this week, ${userName || 'there'}.` : `Bit of a rocky week, ${userName || 'there'}. Nothing you can't fix.`}
              </Text>
              <View style={{ width: 220, height: 132, marginTop: 4 }}>
                <Svg width={220} height={132} viewBox="0 0 220 132">
                  {gauge.segments.map((s, i) => (
                    <Path key={i} d={s.d} fill="none" stroke={s.stroke} strokeWidth={12} strokeLinecap="round" />
                  ))}
                  <Line {...gauge.needle} stroke={colors.text} strokeWidth={3} strokeLinecap="round" />
                </Svg>
                <View style={styles.gaugeCenter}>
                  <Text style={styles.gaugeKicker}>MOMENTUM</Text>
                  <Text style={styles.gaugeScore}>{momentumScore}</Text>
                </View>
              </View>
              <View style={[styles.pill, { backgroundColor: momentumBg }]}>
                <Text style={[styles.pillText, { color: momentumColor }]}>{momentumLabel}</Text>
              </View>
              <Text style={styles.mutedSmall}>
                Calorie {today.calorieSubscore}%
                {'  ·  '}Satiety {today.satietySubscore}%
                {'  ·  '}Movement {today.movementSubscore != null ? `${today.movementSubscore}%` : '--'}
              </Text>
              {today.band.tone !== 'strong' && (
                <TouchableOpacity style={[styles.detailsBtn, { width: '100%' }]} onPress={() => setView('momentum')}>
                  <Text style={styles.detailsBtnText}>See why</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              {today.staleWeighIn && (
                <Text style={styles.mutedSmall}>No weigh-in in over a week — pace confidence is lower until you log one.</Text>
              )}
              {weeklyHitRates.some((w) => w != null) && (
                <>
                  <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
                    {weeklyHitRates.map((p, i) => (
                      <View key={i} style={{ width: 26, height: 5, borderRadius: 3, backgroundColor: p == null ? colors.border : p >= 80 ? accent : p >= 60 ? WARN : DANGER }} />
                    ))}
                  </View>
                  <Text style={styles.mutedSmall}>6-week consistency</Text>
                </>
              )}
            </View>

            {/* This week trend */}
            {chart && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.kicker}>PREDICTION THIS WEEK</Text>
                    <Text style={styles.bigStat}>
                      {chart.weekChange != null
                        ? `${Math.abs(chart.weekChange).toFixed(1)} ${weightUnit} ${chart.weekChange > 0 ? 'gain' : chart.weekChange < 0 ? 'loss' : 'change'}`
                        : '--'}
                      <Text style={styles.bigStatSub}> by {fmtShort(chart.weekEndDate)}</Text>
                    </Text>
                  </View>
                  {trendBadge && (
                    <View style={[styles.pill, { backgroundColor: trendBadge.bg }]}>
                      <Text style={[styles.pillText, { color: trendBadge.color }]}>{trendBadge.label}</Text>
                    </View>
                  )}
                </View>
                <View style={{ position: 'relative', marginTop: 8 }}>
                  <Svg width="100%" height={104} viewBox="0 0 320 104" preserveAspectRatio="none">
                    {!!chart.band && <Path d={chart.band} fill={accent} fillOpacity={0.1} />}
                    <Path d={chart.proj} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="4 4" />
                    {chart.dots.map((p, i) => <Circle key={i} cx={p.cx} cy={p.cy} r={3.2} fill={p.fill} stroke={p.stroke} strokeWidth={1.6} />)}
                  </Svg>
                  <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <View style={{ flex: 1, flexDirection: 'row' }} pointerEvents="box-none">
                      {chart.points.map((pt, i) => (
                        <TouchableOpacity
                          key={i}
                          disabled={pt.value == null}
                          style={{ flex: 1 }}
                          onPress={() => setChartTooltip((t) => (t?.i === i ? null : { i, ...pt }))}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.chartInfoRow}>
                  <Text style={styles.chartInfoText}>
                    {chartTooltip
                      ? `${chartTooltip.label}: ${chartTooltip.value.toFixed(1)} ${weightUnit}${chartTooltip.changeFromStart != null ? `  ·  ${Math.abs(chartTooltip.changeFromStart).toFixed(1)} ${weightUnit} ${chartTooltip.changeFromStart > 0 ? 'gain' : chartTooltip.changeFromStart < 0 ? 'loss' : 'change'} vs Sun` : ''}`
                      : 'Tap a point for that day’s number'}
                  </Text>
                </View>
                <View style={styles.axisRow}>
                  {chart.labels.map((l, i) => <Text key={i} style={styles.axisLabel}>{l}</Text>)}
                </View>
                {trendNote && (
                  <View style={[styles.nudgeBox, (trendBadge?.label === 'Too Aggressive' || trendBadge?.label === 'Stalled') && styles.nudgeBoxUrgent]}>
                    <Text style={[styles.nudgeText, (trendBadge?.label === 'Too Aggressive' || trendBadge?.label === 'Stalled') && styles.nudgeTextUrgent]}>
                      {trendNote}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.detailsBtn} onPress={() => setView('details')}>
                  <Text style={styles.detailsBtnText}>See details</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {!chart && (
              <View style={styles.card}>
                <Text style={styles.mutedBody}>Log a couple of weigh-ins to see your trend here.</Text>
              </View>
            )}

            {/* Energy balance */}
            <View style={styles.card}>
              <Text style={styles.kicker}>ENERGY BALANCE</Text>
              {tdee != null ? (
                <>
                  <View style={styles.statsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statLabel}>TDEE</Text>
                      <Text style={styles.statValue}>{Math.round(tdee).toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statLabel}>TODAY</Text>
                      <Text style={styles.statValue}>{Math.round(todayCalories).toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statLabel}>{deficitToday >= 0 ? 'DEFICIT' : 'SURPLUS'}</Text>
                      <Text style={[styles.statValue, { color: deficitToday >= 0 ? accent : DANGER }]}>{Math.round(Math.abs(deficitToday)).toLocaleString()}</Text>
                    </View>
                  </View>
                  {weeklyPace.dailyRateKg != null && (
                    <Text style={[styles.mutedBody, { marginTop: 10 }]}>
                      At this week's average intake, your calories alone predict about {weeklyPace.dailyRateKg <= 0 ? '-' : '+'}{Math.abs(fromKg(weeklyPace.dailyRateKg * 7, weightUnit)).toFixed(2)} {weightUnit}/week.
                    </Text>
                  )}
                  {observedTdee.available && (
                    <Text style={[styles.mutedBody, { marginTop: 6 }]}>
                      The TDEE above already leans on your own history: since your last weigh-in before this one ({observedTdee.lastGap.spanDays} day{observedTdee.lastGap.spanDays === 1 ? '' : 's'} ago), you averaged {observedTdee.lastGap.avgDailyCalories.toLocaleString()} kcal/day and your weight changed {observedTdee.lastGap.weightChangeKg > 0 ? '+' : ''}{observedTdee.lastGap.weightChangeKg} kg — working backward from that, your real TDEE looks closer to {observedTdee.observedTdee.toLocaleString()} kcal, against {Math.round(formulaTdee).toLocaleString()} from the formula alone{observedTdee.confidence < 0.6 ? '. Still a rough estimate — more consistent logging will sharpen it' : ''}.
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.mutedBody}>Add your age, sex, height, and activity level in Settings to see your energy balance (what you burn vs. what you eat) here.</Text>
              )}
            </View>

            {/* Forecast */}
            {(projected7Kg != null || projectedGoalDate) && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.kicker}>FORECAST</Text>
                  <View style={[styles.pill, { backgroundColor: confidenceBg }]}>
                    <Text style={[styles.pillText, { color: confidenceColor }]}>{confidence} confidence</Text>
                  </View>
                </View>
                <View style={[styles.statsRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>IN 7 DAYS</Text>
                    <Text style={styles.statValue}>{projected7Kg != null ? `${fromKg(projected7Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>IN 14 DAYS</Text>
                    <Text style={styles.statValue}>{projected14Kg != null ? `${fromKg(projected14Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>GOAL DATE</Text>
                    <Text style={styles.statValue}>{projectedGoalDate ? fmtShort(projectedGoalDate) : '--'}</Text>
                  </View>
                </View>
                <Text style={[styles.mutedSmall, { marginTop: 10 }]}>Confidence is based on your logging streak and how recent your last weigh-in is — {Math.round(today.confidence * 100)}% right now.</Text>
              </View>
            )}

            {/* Guardrail */}
            {guardrail && !guardrailDismissed && (
              <View style={[styles.card, { backgroundColor: WARN_BG, borderColor: '#FCE3CB' }]}>
                <View style={styles.rowStart}>
                  <View style={styles.warnDot}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>!</Text></View>
                  <Text style={[styles.cardTitleSmall, { color: '#C25A11' }]}>{guardrail.title}</Text>
                </View>
                <Text style={[styles.mutedBody, { color: '#8A7663', marginTop: 8 }]}>{guardrail.body}</Text>
                <TouchableOpacity style={styles.dismissBtn} onPress={() => setGuardrailDismissed(true)}>
                  <Text style={{ color: '#C25A11', fontSize: 12.5, fontWeight: '700' }}>Got it</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Burnout likelihood */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.kicker}>BURNOUT LIKELIHOOD</Text>
                  <Text style={styles.bigStat}>{burnoutScore}<Text style={styles.bigStatSub}>/100</Text></Text>
                </View>
                <View style={[styles.pill, { backgroundColor: burnoutBg }]}>
                  <Text style={[styles.pillText, { color: burnoutColor }]}>{burnoutBand.label}</Text>
                </View>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{burnoutWhy}</Text>
              <View style={styles.burnoutWeekRow}>
                {burnout.week.map((d, i) => {
                  const dayColor = d.score <= 25 ? accent : d.score <= 55 ? WARN : d.score <= 80 ? '#EA580C' : DANGER;
                  const h = Math.max(10, Math.round((d.score / 100) * 56));
                  return (
                    <View key={i} style={styles.burnoutDayCol}>
                      <Text style={[styles.burnoutDayScore, { color: dayColor }]}>{d.score}</Text>
                      <View style={[styles.burnoutBar, { height: h, backgroundColor: dayColor, opacity: d.isFuture ? 0.55 : 1 }]} />
                      <Text style={styles.axisLabel}>{dayLabel(d.date)}</Text>
                    </View>
                  );
                })}
              </View>
              {burnoutScore > 25 && (
                <View style={styles.nextWeekRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextWeekTitle}>Estimated crash risk window</Text>
                    <Text style={styles.nextWeekNote}>
                      At this rate, off-plan eating or a crash-out becomes likely around {fmtShort(burnout.crashDate)} — {burnout.daysToCrash} day{burnout.daysToCrash === 1 ? '' : 's'} out — if nothing changes.
                    </Text>
                  </View>
                  <View style={[styles.nextWeekBadge, { backgroundColor: burnoutBg }]}>
                    <Text style={[styles.nextWeekBadgeText, { color: burnoutColor }]}>{burnout.daysToCrash}d</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Pace to goal */}
            {pace && !pace.done && !pace.insufficientData && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.kicker}>PACE TO GOAL</Text>
                    <Text style={styles.bigStat}>{pace.eta ? fmtShort(pace.eta) : '--'}<Text style={styles.bigStatSub}> at this pace</Text></Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pace.pct}%`, backgroundColor: accent }]} />
                  {pace.planPct != null && (
                    <View style={[styles.planMarker, { left: `${pace.planPct}%`, backgroundColor: colors.text }]} />
                  )}
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedSmall}>{startingWeight} {weightUnit} start</Text>
                  <Text style={styles.strongSmall}>{currentWeight?.toFixed(1)} {weightUnit} now</Text>
                  <Text style={styles.mutedSmall}>{targetWeight} {weightUnit} goal</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{goalIsLoss ? 'LOST' : 'GAINED'}</Text>
                    <Text style={styles.statValue}>{goalIsLoss ? '-' : '+'}{pace.lost.toFixed(1)} {weightUnit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>TO GO</Text>
                    <Text style={styles.statValue}>{pace.togo.toFixed(1)} {weightUnit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>PER WEEK</Text>
                    <Text style={styles.statValue}>{goalIsLoss ? '-' : '+'}{pace.weeklyRate.toFixed(2)}</Text>
                  </View>
                </View>
                {pace.note && <Text style={[styles.mutedBody, { marginTop: 12 }]}>{pace.note}</Text>}
              </View>
            )}
            {pace?.insufficientData && (
              <View style={styles.card}>
                <Text style={styles.mutedBody}>Log a few more weigh-ins over the next week or two and your pace-to-goal will show up here.</Text>
              </View>
            )}
            {pace?.done && (
              <View style={styles.card}>
                <Text style={styles.mutedBody}>You've reached your goal weight — nice work. Update your target in Settings if you want to keep going.</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {view === 'details' && (
        <View style={styles.wrapper}>
          <View style={styles.headerCompact}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setView('main')}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Details</Text>
          </View>
          <ScrollView style={styles.scrollContainer} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.mutedBody}>
              {momentumScore >= 80
                ? `Your numbers look clean this week, ${userName || 'there'}. If nothing changes, you're on pace for your goal.`
                : `Bit of a rougher week than usual${userName ? `, ${userName}` : ''} — here's what to focus on.`}
            </Text>
            <Text style={[styles.kicker, { marginTop: 20, marginBottom: 10 }]}>
              {spikeDays.length || crashDays.length ? 'TO GET BACK ON TRACK' : 'KEEP DOING'}
            </Text>
            <View style={{ gap: 8 }}>
              {recs.map((r) => (
                <View key={r.title} style={styles.recRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>{r.title}</Text>
                    <Text style={styles.recSub}>{r.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            {worstWeekday && (
              <>
                <Text style={[styles.kicker, { marginTop: 20, marginBottom: 10 }]}>WATCH OUT FOR</Text>
                <View style={[styles.card, { margin: 0, backgroundColor: WARN_BG, borderColor: '#FCE3CB' }]}>
                  <Text style={[styles.cardTitleSmall, { color: colors.text }]}>{worstWeekday.name}</Text>
                  <Text style={[styles.mutedBody, { color: '#8A7663', marginTop: 6 }]}>
                    On average you've come in about {worstWeekday.avgOverage.toLocaleString()} kcal over your goal on {worstWeekday.name.toLowerCase()}. Worth pre-planning that day's meals.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {view === 'momentum' && (
        <View style={styles.wrapper}>
          <View style={styles.headerCompact}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setView('main')}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Why {momentumScore}?</Text>
          </View>
          <ScrollView style={styles.scrollContainer} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>CALORIE — 40%</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.calorie.subscore}%</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>
                {momentumWhy.calorie.loggedToday
                  ? `${momentumWhy.calorie.loggedToday.toLocaleString()} kcal logged today, against a ${momentumWhy.calorie.targetToday.toLocaleString()} kcal target.`
                  : `Nothing logged yet today, against a ${momentumWhy.calorie.targetToday.toLocaleString()} kcal target.`}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>SATIETY — 35%</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.satiety.subscore}%</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 4, marginBottom: 8 }]}>
                Burnout Risk {momentumWhy.satiety.burnoutScore}/100 — lower is better. Each row below is a point of risk, out of its own max.
              </Text>
              {momentumWhy.satiety.rows.map((r) => (
                <View key={r.label} style={styles.whyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whyRowLabel}>{r.label}</Text>
                    {r.detail && <Text style={styles.whyRowDetail}>{r.detail}</Text>}
                  </View>
                  <Text style={[styles.whyRowPts, r.pts > 0 && { color: r.pts >= r.max * 0.5 ? DANGER : WARN }]}>
                    {r.pts}/{r.max}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>MOVEMENT — 25%</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.movement.subscore != null ? `${momentumWhy.movement.subscore}%` : '--'}</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>
                {momentumWhy.movement.targetKcalToday != null
                  ? `${Math.round(momentumWhy.movement.gymKcalToday || 0)} kcal gym + ${Math.round(momentumWhy.movement.stepsKcalToday || 0)} kcal steps today, against a ${Math.round(momentumWhy.movement.targetKcalToday).toLocaleString()} kcal active-energy target.`
                  : 'Not enough profile data (age, sex, height, activity level) to compute an active-energy target yet.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.bg },
  headerCompact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { flex: 1 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 12 },
  cardHeadline: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  cardTitleSmall: { fontSize: 13.5, fontWeight: '700' },
  gaugeCenter: { position: 'absolute', left: 0, right: 0, top: 44, alignItems: 'center', gap: 2 },
  gaugeKicker: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4 },
  gaugeScore: { color: colors.text, fontSize: 40, fontWeight: '800' },
  pill: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14, marginTop: -2 },
  pillText: { fontSize: 12, fontWeight: '700' },
  mutedSmall: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 },
  nudgeBox: { backgroundColor: WARN_BG, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10 },
  nudgeBoxUrgent: { backgroundColor: DANGER_BG },
  nudgeText: { color: '#A8811F', fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  nudgeTextUrgent: { color: '#B91C1C' },
  strongSmall: { color: colors.text, fontSize: 10.5, fontWeight: '700' },
  mutedBody: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  bigStat: { color: colors.text, fontSize: 19, fontWeight: '800' },
  bigStatSub: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chartInfoRow: { minHeight: 16, marginTop: 6, alignItems: 'center' },
  chartInfoText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  axisLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  detailsBtn: { marginTop: 10, backgroundColor: colors.cardAlt, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsBtnText: { color: colors.accentText, fontSize: 12.5, fontWeight: '700' },
  warnDot: { width: 22, height: 22, borderRadius: 7, backgroundColor: WARN, alignItems: 'center', justifyContent: 'center' },
  dismissBtn: { marginTop: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: '#FCE3CB', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  burnoutWeekRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginTop: 16 },
  burnoutDayCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  burnoutDayScore: { fontSize: 12, fontWeight: '800' },
  burnoutBar: { width: '100%', borderRadius: 8 },
  progressTrack: { height: 10, backgroundColor: colors.cardAlt, borderRadius: 5, marginTop: 16, marginBottom: 8, overflow: 'visible' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  planMarker: { position: 'absolute', top: -5, width: 2, height: 20, borderRadius: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  nextWeekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  nextWeekTitle: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  nextWeekNote: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  nextWeekBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nextWeekBadgeText: { fontSize: 14.5, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  recRow: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center' },
  recTitle: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  recSub: { color: colors.textSecondary, fontSize: 12, fontWeight: '500', marginTop: 2 },
  whyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
  whyRowLabel: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  whyRowDetail: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  whyRowPts: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
});

export default InsightsTab;
