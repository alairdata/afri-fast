import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform, Modal } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme';
import { LineChart } from 'react-native-chart-kit';
import { computeMomentumTimeline, MET } from '../lib/momentum';
import { computeWeeklyPace } from '../lib/trajectory';
import { computeObservedTdee } from '../lib/observedTdee';
import { computeBurnoutTimeline } from '../lib/burnout';
import { fetchSavedBurnoutDays, saveBurnoutDay } from '../lib/burnoutHistory';
import { savePredictionSnapshot } from '../lib/predictionHistory';
import { saveBurnoutPredictionSnapshot } from '../lib/burnoutPredictionHistory';
import { computeCurrentMealStreak } from '../lib/mealStreak';
import { resolveGoalForDate } from '../lib/goalHistory';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WARN = '#F59E0B';
const DANGER = '#EF4444';
const WARN_BG = '#FFF7ED';
const DANGER_BG = '#FEF2F2';
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const RANGE_OPTIONS = ['7 days', '14 days', '30 days', '90 days', 'All time'];
const RANGE_SHORT = { '7 days': '7D', '14 days': '14D', '30 days': '30D', '90 days': '90D', 'All time': 'All' };
const RANGE_DAYS = { '7 days': 7, '14 days': 14, '30 days': 30, '90 days': 90 };

// "All time" doesn't have a fixed day count -- it spans from today back to that data source's
// actual earliest entry, so a brand-new logger gets a small chart and a two-year user gets a
// real two-year one, instead of both being arbitrarily capped at the same number.
const daysSinceEarliest = (logs, getTs) => {
  const timestamps = (logs || []).map(getTs).filter(t => t != null && !isNaN(t));
  if (!timestamps.length) return 7;
  return Math.max(7, Math.ceil((Date.now() - Math.min(...timestamps)) / DAY_MS) + 1);
};
// Only used for the Streaks tile's "current weight" lookup (BMI) and Activities' week data
// below — the four Streaks numbers themselves (Current/Best streak, Days on target/logged) are
// all-time, computed separately from the full recentMeals array with no window at all.
const STREAK_WINDOW_DAYS = 90;

// Activities always show "this week" (Mon-Sun), independent of any chart's range dropdown --
// matches the "This Week" check-in style strip on the Today tab, not the 7/14/30/90-day ranges.
const getWeekActivityData = (activities) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const loggedDates = new Set((activities || []).map(a => a.date));
  const weekActivityHistory = WEEK_DAY_LABELS.map((_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    if (day > today) return null;
    return loggedDates.has(day.toDateString());
  });

  const weekActivities = (activities || [])
    .filter(a => {
      const t = a.timestamp || new Date(a.date).getTime();
      return !isNaN(t) && t >= monday.getTime();
    })
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return { weekActivityHistory, weekActivities };
};

