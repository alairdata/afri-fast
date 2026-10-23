import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform, Modal } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme';
import { LineChart } from 'react-native-chart-kit';
import { computeMomentumTimeline, MET, MIN_LOGGED_DAYS } from '../lib/momentum';
import { computeWeeklyPace, estimateChangeSinceWeighInKg, scaleTrendWeekly, blendWeeklyRate, findOddWeighIns } from '../lib/trajectory';
import { computeObservedTdee } from '../lib/observedTdee';
import { computeBurnoutTimeline } from '../lib/burnout';
import { publishBurnoutSummary } from '../lib/smartNotifications';
import { getAiText, getDismissedFingerprints, dismissInsight } from '../lib/insightText';
import { fetchSavedBurnoutDays, saveBurnoutDay } from '../lib/burnoutHistory';
import { savePredictionSnapshot } from '../lib/predictionHistory';
import { saveBurnoutPredictionSnapshot } from '../lib/burnoutPredictionHistory';
import { computeCurrentMealStreak } from '../lib/mealStreak';
import { buildDailyLedgerMap, resolveCalorieGoal, resolveCaloriesEaten } from '../lib/goalHistory';
import { getCachedMomentumWhy, getMomentumWhy } from '../lib/momentumWhy';
import { SourcesLink } from './HealthSourcesPage';
import InfoTip from './InfoTip';
import RiveMomentum from './RiveMomentum';
import { useSubscription } from '../lib/subscription';
import { LockedChartPreview, unlock } from './ProLock';
import { BlurView } from 'expo-blur';
import HeaderFade from './HeaderFade';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WARN = '#F59E0B';
const DANGER = '#EF4444';
const WARN_BG = '#FFF7ED';
const WEEK_AHEAD_LEVELS = {
  low: { label: 'Low risk', bg: '#D1FAE5', color: '#047857' },
  watch: { label: 'Worth watching', bg: '#FEF3C7', color: '#B45309' },
  high: { label: 'Higher risk', bg: '#FFEDD5', color: '#C2410C' },
  none: { label: 'No pattern yet', bg: '#F3F4F6', color: '#6B7280' },
};

