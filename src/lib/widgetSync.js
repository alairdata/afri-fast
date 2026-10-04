// Hands today's numbers to the iOS home-screen widgets (targets/widget) through the shared App
// Group, and brings water logged with the widget's "+" button back into the app.
//
// The widget reads one JSON string under WIDGET_KEY. Field names and the date format (seconds since
// 2001-01-01, Swift's default) must match targets/widget/LoggaWidgetData.swift exactly.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeCurrentMealStreak } from './mealStreak';
import { quickWaterIncrement } from './waterQuickAdd';

const APP_GROUP = 'group.com.logga.app';
const WIDGET_KEY = 'logga.widget.day.v1';
const BASELINE_KEY = 'logga-widget-water-baseline-v1';
const BURNOUT_SUMMARY_KEY = 'logga-burnout-summary-v1'; // written by ProgressTab via smartNotifications.js
const BURNOUT_MAX_AGE_MS = 3 * 86400000;
const SWIFT_REFERENCE_EPOCH = 978307200; // 2001-01-01 in Unix seconds
const DEFAULT_PROTEIN_GOAL = 90;

// Same unit table as milestones.js / burnout.js.
const UNIT_TO_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750 };

// The native side is our own small module (modules/logga-widget-bridge). It replaced the storage helper that
// ships with @bacons/apple-targets: that one was silently missing from the EAS build, and its JS fallback is a
// no-op, so the app never wrote anything for the widgets to read (and never saw widget water either).
let bridge;
const getBridge = () => {
  if (Platform.OS !== 'ios') return null;
  if (bridge !== undefined) return bridge;
  try {
    bridge = require('expo').requireOptionalNativeModule('LoggaWidgetBridge') || null;
  } catch (_) {
    bridge = null;
  }
  if (!bridge) console.log('[widgetSync] native LoggaWidgetBridge is not in this build; widgets will not update');
  return bridge;
};

const getStorage = () => {
  const b = getBridge();
  if (!b) return null; // Expo Go, or a build without the bridge
  return {
    get: (key) => b.getString(key, APP_GROUP),
    set: (key, value) => b.setString(key, value, APP_GROUP),
    remove: (key) => b.remove(key, APP_GROUP),
  };
};

const reloadWidgets = () => {
  try { getBridge()?.reloadWidgets(); } catch (_) {}
};

const swiftDate = (ms) => ms / 1000 - SWIFT_REFERENCE_EPOCH;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// Glasses = one quick-add serving of whatever unit the user tracks water in.
const waterGlassesToday = (waterLogs, volumeUnit, todayStr) => {
  const unitMl = UNIT_TO_ML[volumeUnit] ?? 1;
  const glass = quickWaterIncrement(volumeUnit);
  const units = (waterLogs || [])
    .filter((w) => w.date === todayStr)
    .reduce((s, w) => s + ((Number(w.amount) || 0) * (UNIT_TO_ML[w.unit] ?? UNIT_TO_ML[volumeUnit] ?? 1)) / unitMl, 0);
  return Math.round(units / glass);
};

const burnoutLabel = (score) => (score <= 25 ? 'Low' : score <= 55 ? 'Moderate' : score <= 80 ? 'High' : 'Critical');

// Water logged from the widget since the app last wrote the snapshot.
// Returns { delta, widgetGlasses }: delta = glasses to add to the app's own logs (0 if none).
export async function pendingWidgetWater(currentUserId) {
  const none = { delta: 0, widgetGlasses: 0 };
  const st = getStorage();
  if (!st) return none;
  try {
    const raw = st.get(WIDGET_KEY);
    if (!raw) return none;
    const widgetDay = JSON.parse(raw);
    if (!widgetDay || widgetDay.date == null) return none;
    const widgetMs = (widgetDay.date + SWIFT_REFERENCE_EPOCH) * 1000;
    if (!sameDay(widgetMs, Date.now())) return none;
    // Water tapped on the widget belongs to the account that wrote the snapshot. If someone else signed in
    // since (or this is an old snapshot we can't vouch for), never add it to this account.
    const baselineRaw = await AsyncStorage.getItem(BASELINE_KEY);
    if (widgetDay.userId ? widgetDay.userId !== currentUserId : baselineRaw == null) return none;
    const baseline = Number(baselineRaw);
    const widgetGlasses = widgetDay.waterGlasses || 0;
    const delta = widgetGlasses - (Number.isFinite(baseline) ? baseline : 0);
    return { delta: delta > 0 ? delta : 0, widgetGlasses };
  } catch (_) {
    return none;
  }
}

