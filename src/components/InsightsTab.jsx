import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useTheme } from '../lib/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN = '#F59E0B';
const DANGER = '#EF4444';
const WARN_BG = '#FFF7ED';
const DANGER_BG = '#FEF2F2';
const KCAL_PER_KG = 7700;
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

const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  userName = '',
  weightLogs = [],
  recentMeals = [],
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
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [view, setView] = useState('main');
  const [guardrailDismissed, setGuardrailDismissed] = useState(false);
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

  // BMR — Mifflin-St Jeor
  const bmr = useMemo(() => {
    if (!age || !sex || !heightCm || currentWeightKg == null) return null;
    const base = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
    if (sex === 'Male') return base + 5;
    if (sex === 'Female') return base - 161;
    return base - 78; // unspecified — midpoint of the two offsets
  }, [age, sex, heightCm, currentWeightKg]);

  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.light;
  const tdee = bmr != null ? bmr * activityMultiplier : null;

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

  // Est. Weekly Rate from Deficit — average daily deficit over logged days this week, annualized to a week
  const avgDailyDeficit = useMemo(() => {
    if (tdee == null) return null;
    const logged = last7.filter((d) => d.total > 0);
    if (!logged.length) return null;
    return logged.reduce((s, d) => s + (tdee - d.total), 0) / logged.length;
  }, [last7, tdee]);
  const estWeeklyRateFromDeficitKg = avgDailyDeficit != null ? -(avgDailyDeficit * 7) / KCAL_PER_KG : null;

  // Deviation vs Required Pace — positive = behind pace, negative = ahead
  const deviationKg = (weeklyWeightChangeKg != null && requiredWeeklyRateKg != null)
    ? weeklyWeightChangeKg - requiredWeeklyRateKg
    : null;

  // Calorie Adherence % — symmetric closeness to daily target, averaged over logged days this week
  const calorieAdherence = useMemo(() => {
    if (!dailyCalorieGoal) return null;
    const logged = last7.filter((d) => d.total > 0);
    if (!logged.length) return null;
    const ratios = logged.map((d) => Math.min(d.total, dailyCalorieGoal) / Math.max(d.total, dailyCalorieGoal));
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }, [last7, dailyCalorieGoal]);

  const loggingConsistency = loggedDays.length / 7;

  const paceComponent = (deviationKg != null && requiredWeeklyRateKg)
    ? Math.max(0, Math.min(1, 1 - Math.abs(deviationKg) / Math.abs(requiredWeeklyRateKg)))
    : null;

  // Move Adherence — blends step adherence (steps vs stepGoal) and activity consistency
  // (logged workout days vs a 3/week target). Either signal alone is enough to produce a score;
  // averaged when both exist. This replaces "Step Adherence" in the spec so a steps-only day
  // and a gym-only day both count toward movement, not just one or the other.
  const stepAdherence = useMemo(() => {
    const logged = last7
      .map((d) => (stepLogs || []).find((s) => s.date === d.ds))
      .filter(Boolean)
      .map((s) => s.steps);
    if (!logged.length || !stepGoal) return null;
    const ratios = logged.map((v) => Math.min(v, stepGoal) / Math.max(v, stepGoal));
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }, [last7, stepLogs, stepGoal]);

  const WORKOUT_TARGET_PER_WEEK = 3;
  const activityAdherence = useMemo(() => {
    if (!activities || !activities.length) return null;
    const activeDays = last7.filter((d) => activities.some((a) => a.date === d.ds)).length;
    return Math.min(1, activeDays / WORKOUT_TARGET_PER_WEEK);
  }, [last7, activities]);

  const moveAdherence = useMemo(() => {
    const parts = [stepAdherence, activityAdherence].filter((v) => v != null);
    if (!parts.length) return null;
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  }, [stepAdherence, activityAdherence]);

  // Momentum Score — 35% Calorie Adherence + 35% Pace + 15% Move Adherence + 15% Logging Consistency.
  // Any missing component (e.g. no goal_date yet, so no Pace) redistributes its weight
  // proportionally across whatever's available — Logging Consistency is always present as a floor.
  const momentumScore = useMemo(() => {
    const parts = [];
    if (calorieAdherence != null) parts.push({ w: 35, v: calorieAdherence * 100 });
    if (paceComponent != null) parts.push({ w: 35, v: paceComponent * 100 });
    if (moveAdherence != null) parts.push({ w: 15, v: moveAdherence * 100 });
    parts.push({ w: 15, v: loggingConsistency * 100 });
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    const score = parts.reduce((s, p) => s + p.v * (p.w / totalW), 0);
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [calorieAdherence, paceComponent, moveAdherence, loggingConsistency]);

  const gauge = useMemo(() => buildGauge(momentumScore, accent), [momentumScore, accent]);
  const momentumLabel = momentumScore >= 85 ? 'Optimal' : momentumScore >= 70 ? 'Strong' : momentumScore >= 40 ? 'Getting there' : 'Needs work';
  const momentumColor = momentumScore >= 70 ? accent : momentumScore >= 40 ? WARN : DANGER;
  const momentumBg = momentumScore >= 70 ? colors.accentLight : momentumScore >= 40 ? WARN_BG : DANGER_BG;

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

  const projected7Kg = currentWeightKg != null && weeklyWeightChangeKg != null ? currentWeightKg + weeklyWeightChangeKg * 1 : null;
  const projected14Kg = currentWeightKg != null && weeklyWeightChangeKg != null ? currentWeightKg + weeklyWeightChangeKg * 2 : null;

  const projectedGoalDate = useMemo(() => {
    if (currentWeightKg == null || targetWeightKg == null || !weeklyWeightChangeKg) return null;
    const remainingKg = targetWeightKg - currentWeightKg;
    if ((remainingKg < 0 && weeklyWeightChangeKg >= 0) || (remainingKg > 0 && weeklyWeightChangeKg <= 0)) return null;
    const weeksNeeded = remainingKg / weeklyWeightChangeKg;
    if (!isFinite(weeksNeeded) || weeksNeeded <= 0) return null;
    return new Date(now + weeksNeeded * 7 * DAY_MS);
  }, [currentWeightKg, targetWeightKg, weeklyWeightChangeKg, now]);

  const confidence = loggingConsistency >= 0.85 ? 'High' : loggingConsistency >= 0.5 ? 'Medium' : 'Low';
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

  const burnoutScore = Math.max(0, Math.min(100, spikeDays.length * 18 + crashDays.length * 12 + missingDays * 8));
  const burnoutLabel = burnoutScore >= 70 ? 'High risk' : burnoutScore >= 45 ? 'Watch it' : 'Sustainable';
  const burnoutColor = burnoutScore >= 70 ? DANGER : burnoutScore >= 45 ? WARN : accent;
  const burnoutBg = burnoutScore >= 70 ? DANGER_BG : burnoutScore >= 45 ? WARN_BG : colors.accentLight;
  const burnoutWhy = spikeDays.length > 0
    ? `${spikeDays.length} day${spikeDays.length > 1 ? 's' : ''} this week went over ${Math.round(dailyCalorieGoal * 1.5).toLocaleString()} kcal — big swings like that tend to catch up with you.`
    : crashDays.length > 0
      ? `${crashDays.length} day${crashDays.length > 1 ? 's' : ''} came in under ${Math.round(dailyCalorieGoal * 0.5).toLocaleString()} kcal — very low days often lead to a rebound.`
      : missingDays >= 3
        ? `${missingDays} of the last 7 days weren't logged — hard to tell what's really going on without the data.`
        : dailyCalorieGoal
          ? `Your calories have stayed close to ${dailyCalorieGoal.toLocaleString()} kcal all week — steady like this is sustainable.`
          : 'Set a daily calorie goal to track consistency here.';

  const nextBurnout = useMemo(() => {
    if (!dailyCalorieGoal) return null;
    const recent = last7.slice(-3);
    const recentLogged = recent.filter((d) => d.total > 0);
    const recentScore = Math.max(0, Math.min(100,
      recentLogged.filter((d) => d.total > dailyCalorieGoal * 1.5).length * 18
      + recentLogged.filter((d) => d.total > 0 && d.total < dailyCalorieGoal * 0.5).length * 12
      + (3 - recentLogged.length) * 8
    ));
    const nextScore = Math.round(burnoutScore * 0.4 + recentScore * 0.6);
    const label = nextScore >= 70 ? 'High risk' : nextScore >= 45 ? 'Watch it' : 'Sustainable';
    const color = nextScore >= 70 ? DANGER : nextScore >= 45 ? WARN : accent;
    const bg = nextScore >= 70 ? DANGER_BG : nextScore >= 45 ? WARN_BG : colors.accentLight;
    const note = nextScore > burnoutScore + 10
      ? 'Trending up — the last few days have been rougher than your week average. Keep it steady or this likely continues.'
      : nextScore < burnoutScore - 10
        ? 'Trending down — recent days have been more consistent than earlier this week.'
        : 'Holding steady — no clear shift from this week\'s pattern.';
    return { score: nextScore, label, color, bg, note };
  }, [last7, burnoutScore, dailyCalorieGoal, accent, colors.accentLight]);

  const chart = useMemo(() => {
    const W = 320, top = 10, bot = 100, padX = 16;
    const historySlots = last7.map((d) => {
      const log = sortedWeights.find((w) => new Date(w.ts).toDateString() === d.ds);
      return { label: dayLabel(d.date), actual: log ? log.weight : null };
    });
    const futureSlots = [];
    if (currentWeight != null && weeklyWeightChangeKg != null) {
      const dailyRateDisplay = fromKg(weeklyWeightChangeKg, weightUnit) / 7;
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now + i * DAY_MS);
        const projected = currentWeight + dailyRateDisplay * i;
        const margin = 0.08 * i;
        futureSlots.push({ label: dayLabel(d), proj: projected, upper: projected + margin, lower: projected - margin });
      }
    }
    const data = [...historySlots, ...futureSlots];
    const vals = [];
    data.forEach((p) => ['actual', 'proj', 'upper', 'lower'].forEach((k) => p[k] != null && vals.push(p[k])));
    if (vals.length < 2) return null;
    const min = Math.min(...vals) - 0.15, max = Math.max(...vals) + 0.15;
    const x = (i) => padX + (i * (W - padX * 2)) / (data.length - 1);
    const y = (v) => bot - ((v - min) / (max - min || 1)) * (bot - top);
    const pts = (k) => data.map((p, i) => (p[k] != null ? [x(i), y(p[k])] : null)).filter(Boolean);
    const ups = pts('upper'), los = pts('lower').reverse();
    const band = ups.length > 1 ? smooth(ups) + ` L ${los[0][0]} ${los[0][1]} ` + smooth(los).replace(/^M [^C]*/, '') + ' Z' : '';
    const dots = [];
    data.forEach((p, i) => {
      if (p.actual != null) dots.push({ cx: x(i), cy: y(p.actual), fill: accent, stroke: accent });
      else if (p.proj != null) dots.push({ cx: x(i), cy: y(p.proj), fill: colors.card, stroke: accent });
    });
    return { actual: smooth(pts('actual')), proj: smooth(pts('proj')), band, dots, labels: data.map((p) => p.label) };
  }, [last7, sortedWeights, currentWeight, weeklyWeightChangeKg, accent, colors.card, now, weightUnit]);

  const weekWeightChange = weeklyWeightChangeKg != null ? fromKg(weeklyWeightChangeKg, weightUnit) : null;

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
                {momentumScore >= 70 ? `Looking good this week, ${userName || 'there'}.` : `Bit of a rocky week, ${userName || 'there'}. Nothing you can't fix.`}
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
                Calories {calorieAdherence != null ? Math.round(calorieAdherence * 100) : '--'}%
                {'  ·  '}Pace {paceComponent != null ? Math.round(paceComponent * 100) : '--'}%
                {'  ·  '}Move {moveAdherence != null ? Math.round(moveAdherence * 100) : '--'}%
                {'  ·  '}Logging {Math.round(loggingConsistency * 100)}%
              </Text>
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
                  {estWeeklyRateFromDeficitKg != null && (
                    <Text style={[styles.mutedBody, { marginTop: 10 }]}>
                      At this week's average intake, your calories alone predict about {estWeeklyRateFromDeficitKg <= 0 ? '-' : '+'}{Math.abs(fromKg(estWeeklyRateFromDeficitKg, weightUnit)).toFixed(2)} {weightUnit}/week.
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.mutedBody}>Add your age, sex, height, and activity level in Settings to see your energy balance (BMR/TDEE) here.</Text>
              )}
            </View>

            {/* This week trend */}
            {chart && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.kicker}>WEIGHT TREND</Text>
                    <Text style={styles.bigStat}>
                      {weekWeightChange != null ? `${weekWeightChange > 0 ? '+' : ''}${weekWeightChange.toFixed(1)} ${weightUnit}` : '--'}
                      <Text style={styles.bigStatSub}> vs prior week</Text>
                    </Text>
                  </View>
                  {trajectory && (
                    <View style={[styles.pill, { backgroundColor: trajectory.bg }]}>
                      <Text style={[styles.pillText, { color: trajectory.color }]}>{trajectory.label}</Text>
                    </View>
                  )}
                </View>
                <Svg width="100%" height={104} viewBox="0 0 320 104" preserveAspectRatio="none" style={{ marginTop: 8 }}>
                  {!!chart.band && <Path d={chart.band} fill={accent} fillOpacity={0.1} />}
                  <Path d={chart.proj} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="4 4" />
                  <Path d={chart.actual} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
                  {chart.dots.map((p, i) => <Circle key={i} cx={p.cx} cy={p.cy} r={3.2} fill={p.fill} stroke={p.stroke} strokeWidth={1.6} />)}
                </Svg>
                <View style={styles.axisRow}>
                  {chart.labels.map((l, i) => <Text key={i} style={styles.axisLabel}>{l}</Text>)}
                </View>
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
                <Text style={[styles.mutedSmall, { marginTop: 10 }]}>Confidence is based on how consistently you've logged this week — {Math.round(loggingConsistency * 100)}% of days.</Text>
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
                  <Text style={[styles.pillText, { color: burnoutColor }]}>{burnoutLabel}</Text>
                </View>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{burnoutWhy}</Text>
              <View style={styles.barsRow}>
                {last7.map((d, i) => {
                  const h = dailyCalorieGoal ? Math.max(6, Math.min(60, Math.round((d.total / (dailyCalorieGoal * 2)) * 60))) : 6;
                  const over = d.total > dailyCalorieGoal * 1.5;
                  return (
                    <View key={i} style={styles.barCol}>
                      <View style={[styles.bar, { height: h, backgroundColor: d.total === 0 ? colors.border : over ? DANGER : colors.accentLight }]} />
                    </View>
                  );
                })}
              </View>
              <View style={styles.axisRow}>
                {last7.map((d, i) => <Text key={i} style={styles.axisLabel}>{dayLabel(d.date)}</Text>)}
              </View>
              {nextBurnout && (
                <View style={styles.nextWeekRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextWeekTitle}>Next week: {nextBurnout.label}</Text>
                    <Text style={styles.nextWeekNote}>{nextBurnout.note}</Text>
                  </View>
                  <View style={[styles.nextWeekBadge, { backgroundColor: nextBurnout.bg }]}>
                    <Text style={[styles.nextWeekBadgeText, { color: nextBurnout.color }]}>{nextBurnout.score}</Text>
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
              {momentumScore >= 70
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
  strongSmall: { color: colors.text, fontSize: 10.5, fontWeight: '700' },
  mutedBody: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  bigStat: { color: colors.text, fontSize: 19, fontWeight: '800' },
  bigStatSub: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  axisLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  detailsBtn: { marginTop: 10, backgroundColor: colors.cardAlt, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsBtnText: { color: colors.accentText, fontSize: 12.5, fontWeight: '700' },
  warnDot: { width: 22, height: 22, borderRadius: 7, backgroundColor: WARN, alignItems: 'center', justifyContent: 'center' },
  dismissBtn: { marginTop: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: '#FCE3CB', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  barsRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 60, marginTop: 14 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 5 },
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
});

export default InsightsTab;