// Seven rounded bars on a grey track (Calories, Hydration, Steps on Insights), oldest day first.
const PillBars = ({ values, max, letters, color, styles, label }) => (
  <View style={{ flex: 1, gap: 6 }} accessible accessibilityLabel={label}>
    <View style={{ height: 160, flexDirection: 'row', gap: 8 }}>
      {values.map((v, i) => (
        <View key={i} style={styles.pillTrack}>
          <View style={{ width: '100%', height: `${Math.round(Math.min(1, (v || 0) / (max || 1)) * 100)}%`, borderRadius: 999, backgroundColor: color }} />
        </View>
      ))}
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {letters.map((l, i) => <Text key={i} style={styles.pillLetter}>{l}</Text>)}
    </View>
  </View>
);
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
const ACTIVE_DAY_STEPS = 5000;
const getWeekActivityData = (activities, stepLogs) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const loggedDates = new Set((activities || []).map(a => a.date));
  // A day also counts as active when its steps total 5k+, even with no logged activity.
  const stepsByDate = {};
  (stepLogs || []).forEach(s => { stepsByDate[s.date] = (stepsByDate[s.date] || 0) + (s.steps || 0); });
  const weekActivityHistory = WEEK_DAY_LABELS.map((_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    if (day > today) return null;
    const ds = day.toDateString();
    return loggedDates.has(ds) || (stepsByDate[ds] || 0) >= ACTIVE_DAY_STEPS;
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
function buildGauge(score, accent, muted = false) {
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
    segments.push({ d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, stroke: muted ? '#e5e7eb' : `rgb(${c[0]},${c[1]},${c[2]})` });
  }
  const rad = ((180 + (score / 100) * 180) * Math.PI) / 180, iR = r - 13, oR = r + 13;
  return {
    segments,
    needle: muted ? null : { x1: cx + iR * Math.cos(rad), y1: cy + iR * Math.sin(rad), x2: cx + oR * Math.cos(rad), y2: cy + oR * Math.sin(rad) },
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
  // Apple Health (steps): when it isn't connected, the Steps chart is blurred with a Connect button on it
  appleHealthAvailable = false, appleHealthOn = false, onConnectAppleHealth,
  // Shared data
  fastingSessions = [], recentMeals = [], weightLogs = [], waterLogs = [], stepLogs = [], activities = [], checkInHistory = [],
  height = '', heightUnit = 'cm', weightUnit = 'kg', volumeUnit = 'oz', targetWeight = null, startingWeight = null,
  dailyCalorieGoal = 2000, hydrationGoal = 0, stepGoal = 10000, goalHistory = [], dailyGoalLedger = [],
  // Insights-only data (profile/goal fields the momentum/burnout/pace engines need)
  userId = null, userName = '', goalDate = null, userJoinDate = null, age = null, sex = null,
  activityLevel = null, pacePreference = null, proteinGoal = null, carbsGoal = null, fatsGoal = null,
  // Lumi's voice (onboarding): the AI texts here are written in it, and a new voice means new texts.
  coachTone = null,
}) => {
  const { isPro } = useSubscription();
  const [healthConnecting, setHealthConnecting] = useState(false);
  const needsHealth = appleHealthAvailable && !appleHealthOn;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  // Precomputed daily_goal_ledger, keyed for O(1) lookup by date -- see lib/goalHistory.js.
  const ledgerMap = useMemo(() => buildDailyLedgerMap(dailyGoalLedger), [dailyGoalLedger]);
  const [view, setView] = useState('main');
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

    // Weight -- a day with several logs shows the LATEST one (a second entry is usually a correction, and
    // averaging 111 and 105 into 108 hid it), then carry-forward fill gaps.
    const weightsByDate = {};
    rangeWeights.forEach(w => {
      const key = new Date(w.timestamp || w.date).toDateString();
      const ts = w.timestamp || new Date(w.date).getTime();
      if (!weightsByDate[key] || ts >= weightsByDate[key].ts) weightsByDate[key] = { ...w, ts, weight: parseFloat(Number(w.weight).toFixed(1)) };
    });
    const uniqueWeights = fillDaysCarryForward(weightsByDate, 'weight', days);
    const weightChartData = uniqueWeights.slice().reverse().map(w => w.weight);
    const hasLoggedWeight = uniqueWeights.some(w => !w.carried);
    const totalCal = rangeMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const calDaysCount = loggedCalDays.length; // real logged days only, not the zero-filled gaps
    // The target each of those same days had (not today's), so "vs target" lines up with "Avg daily cal".
    const goalSum = loggedCalDays.reduce((sum, d) => sum + (resolveCalorieGoal(ledgerMap, goalHistory, d.date, dailyCalorieGoal) || 0), 0);
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
      avgDailyGoal: calDaysCount > 0 ? Math.round(goalSum / calDaysCount) : 0,
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
      ...getWeekActivityData(activities, stepLogs),
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

    // Graded against the daily_goal_ledger's precomputed eaten/goal for that day (falling back
    // to a live computation only for a day the ledger hasn't caught up to yet) -- not today's
    // live goal, otherwise changing your goal retroactively repaints old days as on/off target.
    const daysOnTarget = [...loggedDates].filter(date => {
      const liveTotal = (recentMeals || []).filter(m => m.date === date).reduce((s, m) => s + (m.calories || 0), 0);
      const total = resolveCaloriesEaten(ledgerMap, date, liveTotal);
      const dayGoal = resolveCalorieGoal(ledgerMap, goalHistory, date, dailyCalorieGoal);
      const ratio = dayGoal > 0 ? total / dayGoal : 0;
      return ratio >= 0.7 && ratio <= 1.15;
    }).length;

    return { bestStreak, daysOnTarget, totalDaysLogged: loggedDates.size };
  }, [recentMeals, dailyCalorieGoal, goalHistory, ledgerMap]);
  const weightData = getRangeData(weightRange === 'All time'
    ? daysSinceEarliest(weightLogs, w => w.timestamp || new Date(w.date).getTime())
    : RANGE_DAYS[weightRange]);
  // Weight lost (or gained) so far this calendar month: from the last weigh-in before the 1st (or the
  // first weigh-in of the month if there wasn't one) to the latest. Independent of the range picker,
  // so it reads as "this month", not as an average over the whole weight journey.
  const monthWeightChange = (() => {
    const logs = (weightLogs || [])
      .map((w) => ({ ts: w.timestamp || new Date(w.date).getTime(), weight: w.weight }))
      .filter((w) => !Number.isNaN(w.ts) && w.weight != null)
      .sort((a, b) => a.ts - b.ts);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = logs.filter((l) => l.ts < monthStart.getTime());
    const inMonth = logs.filter((l) => l.ts >= monthStart.getTime());
    if (!inMonth.length || (!before.length && inMonth.length < 2)) return null;
    const baseline = before.length ? before[before.length - 1].weight : inMonth[0].weight;
    return Math.round((inMonth[inMonth.length - 1].weight - baseline) * 10) / 10;
  })();
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

  // One weigh-in per day: the LAST of the day (a second entry is usually a correction). Counting both
  // 111.7 and a corrected 105 on the same day skewed the weekly rate and the smoothing.
  const sortedWeights = useMemo(() => {
    const byDay = {};
    (weightLogs || [])
      .map((w) => ({ ...w, ts: w.timestamp || new Date(w.date).getTime(), weightKg: toKg(w.weight, weightUnit) }))
      .filter((w) => !isNaN(w.ts) && typeof w.weight === 'number')
      .forEach((w) => {
        const day = new Date(w.ts).toDateString();
        if (!byDay[day] || w.ts >= byDay[day].ts) byDay[day] = w;
      });
    return Object.values(byDay).sort((a, b) => a.ts - b.ts);
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
  // Declared up here (not next to the burnout card code) because effects further up depend on it.
  // Same rule as momentum: a score from a handful of unlogged days is noise, not 'super low risk'.
  // Only finished days count: today (last entry) is still in progress.
  const completedLoggedDays = last7.slice(0, -1).filter((d) => d.total > 0).length;
  const burnoutReady = completedLoggedDays >= MIN_LOGGED_DAYS;
  // Days before the person's first logged meal have nothing to score. The engine gives them 0, which is the
  // BEST possible burnout score, so showing it would read as 'no risk' rather than 'no data'. Treat them as blank.
  const firstMealTs = (recentMeals || []).reduce((min, m) => {
    if (!(m.calories > 0)) return min;
    const ts = new Date(m.date).getTime();
    return isNaN(ts) ? min : Math.min(min, ts);
  }, Infinity);
  const beforeFirstMeal = (date) => {
    if (firstMealTs === Infinity) return true;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() < firstMealTs;
  };
  const missingDays = 7 - loggedDays.length;
  const todayCalories = last7[last7.length - 1]?.total || 0;
  const deficitToday = tdee != null ? tdee - todayCalories : null;

  // The scale's own trend (last 28 days, one weight per day, odd readings ignored). See trajectory.js.
  const scaleTrend = useMemo(() => scaleTrendWeekly(sortedWeights, now), [sortedWeights, now]);
  const oddWeighIns = useMemo(() => findOddWeighIns(sortedWeights, now), [sortedWeights, now]);


  // Momentum Score — EWMA-smoothed engine (see src/lib/momentum.js): 40% Calorie + 35% Satiety
  // (= 100 - that day's Burnout risk) + 25% Movement.
  const momentumTimeline = useMemo(() => computeMomentumTimeline({
    weightLogs, recentMeals, waterLogs, stepLogs, activities,
    dailyCalorieGoal, goalHistory, ledgerMap, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal,
    fallbackWeightKg: currentWeightKg,
    toKg: (w) => toKg(w, weightUnit),
    now,
  }), [weightLogs, recentMeals, waterLogs, stepLogs, activities, dailyCalorieGoal, goalHistory, ledgerMap, tdee, bmr, pacePreference, proteinGoal, carbsGoal, fatsGoal, currentWeightKg, weightUnit, now]);

  const today = momentumTimeline[momentumTimeline.length - 1];
  const momentumScore = today.momentum;
  // Not enough logged days yet -> no verdict (a brand-new person is not "stalled", they just haven't started).
  const momentumReady = !!today.ready;
  const momentumLabel = !momentumReady ? 'Not enough data yet'
    : today.band.label === 'STRONG' ? 'Strong momentum' : today.band.label === 'DRIFTING' ? 'Drifting' : 'Stalled';
  const momentumColor = !momentumReady ? colors.textMuted : today.band.tone === 'strong' ? accent : today.band.tone === 'drifting' ? WARN : DANGER;
  const momentumBg = !momentumReady ? colors.border : today.band.tone === 'strong' ? colors.accentLight : today.band.tone === 'drifting' ? WARN_BG : DANGER_BG;

  const gauge = useMemo(() => buildGauge(momentumScore, accent, !momentumReady), [momentumScore, accent, momentumReady]);

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

  // Where the forecast and the Prediction chart start. After more than a week without a weigh-in, the
  // smoothed weight is stale, so it's moved by what the food logged since then suggests, and a note says so.
  // The latest real weigh-in, not the smoothed weight: the smoothing blends a new reading with older ones, so
  // logging 105 after 111 left the forecast near 110 (it stays in the momentum score and trends instead).
  const baseAnchorKg = currentWeightKg != null ? currentWeightKg : today.weightEwmaKg;
  // Between weigh-ins the weight is carried forward day by day from the food and activity logged since
  // (unlogged days follow their usual pattern), so someone without a scale still sees a close estimate.
  const lastWeighIn = sortedWeights.length ? sortedWeights[sortedWeights.length - 1] : null;
  const daysSinceWeighIn = Number.isFinite(today.daysSinceWeighIn) ? today.daysSinceWeighIn : null;
  const sinceWeighIn = useMemo(() => (daysSinceWeighIn == null ? null : estimateChangeSinceWeighInKg({
    tdee, bmr, recentMeals, activityKcalByDate: activityKcalLast7ByDate, daysSinceWeighIn, now,
  })), [daysSinceWeighIn, tdee, bmr, recentMeals, activityKcalLast7ByDate, now]);
  const anchorKg = baseAnchorKg != null && sinceWeighIn != null ? baseAnchorKg + sinceWeighIn.kg : baseAnchorKg;
  const lastWeighInLabel = lastWeighIn ? fmtDayMonth(new Date(lastWeighIn.ts)) : null;
  const staleWeighInNote = sinceWeighIn != null && lastWeighIn
    ? `Estimated ${fromKg(anchorKg, weightUnit).toFixed(1)} ${weightUnit} today: your weigh-in on ${lastWeighInLabel}, carried forward with ${sinceWeighIn.loggedDays} logged ${sinceWeighIn.loggedDays === 1 ? 'day' : 'days'}${sinceWeighIn.estimatedDays ? ` and ${sinceWeighIn.estimatedDays} ${sinceWeighIn.estimatedDays === 1 ? 'day' : 'days'} from your usual pattern` : ''}.${daysSinceWeighIn > 7 ? ' Weigh in when you can to sharpen it.' : ''}`
    : daysSinceWeighIn != null && daysSinceWeighIn > 7
      ? `Based on your weigh-in from ${daysSinceWeighIn} days ago. Log your meals or weigh in for a sharper forecast.`
      : null;

  // Weekly Pace & Trajectory Engine — purely calorie-driven.
  const weeklyPace = useMemo(() => computeWeeklyPace({
    tdee, bmr, recentMeals, pacePreference,
    weightEwmaTodayKg: anchorKg,
    confidence: today.confidence,
    daysSinceWeighIn: today.daysSinceWeighIn,
    activityKcalByDate: activityKcalLast7ByDate,
    now,
  }), [tdee, bmr, recentMeals, pacePreference, today, anchorKg, activityKcalLast7ByDate, now]);

  // The one "per week" number: the scale trend only as far as the weigh-ins earn it, the food-based
  // estimate (already calibrated by past weigh-ins) for the rest, so rare weighers still get a fair rate.
  const weeklyRate = useMemo(() => blendWeeklyRate({
    scaleTrend,
    foodRateKg: weeklyPace.dailyRateKg != null ? weeklyPace.dailyRateKg * 7 : null,
    bodyKg: anchorKg,
  }), [scaleTrend, weeklyPace, anchorKg]);
  const weeklyWeightChangeKg = weeklyRate ? weeklyRate.rateKg : null;
  const deviationKg = (weeklyWeightChangeKg != null && requiredWeeklyRateKg != null)
    ? weeklyWeightChangeKg - requiredWeeklyRateKg
    : null;

  const trajectory = useMemo(() => {
    if (deviationKg == null || !requiredWeeklyRateKg) return null;
    const ratio = deviationKg / Math.abs(requiredWeeklyRateKg);
    if (ratio <= -0.001) return { label: 'Ahead of Pace', color: accent, bg: colors.accentLight };
    if (ratio <= 0.10) return { label: 'On Track', color: accent, bg: colors.accentLight };
    if (ratio <= 0.30) return { label: 'Drifting', color: WARN, bg: WARN_BG };
    return { label: 'Stalled', color: DANGER, bg: DANGER_BG };
  }, [deviationKg, requiredWeeklyRateKg, accent, colors.accentLight]);

  // Forecast shares the same energy-deficit engine as the This Week chart (weeklyPace).
  // The change in each forecast is the exact same energy maths as the Energy balance card (calories
  // alone, rate x days), so the two always agree. The absolute weights start from the smoothed weight.
  const forecastDelta = (days) => {
    const kg = (weeklyPace.dailyRateKg || 0) * days;
    return `${kg <= 0 ? '-' : '+'}${Math.abs(fromKg(kg, weightUnit)).toFixed(2)} ${weightUnit}`;
  };
  const forecastAnchorNote = staleWeighInNote;
  // Forecast lands on the three Saturdays AFTER this week's: this Saturday is the Prediction card's job, so the
  // two cards never repeat a number, and both use the same Saturday week end.
  const toSat = 6 - new Date(now).getDay();
  const FORECAST_DAYS = [toSat + 7, toSat + 14, toSat + 21];
  const projected3Kg = weeklyPace.projectDay(FORECAST_DAYS[0])?.projectedKg ?? null;
  const projected7Kg = weeklyPace.projectDay(FORECAST_DAYS[1])?.projectedKg ?? null;
  const projected14Kg = weeklyPace.projectDay(FORECAST_DAYS[2])?.projectedKg ?? null;

  const projectedGoalDate = useMemo(() => {
    if (anchorKg == null || targetWeightKg == null || !weeklyPace.dailyRateKg) return null;
    const remainingKg = targetWeightKg - anchorKg;
    const dailyRateKg = weeklyPace.dailyRateKg;
    if ((remainingKg < 0 && dailyRateKg >= 0) || (remainingKg > 0 && dailyRateKg <= 0)) return null;
    const daysNeeded = remainingKg / dailyRateKg;
    if (!isFinite(daysNeeded) || daysNeeded <= 0) return null;
    return new Date(now + daysNeeded * DAY_MS);
  }, [anchorKg, targetWeightKg, weeklyPace, now]);

  const confidence = today.confidence >= 0.85 ? 'High' : today.confidence >= 0.5 ? 'Medium' : 'Low';
  const confidenceColor = confidence === 'High' ? accent : confidence === 'Medium' ? WARN : DANGER;
  const confidenceBg = confidence === 'High' ? colors.accentLight : confidence === 'Medium' ? WARN_BG : DANGER_BG;

  const pace = useMemo(() => {
    if (startingWeightKg == null || targetWeightKg == null || currentWeightKg == null) return null;
    const totalGapKg = Math.abs(startingWeightKg - targetWeightKg);
    if (totalGapKg < 0.05) return null;
    const togoKg = Math.abs(targetWeightKg - currentWeightKg);
    if (togoKg < 0.05) return { done: true };
    if (weeklyWeightChangeKg == null) {
      // Only one weigh-in so far (the one from sign-up counts): estimate from eating instead of
      // asking for more weigh-ins. It gets sharper with every weigh-in.
      const predictedWeekly = weeklyPace && weeklyPace.dailyRateKg != null ? weeklyPace.dailyRateKg * 7 : null;
      if (predictedWeekly != null && projectedGoalDate) {
        const lostEst = Math.abs(currentWeightKg - startingWeightKg);
        return {
          eta: projectedGoalDate,
          pct: Math.min(100, Math.round((lostEst / totalGapKg) * 100)), planPct: null,
          note: 'An estimate that gets sharper as you keep logging.',
          lost: fromKg(lostEst, weightUnit),
          togo: fromKg(togoKg, weightUnit),
          weeklyRate: fromKg(predictedWeekly, weightUnit),
        };
      }
      return { insufficientData: true, needsWeight: (weightLogs || []).length === 0 };
    }

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
    let noteSuffix = '';
    const predictedWeeklyKg = weeklyPace && weeklyPace.dailyRateKg != null ? weeklyPace.dailyRateKg * 7 : null;
    if (weeklyRate?.tooFast) {
      noteSuffix = ' That is faster than about 1% of your body weight a week, which early on is usually water. Expect it to settle.';
    } else if (scaleTrend && predictedWeeklyKg != null && Math.abs(scaleTrend.rateKg - predictedWeeklyKg) > Math.max(0.5, (currentWeightKg || 70) * 0.006)) {
      noteSuffix = scaleTrend.rateKg < predictedWeeklyKg
        ? " Your weight is moving faster than expected. That's often water weight or weigh-in timing, so trust the trend over a few weeks."
        : " Your scale is moving slower than your eating alone suggests. Water and timing can hide progress for a while, so keep going.";
    }
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
      pct, planPct, note: note ? note + noteSuffix : note,
      lost: fromKg(lostKg, weightUnit),
      togo: fromKg(togoKg, weightUnit),
      weeklyRate: fromKg(weeklyWeightChangeKg, weightUnit),
    };
  }, [startingWeightKg, targetWeightKg, currentWeightKg, weeklyWeightChangeKg, weeklyRate, scaleTrend, goalDate, userJoinDate, trajectory, requiredWeeklyRateKg, projectedGoalDate, weightUnit, weeklyPace, now]);

  // Ledger's real eaten total for each day, not the live recompute -- falls back to live only
  // for a day the ledger hasn't caught up to yet. Each day judged against its own day's goal.
  const ledgerLoggedDays = loggedDays.map((d) => ({ ...d, total: resolveCaloriesEaten(ledgerMap, d.ds, d.total) }));
  const spikeDays = ledgerLoggedDays.filter((d) => d.total > resolveCalorieGoal(ledgerMap, goalHistory, d.ds, dailyCalorieGoal) * 1.5);
  const crashDays = ledgerLoggedDays.filter((d) => d.total > 0 && d.total < resolveCalorieGoal(ledgerMap, goalHistory, d.ds, dailyCalorieGoal) * 0.5);

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

  // Hand the burnout trend to the smart-notification planner (used for the "heads up" nudge).
  useEffect(() => {
    if (!userId) return;
    // No score (and no "rough patch" date) goes to notifications or the widget until there is data behind it.
    publishBurnoutSummary({
      daysToCrash: burnoutReady ? burnout.daysToCrash : null,
      crashDate: burnoutReady ? burnout.crashDate : null,
      score: burnoutReady ? burnout.today?.score : null,
    });
  }, [userId, burnoutReady, burnout.daysToCrash, burnout.crashDate, burnout.today?.score]);

  useEffect(() => {
    if (!userId) return;
    // (Days before the first logged meal have no real score, so they are not saved either.)
    const toFinalize = burnout.week.filter((d) => d.isPast && !d.isFinalized && !beforeFirstMeal(d.date));
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
  // Plain-language drivers behind the burnout number. No jargon: these phrases are what the user
  // reads if the AI text isn't available, and also the facts handed to Gemini to word properly.
  const burnoutDrivers = useMemo(() => {
    const t = burnout.today;
    const d = [];
    if (t.deficitPts >= 12) d.push("you've been eating a lot less than your body uses");
    if (t.proteinPts >= 6) d.push("you're low on protein, so you may feel hungry again quickly");
    if (t.waterPts >= 8) d.push("you're drinking less water than you need");
    if (t.carbsPts >= 4) d.push("you're low on carbs, which is your body's quick energy");
    if (t.fiberPts >= 4) d.push("you're low on fibre, so meals don't keep you full for long");
    if (t.fatPts >= 2) d.push("you're low on healthy fats, which can affect mood and sleep");
    if (t.volatilityPts >= 8) d.push('your days are going up and down a lot');
    return d;
  }, [burnout]);
  const burnoutWhy = useMemo(() => {
    if (!burnoutDrivers.length) return 'Your eating, water and day-to-day rhythm all look steady and sustainable this week.';
    const joined = burnoutDrivers.length === 1
      ? burnoutDrivers[0]
      : `${burnoutDrivers.slice(0, -1).join(', ')} and ${burnoutDrivers[burnoutDrivers.length - 1]}`;
    return `This week ${joined}.`;
  }, [burnoutDrivers]);

  const burnoutFacts = useMemo(() => {
    const t = burnout.today;
    return {
      score: t.score,
      band: burnout.today.band?.label,
      whatIsPullingItUp: burnoutDrivers,
      averagesThisWeek: {
        caloriesPerDay: t.avgCalories, proteinGrams: t.avgProtein, proteinTargetGrams: proteinGoal,
        waterMlPerDay: t.avgWaterMl, fibreGrams: t.avgFiber,
      },
      dailyCalorieTarget: dailyCalorieGoal,
      last7Days: last7.map((d) => ({
        weekday: d.date.toLocaleDateString('en-US', { weekday: 'short' }), eatenKcal: Math.round(d.total),
      })),
      roughPatch: burnout.daysToCrash != null && burnout.crashDate
        ? { inDays: burnout.daysToCrash, weekday: burnout.crashDate.toLocaleDateString('en-US', { weekday: 'long' }), date: fmtShort(burnout.crashDate) }
        : null,
    };
  }, [burnout, burnoutDrivers, proteinGoal, dailyCalorieGoal, last7]);
  const burnoutFingerprint = useMemo(() => [
    Math.round(burnout.today.score / 5) * 5,
    burnoutDrivers.join('|'),
    burnout.crashDate ? burnout.crashDate.toDateString() : '',
  ].join('#'), [burnout, burnoutDrivers]);

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

  // "See why" copy — plain, coach-style sentences, not a numbers dump. The score itself already
  // sits right above each sentence in the UI, so these don't restate it; they just say what's
  // actually going on in a few real words. Each has a mild/medium/strong ladder per direction —
  // word choice carries how far off it is instead of a percentage ever being shown.
  const momentumWhySentences = useMemo(() => {
    const c = momentumWhy.calorie;
    const m = momentumWhy.movement;

    let calorieSentence;
    if (!c.loggedToday) {
      calorieSentence = "Nothing logged yet today. We don't punish that — this just holds steady until you're back.";
    } else {
      const ratio = c.targetToday > 0 ? c.loggedToday / c.targetToday : 1;
      if (ratio > 1.8) calorieSentence = "Today was a real outlier for you, calorie-wise. No judgment — just something to notice.";
      else if (ratio > 1.4) calorieSentence = "You went noticeably over today.";
      else if (ratio > 1.15) calorieSentence = "You went a touch over today — it happens. Tomorrow's a clean slate.";
      else if (ratio < 0.15) calorieSentence = "You've barely eaten anything today — that's a real outlier. Your body needs real fuel to keep this sustainable.";
      else if (ratio < 0.3) calorieSentence = "You ate quite a bit less than you need today.";
      else if (ratio < 0.5) calorieSentence = "You ate less than usual today.";
      else calorieSentence = "You're eating right where you want to be today — steady and on track.";
    }

    let movementSentence;
    if (m.targetKcalToday == null) {
      movementSentence = 'Add your age, sex, height, and activity level in Settings so this can actually track you properly.';
    } else {
      const activeKcal = (m.gymKcalToday || 0) + (m.stepsKcalToday || 0);
      const ratio = m.targetKcalToday > 0 ? activeKcal / m.targetKcalToday : 0;
      if (ratio >= 1) movementSentence = 'You crushed your movement today, between your workout and your steps.';
      else if (ratio >= 0.6) movementSentence = "You got some movement in today, but not quite enough to hit where you'd usually land.";
      else if (ratio >= 0.3) movementSentence = "Movement's been light today.";
      else movementSentence = "Barely any movement today — a real outlier for you. Even a short walk would help.";
    }

    return { calorieSentence, movementSentence };
  }, [momentumWhy]);

  // Historical pattern signals — looks back across the same 60-day timeline already computed
  // for the gauge, to describe SHAPE (better/worse than usual, a recurring bounce-back, a
  // weekday that usually runs rough for you) instead of a raw delta or percentage. Every signal
  // here is a plain boolean/category derived from real history; nothing is invented, no AI call.
  const momentumHistory = useMemo(() => {
    const n = momentumTimeline.length;
    const todayEntry = momentumTimeline[n - 1];
    const history = momentumTimeline.slice(0, n - 1); // everything before today

    const yesterdayEntry = history[history.length - 1] || null;
    const vsYesterday = yesterdayEntry
      ? (todayEntry.momentum - yesterdayEntry.momentum >= 6 ? 'better'
        : yesterdayEntry.momentum - todayEntry.momentum >= 6 ? 'worse' : 'same')
      : null;

    // Best-in-a-while: today's score is a clear, unique high among the last 14 days.
    const last14 = momentumTimeline.slice(Math.max(0, n - 14));
    const maxRecent = Math.max(...last14.map((d) => d.momentum));
    const isBestInWhile = last14.length >= 5 && todayEntry.momentum === maxRecent
      && last14.filter((d) => d.momentum === maxRecent).length === 1;

    // vs the trailing 7-day average (excluding today).
    const last7ExclToday = history.slice(Math.max(0, history.length - 7));
    const avgRecent = last7ExclToday.length ? last7ExclToday.reduce((s, d) => s + d.momentum, 0) / last7ExclToday.length : null;
    const vsRecentAvg = avgRecent == null ? null
      : (todayEntry.momentum - avgRecent >= 8 ? 'above' : avgRecent - todayEntry.momentum >= 8 ? 'below' : 'normal');

    // Bounce-back: today follows a STALLED day with a real jump (+15). Counted over the last 7
    // days for the "third time this week" framing.
    const last7 = momentumTimeline.slice(Math.max(0, n - 7));
    let bounceBackCount = 0;
    for (let i = 1; i < last7.length; i++) {
      if (last7[i - 1].band.tone === 'stalled' && last7[i].momentum - last7[i - 1].momentum >= 15) bounceBackCount++;
    }
    const todayIsBounceBack = yesterdayEntry?.band.tone === 'stalled' && todayEntry.momentum - yesterdayEntry.momentum >= 15;

    // Weekday rhythm: historical average momentum for today's specific weekday vs the overall
    // historical average (both excluding today) — "usually strong/weak on [day]".
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    history.forEach((d) => {
      const wd = d.date.getDay();
      byWeekday[wd].sum += d.momentum;
      byWeekday[wd].count += 1;
    });
    const overallAvg = history.length ? history.reduce((s, d) => s + d.momentum, 0) / history.length : null;
    const todayWd = todayEntry.date.getDay();
    const wdStat = byWeekday[todayWd];
    const weekdayAvg = wdStat.count >= 3 ? wdStat.sum / wdStat.count : null;
    const weekdayRhythm = (weekdayAvg == null || overallAvg == null) ? null
      : (overallAvg - weekdayAvg >= 8 ? 'usually-weak' : weekdayAvg - overallAvg >= 8 ? 'usually-strong' : 'typical');
    const heldStrongOnUsuallyWeakDay = weekdayRhythm === 'usually-weak' && todayEntry.momentum >= overallAvg;
    const strongAsUsual = weekdayRhythm === 'usually-strong' && todayEntry.momentum >= weekdayAvg - 5;

    // Weekend dip + recovery pattern.
    const weekendDays = history.filter((d) => [0, 6].includes(d.date.getDay()));
    const weekdayOnlyDays = history.filter((d) => ![0, 6].includes(d.date.getDay()));
    const weekendAvg = weekendDays.length >= 2 ? weekendDays.reduce((s, d) => s + d.momentum, 0) / weekendDays.length : null;
    const weekdayOnlyAvg = weekdayOnlyDays.length >= 2 ? weekdayOnlyDays.reduce((s, d) => s + d.momentum, 0) / weekdayOnlyDays.length : null;
    const hasWeekendDipPattern = weekendAvg != null && weekdayOnlyAvg != null && (weekdayOnlyAvg - weekendAvg) >= 8;
    const todayIsWeekend = [0, 6].includes(todayWd);

    return {
      vsYesterday, isBestInWhile, vsRecentAvg,
      bounceBackCount, todayIsBounceBack,
      weekdayRhythm, heldStrongOnUsuallyWeakDay, strongAsUsual,
      hasWeekendDipPattern, todayIsWeekend,
    };
  }, [momentumTimeline]);

  // Picks the single most specific, interesting pattern to lead with — showing every signal at
  // once would be the same "overwhelming" problem as a numbers dump, just in sentence form.
  const momentumPatternSentence = useMemo(() => {
    const h = momentumHistory;
    if (h.todayIsBounceBack && h.bounceBackCount >= 3) return "Third day this week you've bounced back after a rough one — that's a real pattern, not luck.";
    if (h.todayIsBounceBack) return "You bounced back today after a rough one — that's exactly the recovery that keeps momentum alive.";
    if (h.hasWeekendDipPattern && h.todayIsWeekend) return "You tend to dip on weekends and recover fast — today's no different.";
    if (h.heldStrongOnUsuallyWeakDay) return "This is usually where it gets harder for you, and you held steady.";
    if (h.strongAsUsual) return "Usually a strong day for you — and it was.";
    if (h.isBestInWhile) return "Your steadiest stretch in a while.";
    if (h.vsYesterday === 'better') return 'Better than yesterday.';
    if (h.vsYesterday === 'worse') return 'A little off your usual rhythm.';
    if (h.vsRecentAvg === 'above') return 'Running ahead of your usual pace lately.';
    if (h.vsRecentAvg === 'below') return "A step behind where you've been lately.";
    return 'Right back to your normal pace.';
  }, [momentumHistory]);

  // Cross-pillar connector — only fires when one pillar is clearly out of step with the other
  // two (a real gap, not noise), framed as an observation about balance, not a report.
  const crossPillarConnector = useMemo(() => {
    const scores = [
      { name: 'eating', value: momentumWhy.calorie.subscore },
      { name: 'appetite', value: momentumWhy.satiety.subscore },
      { name: 'movement', value: momentumWhy.movement.subscore },
    ].filter((s) => s.value != null);
    if (scores.length < 3) return null;
    const sorted = [...scores].sort((a, b) => a.value - b.value);
    const weakest = sorted[0];
    const gap = sorted[2].value - weakest.value;
    if (gap < 20) return null;
    const others = scores.filter((s) => s.name !== weakest.name).map((s) => s.name);
    if (weakest.value >= 60) {
      return `Your ${others.join(' and ')} held steady even though ${weakest.name} was a bit behind — that balance is what's keeping things on track.`;
    }
    return `${weakest.name[0].toUpperCase()}${weakest.name.slice(1)}'s been the shaky one this week, not ${others.join(' or ')}.`;
  }, [momentumWhy]);

  // What's shown at the top of "See why" — the pattern line always leads (it's the most
  // specific, most "someone's actually paying attention" observation available), with the
  // cross-pillar note as an optional second line only when there's a real gap to call out. This
  // is the instant, always-available fallback while the AI version below loads (or if it fails) —
  // never the primary copy once the AI version is in, since fixed template sentences read as
  // canned rather than like the app actually looked at today.
  const momentumWhySummary = useMemo(() => ({
    headline: momentumPatternSentence,
    connector: crossPillarConnector,
  }), [momentumPatternSentence, crossPillarConnector]);

  // "See why" — AI-written breakdown (see src/lib/momentumWhy.js + api/gemini.js's momentum_why
  // prompt), fed the exact same computed numbers the template sentences above use. Real coach
  // language instead of a fixed sentence ladder is what makes this screen feel like it's actually
  // looking at today, not picking from a script. The template sentences above stay as the instant
  // fallback (first paint, offline, or a failed call) so the screen is never blank.
  const momentumWhyFacts = useMemo(() => {
    const t = burnout.today;
    return {
      userName: userName || null,
      momentumScore, band: today.band.label,
      calorie: { subscore: momentumWhy.calorie.subscore, loggedToday: momentumWhy.calorie.loggedToday, targetToday: momentumWhy.calorie.targetToday },
      satiety: {
        subscore: momentumWhy.satiety.subscore,
        avgCalories: t.avgCalories,
        avgProtein: t.avgProtein, proteinGoal,
        avgCarbs: t.avgCarbs, carbsGoal,
        avgFats: t.avgFats, fatsGoal,
        avgFiber: t.avgFiber, avgWaterMl: t.avgWaterMl,
        deficitPts: t.deficitPts, volatilityPts: t.volatilityPts, proteinPts: t.proteinPts,
        waterPts: t.waterPts, carbsPts: t.carbsPts, fiberPts: t.fiberPts, fatPts: t.fatPts,
      },
      movement: {
        subscore: momentumWhy.movement.subscore,
        gymKcalToday: momentumWhy.movement.gymKcalToday, stepsKcalToday: momentumWhy.movement.stepsKcalToday,
        targetKcalToday: momentumWhy.movement.targetKcalToday,
      },
      history: momentumHistory,
    };
  }, [userName, momentumScore, today.band.label, momentumWhy, burnout.today, proteinGoal, carbsGoal, fatsGoal, momentumHistory]);

  // Coarse enough that trivial noise (a gram, a kcal) doesn't force a regenerate — only a
  // materially different picture does — plus today's date so the "today" framing never goes stale.
  const momentumWhyFingerprint = useMemo(() => {
    const c = momentumWhy.calorie, s = momentumWhy.satiety, m = momentumWhy.movement, h = momentumHistory;
    const round5 = (v) => (v == null ? 'x' : Math.round(v / 5) * 5);
    const round25 = (v) => (v == null ? 'x' : Math.round(v / 25) * 25);
    return [
      today.ds, momentumScore, today.band.label,
      round5(c.subscore), c.loggedToday ? round25(c.loggedToday) : 0, round25(c.targetToday),
      round5(s.subscore),
      round5(m.subscore), round25(m.gymKcalToday), round25(m.stepsKcalToday), round25(m.targetKcalToday),
      h.vsYesterday, h.isBestInWhile, h.vsRecentAvg, h.todayIsBounceBack, h.bounceBackCount,
      h.weekdayRhythm, h.heldStrongOnUsuallyWeakDay, h.strongAsUsual, h.hasWeekendDipPattern, h.todayIsWeekend,
    ].join('|');
  }, [today.ds, momentumScore, today.band.label, momentumWhy, momentumHistory]);

  const [momentumWhyAi, setMomentumWhyAi] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) { setMomentumWhyAi(null); return; }
    getCachedMomentumWhy(userId).then((cached) => { if (!cancelled && cached) setMomentumWhyAi(cached); });
    return () => { cancelled = true; };
  }, [userId]);

  // Only fetch once the "Why {score}?" screen is actually opened — no point paying for a call
  // the person may never look at.
  useEffect(() => {
    if (view !== 'momentum' || !userId) return;
    let cancelled = false;
    getMomentumWhy({ userId, facts: { ...momentumWhyFacts, coachTone }, fingerprint: `${momentumWhyFingerprint}|${coachTone || ''}` }).then((why) => {
      if (!cancelled && why) setMomentumWhyAi(why);
    });
    return () => { cancelled = true; };
  }, [view, userId, momentumWhyFingerprint, coachTone]);

  const momentumWhyDisplay = {
    headline: momentumWhyAi?.headline || momentumWhySummary.headline,
    connector: momentumWhyAi ? momentumWhyAi.connector : momentumWhySummary.connector,
    eating: momentumWhyAi?.eating || momentumWhySentences.calorieSentence,
    satiety: momentumWhyAi?.satiety || burnoutWhy,
    movement: momentumWhyAi?.movement || momentumWhySentences.movementSentence,
  };

  // Trajectory chart: a PREDICTION for every day of the week (dashed, with a band that widens away from
  // today), plus the real weigh-ins this week as dots so the two never look alike.
  const chart = useMemo(() => {
    const top = 26, bot = 128;
    const x = (i) => 16 + i * 49;
    const nowDate = new Date(now);
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const confidenceVal = today.confidence;
    const dailyRateKg = weeklyPace.dailyRateKg;
    if (anchorKg == null || dailyRateKg == null) return null;

    const weighInByDay = {};
    sortedWeights.forEach((w) => { weighInByDay[new Date(w.ts).toDateString()] = w.weightKg; });

    const data = [];
    for (let offset = 0; offset <= 6; offset++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + offset);
      const dayDiff = Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
      const projectedKg = anchorKg + dailyRateKg * dayDiff;
      const marginKg = Math.abs(dayDiff) * 0.15 * (2 - confidenceVal);
      const proj = fromKg(projectedKg, weightUnit);
      const margin = fromKg(marginKg, weightUnit);
      const wKg = dayDiff <= 0 ? weighInByDay[d.toDateString()] : undefined;
      data.push({ label: dayLabel(d), proj, upper: proj + margin, lower: proj - margin, weighIn: wKg != null ? fromKg(wKg, weightUnit) : null });
    }

    const weekStartVal = data[0].proj;
    const weekEndVal = data[data.length - 1].proj;
    const weekChange = weekEndVal - weekStartVal;
    const weekEndDate = new Date(startOfWeek);
    weekEndDate.setDate(startOfWeek.getDate() + 6);

    const vals = [];
    data.forEach((p) => { vals.push(p.proj, p.upper, p.lower); if (p.weighIn != null) vals.push(p.weighIn); });
    const min = Math.min(...vals) - 0.15, max = Math.max(...vals) + 0.15;
    const y = (v) => bot - ((v - min) / (max - min || 1)) * (bot - top);
    const pts = (k) => data.map((p, i) => [x(i), y(p[k])]);
    const ups = pts('upper'), los = pts('lower').reverse();
    const band = smooth(ups) + ` L ${los[0][0]} ${los[0][1]} ` + smooth(los).replace(/^M [^C]*/, '') + ' Z';
    const todayIdx = startOfToday.getDay();
    const weighIns = data.map((p, i) => (p.weighIn != null ? { cx: x(i), cy: y(p.weighIn) } : null)).filter(Boolean);
    const points = data.map((p) => ({
      label: p.label, value: p.weighIn != null ? p.weighIn : p.proj, weighed: p.weighIn != null,
      changeFromStart: p.proj - weekStartVal,
    }));
    return {
      proj: smooth(pts('proj')), band, weighIns, points, todayIdx,
      todayPt: { cx: x(todayIdx), cy: y(data[todayIdx].proj) },
      endPt: todayIdx < 6 ? { cx: x(6), cy: y(weekEndVal) } : null,
      labels: data.map((p) => p.label), weekChange, weekEndDate, weekEndVal,
    };
  }, [today, anchorKg, weeklyPace, now, weightUnit, sortedWeights]);

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
      return `This isn't about going too fast — your recent days are averaging ${Math.round(weeklyPace.threeDayAvgCalories).toLocaleString()} kcal, which is less than your body needs to run well. That's under-eating, not overachieving. Bring your calories back up.`;
    }
    if (label === 'Faster Than Planned') return "You're moving faster than your chosen pace, but it's still within a safe range for your body — nothing to fix, unless you'd rather update your pace in Settings to match.";
    if (label === 'Needs Weigh-in') return "It's been over a week since your last weigh-in — log one so this pace reading actually means something.";
    if (label === 'Tracking Only') return "No weigh-in in over two weeks, so treat the projection as a rough guess, not a forecast.";
    if (label === 'Off Pace') return "You're a little behind your chosen pace — nothing urgent, just a nudge to close the gap.";
    if (label === 'Stalled') return "Progress has slowed this week — worth checking your portions and logging everything you eat and drink.";
    return null;
  }, [trendBadge, weeklyPace, bmr]);

  const weeklyHitRates = useMemo(() => {
    const weeks = [];
    for (let w = 5; w >= 0; w--) {
      const weekEnd = new Date(now - w * 7 * DAY_MS);
      const results = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekEnd.getTime() - d * DAY_MS);
        if (day.getTime() > now) continue;
        const ds = day.toDateString();
        const liveTotal = (recentMeals || []).filter((m) => m.date === ds).reduce((s, m) => s + (m.calories || 0), 0);
        const total = resolveCaloriesEaten(ledgerMap, ds, liveTotal);
        const dayGoal = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
        if (total > 0) results.push(total <= dayGoal * 1.15);
      }
      weeks.push(results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : null);
    }
    return weeks;
  }, [recentMeals, dailyCalorieGoal, goalHistory, ledgerMap, now]);

  const worstWeekday = useMemo(() => {
    if (!dailyCalorieGoal) return null;
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    const byDate = {};
    (recentMeals || []).forEach((m) => {
      if (!m.date) return;
      byDate[m.date] = (byDate[m.date] || 0) + (m.calories || 0);
    });
    Object.entries(byDate).forEach(([ds, liveTotal]) => {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return;
      const wd = d.getDay();
      const total = resolveCaloriesEaten(ledgerMap, ds, liveTotal);
      const dayGoal = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
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
  }, [recentMeals, dailyCalorieGoal, goalHistory, ledgerMap]);

  // Weekly pattern insight (replaces the old single-number "Big swing" template). Looks at every
  // day of the last two weeks, not just the highest one, and flags: heavy days (well over that
  // day's target), very light days, and the combination. The wording itself comes from Gemini
  // (see lib/insightText.js); `fallback` is the plain-language version used until/unless that
  // arrives. "Got it" is remembered per set of flagged days, so a card stays dismissed until
  // something NEW shows up (a different heavy/light day), never just because the week rolled over.
  const patternInsight = useMemo(() => {
    if (!dailyCalorieGoal) return null;
    const todayDs = new Date(now).toDateString();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      const ds = d.toDateString();
      const live = (recentMeals || []).filter((m) => m.date === ds).reduce((s, m) => s + (m.calories || 0), 0);
      const eaten = resolveCaloriesEaten(ledgerMap, ds, live);
      if (eaten <= 0) continue;
      const target = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
      days.push({
        ds, date: d, isToday: ds === todayDs, eaten: Math.round(eaten), target: Math.round(target), ratio: eaten / target,
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    if (days.length < 3) return null;
    const recent = days.filter((d) => now - d.date.getTime() < 7 * DAY_MS);
    const heavy = recent.filter((d) => d.ratio > 1.25);
    // Today is only partly eaten, so it can be flagged as heavy but never as a light day.
    const light = recent.filter((d) => !d.isToday && d.ratio < 0.5);
    const triggered = heavy.length >= 2 || heavy.some((d) => d.ratio > 1.3) || light.length >= 3;
    if (!triggered) return null;

    const keys = [...heavy.map((d) => `o:${d.ds}`), ...light.map((d) => `u:${d.ds}`)];
    const fmtDay = (d) => `${d.weekday} (about ${d.eaten.toLocaleString()} kcal)`;
    const list = (arr) => (arr.length <= 1 ? arr.map(fmtDay).join('') : `${arr.slice(0, -1).map(fmtDay).join(', ')} and ${fmtDay(arr[arr.length - 1])}`);
    let title;
    if (heavy.length && light.length) title = 'Up and down this week';
    else if (heavy.length >= 2) title = 'A few heavy days this week';
    else if (heavy.length === 1) title = `A heavy ${heavy[0].weekday}`;
    else title = 'Several light days this week';
    const parts = [];
    if (heavy.length) parts.push(`${list(heavy)} came in well above your usual target of about ${dailyCalorieGoal.toLocaleString()} kcal.`);
    if (light.length) parts.push(`${list(light)} ${light.length === 1 ? 'was' : 'were'} far below what your body needs.`);
    parts.push(heavy.length
      ? "A day or two like this won't undo your progress. Just aim to be close to your normal amount tomorrow."
      : 'Eating very little for days in a row can leave you worn out, so try a proper meal today.');

    return {
      keys,
      fingerprint: keys.join(','),
      facts: {
        dailyTarget: dailyCalorieGoal,
        days: days.map((d) => ({ weekday: d.weekday, date: d.label, eatenKcal: d.eaten, targetKcal: d.target, isToday: d.isToday })),
        heavyDays: heavy.map((d) => d.weekday + ' ' + d.label),
        lightDays: light.map((d) => d.weekday + ' ' + d.label),
        toughestWeekdayOverall: worstWeekday ? worstWeekday.name : null,
      },
      fallback: { title, body: parts.join(' ') },
    };
  }, [recentMeals, ledgerMap, goalHistory, dailyCalorieGoal, worstWeekday, now]);

  const [dismissedInsights, setDismissedInsights] = useState({});
  useEffect(() => {
    let cancelled = false;
    getDismissedFingerprints(userId).then((m) => { if (!cancelled) setDismissedInsights(m); });
    return () => { cancelled = true; };
  }, [userId]);
  const patternDismissed = useMemo(() => {
    const prev = dismissedInsights.pattern_insight;
    if (!patternInsight || !prev) return false;
    const seen = new Set(prev.split(','));
    return patternInsight.keys.every((k) => seen.has(k));
  }, [patternInsight, dismissedInsights]);
  const dismissPattern = () => {
    if (!patternInsight) return;
    dismissInsight(userId, 'pattern_insight', patternInsight.fingerprint);
    setDismissedInsights((m) => ({ ...m, pattern_insight: patternInsight.fingerprint }));
  };
  const [patternAi, setPatternAi] = useState(null);
  useEffect(() => {
    if (!userId || !patternInsight || patternDismissed) return;
    let cancelled = false;
    getAiText({ kind: 'pattern_insight', userId, facts: { ...patternInsight.facts, coachTone }, fingerprint: `${patternInsight.fingerprint},${coachTone || ''}` })
      .then((v) => { if (!cancelled && v) setPatternAi(v); });
    return () => { cancelled = true; };
  }, [userId, patternInsight?.fingerprint, patternDismissed, coachTone]);

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

  // ── Last 7 days, one value per day (oldest first), for the pill bar charts ──
  const UNIT_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750, glasses: 237 };
  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    return { date: d, ds: d.toDateString(), letter: d.toLocaleDateString('en-US', { weekday: 'narrow' }) };
  }), [now]);
  const week7 = useMemo(() => {
    const calsLive = {}; (recentMeals || []).forEach((m) => { if (m.date) calsLive[m.date] = (calsLive[m.date] || 0) + (m.calories || 0); });
    const waterMl = {}; (waterLogs || []).forEach((w) => { if (w.date) waterMl[w.date] = (waterMl[w.date] || 0) + (Number(w.amount) || 0) * (UNIT_ML[w.unit] ?? 237); });
    const steps = {}; (stepLogs || []).forEach((r) => { if (r.date) steps[r.date] = (steps[r.date] || 0) + (r.steps || 0); });
    const goalMl = hydrationGoal > 0 ? hydrationGoal * (UNIT_ML[volumeUnit] ?? 1) : 2000;
    const days = last7Days.map(({ ds, letter }) => {
      const cal = calsLive[ds] ? resolveCaloriesEaten(ledgerMap, ds, calsLive[ds]) : 0;
      return { ds, letter, cal, calGoal: resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal) || 0, waterL: (waterMl[ds] || 0) / 1000, steps: steps[ds] || 0 };
    });
    const calDays = days.filter((d) => d.cal > 0);
    const avgCal = calDays.length ? Math.round(calDays.reduce((s, d) => s + d.cal, 0) / calDays.length) : 0;
    const avgGoal = calDays.length ? calDays.reduce((s, d) => s + d.calGoal, 0) / calDays.length : 0;
    const gapPct = calDays.length && avgGoal > 0 ? Math.round(((avgCal - avgGoal) / avgGoal) * 100) : null;
    const waterDays = days.filter((d) => d.waterL > 0);
    const stepDays = days.filter((d) => d.steps > 0);
    return {
      days, avgCal, gapPct, goalMl,
      avgWaterL: waterDays.length ? waterDays.reduce((s, d) => s + d.waterL, 0) / waterDays.length : 0,
      waterGoalDays: days.filter((d) => d.waterL * 1000 >= goalMl).length,
      hasWater: waterDays.length > 0,
      avgSteps: stepDays.length ? Math.round(stepDays.reduce((s, d) => s + d.steps, 0) / stepDays.length) : 0,
      stepGoalDays: days.filter((d) => stepGoal > 0 && d.steps >= stepGoal).length,
      hasSteps: stepDays.length > 0,
    };
  }, [last7Days, recentMeals, waterLogs, stepLogs, ledgerMap, goalHistory, dailyCalorieGoal, hydrationGoal, volumeUnit, stepGoal]);

  // ── Your week ahead: the next 7 days, judged by how that weekday has gone before ──
  const weekAhead = useMemo(() => {
    const plural = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    const byDate = {};
    (recentMeals || []).forEach((m) => { if (m.date) byDate[m.date] = (byDate[m.date] || 0) + (m.calories || 0); });
    Object.entries(byDate).forEach(([ds, live]) => {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return;
      const goal = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
      if (!goal) return;
      byWeekday[d.getDay()].sum += resolveCaloriesEaten(ledgerMap, ds, live) - goal;
      byWeekday[d.getDay()].count += 1;
    });
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + 1 + i);
      const wd = date.getDay();
      const b = byWeekday[wd];
      const enough = b.count >= 2 && dailyCalorieGoal > 0;
      const over = enough ? b.sum / b.count : 0;
      const ratio = enough ? over / dailyCalorieGoal : 0;
      const level = !enough ? 'none' : ratio > 0.15 ? 'high' : ratio > 0.05 ? 'watch' : 'low';
      const kcal = Math.round(Math.abs(over) / 10) * 10;
      const text = level === 'high'
        ? `Your past ${plural[wd]} came in about ${kcal.toLocaleString()} kcal over your goal. Planning that day's meals ahead helps.`
        : level === 'watch'
          ? `${plural[wd]} run a little over, about ${kcal.toLocaleString()} kcal on average. Logging as you go keeps you close.`
          : level === 'low'
            ? `${plural[wd]} usually go to plan for you.`
            : `Not enough ${plural[wd]} logged yet to see a pattern.`;
      return {
        date, level, text,
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        num: date.getDate(),
        title: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        height: level === 'none' ? 0.1 : Math.max(0.15, Math.min(1, 0.25 + ratio * 3)),
      };
    });
    return { days, toWatch: days.filter((d) => d.level === 'high').length };
  }, [recentMeals, ledgerMap, goalHistory, dailyCalorieGoal, now]);
  const [weekAheadPick, setWeekAheadPick] = useState(0);
  const [riveMomentumFailed, setRiveMomentumFailed] = useState(false);

  // ── Your movement: the last 4 weeks (Mon-Sun rows), full workout vs lighter activity ──
  const movement = useMemo(() => {
    const mins = {}; (activities || []).forEach((a) => { if (a.date) mins[a.date] = (mins[a.date] || 0) + (Number(a.durationMin) || 0) + 0.001; });
    const steps = {}; (stepLogs || []).forEach((r) => { if (r.date) steps[r.date] = (steps[r.date] || 0) + (r.steps || 0); });
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 21);
    let full = 0, light = 0;
    const weeks = Array.from({ length: 4 }, (_, w) => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + w * 7 + i);
      const ds = d.toDateString();
      const level = d > today ? 'future' : (mins[ds] || 0) >= 30 ? 'full' : (mins[ds] || (steps[ds] || 0) >= ACTIVE_DAY_STEPS) ? 'light' : 'none';
      if (level === 'full') full += 1;
      if (level === 'light') light += 1;
      return { ds, level };
    }));
    return { weeks, full, light };
  }, [activities, stepLogs, now]);

  return (
    <View style={styles.wrapper}>
      <HeaderFade bg={colors.bg} />
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
                  <Text style={styles.progressSectionTitleCompact}>Streaks</Text><InfoTip id="streaks" />
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

            {/* Momentum */}
            <View style={[styles.card, { paddingTop: 14, alignItems: 'center' }]}>
              {/* The animated battery (Rive) once there's a score; the drawn one on web, before a score, or if it fails */}
              {Platform.OS !== 'web' && momentumReady && !riveMomentumFailed ? (
                <View style={{ alignSelf: 'stretch', alignItems: 'center' }} accessible accessibilityLabel={`Momentum ${momentumScore} out of 100`}>
                  <RiveMomentum score={momentumScore} width={SCREEN_WIDTH - 64} onFail={() => setRiveMomentumFailed(true)} />
                </View>
              ) : (<>
              <View style={[styles.rowBetween, { alignSelf: 'stretch', alignItems: 'center', marginBottom: 12 }]}>
                <View style={styles.titleTipRow}><Text style={styles.cardTitle15}>Momentum</Text><InfoTip id="momentum" /></View>
                <View style={styles.greyPill}><Text style={styles.greyPillText}>{momentumReady ? `${momentumScore} / 100` : '-- / 100'}</Text></View>
              </View>
              <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 3 }} accessible accessibilityLabel={momentumReady ? `Momentum ${momentumScore} out of 100` : 'Momentum not ready yet'}>
                <View style={[styles.battery, { borderColor: momentumReady ? momentumColor : colors.border }]}>
                  {Array.from({ length: 10 }, (_, k) => (
                    <View key={k} style={[styles.batteryCell, { backgroundColor: momentumReady && k < Math.round(momentumScore / 10) ? momentumColor : colors.cardAlt }]} />
                  ))}
                </View>
                <View style={[styles.batteryCap, { backgroundColor: momentumReady ? momentumColor : colors.border }]} />
              </View>
              </>)}
              <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Ionicons name="flash-outline" size={16} color={momentumColor} />
                <Text style={styles.momentumLine}>
                  {!momentumReady ? 'Not enough data yet' : today.band.tone === 'strong' ? "You've got momentum" : today.band.tone === 'drifting' ? "You're drifting a little" : "You've stalled, let's restart"}
                </Text>
                {Platform.OS !== 'web' && momentumReady && !riveMomentumFailed && <InfoTip id="momentum" />}
              </View>
              {!momentumReady && (
                <Text style={[styles.mutedSmall, { alignSelf: 'stretch' }]}>
                  {`Log meals on ${MIN_LOGGED_DAYS} different days to unlock your momentum score. Today counts once it is over. ${Math.min(today.loggedDays || 0, MIN_LOGGED_DAYS)} of ${MIN_LOGGED_DAYS} so far.`}
                </Text>
              )}
              {momentumReady && (
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

            {/* Calories: last 7 days */}
            <View style={styles.statCardBig}>
              <TouchableOpacity style={styles.statCardHead} onPress={() => onShowCalorieDetails && onShowCalorieDetails()} accessibilityLabel="Calories, see details">
                <Text style={styles.statCardTitle}>Calories</Text>
                <Ionicons name="chevron-forward" size={18} color="#4B5563" />
              </TouchableOpacity>
              <View style={styles.statCardBody}>
                <View style={styles.statCardFacts}>
                  <Text style={styles.statFactLabel}>Avg cal</Text>
                  <Text style={styles.statFactValue}>{week7.avgCal ? `${week7.avgCal.toLocaleString()} cal` : '--'}</Text>
                  <Text style={[styles.statFactLabel, { marginTop: 18 }]}>{week7.gapPct == null ? 'Avg goal gap' : week7.gapPct > 0 ? 'Avg over goal' : week7.gapPct < 0 ? 'Avg under goal' : 'Avg on goal'}</Text>
                  <Text style={styles.statFactValue}>{week7.gapPct == null ? '--' : week7.gapPct > 0 ? `+${week7.gapPct}%` : week7.gapPct < 0 ? `−${Math.abs(week7.gapPct)}%` : '0%'}</Text>
                </View>
                <PillBars values={week7.days.map((d) => d.cal)} max={Math.max(...week7.days.map((d) => Math.max(d.cal, d.calGoal)), 1)} letters={week7.days.map((d) => d.letter)} color={accent} styles={styles} label="Calories for the last 7 days" />
              </View>
            </View>

            {/* Weight trend */}
            <View style={styles.progressSectionCompact}>
              <View style={styles.progressSectionHeader}>
                <View style={styles.titleTipRow}><Text style={styles.progressSectionTitleCompact}>Weight trend</Text><InfoTip id="weight" /></View>
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
                          <Text style={[styles.weightStatValueCompact, { color: '#059669' }]}>{monthWeightChange == null ? '--' : `${monthWeightChange >= 0 ? '+' : ''}${monthWeightChange} kg`}</Text>
                          <Text style={styles.weightStatLabelCompact}>This month</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
                {oddWeighIns.length > 0 && (
                  <View style={[styles.nudgeBox, { marginTop: 10 }]}>
                    <Text style={[styles.nudgeText, { textAlign: 'left' }]}>
                      {oddWeighIns.length === 1
                        ? `One weigh-in (${Number(oddWeighIns[0].weight).toFixed(1)} ${oddWeighIns[0].unit || weightUnit} on ${fmtDayMonth(new Date(oddWeighIns[0].ts))}) looks very different from your others, so it isn't counted in your trend. If it's a typo, fix or delete it in your logs.`
                        : `${oddWeighIns.length} weigh-ins look very different from your others, so they aren't counted in your trend. If they're typos, fix or delete them in your logs.`}
                    </Text>
                    <TouchableOpacity onPress={() => onShowWeightModal && onShowWeightModal()} style={{ marginTop: 6, minHeight: 32, justifyContent: 'center' }} accessibilityRole="button">
                      <Text style={{ color: '#A8811F', fontSize: 12.5, fontWeight: '800' }}>Check my logs ›</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
                    <View style={styles.titleTipRow}><Text style={styles.kicker}>PREDICTION THIS WEEK</Text><InfoTip id="prediction" /></View>
                    {/* The predicted weight on Saturday, from the latest (or carried-forward) weight plus the days left */}
                    <Text style={styles.bigStat}>
                      {chart.weekEndVal != null ? `About ${chart.weekEndVal.toFixed(1)} ${weightUnit}` : '--'}
                      <Text style={styles.bigStatSub}> by {fmtDayMonth(chart.weekEndDate)}</Text>
                    </Text>
                    {lastWeighIn && chart.weekEndVal != null && (() => {
                      const diff = chart.weekEndVal - fromKg(lastWeighIn.weightKg, weightUnit);
                      const when = daysSinceWeighIn != null && daysSinceWeighIn < 1 ? 'your weigh-in today' : `your last weigh-in (${lastWeighInLabel})`;
                      return <Text style={styles.mutedSmall}>{`${diff <= 0 ? '−' : '+'}${Math.abs(diff).toFixed(1)} ${weightUnit} since ${when}`}</Text>;
                    })()}
                  </View>
                  {trendBadge && (
                    <View style={[styles.pill, { backgroundColor: trendBadge.bg }]}>
                      <Text style={[styles.pillText, { color: trendBadge.color }]}>{trendBadge.label}</Text>
                    </View>
                  )}
                </View>
                <View style={{ position: 'relative', marginTop: 12 }}>
                  <Svg width="100%" height={164} viewBox="0 0 326 164">
                    <Path d="M0 26H326M0 64H326M0 102H326M0 140H326" stroke={colors.border} strokeWidth={1} strokeOpacity={0.5} />
                    {!!chart.band && <Path d={chart.band} fill={accent} fillOpacity={0.07} />}
                    <Line x1={chart.todayPt.cx} y1={12} x2={chart.todayPt.cx} y2={140} stroke={colors.textMuted} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
                    <Rect x={Math.min(Math.max(chart.todayPt.cx - 20, 0), 286)} y={0} width={40} height={16} rx={8} fill={colors.text} />
                    <SvgText x={Math.min(Math.max(chart.todayPt.cx, 20), 306)} y={11.5} textAnchor="middle" fontSize={9.5} fontWeight="700" fill={colors.card}>Today</SvgText>
                    <Path d={chart.proj} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="6 6" strokeOpacity={0.75} />
                    {chart.weighIns.map((p, i) => <Circle key={i} cx={p.cx} cy={p.cy} r={4} fill={accent} stroke={colors.card} strokeWidth={2} />)}
                    <Circle cx={chart.todayPt.cx} cy={chart.todayPt.cy} r={10} fill={accent} fillOpacity={0.15} />
                    <Circle cx={chart.todayPt.cx} cy={chart.todayPt.cy} r={5.5} fill={accent} stroke={colors.card} strokeWidth={2} />
                    {chart.endPt && <Circle cx={chart.endPt.cx} cy={chart.endPt.cy} r={5} fill={colors.card} stroke={accent} strokeWidth={2} />}
                    {chart.labels.map((l, i) => (
                      <SvgText key={i} x={16 + i * 49} y={158} textAnchor="middle" fontSize={10} fontWeight={i === chart.todayIdx ? '800' : '600'} fill={i === chart.todayIdx ? colors.text : colors.textMuted}>{l}</SvgText>
                    ))}
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
                <View style={styles.chartKeyRow}>
                  <View style={styles.chartKeyItem}>
                    <Svg width={14} height={4}><Line x1={0} y1={2} x2={14} y2={2} stroke={accent} strokeWidth={3} strokeDasharray="4 3" /></Svg>
                    <Text style={styles.chartKeyText}>Predicted</Text>
                  </View>
                  {chart.weighIns.length > 0 && (
                    <View style={styles.chartKeyItem}>
                      <View style={[styles.chartKeyDot, { backgroundColor: accent }]} />
                      <Text style={styles.chartKeyText}>Your weigh-ins</Text>
                    </View>
                  )}
                  {!chartTooltip && <Text style={[styles.chartInfoText, { marginLeft: 'auto' }]}>Tap a point</Text>}
                </View>
                {chartTooltip && (
                  <Text style={[styles.chartInfoText, { marginTop: 6 }]}>
                    {`${chartTooltip.label}: ${chartTooltip.value.toFixed(1)} ${weightUnit}${chartTooltip.weighed ? ' (your weigh-in)' : ' (predicted)'}${chartTooltip.changeFromStart != null ? `  ·  ${Math.abs(chartTooltip.changeFromStart).toFixed(2)} ${weightUnit} ${chartTooltip.changeFromStart > 0 ? 'gain' : chartTooltip.changeFromStart < 0 ? 'loss' : 'change'} vs Sun` : ''}`}
                  </Text>
                )}
                {staleWeighInNote ? <Text style={[styles.mutedSmall, { marginTop: 8 }]}>{staleWeighInNote}</Text> : null}
                {trendNote && (
                  <View style={[styles.nudgeBox, (trendBadge?.label === 'Too Aggressive' || trendBadge?.label === 'Stalled') && styles.nudgeBoxUrgent]}>
                    <Text style={[styles.nudgeText, (trendBadge?.label === 'Too Aggressive' || trendBadge?.label === 'Stalled') && styles.nudgeTextUrgent]}>
                      {trendNote}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.detailsBtn} onPress={() => (isPro ? setView('details') : unlock('forecast'))}>
                  <Text style={styles.detailsBtnText}>See details</Text>
                  {!isPro && <Ionicons name="sparkles" size={13} color="#F5A524" style={{ marginLeft: 5 }} />}
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
                  <View style={styles.titleTipRow}><Text style={styles.kicker}>FORECAST</Text><InfoTip id="forecast" /></View>
                  <View style={[styles.pill, { backgroundColor: confidenceBg }]}>
                    <Text style={[styles.pillText, { color: confidenceColor }]}>{confidence} confidence</Text>
                  </View>
                </View>
                {!isPro ? (
                  <LockedChartPreview reason="forecast" kind="line" caption="Your weight for the three Saturdays after this week and likely goal date" />
                ) : (<>
                <View style={[styles.statsRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{fmtDayMonth(new Date(now + FORECAST_DAYS[0] * DAY_MS)).toUpperCase()}</Text>
                    <Text style={styles.statValue}>{projected3Kg != null ? `${fromKg(projected3Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                    {weeklyPace.dailyRateKg != null && (
                      <Text style={styles.mutedSmall}>{forecastDelta(FORECAST_DAYS[0])}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{fmtDayMonth(new Date(now + FORECAST_DAYS[1] * DAY_MS)).toUpperCase()}</Text>
                    <Text style={styles.statValue}>{projected7Kg != null ? `${fromKg(projected7Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                    {weeklyPace.dailyRateKg != null && (
                      <Text style={styles.mutedSmall}>{forecastDelta(FORECAST_DAYS[1])}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{fmtDayMonth(new Date(now + FORECAST_DAYS[2] * DAY_MS)).toUpperCase()}</Text>
                    <Text style={styles.statValue}>{projected14Kg != null ? `${fromKg(projected14Kg, weightUnit).toFixed(1)} ${weightUnit}` : '--'}</Text>
                    {weeklyPace.dailyRateKg != null && (
                      <Text style={styles.mutedSmall}>{forecastDelta(FORECAST_DAYS[2])}</Text>
                    )}
                  </View>
                </View>
                {forecastAnchorNote ? <Text style={[styles.mutedSmall, { marginTop: 10 }]}>{forecastAnchorNote}</Text> : null}
                <Text style={[styles.mutedSmall, { marginTop: 10 }]}>Confidence grows as you log and weigh in regularly — {Math.round(today.confidence * 100)}% right now.</Text>
                </>)}
              </View>
            )}

            {/* BMR checkpoint change notice */}
            {checkpointNotice && (
              <View style={[styles.card, { backgroundColor: colors.accentLight, borderColor: accent }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitleSmall}>Your daily burn has changed</Text>
                  <TouchableOpacity onPress={dismissCheckpointNotice} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.mutedBody, { marginTop: 6 }]}>
                  Your weight has changed enough that your daily calorie needs have shifted —
                  {pacePreference ? ` worth updating your daily calorie target in Settings to stay on your ${pacePreference} pace.` : ' worth updating your daily calorie target in Settings to keep it matched to your goal.'}
                </Text>
              </View>
            )}

            {/* Pace to goal */}
            {pace && !pace.done && !pace.insufficientData && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <View style={styles.titleTipRow}><Text style={styles.kicker}>PACE TO GOAL</Text><InfoTip id="pace" /></View>
                    <Text style={styles.bigStat}>{pace.eta ? fmtShort(pace.eta) : '--'}<Text style={styles.bigStatSub}> at this pace</Text></Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pace.pct}%`, backgroundColor: accent }]} />
                  <View style={[styles.planMarker, { left: `${pace.pct}%`, marginLeft: -1, backgroundColor: colors.text }]} />
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
                    <Text style={styles.statValue}>{pace.weeklyRate <= 0 ? '−' : '+'}{Math.abs(pace.weeklyRate).toFixed(2)}</Text>
                  </View>
                </View>
                {pace.note && <Text style={[styles.mutedBody, { marginTop: 12 }]}>{pace.note}</Text>}
                <SourcesLink topic="weight" only label="Estimates · Sources" color={colors.textMuted} style={{ marginTop: 12 }} />
              </View>
            )}
            {pace?.insufficientData && (
              <View style={styles.card}>
                <Text style={styles.mutedBody}>
                  {pace.needsWeight
                    ? 'Log your current weight and we will estimate when you will reach your goal.'
                    : `Keep logging your meals. After ${MIN_LOGGED_DAYS} days your pace to goal will show up here.`}
                </Text>
              </View>
            )}
            {pace?.done && (
              <View style={styles.card}>
                <Text style={styles.mutedBody}>You've reached your goal weight — nice work. Update your target in Settings if you want to keep going.</Text>
              </View>
            )}

            {/* Guardrail */}
            {patternInsight && !patternDismissed && (
              <View style={[styles.card, { backgroundColor: WARN_BG, borderColor: '#FCE3CB' }]}>
                <View style={styles.rowStart}>
                  <View style={styles.warnDot}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>!</Text></View>
                  <Text style={[styles.cardTitleSmall, { color: '#C25A11' }]}>{patternAi?.title || patternInsight.fallback.title}</Text>
                </View>
                <Text style={[styles.mutedBody, { color: '#8A7663', marginTop: 8 }]}>{patternAi?.body || patternInsight.fallback.body}</Text>
                <TouchableOpacity style={styles.dismissBtn} onPress={dismissPattern}>
                  <Text style={{ color: '#C25A11', fontSize: 12.5, fontWeight: '700' }}>Got it</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Your week ahead (Pro) */}
            <View style={styles.card}>
              {!isPro ? (<>
                <Text style={styles.cardTitle15}>Your week ahead</Text>
                <LockedChartPreview reason="burnout" kind="bars" caption="Which days this week may need a little more planning" />
              </>) : (<>
              <View style={[styles.rowBetween, { alignItems: 'center' }]}>
                <Text style={styles.cardTitle15}>Your week ahead</Text>
                {weekAhead.toWatch > 0 && (
                  <View style={[styles.greyPill, { backgroundColor: '#FFEDD5' }]}><Text style={[styles.greyPillText, { color: '#C2410C' }]}>{weekAhead.toWatch} {weekAhead.toWatch === 1 ? 'day' : 'days'} to watch</Text></View>
                )}
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>Based on your past patterns, some days may need a little more planning.</Text>
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 12 }}>
                {weekAhead.days.map((d, i) => {
                  const on = i === weekAheadPick;
                  const color = d.level === 'high' ? '#F97316' : d.level === 'watch' ? '#FBBF24' : d.level === 'low' ? '#34D399' : colors.border;
                  return (
                    <TouchableOpacity key={i} onPress={() => setWeekAheadPick(i)} style={[styles.aheadDay, on && styles.aheadDayOn]} accessibilityState={{ selected: on }} accessibilityLabel={`${d.title}, ${WEEK_AHEAD_LEVELS[d.level].label}`}>
                      <Text style={[styles.aheadDayName, on && { fontWeight: '700', color: colors.text }]}>{d.name}</Text>
                      <Text style={styles.aheadDayNum}>{d.num}</Text>
                      <View style={styles.aheadBarBox}><View style={{ width: '70%', height: `${Math.round(d.height * 100)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: color }} /></View>
                      <View style={{ height: 14, justifyContent: 'center' }}>{d.level === 'high' ? <Ionicons name="alert-circle-outline" size={12} color="#EA580C" /> : null}</View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(() => {
                const d = weekAhead.days[weekAheadPick] || weekAhead.days[0];
                const lvl = WEEK_AHEAD_LEVELS[d.level];
                return (
                  <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={[styles.rowBetween, { alignItems: 'center' }]}>
                      <Text style={styles.cardTitle15}>{d.title}</Text>
                      <View style={[styles.greyPill, { backgroundColor: lvl.bg }]}><Text style={[styles.greyPillText, { color: lvl.color }]}>{lvl.label}</Text></View>
                    </View>
                    <Text style={[styles.mutedBody, { marginTop: 6, minHeight: 36 }]}>{d.text}</Text>
                  </View>
                );
              })()}
              <SourcesLink topic="wellbeing" label="Not a diagnosis · Sources" color={colors.textMuted} style={{ marginTop: 8 }} />
              </>)}
            </View>

            {/* Hydration: last 7 days */}
            <View style={styles.statCardBig}>
              <TouchableOpacity style={styles.statCardHead} onPress={() => onShowHydrationDetails && onShowHydrationDetails()} accessibilityLabel="Hydration, open the water log">
                <Text style={styles.statCardTitle}>Hydration</Text>
                <Ionicons name="chevron-forward" size={18} color="#4B5563" />
              </TouchableOpacity>
              <View style={styles.statCardBody}>
                <View style={styles.statCardFacts}>
                  <Text style={styles.statFactLabel}>Avg daily</Text>
                  <Text style={styles.statFactValue}>{week7.hasWater ? `${week7.avgWaterL.toFixed(1)} L` : '--'}</Text>
                  <Text style={[styles.statFactLabel, { marginTop: 18 }]}>Goal met</Text>
                  <Text style={styles.statFactValue}>{week7.hasWater ? `${week7.waterGoalDays} of 7 days` : '--'}</Text>
                </View>
                <PillBars values={week7.days.map((d) => d.waterL)} max={Math.max(...week7.days.map((d) => d.waterL), week7.goalMl / 1000, 0.1)} letters={week7.days.map((d) => d.letter)} color="#0EA5E9" styles={styles} label="Water for the last 7 days" />
              </View>
            </View>

            {/* Steps: last 7 days */}
            <View style={styles.statCardBig}>
              <TouchableOpacity style={styles.statCardHead} onPress={() => onShowStepsDetails && onShowStepsDetails()} accessibilityLabel="Steps, open the steps log">
                <Text style={styles.statCardTitle}>Steps</Text>
                <Ionicons name="chevron-forward" size={18} color="#4B5563" />
              </TouchableOpacity>
              <View style={[styles.statCardBody, { position: 'relative' }]}>
                <View style={styles.statCardFacts}>
                  <Text style={styles.statFactLabel}>Avg daily</Text>
                  <Text style={styles.statFactValue}>{week7.hasSteps ? week7.avgSteps.toLocaleString() : '--'}</Text>
                  <Text style={[styles.statFactLabel, { marginTop: 18 }]}>Goal met</Text>
                  <Text style={styles.statFactValue}>{week7.hasSteps ? `${week7.stepGoalDays} of 7 days` : '--'}</Text>
                </View>
                <PillBars values={week7.days.map((d) => d.steps)} max={Math.max(...week7.days.map((d) => d.steps), stepGoal || 0, 1)} letters={week7.days.map((d) => d.letter)} color="#F97316" styles={styles} label="Steps for the last 7 days" />
                {needsHealth && (
                  <>
                    <BlurView intensity={Platform.OS === 'android' ? 30 : 16} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={styles.healthOverlay}>
                      <View style={styles.healthIcon}><Ionicons name="heart" size={18} color="#EF4444" /></View>
                      <Text style={styles.healthTitle}>Connect Apple Health</Text>
                      <Text style={styles.healthSub}>Your daily steps fill in by themselves. Logga only reads steps.</Text>
                      <TouchableOpacity
                        style={[styles.healthBtn, healthConnecting && { opacity: 0.6 }]}
                        disabled={healthConnecting}
                        onPress={async () => { setHealthConnecting(true); try { await onConnectAppleHealth?.(); } finally { setHealthConnecting(false); } }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.healthBtnTxt}>{healthConnecting ? 'Connecting…' : 'Connect'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Your movement: last 4 weeks */}
            <View style={styles.card}>
              <View style={[styles.rowBetween, { alignItems: 'center', marginBottom: 12 }]}>
                <Text style={styles.cardTitle15}>Your movement</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.greyPill}><Text style={styles.greyPillText}>Last 4 weeks</Text></View>
                  <TouchableOpacity onPress={() => onShowActivityLog && onShowActivityLog()} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={[styles.seeAllBtnSmall, { fontSize: 13, color: '#047857' }]}>See all</Text>
                    <Ionicons name="arrow-forward" size={13} color="#047857" />
                  </TouchableOpacity>
                </View>
              </View>
              <View accessible accessibilityLabel={`Activity over the last 4 weeks: ${movement.full} full workout days and ${movement.light} lighter active days`} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                  {WEEK_DAY_LABELS.map((l, i) => <Text key={i} style={styles.moveDayLabel}>{l}</Text>)}
                </View>
                {movement.weeks.map((week, w) => (
                  <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
                    {week.map((c) => (
                      <View key={c.ds} style={[styles.moveCell, { backgroundColor: c.level === 'full' ? '#F97316' : c.level === 'light' ? '#FDBA74' : colors.cardAlt, opacity: c.level === 'future' ? 0.45 : 1 }]}>
                        {c.level === 'full' && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                <Text style={styles.moveLegend}>Less activity</Text>
                <View style={[styles.moveSwatch, { backgroundColor: '#FDBA74' }]} />
                <View style={[styles.moveSwatch, { backgroundColor: '#F97316' }]} />
                <Text style={styles.moveLegend}>More activity</Text>
              </View>
            </View>

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
              {momentumScore >= 60
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
            <Text style={[styles.mutedBody, { fontSize: 14.5, fontWeight: '700', color: colors.text, lineHeight: 21 }]}>
              {momentumWhyDisplay.headline}
            </Text>
            {momentumWhyDisplay.connector && (
              <Text style={[styles.mutedBody, { marginTop: 6, marginBottom: 4 }]}>{momentumWhyDisplay.connector}</Text>
            )}

            <View style={[styles.card, { marginTop: momentumWhyDisplay.connector ? 8 : 16 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>Eating</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.calorie.subscore}%</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{momentumWhyDisplay.eating}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>Staying Satisfied</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.satiety.subscore}%</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{momentumWhyDisplay.satiety}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitleSmall}>Moving</Text>
                <Text style={styles.cardTitleSmall}>{momentumWhy.movement.subscore != null ? `${momentumWhy.movement.subscore}%` : '--'}</Text>
              </View>
              <Text style={[styles.mutedBody, { marginTop: 6 }]}>{momentumWhyDisplay.movement}</Text>
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
  titleTipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bigStat: { color: c.text, fontSize: 19, fontWeight: '800' },
  bigStatSub: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chartInfoRow: { minHeight: 16, marginTop: 6, alignItems: 'center' },
  chartKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  chartKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartKeyText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  chartKeyDot: { width: 8, height: 8, borderRadius: 4 },
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
  healthOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  cardTitle15: { fontSize: 15, fontWeight: '700', color: c.text },
  greyPill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.06)' },
  greyPillText: { fontSize: 12, fontWeight: '600', color: c.text },
  battery: { flex: 1, height: 56, padding: 4, borderWidth: 2, borderRadius: 8, flexDirection: 'row', gap: 3 },
  batteryCell: { flex: 1, borderRadius: 3 },
  batteryCap: { width: 5, height: 20, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  momentumLine: { fontSize: 14, fontWeight: '600', color: c.text },
  statCardBig: { marginHorizontal: 16, marginTop: 12, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  statCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statCardTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  statCardBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statCardFacts: { width: 96, gap: 4 },
  statFactLabel: { fontSize: 12, color: c.textSecondary },
  statFactValue: { fontSize: 18, fontWeight: '700', color: c.text },
  pillTrack: { flex: 1, justifyContent: 'flex-end', borderRadius: 999, backgroundColor: c.cardAlt === '#F3F4F6' ? '#EEF0F2' : c.cardAlt, overflow: 'hidden' },
  pillLetter: { flex: 1, textAlign: 'center', fontSize: 10, color: c.textSecondary },
  aheadDay: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent' },
  aheadDayOn: { borderColor: '#D1D5DB', backgroundColor: c.card },
  aheadDayName: { fontSize: 10, color: c.textSecondary },
  aheadDayNum: { fontSize: 13, fontWeight: '600', color: c.text },
  aheadBarBox: { width: '100%', height: 90, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  moveDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: c.textSecondary },
  moveCell: { flex: 1, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moveLegend: { fontSize: 12, color: c.textSecondary },
  moveSwatch: { width: 12, height: 12, borderRadius: 3 },
  healthIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  healthTitle: { fontSize: 15, fontWeight: '800', color: '#16201b' },
  healthSub: { fontSize: 12.5, lineHeight: 17, color: '#4b5563', textAlign: 'center', marginTop: 4 },
  healthBtn: { marginTop: 10, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999, backgroundColor: '#16201b' },
  healthBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressSectionTitleCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
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