// Small per-chart range control (7D/14D/30D/90D/All) — replaces the single global selector that
// used to drive every chart at once. Each chart that has one owns its own value/onChange so
// picking "30 days" on Calorie Intake doesn't also change what Weight trend is showing. Styled
// to match the small anchored dropdown already used for the range picker on the Hydration Log
// page (dropdownWrap/dropdownBtn/dropdownMenu there) rather than a heavy full-screen sheet.
//
// The menu itself still renders through RN's Modal, not as an inline absolute-positioned child —
// a popover nested this deep inside a ScrollView relies on zIndex/elevation lifting it above
// every *later* sibling section in that scroll list, which React Native does not reliably do
// (it would silently render underneath whatever section comes next and eat no taps — this is
// exactly what broke the first version of this control). Modal is a true top-level overlay, so
// it's positioned using the button's own on-screen coordinates (measured on open) to look and
// sit exactly like an anchored dropdown, while still actually catching taps reliably.
const RangeDropdown = ({ value, onChange, styles }) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const btnRef = useRef(null);

  const openMenu = () => {
    btnRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <>
      <TouchableOpacity ref={btnRef} style={styles.rangeDropdownBtn} onPress={openMenu} activeOpacity={0.7}>
        <Text style={styles.rangeDropdownBtnText}>{RANGE_SHORT[value]}</Text>
        <Ionicons name="chevron-down" size={10} color="#059669" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)}>
          {anchor && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={[
                styles.rangeDropdownMenu,
                { top: anchor.y + anchor.height + 4, right: Math.max(12, SCREEN_WIDTH - (anchor.x + anchor.width)) },
              ]}
            >
              {RANGE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.rangeDropdownItem, value === opt && styles.rangeDropdownItemActive]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                >
                  <Text style={[styles.rangeDropdownItemText, value === opt && styles.rangeDropdownItemTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
};

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
// "13 Sep" — used for the forecast box's date-based labels (see FORECAST section below).
const fmtDayMonth = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

const ProgressTab = ({
  // Navigation into external full-page detail modals (owned by FastingApp.jsx)
  onShowWeightModal, onShowFastingDetails, onShowBMIDetails, onShowCalorieDetails, onShowHydrationDetails,
  onShowStepsDetails, onShowAddActivity, onShowActivityLog,
  // Shared data
  fastingSessions = [], recentMeals = [], weightLogs = [], waterLogs = [], stepLogs = [], activities = [], checkInHistory = [],
  height = '', heightUnit = 'cm', weightUnit = 'kg', volumeUnit = 'oz', targetWeight = null, startingWeight = null,
  dailyCalorieGoal = 2000, hydrationGoal = 0, stepGoal = 10000, goalHistory = [],
  // Insights-only data (profile/goal fields the momentum/burnout/pace engines need)
  userId = null, userName = '', goalDate = null, userJoinDate = null, age = null, sex = null,
  activityLevel = null, pacePreference = null, proteinGoal = null, carbsGoal = null, fatsGoal = null,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [view, setView] = useState('main');
  const [guardrailDismissed, setGuardrailDismissed] = useState(false);
  const [chartTooltip, setChartTooltip] = useState(null);

  // Independent per-chart range state — each of Weight/Calorie/Hydration/Steps owns its own
  // 7/14/30/90-day selection instead of one shared selector driving all four.
  const [weightRange, setWeightRange] = useState('7 days');
  const [calorieRange, setCalorieRange] = useState('7 days');
  const [waterRange, setWaterRange] = useState('7 days');
  const [stepsRange, setStepsRange] = useState('7 days');

  const [weightTooltip, setWeightTooltip] = useState(null);
  const [stepsTooltip, setStepsTooltip] = useState(null);
  const [calTooltip, setCalTooltip] = useState(null);
  const [waterTooltip, setWaterTooltip] = useState(null);

  useEffect(() => { if (!weightTooltip) return; const t = setTimeout(() => setWeightTooltip(null), 2000); return () => clearTimeout(t); }, [weightTooltip]);
  useEffect(() => { if (!calTooltip) return; const t = setTimeout(() => setCalTooltip(null), 2000); return () => clearTimeout(t); }, [calTooltip]);
  useEffect(() => { if (!waterTooltip) return; const t = setTimeout(() => setWaterTooltip(null), 2000); return () => clearTimeout(t); }, [waterTooltip]);
  useEffect(() => { if (!stepsTooltip) return; const t = setTimeout(() => setStepsTooltip(null), 2000); return () => clearTimeout(t); }, [stepsTooltip]);
  useEffect(() => { if (!chartTooltip) return; const t = setTimeout(() => setChartTooltip(null), 4000); return () => clearTimeout(t); }, [chartTooltip]);

  const accent = colors.accent;
  const now = Date.now();

  // ══════════════════════════════════════════════════════════════════════
  // PROGRESS — range-filtered chart data (weight / calorie / water / steps / streaks)
  // ══════════════════════════════════════════════════════════════════════

  // Builds every stat + chart-ready array for a given lookback window. Called once per chart
  // that needs one (each with its own `days`), plus once more at a fixed window for Streaks.
  const getRangeData = (days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    // Every range always shows one point per individual day -- charts never aggregate into
    // weekly/monthly averages. rangeMode controls the axis label FORMAT: "18-Aug" (dd-Mmm) for
    // 7 days only, "18/08" (dd/mm) for 14/30/90 days.
    const rangeMode = days === 7 ? 'daily' : 'weekly';
    const isLongRange = days >= 90; // 90 days = "monthly avg" pills; 7/14/30 = "weekly avg"

    // Filter sessions within range
    const sessions = fastingSessions.filter(s => s.startTime >= cutoff);
    const totalSessions = sessions.length;
    const totalHours = sessions.reduce((sum, s) => sum + s.durationHours + s.durationMinutes / 60, 0);
    const avgHours = totalSessions > 0 ? totalHours / totalSessions : 0;
    const avgH = Math.floor(avgHours);
    const avgM = Math.round((avgHours - avgH) * 60);

    // Filter all data sources by date range first
    const rangeMeals = (recentMeals || []).filter(m => {
      const t = m.timestamp || new Date(m.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const rangeWeights = (weightLogs || []).filter(w => {
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });
    const weightChange = rangeWeights.length >= 2 ? (rangeWeights[0].weight - rangeWeights[rangeWeights.length - 1].weight).toFixed(1) : '0';

    const rangeWater = (waterLogs || []).filter(w => {
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const rangeSteps = (stepLogs || []).filter(s => {
      // id is a client-generated primary key (Date.now() for manual logs, but a large synthetic
      // number like 9000000000000+n for backfilled/webhook-synced rows) -- never a real
      // timestamp. date is the only reliable field the client actually fetches for step_logs.
      const t = new Date(s.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    // Convert water to litres
    const toL = (amount, u) => {
      const ml = u === 'mL' ? amount : u === 'oz' ? amount * 29.574 : u === 'sachet' ? amount * 500 : u === 'bottle' ? amount * 750 : amount * 237;
      return Math.round(ml / 100) / 10;
    };

    // Fills gaps so the chosen range always shows every calendar day in it -- a day with no log
    // becomes a real 0 entry instead of being skipped, so "7 days" always means 7 bars/points,
    // not "however many of the last 7 days happened to have data".
    const fillDays = (byDate, field, dayCount) => {
      const out = [];
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(now - i * DAY_MS);
        const ds = d.toDateString();
        out.push(byDate[ds] || { date: ds, [field]: 0 });
      }
      return out; // already newest-first, matching the sort order of the non-filled path
    };

    // Water stats
    const waterByDate = {};
    rangeWater.forEach(l => {
      const key = l.date;
      if (!waterByDate[key]) waterByDate[key] = { date: key, totalL: 0 };
      waterByDate[key].totalL += toL(l.amount, l.unit);
    });
    const dailyWater = fillDays(waterByDate, 'totalL', days);
    const uniqueWater = dailyWater;
    const waterChartData = uniqueWater.slice().reverse().map(l => Math.round(l.totalL * 10) / 10);
    const loggedWaterDays = dailyWater.filter(l => l.totalL > 0);
    const avgWaterL = loggedWaterDays.length > 0 ? (loggedWaterDays.reduce((s, l) => s + l.totalL, 0) / loggedWaterDays.length).toFixed(1) : '0';

    // Steps stats
    const stepsByDate = {};
    rangeSteps.forEach(l => {
      const key = l.date;
      if (!stepsByDate[key]) stepsByDate[key] = { date: key, totalSteps: 0 };
      stepsByDate[key].totalSteps += l.steps;
    });
    const dailySteps = fillDays(stepsByDate, 'totalSteps', days);
    const uniqueSteps = dailySteps;
    const stepsChartData = uniqueSteps.slice().reverse().map(l => l.totalSteps);
    const loggedStepsDays = dailySteps.filter(l => l.totalSteps > 0);
    const avgSteps = loggedStepsDays.length > 0 ? Math.round(loggedStepsDays.reduce((s, l) => s + l.totalSteps, 0) / loggedStepsDays.length) : 0;

    // Chart label formatter: "18-Aug" (dd-Mmm) for 7 days, "18/08" (dd/mm) for 14/30/90 days.
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatLabel = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 6);
      if (rangeMode === 'weekly') return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
    };

    // Picks up to `count` evenly-spaced indices (always including first and last) from a dense
    // day-by-day array, so a chart with 90+ points still only labels ~4 of them -- every bar/point
    // stays, only the text underneath thins out.
    const pickLabelIndices = (n, count = 4) => {
      const idxs = new Set();
      if (n <= count) { for (let i = 0; i < n; i++) idxs.add(i); return idxs; }
      for (let k = 0; k < count; k++) idxs.add(Math.round((k * (n - 1)) / (count - 1)));
      return idxs;
    };
    const buildLabels = (items) => {
      const idxs = pickLabelIndices(items.length);
      return items.map((item, i) => (idxs.has(i) ? formatLabel(item.date) : ''));
    };

    // Fills gaps by carrying the last real value forward instead of zeroing it out -- for a
    // level metric like weight, "no log today" means "assume unchanged", not "assume 0kg". Days
    // before the very first real log stay genuinely blank (nothing to carry forward yet).
    const fillDaysCarryForward = (byDate, field, dayCount) => {
      const out = [];
      let lastEntry = null;
      for (let i = dayCount - 1; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        const ds = d.toDateString();
        const entry = byDate[ds];
        if (entry) { lastEntry = entry; out.push(entry); }
        else if (lastEntry) { out.push({ ...lastEntry, date: ds, carried: true }); }
      }
      return out.reverse(); // newest-first, matching the rest of this file's convention
    };

    const mealsByDate = {};
    rangeMeals.forEach(m => {
      if (!m.date) return;
      if (!mealsByDate[m.date]) mealsByDate[m.date] = { calories: 0, date: m.date };
      mealsByDate[m.date].calories += m.calories || 0;
    });
    const dailyCalData = fillDays(mealsByDate, 'calories', days);
    const loggedCalDays = dailyCalData.filter(d => d.calories > 0);

    // Weight -- group multiple same-day logs by averaging, then carry-forward fill gaps.
    const weightsByDate = {};
    rangeWeights.forEach(w => {
      const key = new Date(w.timestamp || w.date).toDateString();
      if (!weightsByDate[key]) weightsByDate[key] = { ...w, weights: [] };
      weightsByDate[key].weights.push(w.weight);
    });
    Object.values(weightsByDate).forEach(g => {
      g.weight = parseFloat((g.weights.reduce((a, b) => a + b, 0) / g.weights.length).toFixed(1));
    });
    const uniqueWeights = fillDaysCarryForward(weightsByDate, 'weight', days);
    const weightChartData = uniqueWeights.slice().reverse().map(w => w.weight);
    const hasLoggedWeight = uniqueWeights.some(w => !w.carried);
    const totalCal = rangeMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const calDaysCount = loggedCalDays.length; // real logged days only, not the zero-filled gaps
    const monthsCount = Math.max(Math.ceil(days / 30), 1);

    return {
      days,
      isLongRange,
      // Fasting
      avgFastLength: totalSessions > 0 ? `${avgH}h ${avgM}m` : '0h 0m',
      // Weight
      rangeWeights,
      uniqueWeights,
      weightChartData,
      hasLoggedWeight,
      weightChange: `${parseFloat(weightChange) >= 0 ? '+' : ''}${weightChange} kg`,
      weeklyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(days / 7, 1)).toFixed(1)} kg/wk` : '--',
      monthlyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(monthsCount, 1)).toFixed(1)} kg/mo` : '--',
      // Calories
      rangeMeals,
      dailyCalData,
      hasLoggedCal: loggedCalDays.length > 0,
      avgDailyCal: calDaysCount > 0 ? Math.round(totalCal / calDaysCount) : 0,
      avgMonthlyCal: calDaysCount > 0 ? Math.round(totalCal / Math.max(monthsCount, 1)) : 0,
      // Water
      uniqueWater,
      waterChartData,
      avgWaterL,
      hasLoggedWater: loggedWaterDays.length > 0,
      waterGoalMet: `${uniqueWater.filter(w => w.totalL >= 2).length}/${uniqueWater.length}`,
      // Steps
      uniqueSteps,
      stepsChartData,
      avgSteps,
      hasLoggedSteps: loggedStepsDays.length > 0,
      stepsGoalMet: `${uniqueSteps.filter(s => s.totalSteps >= stepGoal).length}/${uniqueSteps.length}`,
      ...getWeekActivityData(activities),
      // Labels
      formatLabel,
      buildLabels,
    };
  };

  const streakData = getRangeData(STREAK_WINDOW_DAYS);
  // Current streak specifically must match the Meals tab banner and the meal share card, so it
  // uses the same shared, uncapped calculation rather than streakData's 90-day-windowed one —
  // otherwise a real streak longer than 90 days would silently read differently here than
  // everywhere else in the app that shows it.
  const currentMealStreak = useMemo(() => computeCurrentMealStreak(recentMeals), [recentMeals]);

  // Best Streak / Days on Target / Days Logged — all-time, not windowed to any fixed number of
  // days. (Note: "all-time" here means as far back as recentMeals actually reaches, which is the
  // last 200 logged meals per the fetch in FastingApp.jsx — not literally the account's full
  // history for a very long-time user. Best Streak in particular can't exceed however many
  // distinct days that 200-meal window happens to span.)
  const allTimeStreakStats = useMemo(() => {
    const loggedDates = new Set((recentMeals || []).map(m => m.date));
    const sortedDates = [...loggedDates].map(s => new Date(s)).sort((a, b) => a - b);
    let bestStreak = 0, runStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { runStreak = 1; }
      else {
        const diff = (sortedDates[i] - sortedDates[i - 1]) / DAY_MS;
        runStreak = diff === 1 ? runStreak + 1 : 1;
      }
      if (runStreak > bestStreak) bestStreak = runStreak;
    }

    // Graded against the goal that was active on each specific day, not today's live goal --
    // otherwise changing your goal retroactively repaints old days as on/off target.
    const daysOnTarget = [...loggedDates].filter(date => {
      const total = (recentMeals || []).filter(m => m.date === date).reduce((s, m) => s + (m.calories || 0), 0);
      const dayGoal = resolveGoalForDate(goalHistory, date, dailyCalorieGoal, 'dailyCalorieGoal');
      const ratio = dayGoal > 0 ? total / dayGoal : 0;
      return ratio >= 0.7 && ratio <= 1.15;
    }).length;

    return { bestStreak, daysOnTarget, totalDaysLogged: loggedDates.size };
  }, [recentMeals, dailyCalorieGoal, goalHistory]);
  const weightData = getRangeData(weightRange === 'All time'
    ? daysSinceEarliest(weightLogs, w => w.timestamp || new Date(w.date).getTime())
    : RANGE_DAYS[weightRange]);
  const calorieData = getRangeData(calorieRange === 'All time'
    ? daysSinceEarliest(recentMeals, m => m.timestamp || new Date(m.date).getTime())
    : RANGE_DAYS[calorieRange]);
  const waterData = getRangeData(waterRange === 'All time'
    ? daysSinceEarliest(waterLogs, w => w.timestamp || new Date(w.date).getTime())
    : RANGE_DAYS[waterRange]);
  const stepsData = getRangeData(stepsRange === 'All time'
    ? daysSinceEarliest(stepLogs, s => new Date(s.date).getTime())
    : RANGE_DAYS[stepsRange]);

  // ══════════════════════════════════════════════════════════════════════
  // INSIGHTS — momentum / burnout / pace engines (profile & goals baseline)
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
  // without waiting on the full momentum timeline. Decay scales with elapsed days between
  // weigh-ins, not sample count.
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

  // BMR checkpoint weight — holds at a fixed anchor until the smoothed trend has moved a full
  // 6kg away from it, then checkpoints onto the new value. Keeps TDEE from jittering day to day.
  const CHECKPOINT_STEP_KG = 6;
  const bmrCheckpointWeightKg = useMemo(() => {
    if (!weightEwmaSeries.length) return null;
    let anchor = startingWeightKg != null ? startingWeightKg : weightEwmaSeries[0];
    weightEwmaSeries.forEach((e) => { if (Math.abs(e - anchor) >= CHECKPOINT_STEP_KG) anchor = e; });
    return anchor;
  }, [weightEwmaSeries, startingWeightKg]);

  // BMR — Mifflin-St Jeor, recalculated off the checkpointed weight.
  const bmr = useMemo(() => {
    const weightForBmr = bmrCheckpointWeightKg != null ? bmrCheckpointWeightKg : currentWeightKg;
    if (!age || !sex || !heightCm || weightForBmr == null) return null;
    const base = 10 * weightForBmr + 6.25 * heightCm - 5 * age;
    if (sex === 'Male') return base + 5;
    if (sex === 'Female') return base - 161;
    return base - 78; // unspecified — midpoint of the two offsets
  }, [age, sex, heightCm, bmrCheckpointWeightKg, currentWeightKg]);

  // Checkpoint-change notice — dismissable, fires once per new checkpoint.
  const [checkpointNotice, setCheckpointNotice] = useState(null); // { newKg, prevKg } | null
  useEffect(() => {
    if (!userId || bmrCheckpointWeightKg == null) return;
    let cancelled = false;
    const key = `bmr_checkpoint_seen_${userId}`;
    AsyncStorage.getItem(key).then((raw) => {
      if (cancelled) return;
      const prevKg = raw != null ? parseFloat(raw) : null;
      if (prevKg == null) {
        AsyncStorage.setItem(key, String(bmrCheckpointWeightKg));
        return;
      }
      if (Math.abs(bmrCheckpointWeightKg - prevKg) > 0.05) {
        setCheckpointNotice({ newKg: bmrCheckpointWeightKg, prevKg });
      }
    });
    return () => { cancelled = true; };
  }, [userId, bmrCheckpointWeightKg]);

  const dismissCheckpointNotice = () => {
    if (checkpointNotice && userId) AsyncStorage.setItem(`bmr_checkpoint_seen_${userId}`, String(checkpointNotice.newKg));
    setCheckpointNotice(null);
  };

  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.light;
  const formulaTdee = bmr != null ? bmr * activityMultiplier : null;

  const observedTdee = useMemo(() => computeObservedTdee({
    weightLogs, recentMeals, toKg: (w) => toKg(w, weightUnit), now,
  }), [weightLogs, recentMeals, weightUnit, now]);

  const tdee = useMemo(() => {
    if (!observedTdee.available || formulaTdee == null) return formulaTdee;
    const c = observedTdee.confidence;
    return c * observedTdee.observedTdee + (1 - c) * formulaTdee;
  }, [observedTdee, formulaTdee]);

  const requiredWeeklyRateKg = useMemo(() => {
    if (targetWeightKg == null || startingWeightKg == null || !goalDate || !userJoinDate) return null;
    const startTs = new Date(userJoinDate).getTime();
    const goalTs = new Date(goalDate).getTime();
    if (isNaN(startTs) || isNaN(goalTs) || goalTs <= startTs) return null;
    const weeks = (goalTs - startTs) / (7 * DAY_MS);
    return (targetWeightKg - startingWeightKg) / weeks;
  }, [targetWeightKg, startingWeightKg, goalDate, userJoinDate]);

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
  const deficitToday = tdee != null ? tdee - todayCalories : null;

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

  const deviationKg = (weeklyWeightChangeKg != null && requiredWeeklyRateKg != null)
    ? weeklyWeightChangeKg - requiredWeeklyRateKg
    : null;

  // Momentum Score — EWMA-smoothed engine (see src/lib/momentum.js): 40% Calorie + 35% Satiety
  // (= 100 - that day's Burnout risk) + 25% Movement.
  const momentumTimeline = useMemo(() => computeMomentumTimeline({
    weightLogs, recentMeals, waterLogs, stepLogs, activities,
    dailyCalorieGoal, goalHistory, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal,
    fallbackWeightKg: currentWeightKg,
    toKg: (w) => toKg(w, weightUnit),
    now,
  }), [weightLogs, recentMeals, waterLogs, stepLogs, activities, dailyCalorieGoal, goalHistory, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal, currentWeightKg, weightUnit, now]);

  const today = momentumTimeline[momentumTimeline.length - 1];
  const momentumScore = today.momentum;
  const momentumLabel = today.band.label === 'STRONG' ? 'Strong momentum' : today.band.label === 'DRIFTING' ? 'Drifting' : 'Stalled';
  const momentumColor = today.band.tone === 'strong' ? accent : today.band.tone === 'drifting' ? WARN : DANGER;
  const momentumBg = today.band.tone === 'strong' ? colors.accentLight : today.band.tone === 'drifting' ? WARN_BG : DANGER_BG;

  const gauge = useMemo(() => buildGauge(momentumScore, accent), [momentumScore, accent]);

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

  // Weekly Pace & Trajectory Engine — purely calorie-driven.
  const weeklyPace = useMemo(() => computeWeeklyPace({
    tdee, bmr, recentMeals, pacePreference,
    weightEwmaTodayKg: today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg,
    confidence: today.confidence,
    daysSinceWeighIn: today.daysSinceWeighIn,
    activityKcalByDate: activityKcalLast7ByDate,
    now,
  }), [tdee, bmr, recentMeals, pacePreference, today, currentWeightKg, activityKcalLast7ByDate, now]);

  const trajectory = useMemo(() => {
    if (deviationKg == null || !requiredWeeklyRateKg) return null;
    const ratio = deviationKg / Math.abs(requiredWeeklyRateKg);
    if (ratio <= -0.001) return { label: 'Ahead of Pace', color: accent, bg: colors.accentLight };
    if (ratio <= 0.10) return { label: 'On Track', color: accent, bg: colors.accentLight };
    if (ratio <= 0.30) return { label: 'Drifting', color: WARN, bg: WARN_BG };
    return { label: 'Stalled', color: DANGER, bg: DANGER_BG };
  }, [deviationKg, requiredWeeklyRateKg, accent, colors.accentLight]);

  // Forecast shares the same energy-deficit engine as the This Week chart (weeklyPace).
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

  // Each day judged against its own day's goal, not today's live one.
  const spikeDays = loggedDays.filter((d) => d.total > resolveGoalForDate(goalHistory, d.ds, dailyCalorieGoal, 'dailyCalorieGoal') * 1.5);
  const crashDays = loggedDays.filter((d) => d.total > 0 && d.total < resolveGoalForDate(goalHistory, d.ds, dailyCalorieGoal, 'dailyCalorieGoal') * 0.5);

  // Saved (finalized) past-day Burnout scores.
  const [savedBurnoutDays, setSavedBurnoutDays] = useState({});
  useEffect(() => {
    let cancelled = false;
    if (!userId) { setSavedBurnoutDays({}); return; }
    fetchSavedBurnoutDays(userId).then((days) => { if (!cancelled) setSavedBurnoutDays(days); });
    return () => { cancelled = true; };
  }, [userId]);

  const burnout = useMemo(() => computeBurnoutTimeline({
    recentMeals, waterLogs, tdee, bmr, weightKg: currentWeightKg, pacePreference,
    dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, goalHistory, savedDays: savedBurnoutDays, now,
  }), [recentMeals, waterLogs, tdee, bmr, currentWeightKg, pacePreference, dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, goalHistory, savedBurnoutDays, now]);

  useEffect(() => {
    if (!userId) return;
    const toFinalize = burnout.week.filter((d) => d.isPast && !d.isFinalized);
    if (!toFinalize.length) return;
    let cancelled = false;
    Promise.all(toFinalize.map((d) => saveBurnoutDay(userId, d.ds, d))).then(() => {
      if (cancelled) return;
      setSavedBurnoutDays((prev) => {
        const next = { ...prev };
        toFinalize.forEach((d) => { next[d.ds] = d; });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [userId, burnout.week]);

  const burnoutPredictionSnapshot = useMemo(() => {
    const predictions = burnout.week
      .filter((d) => !d.isPast)
      .map((d) => ({
        targetDate: d.ds, daysOut: Math.round((d.date.getTime() - burnout.week[3].date.getTime()) / DAY_MS),
        score: d.score, deficitPts: d.deficitPts, volatilityPts: d.volatilityPts,
        proteinPts: d.proteinPts, waterPts: d.waterPts, carbsPts: d.carbsPts,
        fiberPts: d.fiberPts, fatPts: d.fatPts,
        avgCalories: d.avgCalories, avgProtein: d.avgProtein, avgCarbs: d.avgCarbs,
        avgFats: d.avgFats, avgFiber: d.avgFiber, avgWaterMl: d.avgWaterMl,
      }));
    if (!predictions.length) return null;
    return {
      date: burnout.week[3].ds,
      predictions,
      bmr, tdee, pacePreference, dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal,
      weightKg: currentWeightKg,
      daysToCrash: burnout.daysToCrash, crashDate: burnout.crashDate ? burnout.crashDate.toDateString() : null,
    };
  }, [burnout, bmr, tdee, pacePreference, dailyCalorieGoal, proteinGoal, carbsGoal, fatsGoal, currentWeightKg]);

  useEffect(() => {
    if (!userId || !burnoutPredictionSnapshot) return;
    saveBurnoutPredictionSnapshot(userId, burnoutPredictionSnapshot.date, burnoutPredictionSnapshot);
  }, [userId, burnoutPredictionSnapshot]);

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

  // Momentum "See why" — plain-language sentences instead of a bare numbers table. Calorie and
  // Movement are single facts, so they're templated directly off the same live numbers shown
  // elsewhere on this tab. Satiety reuses burnoutWhy verbatim rather than re-deriving its own
  // explanation — burnoutWhy already explains the exact same underlying fields (deficit,
  // protein, water, carbs, fiber, fat, volatility) in plain language, so duplicating that logic
  // here would just be two sentences that can drift out of sync with each other over time.
  const momentumWhy = useMemo(() => ({
    calorie: { subscore: today.calorieSubscore, loggedToday: today.caloriesLoggedToday, targetToday: dailyCalorieGoal },
    satiety: { subscore: today.satietySubscore },
    movement: {
      subscore: today.movementSubscore,
      gymKcalToday: today.movementGymKcal, stepsKcalToday: today.movementStepsKcal, targetKcalToday: today.movementTargetKcal,
    },
  }), [today, dailyCalorieGoal]);

  const momentumWhySentences = useMemo(() => {
    const c = momentumWhy.calorie;
    const m = momentumWhy.movement;
    const calorieSentence = c.loggedToday
      ? `You've logged ${c.loggedToday.toLocaleString()} kcal today against a ${c.targetToday.toLocaleString()} kcal target — that's what's putting Calorie at ${c.subscore}%.`
      : `Nothing logged yet today against a ${c.targetToday.toLocaleString()} kcal target, which is why Calorie is sitting at ${c.subscore}%.`;
    const movementSentence = m.targetKcalToday != null
      ? `${Math.round(m.gymKcalToday || 0)} kcal from workouts plus ${Math.round(m.stepsKcalToday || 0)} kcal from steps today, against a ${Math.round(m.targetKcalToday).toLocaleString()} kcal active-energy target — that's the ${m.subscore}% here.`
      : 'Add your age, sex, height, and activity level in Settings so Movement can be measured properly.';
    return { calorieSentence, movementSentence };
  }, [momentumWhy]);

  // Trajectory chart: a PREDICTION, not a log -- every day of the week gets a guess.
  const chart = useMemo(() => {
    const W = 320, top = 10, bot = 100, padX = 16;
    const nowDate = new Date(now);
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const anchorKg = today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg;
    const confidenceVal = today.confidence;
    const dailyRateKg = weeklyPace.dailyRateKg;
    if (anchorKg == null || dailyRateKg == null) return null;

    const data = [];
    for (let offset = 0; offset <= 6; offset++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + offset);
      const dayDiff = Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
      const projectedKg = anchorKg + dailyRateKg * dayDiff;
      const marginKg = Math.abs(dayDiff) * 0.15 * (2 - confidenceVal);
      const proj = fromKg(projectedKg, weightUnit);
      const margin = fromKg(marginKg, weightUnit);
      data.push({ label: dayLabel(d), proj, upper: proj + margin, lower: proj - margin });
    }

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
    const points = data.map((p, i) => ({
      label: p.label, value: p.proj, changeFromStart: p.proj - weekStartVal, xFrac: i / 6,
    }));
    return { proj: smooth(pts('proj')), band, dots, points, labels: data.map((p) => p.label), weekChange, weekEndDate };
  }, [today, currentWeightKg, weeklyPace, accent, colors.card, now, weightUnit]);

  const predictionSnapshot = useMemo(() => {
    const anchorKg = today.weightEwmaKg != null ? today.weightEwmaKg : currentWeightKg;
    if (anchorKg == null || weeklyPace.dailyRateKg == null) return null;

    const nowDate = new Date(now);
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const predictions = [];
    for (let offset = 0; offset <= 6; offset++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + offset);
      const dayDiff = Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
      const proj = weeklyPace.projectDay(dayDiff);
      if (!proj) continue;
      predictions.push({
        targetDate: d.toDateString(), daysOut: dayDiff,
        predictedKg: proj.projectedKg, marginKg: proj.upperKg - proj.projectedKg,
      });
    }
    if (predictions.length === 0) return null;

    return {
      date: startOfToday.toDateString(),
      predictions,
      anchorWeightKg: anchorKg,
      dailyRateKg: weeklyPace.dailyRateKg,
      confidence: today.confidence,
      daysSinceWeighIn: today.daysSinceWeighIn,
      tdee, bmr, pacePreference,
      avgDailyDeficitKcal: weeklyPace.dBar,
      paceRatio: weeklyPace.pRatio,
      badgeLabel: weeklyPace.badge?.label ?? null,
    };
  }, [today, currentWeightKg, weeklyPace, now, tdee, bmr, pacePreference]);

  useEffect(() => {
    if (!userId || !predictionSnapshot) return;
    savePredictionSnapshot(userId, predictionSnapshot.date, predictionSnapshot);
  }, [userId, predictionSnapshot]);

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

  const trendNote = useMemo(() => {
    const label = trendBadge?.label;
    if (!label || label === 'On Pace') return null;
    if (label === 'Too Aggressive') {
      return `This isn't about going too fast — your last 3 logged days are averaging ${Math.round(weeklyPace.threeDayAvgCalories).toLocaleString()} kcal, under the safe floor for what your organs need at rest (~${weeklyPace.bmrSafetyFloor ? Math.round(weeklyPace.bmrSafetyFloor).toLocaleString() : ''} kcal). That's under-eating, not overachieving. Bring your calories back up.`;
    }
    if (label === 'Faster Than Planned') return "You're running a bigger deficit than your chosen pace calls for, but it's still within a safe range for your body — nothing to fix, unless you'd rather update your pace in Settings to match.";
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
    // Whether this counts as a "big swing" is judged against the goal that was active on
    // maxDay itself; the "get back to X" advice below still points at today's live goal since
    // that's forward guidance, not a judgment of the past.
    const maxDayGoal = resolveGoalForDate(goalHistory, maxDay.ds, dailyCalorieGoal, 'dailyCalorieGoal');
    if (swing > maxDayGoal * 0.5 && maxDay.total > maxDayGoal * 1.3) {
      return {
        title: 'Big swing this week',
        body: `${fmtShort(maxDay.date)} came in around ${Math.round(maxDay.total).toLocaleString()} kcal — about ${Math.round(swing).toLocaleString()} more than your other days. One day like that won't undo your progress. Get back to ${dailyCalorieGoal.toLocaleString()} kcal and keep moving.`,
      };
    }
    return null;
  }, [loggedDays, dailyCalorieGoal, goalHistory]);

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
        const dayGoal = resolveGoalForDate(goalHistory, ds, dailyCalorieGoal, 'dailyCalorieGoal');
        if (total > 0) results.push(total <= dayGoal * 1.15);
      }
      weeks.push(results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : null);
    }
    return weeks;
  }, [recentMeals, dailyCalorieGoal, goalHistory, now]);

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
      const dayGoal = resolveGoalForDate(goalHistory, ds, dailyCalorieGoal, 'dailyCalorieGoal');
      byWeekday[wd].sum += total - dayGoal;
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
  }, [recentMeals, dailyCalorieGoal, goalHistory]);

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

            {/* Streaks */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="flame-outline" size={14} color={colors.text} />
                  </View>
                  <Text style={styles.progressSectionTitleCompact}>Streaks</Text>
                </View>
              </View>
              <View style={styles.chartCardCompact}>
                <View style={styles.streaksGridFour}>
                  <View style={styles.streakItemCompact}>
                    <Text style={styles.streakValueCompact}>{currentMealStreak > 0 ? currentMealStreak : '--'}</Text>
                    <Text style={styles.streakLabelCompact}>Current streak</Text>
                  </View>
                  <View style={styles.streakItemCompact}>
                    <Text style={styles.streakValueCompact}>{allTimeStreakStats.bestStreak > 0 ? allTimeStreakStats.bestStreak : '--'}</Text>
                    <Text style={styles.streakLabelCompact}>Best streak</Text>
                  </View>
                  <View style={styles.streakItemCompact}>
                    <Text style={styles.streakValueCompact}>{allTimeStreakStats.daysOnTarget > 0 ? allTimeStreakStats.daysOnTarget : '--'}</Text>
                    <Text style={styles.streakLabelCompact}>Days on target</Text>
                  </View>
                  <View style={styles.streakItemCompact}>
                    <Text style={styles.streakValueCompact}>{allTimeStreakStats.totalDaysLogged > 0 ? allTimeStreakStats.totalDaysLogged : '--'}</Text>
                    <Text style={styles.streakLabelCompact}>Days logged</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Momentum gauge */}
            <View style={[styles.card, { alignItems: 'center', paddingTop: 18 }]}>
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

            {/* Current BMI */}
            <View style={styles.progressSectionCompact}>
              <Text style={styles.progressSectionTitleCompact}>Current BMI</Text>
              {(() => {
                const latestWeight = streakData.rangeWeights.length > 0
                  ? [...streakData.rangeWeights].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                  : null;
                const hasWeight = latestWeight !== null;
                const heightNum = parseFloat(height);
                const heightM = heightNum ? (heightUnit === 'ft' ? heightNum * 0.3048 : heightNum / 100) : 0;
                const hasHeight = heightM > 0;
                const weightKg = hasWeight ? (latestWeight.unit === 'lbs' ? latestWeight.weight * 0.453592 : latestWeight.weight) : 0;
                const bmi = hasWeight && hasHeight ? (weightKg / (heightM * heightM)).toFixed(1) : null;
                const bmiCategory = bmi ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese') : null;
                const bmiPosition = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / (35 - 15)) * 100)) : 0;

                return (
                  <View style={styles.chartCardCompact}>
                    <View style={styles.bmiDisplay}>
                      <View style={styles.bmiValueContainer}>
                        <Text style={styles.bmiValue}>{bmi || '--'}</Text>
                        {bmiCategory && (
                          <View style={styles.bmiCategoryBadge}>
                            <Text style={styles.bmiCategory}>{bmiCategory}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.bmiWeightInfo}>
                        <Text style={styles.bmiWeightLabel}>Current weight</Text>
                        <Text style={styles.bmiWeightValue}>{hasWeight ? `${latestWeight.weight} ${latestWeight.unit}` : '--'}</Text>
                      </View>
                    </View>
                    <View style={styles.bmiBarContainer}>
                      <View style={styles.bmiBar}>
                        <View style={[styles.bmiBarSegment, { width: '17.5%', backgroundColor: '#3B82F6' }]} />
                        <View style={[styles.bmiBarSegment, { width: '32.5%', backgroundColor: '#10B981' }]} />
                        <View style={[styles.bmiBarSegment, { width: '25%', backgroundColor: '#F59E0B' }]} />
                        <View style={[styles.bmiBarSegment, { width: '25%', backgroundColor: '#EF4444' }]} />
                        {bmi && <View style={[styles.bmiIndicator, { left: `${bmiPosition}%` }]} />}
                      </View>
                      <View style={styles.bmiLabels}>
                        <Text style={styles.bmiLabel}>Underweight</Text>
                        <Text style={styles.bmiLabel}>Normal</Text>
                        <Text style={styles.bmiLabel}>Overweight</Text>
                        <Text style={styles.bmiLabel}>Obese</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Weight trend */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <Text style={styles.progressSectionTitleCompact}>Weight trend</Text>
                <RangeDropdown value={weightRange} onChange={setWeightRange} styles={styles} />
              </View>
              <View style={styles.chartCardCompact}>
                {(() => {
                  const uniqueLogs = weightData.uniqueWeights;
                  const hasData = weightData.hasLoggedWeight;
                  const hasMultiple = hasData && uniqueLogs.length >= 2;
                  const latest = uniqueLogs.length > 0 ? uniqueLogs[0] : null;
                  const unit = latest ? latest.unit : 'kg';
                  const displayLogs = uniqueLogs.slice().reverse();
                  const allWeights = weightData.weightChartData;
                  const currentWeightVal = latest ? latest.weight : null;
                  const yMax = currentWeightVal != null ? Math.ceil(currentWeightVal + 5) : undefined;
                  const yMin = targetWeight != null ? Math.floor(targetWeight - 10) : undefined;
                  return (
                    <>
                      <View style={{ marginLeft: 0, marginRight: -22, height: 200, overflow: 'hidden', position: 'relative' }}>
                        {hasMultiple ? (
                          <>
                          <LineChart
                            data={{
                              labels: weightData.buildLabels(displayLogs),
                              datasets: [
                                { data: allWeights },
                                ...(yMin != null ? [{ data: [yMin] }] : []),
                              ],
                            }}
                            fromNumber={yMax}
                            width={SCREEN_WIDTH + 22}
                            height={190}
                            chartConfig={{
                              backgroundColor: colors.card,
                              backgroundGradientFrom: colors.card,
                              backgroundGradientTo: colors.card,
                              decimalPlaces: 1,
                              color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
                              labelColor: () => '#888',
                              propsForDots: { r: '3.5', strokeWidth: '1.5', stroke: colors.card, fill: '#059669' },
                              propsForBackgroundLines: { stroke: 'transparent' },
                              fillShadowGradient: '#059669',
                              fillShadowGradientFrom: '#059669',
                              fillShadowGradientTo: '#059669',
                              fillShadowGradientFromOpacity: 0.3,
                              fillShadowGradientToOpacity: 0.05,
                              propsForLabels: { fontSize: 9 },
                              paddingRight: 48,
                            }}
                            onDataPointClick={({ value, x, y }) => setWeightTooltip(t => t?.x === x && t?.y === y ? null : { value, x, y })}
                            bezier
                            style={{ borderRadius: 12, marginLeft: -54 }}
                            withInnerLines={false}
                            withOuterLines={false}
                            fromZero={false}
                            withHorizontalLabels={false}
                            segments={5}
                          />
                          {weightTooltip && (
                            <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(weightTooltip.x - 30, SCREEN_WIDTH - 120)), top: weightTooltip.y - 12 }]} pointerEvents="none">
                              <Text style={styles.chartTooltipText}>{weightTooltip.value} kg</Text>
                            </View>
                          )}
                          </>
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={styles.chartPlaceholderText}>{hasData ? `${latest.weight} ${unit}` : 'No weight data'}</Text>
                            <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more to see trends' : 'Log your weight to start'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.weightStatsCompact}>
                        <View style={styles.weightStatCompact}>
                          <Text style={styles.weightStatValueCompact}>{hasMultiple ? weightData.weightChange : '--'}</Text>
                          <Text style={styles.weightStatLabelCompact}>This period</Text>
                        </View>
                        <View style={[styles.weightStatCompact, { backgroundColor: 'rgba(5, 150, 105, 0.08)' }]}>
                          <Text style={[styles.weightStatValueCompact, { color: '#059669' }]}>{hasMultiple ? (weightData.isLongRange ? weightData.monthlyChange : weightData.weeklyChange) : '--'}</Text>
                          <Text style={styles.weightStatLabelCompact}>{weightData.isLongRange ? 'Monthly avg' : 'Weekly avg'}</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
                <View style={styles.weightActionsCompact}>
                  <TouchableOpacity style={styles.weightActionBtnCompact} onPress={() => onShowWeightModal && onShowWeightModal()}>
                    <Text style={styles.weightActionBtnText}>Log weight</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowWeightModal && onShowWeightModal()}>
                    <Text style={styles.weightActionLinkText}>View all logs</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Prediction this week */}
            {chart && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.kicker}>PREDICTION THIS WEEK</Text>
                    <Text style={styles.bigStat}>
                      {chart.weekChange != null
                        ? `${Math.abs(chart.weekChange).toFixed(2)} ${weightUnit} ${chart.weekChange > 0 ? 'gain' : chart.weekChange < 0 ? 'loss' : 'change'}`
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
                      ? `${chartTooltip.label}: ${chartTooltip.value.toFixed(1)} ${weightUnit}${chartTooltip.changeFromStart != null ? `  ·  ${Math.abs(chartTooltip.changeFromStart).toFixed(2)} ${weightUnit} ${chartTooltip.changeFromStart > 0 ? 'gain' : chartTooltip.changeFromStart < 0 ? 'loss' : 'change'} vs Sun` : ''}`
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

            {/* Forecast — dates instead of "next 7 days" */}
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
                    <Text style={styles.statLabel}>{fmtDayMonth(new Date(now + 7 * DAY_MS)).toUpperCase()} (7D)</Text>
                    <Text style={styles.statValue}>{projected7Kg != null ? `${fromKg(projected7Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{fmtDayMonth(new Date(now + 14 * DAY_MS)).toUpperCase()} (14D)</Text>
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

            {/* BMR checkpoint change notice */}
            {checkpointNotice && (
              <View style={[styles.card, { backgroundColor: colors.accentLight, borderColor: accent }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitleSmall}>TDEE re-adjusted</Text>
                  <TouchableOpacity onPress={dismissCheckpointNotice} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.mutedBody, { marginTop: 6 }]}>
                  You've {checkpointNotice.newKg < checkpointNotice.prevKg ? 'lost' : 'gained'} enough for your TDEE to be recalculated —
                  {pacePreference ? ` worth updating your daily calorie target in Settings to stay on your ${pacePreference} pace.` : ' worth updating your daily calorie target in Settings to keep it matched to your goal.'}
                </Text>
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
                </>
              ) : (
                <Text style={styles.mutedBody}>Add your age, sex, height, and activity level in Settings to see your energy balance (what you burn vs. what you eat) here.</Text>
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

            {/* Calorie Intake */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="flame-outline" size={14} color={colors.text} />
                  </View>
                  <Text style={styles.progressSectionTitleCompact}>Calorie Intake</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <RangeDropdown value={calorieRange} onChange={setCalorieRange} styles={styles} />
                  <TouchableOpacity onPress={() => onShowCalorieDetails && onShowCalorieDetails()}>
                    <Text style={styles.seeAllBtnSmall}>See all</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.chartCardCompact}>
                {(() => {
                  const uniqueLogs = calorieData.dailyCalData;
                  const hasData = calorieData.hasLoggedCal;
                  const hasMultiple = hasData && uniqueLogs.length >= 2;
                  const lastMeal = calorieData.rangeMeals.length > 0 ? calorieData.rangeMeals[0] : null;
                  const orderedLogs = uniqueLogs.slice().reverse();
                  const chartData = orderedLogs.map(d => d.calories);
                  const chartLabels = calorieData.buildLabels(orderedLogs);
                  const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
                  const CHART_H = 140;
                  const dataMax = chartData.length ? Math.max(...chartData) : 0;
                  const axisMax = Math.max(dataMax, dailyCalorieGoal > 0 ? dailyCalorieGoal : 0, 1) * 1.1;

                  return (
                    <>
                      <View style={{ overflow: 'hidden', position: 'relative' }}>
                        {hasMultiple ? (
                          <>
                          <View style={{ height: CHART_H, marginTop: 10 }}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                              {chartData.map((value, i) => {
                                const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                                return (
                                  <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    activeOpacity={0.7}
                                    onPress={() => setCalTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                                  >
                                    <View style={{
                                      width: '100%', height: barH, borderRadius: 2,
                                      backgroundColor: '#EF4444',
                                    }} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row' }}>
                            {chartLabels.map((label, i) => (
                              <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                            ))}
                          </View>
                          {calTooltip && (
                            <View style={styles.stepsTooltipCentered} pointerEvents="none">
                              <Text style={styles.chartTooltipText}>{calTooltip.value.toLocaleString()} cal</Text>
                              {calTooltip.date && (
                                <Text style={styles.chartTooltipSub}>{calorieData.formatLabel(calTooltip.date)}</Text>
                              )}
                            </View>
                          )}
                          </>
                        ) : (
                          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={styles.chartPlaceholderText}>{hasData ? `${orderedLogs[orderedLogs.length - 1].calories} cal` : 'No calorie data'}</Text>
                            <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more meals to see trends' : 'Log a meal to start'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.calorieStatsRow}>
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{calorieData.isLongRange ? (calorieData.avgMonthlyCal > 0 ? calorieData.avgMonthlyCal.toLocaleString() : '--') : (calorieData.avgDailyCal > 0 ? calorieData.avgDailyCal.toLocaleString() : '--')}</Text>
                          <Text style={styles.calorieStatLabel}>{calorieData.isLongRange ? 'Avg monthly cal' : 'Avg daily cal'}</Text>
                        </View>
                        <View style={styles.calorieStatDivider} />
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{lastMeal ? lastMeal.calories.toLocaleString() : '--'}</Text>
                          <Text style={styles.calorieStatLabel}>Last log</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>

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
              {burnout.daysToCrash != null && (
                <View style={styles.nextWeekRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextWeekTitle}>Estimated crash risk window</Text>
                    <Text style={styles.nextWeekNote}>
                      {burnout.daysToCrash === 0
                        ? "Your score is already in Critical territory — this isn't a forecast, it's where you are right now."
                        : `Your risk score has been climbing — at that rate, off-plan eating or a crash-out becomes likely around ${fmtShort(burnout.crashDate)}, ${burnout.daysToCrash} day${burnout.daysToCrash === 1 ? '' : 's'} out, if nothing changes.`}
                    </Text>
                  </View>
                  <View style={[styles.nextWeekBadge, { backgroundColor: burnoutBg }]}>
                    <Text style={[styles.nextWeekBadgeText, { color: burnoutColor }]}>{burnout.daysToCrash === 0 ? 'Now' : `${burnout.daysToCrash}d`}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Hydration */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="water-outline" size={14} color={colors.text} />
                  </View>
                  <Text style={styles.progressSectionTitleCompact}>Hydration</Text>
                </View>
                <RangeDropdown value={waterRange} onChange={setWaterRange} styles={styles} />
              </View>
              <View style={styles.chartCardCompact}>
                {(() => {
                  const uniqueLogs = waterData.uniqueWater;
                  const hasWaterData = waterData.hasLoggedWater;
                  const hasMultipleWater = hasWaterData && uniqueLogs.length >= 2;
                  const chartData = waterData.waterChartData;
                  const orderedLogs = uniqueLogs.slice().reverse();
                  const chartLabels = waterData.buildLabels(orderedLogs);
                  const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
                  const CHART_H = 140;
                  const dataMax = chartData.length ? Math.max(...chartData) : 0;
                  const axisMax = Math.ceil(dataMax) || 1;

                  return (
                    <>
                      <View style={{ overflow: 'hidden', position: 'relative' }}>
                        {hasMultipleWater ? (
                          <>
                          <View style={{ height: CHART_H, marginTop: 10 }}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                              {chartData.map((value, i) => {
                                const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                                return (
                                  <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    activeOpacity={0.7}
                                    onPress={() => setWaterTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                                  >
                                    <View style={{
                                      width: '100%', height: barH, borderRadius: 2,
                                      backgroundColor: '#0EA5E9',
                                    }} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row' }}>
                            {chartLabels.map((label, i) => (
                              <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                            ))}
                          </View>
                          {waterTooltip && (
                            <View style={styles.stepsTooltipCentered} pointerEvents="none">
                              <Text style={styles.chartTooltipText}>{waterTooltip.value} L</Text>
                              {waterTooltip.date && (
                                <Text style={styles.chartTooltipSub}>{waterData.formatLabel(waterTooltip.date)}</Text>
                              )}
                            </View>
                          )}
                          </>
                        ) : (
                          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={styles.chartPlaceholderText}>{hasWaterData ? `${waterData.avgWaterL} L` : 'No hydration data'}</Text>
                            <Text style={styles.chartPlaceholderSubtext}>{hasWaterData ? 'Log more to see trends' : 'Log water to start'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.calorieStatsRow}>
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{hasWaterData ? `${waterData.avgWaterL} L` : '--'}</Text>
                          <Text style={styles.calorieStatLabel}>{waterData.isLongRange ? 'Avg monthly' : 'Avg daily'}</Text>
                        </View>
                        <View style={styles.calorieStatDivider} />
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{hasWaterData ? waterData.waterGoalMet : '--'}</Text>
                          <Text style={styles.calorieStatLabel}>Goal met</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
                <View style={styles.weightActionsCompact}>
                  <TouchableOpacity style={[styles.weightActionBtnCompact, { backgroundColor: '#0EA5E9', shadowColor: 'rgba(14, 165, 233, 1)' }]} onPress={() => onShowHydrationDetails && onShowHydrationDetails()}>
                    <Text style={styles.weightActionBtnText}>Log water</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowHydrationDetails && onShowHydrationDetails()}>
                    <Text style={styles.weightActionLinkText}>View all logs</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Steps */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="footsteps-outline" size={14} color={colors.text} />
                  </View>
                  <Text style={styles.progressSectionTitleCompact}>Steps</Text>
                </View>
                <RangeDropdown value={stepsRange} onChange={setStepsRange} styles={styles} />
              </View>
              <View style={styles.chartCardCompact}>
                {(() => {
                  const uniqueLogs = stepsData.uniqueSteps;
                  const hasStepsData = stepsData.hasLoggedSteps;
                  const hasMultipleSteps = hasStepsData && uniqueLogs.length >= 2;
                  const chartData = stepsData.stepsChartData;
                  const orderedLogs = uniqueLogs.slice().reverse();
                  const chartLabels = stepsData.buildLabels(orderedLogs);
                  const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
                  const CHART_H = 140;
                  const dataMax = chartData.length ? Math.max(...chartData) : 0;
                  const axisMax = Math.ceil(dataMax / 1000) * 1000 || 1000;

                  return (
                    <>
                      <View style={{ overflow: 'hidden', position: 'relative' }}>
                        {hasMultipleSteps ? (
                          <>
                          <View style={{ height: CHART_H, marginTop: 10 }}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                              {chartData.map((value, i) => {
                                const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                                return (
                                  <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    activeOpacity={0.7}
                                    onPress={() => setStepsTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                                  >
                                    <View style={{
                                      width: '100%', height: barH, borderRadius: 2,
                                      backgroundColor: '#fb923c',
                                    }} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row' }}>
                            {chartLabels.map((label, i) => (
                              <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                            ))}
                          </View>
                          {stepsTooltip && (
                            <View style={styles.stepsTooltipCentered} pointerEvents="none">
                              <Text style={styles.chartTooltipText}>{stepsTooltip.value.toLocaleString()} steps</Text>
                              {stepsTooltip.date && (
                                <Text style={styles.chartTooltipSub}>{stepsData.formatLabel(stepsTooltip.date)}</Text>
                              )}
                            </View>
                          )}
                          </>
                        ) : (
                          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={styles.chartPlaceholderText}>{hasStepsData ? `${stepsData.avgSteps.toLocaleString()} steps` : 'No steps data'}</Text>
                            <Text style={styles.chartPlaceholderSubtext}>{hasStepsData ? 'Log more to see trends' : 'Log steps to start'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.calorieStatsRow}>
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{hasStepsData ? stepsData.avgSteps.toLocaleString() : '--'}</Text>
                          <Text style={styles.calorieStatLabel}>{stepsData.isLongRange ? 'Avg monthly' : 'Avg daily'}</Text>
                        </View>
                        <View style={styles.calorieStatDivider} />
                        <View style={styles.calorieStatItem}>
                          <Text style={styles.calorieStatValue}>{hasStepsData ? stepsData.stepsGoalMet : '--'}</Text>
                          <Text style={styles.calorieStatLabel}>Goal met</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
                <View style={styles.weightActionsCompact}>
                  <TouchableOpacity style={[styles.weightActionBtnCompact, { backgroundColor: '#F97316', shadowColor: 'rgba(249, 115, 22, 1)' }]} onPress={() => onShowStepsDetails && onShowStepsDetails()}>
                    <Text style={styles.weightActionBtnText}>Log steps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowStepsDetails && onShowStepsDetails()}>
                    <Text style={styles.weightActionLinkText}>View all logs</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Activities — "Log an activity" now mirrors the meal check-in tap-to-add card */}
            <View style={styles.progressSectionCompact}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="barbell-outline" size={14} color={colors.text} />
                </View>
                <Text style={styles.progressSectionTitleCompact}>Activities</Text>
              </View>
              <View style={styles.chartCardCompact}>
                <TouchableOpacity style={styles.activityCheckInRow} onPress={() => onShowAddActivity && onShowAddActivity()} activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="barbell-outline" size={22} color="#F97316" />
                    <Text style={styles.activityCheckInText}>Log today's activity</Text>
                  </View>
                  <View style={styles.activityCheckInAddBtn}>
                    <Ionicons name="add" size={22} color="#fff" />
                  </View>
                </TouchableOpacity>

                <Text style={styles.weekActivitySubtitle}>Days you logged an activity this week</Text>
                <View style={styles.weekDots}>
                  {WEEK_DAY_LABELS.map((label, i) => (
                    <View key={i} style={styles.weekDay}>
                      <View style={[
                        styles.weekDot,
                        {
                          backgroundColor: streakData.weekActivityHistory[i] === true ? '#F97316' : 'rgba(249,115,22,0.06)',
                          borderWidth: streakData.weekActivityHistory[i] === false ? 2 : 0,
                          borderColor: 'rgba(249,115,22,0.25)',
                        },
                      ]}>
                        {streakData.weekActivityHistory[i] === true && <Text style={styles.weekDotCheck}>{'✓'}</Text>}
                      </View>
                      <Text style={styles.weekDayLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {streakData.weekActivities.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={styles.chartPlaceholderText}>No activities logged this week</Text>
                    <Text style={styles.chartPlaceholderSubtext}>Log a walk, run, or workout to start</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginTop: 14 }}>
                    {streakData.weekActivities.map((a) => {
                      const icon = a.type === 'walking' ? 'walk-outline' : a.type === 'running' ? 'body-outline'
                        : a.type === 'cycling' ? 'bicycle-outline' : a.type === 'swimming' ? 'water-outline'
                        : a.type === 'strength' ? 'barbell-outline' : a.type === 'sports' ? 'football-outline' : 'ellipsis-horizontal-circle-outline';
                      const parts = [`${a.durationMin} min`];
                      if (a.distance) parts.push(`${a.distance} ${a.distanceUnit || 'km'}`);
                      if (a.estimatedCalories) parts.push(`~${a.estimatedCalories} kcal`);
                      return (
                        <View key={a.id} style={styles.activityRow}>
                          <View style={styles.activityIconWrap}>
                            <Ionicons name={icon} size={16} color="#F97316" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activityName}>{a.name}{a.sessionType ? ` · ${a.sessionType}` : ''}</Text>
                            <Text style={styles.activityMeta}>{parts.join(' · ')}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowActivityLog && onShowActivityLog()}>
                  <Text style={[styles.weightActionLinkText, { color: '#F97316' }]}>View all logs</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 100 }} />
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
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{momentumWhySentences.calorieSentence}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>SATIETY — 35%</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.satiety.subscore}%</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{burnoutWhy}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>MOVEMENT — 25%</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.movement.subscore != null ? `${momentumWhy.movement.subscore}%` : '--'}</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{momentumWhySentences.movementSentence}</Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
  // ── Shared wrapper/header (from Insights) ──────────────────────────────
  wrapper: { flex: 1, backgroundColor: c.bg },
  headerCompact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.text },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { flex: 1 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 12 },
  cardTitleSmall: { fontSize: 13.5, fontWeight: '700' },
  gaugeCenter: { position: 'absolute', left: 0, right: 0, top: 44, alignItems: 'center', gap: 2 },
  gaugeKicker: { color: c.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4 },
  gaugeScore: { color: c.text, fontSize: 40, fontWeight: '800' },
  pill: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14, marginTop: -2 },
  pillText: { fontSize: 12, fontWeight: '700' },
  mutedSmall: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 },
  nudgeBox: { backgroundColor: WARN_BG, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10 },
  nudgeBoxUrgent: { backgroundColor: DANGER_BG },
  nudgeText: { color: '#A8811F', fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  nudgeTextUrgent: { color: '#B91C1C' },
  strongSmall: { color: c.text, fontSize: 10.5, fontWeight: '700' },
  mutedBody: { color: c.textSecondary, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: c.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  bigStat: { color: c.text, fontSize: 19, fontWeight: '800' },
  bigStatSub: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chartInfoRow: { minHeight: 16, marginTop: 6, alignItems: 'center' },
  chartInfoText: { color: c.textMuted, fontSize: 11, fontWeight: '600' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  axisLabel: { color: c.textMuted, fontSize: 10, fontWeight: '600' },
  detailsBtn: { marginTop: 10, backgroundColor: c.cardAlt, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsBtnText: { color: c.accentText, fontSize: 12.5, fontWeight: '700' },
  warnDot: { width: 22, height: 22, borderRadius: 7, backgroundColor: WARN, alignItems: 'center', justifyContent: 'center' },
  dismissBtn: { marginTop: 12, backgroundColor: c.card, borderWidth: 1, borderColor: '#FCE3CB', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  burnoutWeekRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginTop: 16 },
  burnoutDayCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  burnoutDayScore: { fontSize: 12, fontWeight: '800' },
  burnoutBar: { width: '100%', borderRadius: 8 },
  progressTrack: { height: 10, backgroundColor: c.cardAlt, borderRadius: 5, marginTop: 16, marginBottom: 8, overflow: 'visible' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  planMarker: { position: 'absolute', top: -5, width: 2, height: 20, borderRadius: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  nextWeekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  nextWeekTitle: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  nextWeekNote: { color: c.textSecondary, fontSize: 11.5, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  nextWeekBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nextWeekBadgeText: { fontSize: 14.5, fontWeight: '800' },
  statLabel: { color: c.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  statValue: { color: c.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  recRow: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center' },
  recTitle: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  recSub: { color: c.textSecondary, fontSize: 12, fontWeight: '500', marginTop: 2 },
  whyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.border },
  whyRowLabel: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  whyRowDetail: { color: c.textSecondary, fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  whyRowPts: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },

  // ── Range picker (new) — matches the small anchored dropdown style already used for the
  // range picker on the Hydration Log page (dropdownWrap/dropdownBtn/dropdownMenu there).
  rangeDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(5,150,105,0.08)',
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)',
    borderRadius: 8,
  },
  rangeDropdownBtnText: { color: '#059669', fontSize: 12, fontWeight: '600' },
  rangeDropdownMenu: {
    position: 'absolute',
    backgroundColor: c.card, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.1)',
    minWidth: 120,
  },
  rangeDropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  rangeDropdownItemActive: { backgroundColor: 'rgba(5,150,105,0.08)' },
  rangeDropdownItemText: { fontSize: 13, color: c.textSecondary },
  rangeDropdownItemTextActive: { color: '#059669', fontWeight: '700' },

  // ── Activities check-in-style add row (new) ─────────────────────────────
  activityCheckInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.cardAlt, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', marginBottom: 14,
  },
  activityCheckInText: { fontSize: 13.5, color: c.text, fontWeight: '600' },
  activityCheckInAddBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F97316',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── From Progress ────────────────────────────────────────────────────────
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: c.cardAlt, borderRadius: 12,
  },
  activityIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  activityName: { fontSize: 13, fontWeight: '700', color: c.text },
  activityMeta: { fontSize: 11.5, color: c.textMuted, marginTop: 1 },
  weekActivitySubtitle: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  weekDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  weekDotCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  weekDayLabel: { fontSize: 11, fontWeight: '500', color: c.textMuted },
  progressContentCompact: {
    flex: 1,
    paddingHorizontal: 16,
  },
  progressSectionCompact: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  progressSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  // Fixed-size centering box for section-header icons — different Ionicons glyphs (flame,
  // water, footsteps, barbell) carry different internal padding within their own bounding box
  // even at the same `size`, so identical alignItems:'center' rows could still render each
  // glyph sitting at a slightly different visual height next to the title text. Wrapping every
  // one in the same fixed box normalizes that away instead of nudging each icon individually.
  sectionIconBox: {
    width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  progressSectionTitleCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
    marginBottom: 8,
  },
  seeAllBtnSmall: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  chartCardCompact: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  chartTooltip: {
    position: 'absolute',
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
    zIndex: 20,
  },
  chartTooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  chartTooltipSub: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 1,
  },
  stepsAxisLabel: {
    fontSize: 9,
    color: '#b3b9c4',
    fontWeight: '400',
  },
  stepsTooltipCentered: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    zIndex: 20,
  },
  streaksGridFour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakItemCompact: {
    flex: 1,
    alignItems: 'center',
  },
  streakValueCompact: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
  },
  streakLabelCompact: {
    fontSize: 9,
    color: c.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  bmiDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bmiValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bmiValue: {
    fontSize: 32,
    fontWeight: '700',
    color: c.text,
  },
  bmiCategoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
  },
  bmiCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  bmiWeightInfo: {
    alignItems: 'flex-end',
  },
  bmiWeightLabel: {
    fontSize: 10,
    color: c.textSecondary,
  },
  bmiWeightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  bmiBarContainer: {
    marginTop: 8,
  },
  bmiBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  bmiBarSegment: {
    height: 10,
  },
  bmiIndicator: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    backgroundColor: c.cardAlt,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bmiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bmiLabel: {
    fontSize: 8,
    color: c.textMuted,
    textAlign: 'center',
    flex: 1,
  },
  chartPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  chartPlaceholderSubtext: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 4,
  },
  weightStatsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  weightStatCompact: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  weightStatValueCompact: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  weightStatLabelCompact: {
    fontSize: 9,
    color: c.textSecondary,
    marginTop: 2,
  },
  weightActionsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  weightActionBtnCompact: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
    alignItems: 'center',
  },
  weightActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  weightActionLinkCompact: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 8,
    alignItems: 'center',
  },
  weightActionLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  calorieStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 20,
  },
  calorieStatItem: {
    alignItems: 'center',
  },
  calorieStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  calorieStatLabel: {
    fontSize: 10,
    color: c.textMuted,
  },
  calorieStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
  },
});

export default ProgressTab;
