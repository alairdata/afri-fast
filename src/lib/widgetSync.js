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

let storage = null;
const getStorage = () => {
  if (Platform.OS !== 'ios') return null;
  if (storage) return storage;
  try {
    const { ExtensionStorage } = require('@bacons/apple-targets');
    storage = new ExtensionStorage(APP_GROUP);
  } catch (_) {
    storage = null; // e.g. Expo Go or a build without the widget target
  }
  return storage;
};

const reloadWidgets = () => {
  try { require('@bacons/apple-targets').ExtensionStorage.reloadWidget(); } catch (_) {}
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
export async function pendingWidgetWater() {
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
    const baseline = Number(await AsyncStorage.getItem(BASELINE_KEY));
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

// Writes the current snapshot for the widgets and asks them to refresh.
export async function pushWidgetSnapshot({ recentMeals, waterLogs, hydrationGoal, volumeUnit, dailyCalorieGoal, proteinGoal }) {
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

    const day = {
      date: swiftDate(now.getTime()),
      caloriesEaten,
      calorieGoal: Math.round(dailyCalorieGoal || 1520),
      waterGlasses,
      waterGoal,
      proteinGrams,
      proteinGoal: Math.round(proteinGoal || DEFAULT_PROTEIN_GOAL),
      streakDays: computeCurrentMealStreak(recentMeals, now),
      loggedThisWeek,
      ...(burnoutScore != null ? { burnoutScore, burnoutLabel: burnoutLabel(burnoutScore) } : {}),
    };

    st.set(WIDGET_KEY, JSON.stringify(day));
    await AsyncStorage.setItem(BASELINE_KEY, String(waterGlasses));
    reloadWidgets();
  } catch (e) {
    console.log('[widgetSync] push failed:', e?.message);
  }
}