// Call right after adding the widget's glasses to the app's logs, so they are never added twice.
export async function ackWidgetWater(widgetGlasses) {
  try { await AsyncStorage.setItem(BASELINE_KEY, String(widgetGlasses)); } catch (_) {}
}

// Signed out (or switching accounts): remove the snapshot so the widgets stop showing the previous person's
// numbers, and forget the water baseline so nothing carries over to the next account.
export async function clearWidgetSnapshot() {
  const st = getStorage();
  try { await AsyncStorage.removeItem(BASELINE_KEY); } catch (_) {}
  if (!st) return;
  try { st.remove(WIDGET_KEY); } catch (_) {}
  reloadWidgets();
}

// Writes the current snapshot for the widgets and asks them to refresh.
export async function pushWidgetSnapshot({ recentMeals, waterLogs, hydrationGoal, volumeUnit, dailyCalorieGoal, proteinGoal, userId }) {
  const st = getStorage();
  if (!st) return;
  try {
    const now = new Date();
    const todayStr = now.toDateString();
    const todayMeals = (recentMeals || []).filter((m) => m.date === todayStr);
    const caloriesEaten = Math.round(todayMeals.reduce((s, m) => s + (m.calories || 0), 0));
    const proteinGrams = Math.round(todayMeals.reduce((s, m) => s + (m.protein || 0), 0));

    // Monday -> Sunday: did the user log food that day?
    const loggedDates = new Set((recentMeals || []).map((m) => m.date));
    const monday = new Date(now);
    monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
    const loggedThisWeek = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return loggedDates.has(d.toDateString());
    });

    const glass = quickWaterIncrement(volumeUnit);
    const waterGlasses = waterGlassesToday(waterLogs, volumeUnit, todayStr);
    const waterGoal = Math.max(1, Math.round((hydrationGoal || 0) / glass)) || 8;

    let burnoutScore = null;
    try {
      const raw = await AsyncStorage.getItem(BURNOUT_SUMMARY_KEY);
      if (raw) {
        const b = JSON.parse(raw);
        if (b.score != null && b.at && Date.now() - b.at < BURNOUT_MAX_AGE_MS) burnoutScore = Math.round(b.score);
      }
    } catch (_) {}

    // NaN / Infinity would serialise to null and the widget's integer fields would not decode.
    const whole = (n, fallback = 0) => (Number.isFinite(n) ? Math.round(n) : fallback);
    const day = {
      date: swiftDate(now.getTime()),
      caloriesEaten: whole(caloriesEaten),
      calorieGoal: whole(dailyCalorieGoal, 1520) || 1520,
      waterGlasses: whole(waterGlasses),
      waterGoal: whole(waterGoal, 8) || 8,
      proteinGrams: whole(proteinGrams),
      proteinGoal: whole(proteinGoal, DEFAULT_PROTEIN_GOAL) || DEFAULT_PROTEIN_GOAL,
      streakDays: whole(computeCurrentMealStreak(recentMeals, now)),
      userId: userId || null,
      loggedThisWeek,
      ...(burnoutScore != null ? { burnoutScore, burnoutLabel: burnoutLabel(burnoutScore) } : {}),
    };

    if (st.set(WIDGET_KEY, JSON.stringify(day)) === false) {
      console.log('[widgetSync] App Group is not available to the app; widgets cannot be updated');
      return;
    }
    await AsyncStorage.setItem(BASELINE_KEY, String(waterGlasses));
    reloadWidgets();
  } catch (e) {
    console.log('[widgetSync] push failed:', e?.message);
  }
}
