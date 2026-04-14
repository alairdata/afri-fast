import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Animated, Platform, StatusBar, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';

const ACTIVE_FAST_KEY = 'afri_active_fast_v1';
const SETTINGS_KEY = 'afri_user_settings_v2';
import {
  requestNotificationPermissions,
  scheduleFastEndNotification,
  scheduleMilestoneNotifications,
  cancelFastingNotifications,
  scheduleFastStartReminder,
  cancelFastStartReminder,
  scheduleMealReminder,
  cancelMealReminder,
} from './lib/notifications';

// Tab components
import TodayTab from './components/TodayTab';
import MealsTab from './components/MealsTab';
import ProgressTab from './components/ProgressTab';
import SettingsTab from './components/SettingsTab';
import BottomTabBar from './components/BottomTabBar';

// Overlay/Page components
import ChatScreen from './components/ChatScreen';
import CheckInPage from './components/CheckInPage';
import PlanSelectionPage from './components/PlanSelectionPage';
import WeightLogPage from './components/WeightLogPage';
import HydrationDetailsPage from './components/HydrationDetailsPage';
import CalorieDetailsPage from './components/CalorieDetailsPage';
import BMIDetailsPage from './components/BMIDetailsPage';
import FastingDetailsPage from './components/FastingDetailsPage';
import WhispersTab from './components/WhispersTab';
import FastingCalendarPage from './components/FastingCalendarPage';
import FastingQuizPage from './components/FastingQuizPage';
import NutritionQuizPage from './components/NutritionQuizPage';

// Modal components
import LogMealModal from './components/LogMealModal';
import MakeRecipePage from './components/MakeRecipePage';
import FindRecipePage from './components/FindRecipePage';
import MakeRecipeModal from './components/MakeRecipeModal';
import FindRecipeModal from './components/FindRecipeModal';
import EditProfileModal from './components/EditProfileModal';
import TimeEditModal from './components/TimeEditModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


const dbSave = (promise, label, onError) => {
  promise.then(({ error }) => {
    if (error) onError?.(`Failed to save. Try again.`);
  });
};

const MACRO_STYLE_SPLITS = {
  balanced: { protein: 0.30, carbs: 0.40, fats: 0.30 },
  highProtein: { protein: 0.40, carbs: 0.35, fats: 0.25 },
  lowCarb: { protein: 0.35, carbs: 0.20, fats: 0.45 },
};

const HYDRATION_UNIT_TO_ML = {
  oz: 29.574,
  mL: 1,
  sachet: 500,
  bottle: 750,
};

const convertHydrationGoal = (amount, fromUnit, toUnit) => {
  const safeAmount = Number(amount) || 0;
  const fromFactor = HYDRATION_UNIT_TO_ML[fromUnit] || 1;
  const toFactor = HYDRATION_UNIT_TO_ML[toUnit] || 1;
  const ml = safeAmount * fromFactor;
  const converted = ml / toFactor;

  if (toUnit === 'mL') return Math.round(converted);
  if (toUnit === 'oz') return Math.round(converted);
  return Math.round(converted * 10) / 10;
};

const closestMacroStyle = (protein, carbs, fats) => {
  const proteinCals = (Number(protein) || 0) * 4;
  const carbCals = (Number(carbs) || 0) * 4;
  const fatCals = (Number(fats) || 0) * 9;
  const total = proteinCals + carbCals + fatCals;

  if (!total) return 'balanced';

  const current = {
    protein: proteinCals / total,
    carbs: carbCals / total,
    fats: fatCals / total,
  };

  let bestStyle = 'balanced';
  let bestScore = Number.POSITIVE_INFINITY;

  Object.entries(MACRO_STYLE_SPLITS).forEach(([style, split]) => {
    const score =
      Math.abs(current.protein - split.protein) +
      Math.abs(current.carbs - split.carbs) +
      Math.abs(current.fats - split.fats);

    if (score < bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  });

  return bestScore <= 0.12 ? bestStyle : 'custom';
};

const WHISPER_ICONS = ['🦁', '🐯', '🦊', '🐺', '🦝', '🐻', '🐼', '🦄', '🐸', '🦋', '🦜', '🦚', '🦩', '🐬', '🦭', '🐆', '🦓', '🦒', '🦘', '🦫', '🦦', '🦥', '🐙', '🐘'];
const WHISPER_COLORS = ['#059669', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#f97316'];
const getUserIcon = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  return WHISPER_ICONS[Math.abs(hash) % WHISPER_ICONS.length];
};
const getUserColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 37 + str.charCodeAt(i)) & 0xffffffff;
  return WHISPER_COLORS[Math.abs(hash) % WHISPER_COLORS.length];
};

const FastingApp = ({ session, pendingPreAuthData, onPreAuthDataApplied }) => {
  // === Core fasting state ===
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fastingHours, setFastingHours] = useState(0);
  const [fastingMinutes, setFastingMinutes] = useState(0);
  const [fastingSeconds, setFastingSeconds] = useState(0);
  const [isFasting, setIsFasting] = useState(false);
  const [fastStartTime, setFastStartTime] = useState(null);
  const [fastingSessions, setFastingSessions] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [hunger, setHunger] = useState('medium');
  const [energy, setEnergy] = useState('low');
  const [mood, setMood] = useState('okay');
  const [selectedPlan, setSelectedPlan] = useState(null);

  // === Navigation state ===
  const [activeTab, setActiveTab] = useState('today');
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showPlanPage, setShowPlanPage] = useState(false);
  const [showCheckInPage, setShowCheckInPage] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatOpeningContext, setChatOpeningContext] = useState(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showFastingDetails, setShowFastingDetails] = useState(false);
  const [showBMIDetails, setShowBMIDetails] = useState(false);
  const [showCalorieDetails, setShowCalorieDetails] = useState(false);
  const [showHydrationDetails, setShowHydrationDetails] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [whisperPosts, setWhisperPosts] = useState([]);
  const [showFastingQuiz, setShowFastingQuiz] = useState(false);
  const [showNutritionQuiz, setShowNutritionQuiz] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const [isOffline, setIsOffline] = useState(false);
  const [showLogMealModal, setShowLogMealModal] = useState(false);
  const [showMakeRecipePage, setShowMakeRecipePage] = useState(false);
  const [showFindRecipePage, setShowFindRecipePage] = useState(false);
  const [showMakeRecipeModal, setShowMakeRecipeModal] = useState(false);
  const [showFindRecipeModal, setShowFindRecipeModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingTime, setEditingTime] = useState('start');
  const [logMealMethod, setLogMealMethod] = useState(null);
  const [viewingMeal, setViewingMeal] = useState(null);
  const [makeRecipeMethod, setMakeRecipeMethod] = useState(null);

  // === Check-in state ===
  const [feelings, setFeelings] = useState([]);
  const [fastingStatus, setFastingStatus] = useState('');
  const [hungerLevel, setHungerLevel] = useState('');
  const [moods, setMoods] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [fastBreak, setFastBreak] = useState([]);
  const [activities, setActivities] = useState([]);
  const [otherFactors, setOtherFactors] = useState([]);
  const [waterCount, setWaterCount] = useState(0);
  const [notes, setNotes] = useState('');

  // === Chat state ===
  const [chatMessages, setChatMessages] = useState([]);

  // === User/profile state ===
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState(session?.user?.email ?? '');
  const [userCountry, setUserCountry] = useState('');
  const [userCount, setUserCount] = useState(0);

  // === Notification settings ===
  const [notifyFastStart, setNotifyFastStart] = useState(true);
  const [notifyFastEnd, setNotifyFastEnd] = useState(true);
  const [notifyMealReminder, setNotifyMealReminder] = useState(false);
  const [notifyMilestones, setNotifyMilestones] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  // === Weight state ===
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightLogs, setWeightLogs] = useState([]);
  const [targetWeight, setTargetWeight] = useState(null);
  const [startingWeight, setStartingWeight] = useState(null);

  // === Hydration state ===
  const [volumeUnit, setVolumeUnit] = useState('sachet');
  const waterUnit = volumeUnit;
  const setWaterUnit = setVolumeUnit;
  const [waterLogs, setWaterLogs] = useState([]);

  // === Body measurements ===
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');

  // === Nutrition goals state ===
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(120);
  const [carbsGoal, setCarbsGoal] = useState(200);
  const [fatsGoal, setFatsGoal] = useState(65);
  const [macroStyle, setMacroStyle] = useState('balanced');
  const [hydrationGoal, setHydrationGoal] = useState(6);
  const [foodMeasurement, setFoodMeasurement] = useState('cups');

  const updateMacroGoalsFromCalories = (nextCalories) => {
    const safeCalories = Math.max(0, Number(nextCalories) || 0);
    const split = MACRO_STYLE_SPLITS[macroStyle] || MACRO_STYLE_SPLITS.balanced;

    setDailyCalorieGoal(safeCalories);
    setProteinGoal(Math.round((safeCalories * split.protein) / 4));
    setCarbsGoal(Math.round((safeCalories * split.carbs) / 4));
    setFatsGoal(Math.round((safeCalories * split.fats) / 9));
  };

  const updateHydrationUnit = (nextUnit) => {
    setHydrationGoal((currentGoal) => convertHydrationGoal(currentGoal, volumeUnit, nextUnit));
    setVolumeUnit(nextUnit);
  };

  // === Meals state ===
  const [selectedMealDate, setSelectedMealDate] = useState(new Date());
  const [recentMeals, setRecentMeals] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);

  // === Time edit state ===
  const [startDay, setStartDay] = useState('');
  const [startHour, setStartHour] = useState(0);
  const [startMinute, setStartMinute] = useState(0);
  const [startSecond, setStartSecond] = useState(0);
  const [endDay, setEndDay] = useState('');
  const [endHour, setEndHour] = useState(0);
  const [endMinute, setEndMinute] = useState(0);
  const [endSecond, setEndSecond] = useState(0);
  // Date string (YYYY-MM-DD) used by TimeEditModal drum-roll date column
  const [editDateStr, setEditDateStr] = useState('');

  const upsertProfile = async (patch, label) => {
    if (!session?.user?.id) {
      console.warn(`[Profile skip - ${label}] No session user id`);
      return null;
    }

    const payload = {
      id: session.user.id,
      email: session.user.email ?? userEmail ?? '',
      ...patch,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id, name, email, country, selected_plan')
      .maybeSingle();

    if (error) {
      console.error(`[Profile upsert error - ${label}]`, error);
      return null;
    }

    console.log(`[Profile upsert ok - ${label}]`, data);
    return data;
  };

  // === Recalculate end time when plan changes ===
  // Restore active fast from AsyncStorage — runs independently of profile fetch
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const local = await AsyncStorage.getItem(ACTIVE_FAST_KEY);
        if (!local) return;
        const parsed = JSON.parse(local);
        if (parsed.userId !== session.user.id || !(parsed.startTime > 0)) return;
        const restoredStartTime = parsed.startTime;
        const restoredPlan = parsed.plan || selectedPlan || '16:8';
        const toLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        setIsFasting(true);
        setFastStartTime(restoredStartTime);
        const startDate = new Date(restoredStartTime);
        setStartDay(toLabel(startDate));
        setStartHour(startDate.getHours());
        setStartMinute(startDate.getMinutes());
        const planHours = parseInt(restoredPlan.split(':')[0]) || 16;
        const endDate = new Date(restoredStartTime + planHours * 60 * 60 * 1000);
        setEndDay(toLabel(endDate));
        setEndHour(endDate.getHours());
        setEndMinute(endDate.getMinutes());
      } catch (_) {}
    })();
  }, [session]);

  // Restore Make it Yours settings from AsyncStorage (instant — before DB fetch)
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!stored) return;
        const s = JSON.parse(stored);
        if (s.userId !== session.user.id) return;
        if (s.userName) setUserName(s.userName);
        if (s.userCountry) setUserCountry(s.userCountry);
        if (s.height != null) setHeight(s.height);
        if (s.heightUnit) setHeightUnit(s.heightUnit);
        if (s.weightUnit) setWeightUnit(s.weightUnit);
        if (s.volumeUnit) setVolumeUnit(s.volumeUnit);
        if (s.foodMeasurement) setFoodMeasurement(s.foodMeasurement);
        if (s.dailyCalorieGoal != null) setDailyCalorieGoal(s.dailyCalorieGoal);
        if (s.macroStyle) setMacroStyle(s.macroStyle);
        if (s.proteinGoal != null) setProteinGoal(s.proteinGoal);
        if (s.carbsGoal != null) setCarbsGoal(s.carbsGoal);
        if (s.fatsGoal != null) setFatsGoal(s.fatsGoal);
        if (s.hydrationGoal != null) setHydrationGoal(s.hydrationGoal);
        if (s.startingWeight != null) setStartingWeight(s.startingWeight);
        if (s.targetWeight != null) setTargetWeight(s.targetWeight);
      } catch (_) {}
    })();
  }, [session]);

  // Save Make it Yours settings to AsyncStorage whenever they change
  useEffect(() => {
    if (!session?.user?.id) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
      userId: session.user.id,
      userName, userCountry,
      height, heightUnit, weightUnit, volumeUnit, foodMeasurement,
      dailyCalorieGoal, macroStyle, proteinGoal, carbsGoal, fatsGoal,
      hydrationGoal, startingWeight, targetWeight,
    })).catch(() => {});
  }, [userName, userCountry, height, heightUnit, weightUnit, volumeUnit, foodMeasurement,
      dailyCalorieGoal, macroStyle, proteinGoal, carbsGoal, fatsGoal,
      hydrationGoal, startingWeight, targetWeight, session]);

  // Auto-detect country from IP if not set
  useEffect(() => {
    if (!session?.user?.id || userCountry) return;
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(geo => {
        if (geo?.country_name) {
          setUserCountry(geo.country_name);
          upsertProfile({ country: geo.country_name }, 'auto-detect country');
        }
      })
      .catch(() => {});
  }, [session, userCountry]);

  // Fetch profile from Supabase
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('profiles').select('name, country, selected_plan, target_weight, starting_weight, height, height_unit, weight_unit, volume_unit, food_measurement, daily_calorie_goal, macro_style, protein_goal, carbs_goal, fats_goal, hydration_goal, active_fast_start, active_fast_plan').eq('id', session.user.id).maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          console.error('[Profile fetch error]', error);
          return;
        }
        if (!data) {
          console.warn('[Profile restore] No profile row found for user', session.user.id);
          const createdProfile = await upsertProfile({}, 'create missing profile on restore');
          if (!createdProfile) return;
          data = createdProfile;
        }
        if (data.name) setUserName(data.name);
        if (data.country) setUserCountry(data.country);
        if (data.selected_plan) setSelectedPlan(data.selected_plan);
        if (data.target_weight != null) setTargetWeight(parseFloat(data.target_weight));
        if (data.starting_weight != null) setStartingWeight(parseFloat(data.starting_weight));
        if (data.height != null) setHeight(data.height);
        if (data.height_unit) setHeightUnit(data.height_unit);
        if (data.weight_unit) setWeightUnit(data.weight_unit);
        if (data.volume_unit) setVolumeUnit(data.volume_unit);
        if (data.food_measurement) setFoodMeasurement(data.food_measurement);
        if (data.daily_calorie_goal != null) setDailyCalorieGoal(data.daily_calorie_goal);
        if (data.macro_style) setMacroStyle(data.macro_style);
        if (data.protein_goal != null) setProteinGoal(data.protein_goal);
        if (data.carbs_goal != null) setCarbsGoal(data.carbs_goal);
        if (data.fats_goal != null) setFatsGoal(data.fats_goal);
        if (data.hydration_goal != null) setHydrationGoal(data.hydration_goal);

        // DB-backed active fast restore — fallback if AsyncStorage was cleared (PWA)
        if (data.active_fast_start != null) {
          const restoredStart = parseInt(data.active_fast_start);
          const restoredPlan = data.active_fast_plan || '16:8';
          if (restoredStart > 0) {
            const toLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            setIsFasting(true);
            setFastStartTime(restoredStart);
            const startDate = new Date(restoredStart);
            setStartDay(toLabel(startDate));
            setStartHour(startDate.getHours());
            setStartMinute(startDate.getMinutes());
            const planHours = parseInt(restoredPlan.split(':')[0]) || 16;
            const endDate = new Date(restoredStart + planHours * 60 * 60 * 1000);
            setEndDay(toLabel(endDate));
            setEndHour(endDate.getHours());
            setEndMinute(endDate.getMinutes());
            // Also refresh AsyncStorage so next restore is instant
            AsyncStorage.setItem(ACTIVE_FAST_KEY, JSON.stringify({
              userId: session.user.id,
              startTime: restoredStart,
              plan: restoredPlan,
            })).catch(() => {});
          }
        }
      });
  }, [session]);

  // Request notification permissions
  useEffect(() => { requestNotificationPermissions(); }, []);

  // Fetch total user count for Whispers unlock
  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count != null) setUserCount(count); });
  }, []);

  // Fetch meals from Supabase
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('meals')
      .select('id, user_id, name, calories, protein, carbs, fats, date, logged_at, method, image_url, notes, photo, detected_name')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { console.error('[DB Error - fetch meals]', error); return; }
        if (data) setRecentMeals(data);
      });
  }, [session]);

  // Fetch fasting sessions
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('fasting_sessions')
      .select('id, start_time, end_time, duration_hours, duration_minutes, plan, date')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { console.error('[DB Error - fetch fasting_sessions]', error); return; }
        if (data) setFastingSessions(data.map(r => ({
          id: r.id, startTime: r.start_time, endTime: r.end_time,
          durationHours: r.duration_hours, durationMinutes: r.duration_minutes,
          plan: r.plan, date: r.date,
        })));
      });
  }, [session]);

  // Fetch check-ins
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('check_ins')
      .select('id, date, feelings, fasting_status, hunger_level, moods, symptoms, fast_break, activities, other_factors, water_count, volume_unit, notes, fasting_hours, fasting_minutes')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { console.error('[DB Error - fetch check_ins]', error); return; }
        if (data) setCheckInHistory(data.map(r => ({
          id: r.id, date: r.date, timestamp: r.id,
          feelings: r.feelings || [], fastingStatus: r.fasting_status,
          hungerLevel: r.hunger_level, moods: r.moods || [],
          symptoms: r.symptoms || [], fastBreak: r.fast_break || [],
          activities: r.activities || [], otherFactors: r.other_factors || [],
          waterCount: r.water_count, volumeUnit: r.volume_unit,
          notes: r.notes, fastingHours: r.fasting_hours, fastingMinutes: r.fasting_minutes,
        })));
      });
  }, [session]);

  // Fetch weight logs
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('weight_logs')
      .select('id, date, weight, unit')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) { console.error('[DB Error - fetch weight_logs]', error); return; }
        if (data) setWeightLogs(data.map(r => ({ id: r.id, date: r.date, timestamp: r.id, weight: r.weight, unit: r.unit })));
      });
  }, [session]);

  // Fetch water logs
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('water_logs')
      .select('id, date, display_date, amount, unit')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { console.error('[DB Error - fetch water_logs]', error); return; }
        if (data) setWaterLogs(data.map(r => ({ id: r.id, date: r.date, displayDate: r.display_date, amount: r.amount, unit: r.unit })));
      });
  }, [session]);

  useEffect(() => {
    const fastHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
    if (isFasting && fastStartTime) {
      // Restore start time display from saved timestamp
      const start = new Date(fastStartTime);
      setStartDay(formatDateLabel(start));
      setStartHour(start.getHours());
      setStartMinute(start.getMinutes());
      // Recalculate end time from the original start time
      const endTime = new Date(fastStartTime + fastHours * 60 * 60 * 1000);
      setEndDay(formatDateLabel(endTime));
      setEndHour(endTime.getHours());
      setEndMinute(endTime.getMinutes());
    } else {
      // Preview: if you started now
      const now = new Date();
      setStartDay(formatDateLabel(now));
      setStartHour(now.getHours());
      setStartMinute(now.getMinutes());
      const endTime = new Date(now.getTime() + fastHours * 60 * 60 * 1000);
      setEndDay(formatDateLabel(endTime));
      setEndHour(endTime.getHours());
      setEndMinute(endTime.getMinutes());
    }
  }, [selectedPlan, isFasting, fastStartTime]);

  // === Timer effect ===
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isFasting && fastStartTime) {
        const elapsed = Math.floor((Date.now() - fastStartTime) / 1000);
        setFastingHours(Math.floor(elapsed / 3600));
        setFastingMinutes(Math.floor((elapsed % 3600) / 60));
        setFastingSeconds(elapsed % 60);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isFasting, fastStartTime]);

  // === Offline detection (web) ===
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // === Progress ring calculation ===
  const planFastHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
  const progress = Math.min(((fastingHours * 60 + fastingMinutes) / (planFastHours * 60)) * 100, 100);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // === Check-in history ===
  const [checkInHistory, setCheckInHistory] = useState([]);

  useEffect(() => {
    if (!session?.user?.id || !pendingPreAuthData?.completedAt) return;

    let cancelled = false;

    const applyPreAuthData = async () => {
      if (!pendingPreAuthData.skipped) {
        if (pendingPreAuthData.preferredName && !userName) {
          setUserName(pendingPreAuthData.preferredName);
        }

        if (pendingPreAuthData.height) {
          setHeight(String(pendingPreAuthData.height));
        }

        if (pendingPreAuthData.heightUnit) {
          setHeightUnit(pendingPreAuthData.heightUnit);
        }

        if (pendingPreAuthData.targetWeight) {
          const tw = parseFloat(pendingPreAuthData.targetWeight);
          setTargetWeight(tw);
          upsertProfile({ target_weight: tw }, 'save onboarding target_weight');
        }

        if (pendingPreAuthData.currentWeight) {
          const sw = parseFloat(pendingPreAuthData.currentWeight);
          setStartingWeight(sw);
          upsertProfile({ starting_weight: sw }, 'save onboarding starting_weight');
        }

        if (pendingPreAuthData.currentWeight && weightLogs.length === 0) {
          const initialWeightLog = {
            date: new Date().toDateString(),
            timestamp: Date.now(),
            weight: parseFloat(pendingPreAuthData.currentWeight),
            unit: pendingPreAuthData.weightUnit || 'kg',
          };

          if (!Number.isNaN(initialWeightLog.weight)) {
            setWeightLogs((prev) => [initialWeightLog, ...prev]);
            dbSave(
              supabase.from('weight_logs').insert({
                id: initialWeightLog.timestamp,
                user_id: session.user.id,
                date: initialWeightLog.date,
                weight: initialWeightLog.weight,
                unit: initialWeightLog.unit,
              }),
              'save onboarding weight_log'
            );
          }
        }

        if (pendingPreAuthData.preferredName) {
          upsertProfile({ name: pendingPreAuthData.preferredName }, 'save onboarding name');
        }
      }

      if (!cancelled) {
        onPreAuthDataApplied?.();
      }
    };

    applyPreAuthData();

    return () => {
      cancelled = true;
    };
  }, [session, pendingPreAuthData, onPreAuthDataApplied, userName, weightLogs.length]);

  // === Handlers ===
  const formatDateLabel = (date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();

    const getOrdinal = (value) => {
      if (value > 3 && value < 21) return 'th';
      switch (value % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${day}${getOrdinal(day)} ${month} ${year}`;
  };

  const handleStartFast = () => {
    if (!selectedPlan) {
      setShowPlanPage(true);
      return;
    }
    const now = new Date();
    const startTs = now.getTime();
    setFastStartTime(startTs);
    setFastingHours(0);
    setFastingMinutes(0);
    setFastingSeconds(0);
    setIsFasting(true);
    setCheckedIn(false);
    const planHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
    if (notifyFastEnd) scheduleFastEndNotification(startTs, planHours);
    if (notifyMilestones) scheduleMilestoneNotifications(startTs, planHours);
    AsyncStorage.setItem(ACTIVE_FAST_KEY, JSON.stringify({
      userId: session?.user?.id,
      startTime: startTs,
      plan: selectedPlan,
    })).catch(() => {});
    upsertProfile({ active_fast_start: startTs, active_fast_plan: selectedPlan }, 'start fast');
    // Update start time display
    setStartDay(formatDateLabel(now));
    setStartHour(now.getHours());
    setStartMinute(now.getMinutes());
    // Calculate end time based on plan
    const fastHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
    const endTime = new Date(now.getTime() + fastHours * 60 * 60 * 1000);
    setEndDay(formatDateLabel(endTime));
    setEndHour(endTime.getHours());
    setEndMinute(endTime.getMinutes());
  };

  const [showEndFastWarning, setShowEndFastWarning] = useState(false);

  const handleEndFast = () => {
    // Check if fasting less than 30 minutes
    if (fastStartTime) {
      const elapsedMinutes = (Date.now() - fastStartTime) / 1000 / 60;
      if (elapsedMinutes < 30) {
        setShowEndFastWarning(true);
        return;
      }
    }
    confirmEndFast(true);
  };

  const confirmEndFast = (shouldLog) => {
    cancelFastingNotifications();
    setShowEndFastWarning(false);
    if (shouldLog && fastStartTime) {
      const duration = Math.floor((Date.now() - fastStartTime) / 1000);
      const fastSession = {
        id: Date.now(),
        startTime: fastStartTime,
        endTime: Date.now(),
        durationHours: Math.floor(duration / 3600),
        durationMinutes: Math.floor((duration % 3600) / 60),
        plan: selectedPlan,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
      setFastingSessions(prev => [fastSession, ...prev]);
      dbSave(supabase.from('fasting_sessions').insert({
        id: fastSession.id, user_id: session?.user?.id,
        start_time: fastSession.startTime, end_time: fastSession.endTime,
        duration_hours: fastSession.durationHours, duration_minutes: fastSession.durationMinutes,
        plan: fastSession.plan, date: fastSession.date,
      }), 'save fasting_session', (msg) => showToast(msg, 'error'));
    }
    setIsFasting(false);
    setFastStartTime(null);
    setFastingHours(0);
    setFastingMinutes(0);
    setFastingSeconds(0);
    AsyncStorage.removeItem(ACTIVE_FAST_KEY).catch(() => {});
    upsertProfile({ active_fast_start: null, active_fast_plan: null }, 'end fast');
  };

  const prefersReducedMotion = Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    toastAnim.setValue(-80);
    if (prefersReducedMotion) {
      toastAnim.setValue(50);
      setTimeout(() => { toastAnim.setValue(-80); setToastMessage(''); }, 2500);
      return;
    }
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 50, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  };

  const saveCheckIn = () => {
    const now = new Date();
    const checkIn = {
      id: Date.now(),
      date: now.toDateString(),
      timestamp: Date.now(),
      feelings,
      fastingStatus,
      hungerLevel,
      moods,
      symptoms,
      fastBreak,
      activities,
      otherFactors,
      waterCount,
      volumeUnit,
      notes,
      fastingHours,
      fastingMinutes,
    };
    setCheckInHistory(prev => [checkIn, ...prev]);
    dbSave(supabase.from('check_ins').insert({
      id: checkIn.id, user_id: session?.user?.id, date: checkIn.date,
      feelings: checkIn.feelings, fasting_status: checkIn.fastingStatus,
      hunger_level: checkIn.hungerLevel, moods: checkIn.moods,
      symptoms: checkIn.symptoms, fast_break: checkIn.fastBreak,
      activities: checkIn.activities, other_factors: checkIn.otherFactors,
      water_count: checkIn.waterCount, volume_unit: checkIn.volumeUnit,
      notes: checkIn.notes, fasting_hours: checkIn.fastingHours, fasting_minutes: checkIn.fastingMinutes,
    }), 'save check_in', (msg) => showToast(msg, 'error'));
    // Also log water to waterLogs if any was tracked
    if (waterCount > 0) {
      const wId = Date.now() + 1;
      const waterLog = {
        id: wId,
        date: now.toDateString(),
        displayDate: `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]}, ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        amount: waterCount,
        unit: volumeUnit,
      };
      setWaterLogs(prev => [waterLog, ...prev]);
      dbSave(supabase.from('water_logs').insert({ id: wId, user_id: session?.user?.id, date: waterLog.date, display_date: waterLog.displayDate, amount: waterLog.amount, unit: waterLog.unit }), 'save water_log from check-in', (msg) => showToast(msg, 'error'));
    }
    setCheckedIn(true);
    setShowCheckInPage(false);
    showToast('Check-in saved!');
  };

  const handleEditStartTime = () => {
    if (fastStartTime) {
      const d = new Date(fastStartTime);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setEditDateStr(`${yyyy}-${mm}-${dd}`);
      setStartHour(d.getHours());
      setStartMinute(d.getMinutes());
      setStartSecond(d.getSeconds());
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setEditDateStr(`${yyyy}-${mm}-${dd}`);
      setStartHour(now.getHours());
      setStartMinute(now.getMinutes());
      setStartSecond(0);
    }
    setEditingTime('start');
    setShowTimeModal(true);
  };

  const handleEditEndTime = () => {
    if (fastStartTime) {
      const planHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
      const projectedEnd = new Date(fastStartTime + planHours * 3600000);
      const yyyy = projectedEnd.getFullYear();
      const mm = String(projectedEnd.getMonth() + 1).padStart(2, '0');
      const dd = String(projectedEnd.getDate()).padStart(2, '0');
      setEditDateStr(`${yyyy}-${mm}-${dd}`);
      setEndHour(projectedEnd.getHours());
      setEndMinute(projectedEnd.getMinutes());
      setEndSecond(0);
    }
    setEditingTime('end');
    setShowTimeModal(true);
  };

  const handleSaveTime = () => {
    if (editingTime === 'start') {
      const [yr, mo, dy] = editDateStr.split('-').map(Number);
      const targetDate = new Date(yr, mo - 1, dy);
      targetDate.setHours(startHour, startMinute, startSecond, 0);
      const newStartTime = targetDate.getTime();
      if (newStartTime > Date.now()) {
        showToast('Start time cannot be in the future');
        return;
      }
      setFastStartTime(newStartTime);
      setStartDay(formatDateLabel(targetDate));
      const fastHours = parseInt((selectedPlan || '16:8').split(':')[0]) || 16;
      const endTime = new Date(newStartTime + fastHours * 60 * 60 * 1000);
      setEndDay(formatDateLabel(endTime));
      setEndHour(endTime.getHours());
      setEndMinute(endTime.getMinutes());
      // Persist to both AsyncStorage and DB
      AsyncStorage.setItem(ACTIVE_FAST_KEY, JSON.stringify({
        userId: session?.user?.id,
        startTime: newStartTime,
        plan: selectedPlan,
      })).catch(() => {});
      upsertProfile({ active_fast_start: newStartTime, active_fast_plan: selectedPlan }, 'update active fast start time');
      showToast('Start time updated!');
    } else if (editingTime === 'end' && fastStartTime) {
      const [yr, mo, dy] = editDateStr.split('-').map(Number);
      const targetDate = new Date(yr, mo - 1, dy);
      targetDate.setHours(endHour, endMinute, 0, 0);
      const newEndTime = targetDate.getTime();
      if (newEndTime > Date.now()) {
        showToast('End time cannot be in the future');
        return;
      }
      if (newEndTime <= fastStartTime) {
        showToast('End time must be after start time');
        return;
      }
      const duration = Math.floor((newEndTime - fastStartTime) / 1000);
      const fastSession = {
        id: Date.now(),
        startTime: fastStartTime,
        endTime: newEndTime,
        durationHours: Math.floor(duration / 3600),
        durationMinutes: Math.floor((duration % 3600) / 60),
        plan: selectedPlan,
        date: new Date(newEndTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
      setFastingSessions(prev => [fastSession, ...prev]);
      dbSave(supabase.from('fasting_sessions').insert({
        id: fastSession.id, user_id: session?.user?.id,
        start_time: fastSession.startTime, end_time: fastSession.endTime,
        duration_hours: fastSession.durationHours, duration_minutes: fastSession.durationMinutes,
        plan: fastSession.plan, date: fastSession.date,
      }), 'save fasting_session', (msg) => showToast(msg, 'error'));
      setIsFasting(false);
      setFastStartTime(null);
      setFastingHours(0); setFastingMinutes(0); setFastingSeconds(0);
      AsyncStorage.removeItem(ACTIVE_FAST_KEY).catch(() => {});
      upsertProfile({ active_fast_start: null, active_fast_plan: null }, 'end fast via edit time');
      showToast('Fast ended!');
    }
    setShowTimeModal(false);
  };

  const handleOpenPlanPage = () => {
    setShowPlanPage(true);
  };

  const handleDeleteFastSession = async (sessionToDelete) => {
    if (!sessionToDelete?.id) return;

    const prevSessions = fastingSessions;
    setFastingSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));

    const { error } = await supabase
      .from('fasting_sessions')
      .delete()
      .eq('id', sessionToDelete.id)
      .eq('user_id', session?.user?.id);

    if (error) {
      setFastingSessions(prevSessions);
      showToast('Failed to delete session. Try again.', 'error');
      return;
    }

    showToast('Fast deleted');
  };

  return (
    <View style={styles.container}>
      {/* === Offline banner === */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>No internet connection</Text>
        </View>
      )}
      {/* === Tab Content === */}
      {activeTab === 'today' && (
        <TodayTab
          currentTime={currentTime}
          fastingHours={fastingHours}
          fastingMinutes={fastingMinutes}
          fastingSeconds={fastingSeconds}
          isFasting={isFasting}
          checkedIn={checkedIn}
          hunger={hunger}
          energy={energy}
          mood={mood}
          selectedPlan={selectedPlan}
          progress={progress}
          circumference={circumference}
          strokeDashoffset={strokeDashoffset}
          onShowPlanPage={handleOpenPlanPage}
          onShowCheckInPage={() => setShowCheckInPage(true)}
          onShowChat={(context) => { setChatOpeningContext(context || null); setShowChat(true); }}
          onStartFast={handleStartFast}
          onEndFast={handleEndFast}
          fastingSessions={fastingSessions}
          recentMeals={recentMeals}
          waterCount={waterCount}
          waterLogs={waterLogs}
          volumeUnit={volumeUnit}
          onNavigateToProgress={() => setActiveTab('progress')}
          onNavigateToHydration={() => {
            setActiveTab('progress');
            setTimeout(() => setShowHydrationDetails(true), 100);
          }}
          onEditStartTime={handleEditStartTime}
          onEditEndTime={handleEditEndTime}
          canEditEndTime={isFasting && !!fastStartTime && (Date.now() - fastStartTime) > (parseInt((selectedPlan || '16:8').split(':')[0]) || 16) * 3600000}
          onShowCalendar={() => setShowCalendar(true)}
          startDay={startDay}
          startHour={startHour}
          startMinute={startMinute}
          endDay={endDay}
          endHour={endHour}
          endMinute={endMinute}
          checkInHistory={checkInHistory}
          weightLogs={weightLogs}
          targetWeight={targetWeight}
          startingWeight={startingWeight}
          dailyCalorieGoal={dailyCalorieGoal}
          hydrationGoal={hydrationGoal}
          userName={userName}
          userCountry={userCountry}
          userId={session?.user?.id}
          proteinGoal={proteinGoal}
          carbsGoal={carbsGoal}
          fatsGoal={fatsGoal}
        />
      )}

      {activeTab === 'meals' && (
        <MealsTab
          selectedMealDate={selectedMealDate}
          setSelectedMealDate={setSelectedMealDate}
          recentMeals={recentMeals}
          dailyCalorieGoal={dailyCalorieGoal}
          isFasting={isFasting}
          onLogMeal={(method) => {
            setLogMealMethod(method);
            setShowLogMealModal(true);
          }}
          onMealLogBlocked={() => showToast('Log meals only after ending your fast.')}
          onMakeRecipe={() => setShowMakeRecipePage(true)}
          onFindRecipe={() => setShowFindRecipePage(true)}
          onViewMeal={(meal) => { setViewingMeal(meal); setLogMealMethod('scan'); setShowLogMealModal(true); }}
          onDeleteMeal={async (id) => {
            const prevMeals = recentMeals;
            setRecentMeals(prev => prev.filter(m => m.id !== id));
            const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', session.user.id);
            if (error) {
              setRecentMeals(prevMeals);
              showToast('Failed to delete meal. Try again.', 'error');
            }
          }}
        />
      )}

      {activeTab === 'progress' && (
        <ProgressTab
          onShowWeightModal={() => setShowWeightModal(true)}
          onShowFastingDetails={() => setShowFastingDetails(true)}
          onShowBMIDetails={() => setShowBMIDetails(true)}
          onShowCalorieDetails={() => setShowCalorieDetails(true)}
          onShowHydrationDetails={() => setShowHydrationDetails(true)}
          fastingSessions={fastingSessions}
          height={height}
          heightUnit={heightUnit}
          volumeUnit={volumeUnit}
          recentMeals={recentMeals}
          weightLogs={weightLogs}
          waterLogs={waterLogs}
          checkInHistory={checkInHistory}
          targetWeight={targetWeight}
          startingWeight={startingWeight}
        />
      )}

      {activeTab === 'whispers' && (
        <WhispersTab userName={userName} profileImage={profileImage} whisperPosts={whisperPosts} setWhisperPosts={setWhisperPosts} userId={session?.user?.id} />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          onLogout={() => {
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ]);
          }}
          onDeleteAccount={() => {
            Alert.alert(
              'Delete Account',
              'This will permanently delete your account and all your data. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const uid = session?.user?.id;
                    if (!uid) return;
                    try {
                      // Delete all user data from tables
                      await Promise.all([
                        supabase.from('meals').delete().eq('user_id', uid),
                        supabase.from('weight_logs').delete().eq('user_id', uid),
                        supabase.from('fasting_sessions').delete().eq('user_id', uid),
                        supabase.from('water_logs').delete().eq('user_id', uid),
                        supabase.from('check_ins').delete().eq('user_id', uid),
                        supabase.from('profiles').delete().eq('id', uid),
                      ]);
                      await AsyncStorage.clear();
                      await supabase.auth.signOut();
                    } catch (e) {
                      console.error('[DeleteAccount]', e);
                      showToast('Failed to delete account. Try again.', 'error');
                    }
                  },
                },
              ]
            );
          }}
          userName={userName}
          userEmail={userEmail}
          userCountry={userCountry}
          onSetCountry={(c) => { setUserCountry(c); upsertProfile({ country: c }, 'update country'); }}
          profileImage={profileImage}
          onEditProfile={() => setShowEditProfile(true)}
          onShowPlanPage={handleOpenPlanPage}
          onShowFastingQuiz={() => setShowFastingQuiz(true)}
          onShowNutritionQuiz={() => setShowNutritionQuiz(true)}
          selectedPlan={selectedPlan}
          height={height}
          setHeight={(val) => { setHeight(val); upsertProfile({ height: val }, 'update height'); }}
          heightUnit={heightUnit}
          setHeightUnit={(val) => { setHeightUnit(val); upsertProfile({ height_unit: val }, 'update height_unit'); }}
          weightUnit={weightUnit}
          setWeightUnit={(val) => { setWeightUnit(val); upsertProfile({ weight_unit: val }, 'update weight_unit'); }}
          foodMeasurement={foodMeasurement}
          setFoodMeasurement={(val) => { setFoodMeasurement(val); upsertProfile({ food_measurement: val }, 'update food_measurement'); }}
          dailyCalorieGoal={dailyCalorieGoal}
          setDailyCalorieGoal={(val) => { updateMacroGoalsFromCalories(val); upsertProfile({ daily_calorie_goal: val }, 'update daily_calorie_goal'); }}
          macroStyle={macroStyle}
          setMacroStyle={(style) => {
            setMacroStyle(style);
            upsertProfile({ macro_style: style }, 'update macro_style');
            if (style !== 'custom') {
              const split = MACRO_STYLE_SPLITS[style] || MACRO_STYLE_SPLITS.balanced;
              const p = Math.round((dailyCalorieGoal * split.protein) / 4);
              const c = Math.round((dailyCalorieGoal * split.carbs) / 4);
              const f = Math.round((dailyCalorieGoal * split.fats) / 9);
              setProteinGoal(p); setCarbsGoal(c); setFatsGoal(f);
              upsertProfile({ protein_goal: p, carbs_goal: c, fats_goal: f }, 'update macros from style');
            }
          }}
          proteinGoal={proteinGoal}
          setProteinGoal={(value) => { setMacroStyle('custom'); setProteinGoal(value); upsertProfile({ protein_goal: value, macro_style: 'custom' }, 'update protein_goal'); }}
          carbsGoal={carbsGoal}
          setCarbsGoal={(value) => { setMacroStyle('custom'); setCarbsGoal(value); upsertProfile({ carbs_goal: value, macro_style: 'custom' }, 'update carbs_goal'); }}
          fatsGoal={fatsGoal}
          setFatsGoal={(value) => { setMacroStyle('custom'); setFatsGoal(value); upsertProfile({ fats_goal: value, macro_style: 'custom' }, 'update fats_goal'); }}
          hydrationGoal={hydrationGoal}
          setHydrationGoal={(val) => { setHydrationGoal(val); upsertProfile({ hydration_goal: val }, 'update hydration_goal'); }}
          volumeUnit={volumeUnit}
          setVolumeUnit={(val) => { updateHydrationUnit(val); upsertProfile({ volume_unit: val }, 'update volume_unit'); }}
          targetWeight={targetWeight}
          setTargetWeight={(val) => { setTargetWeight(val); upsertProfile({ target_weight: val }, 'update target_weight'); }}
          startingWeight={startingWeight}
          setStartingWeight={(val) => { setStartingWeight(val); upsertProfile({ starting_weight: val }, 'update starting_weight'); }}
          notifyFastStart={notifyFastStart}
          onToggleNotifyFastStart={(val) => { setNotifyFastStart(val); val ? scheduleFastStartReminder() : cancelFastStartReminder(); }}
          notifyFastEnd={notifyFastEnd}
          onToggleNotifyFastEnd={(val) => { setNotifyFastEnd(val); if (!val) cancelFastingNotifications(); }}
          notifyMealReminder={notifyMealReminder}
          onToggleNotifyMealReminder={(val) => { setNotifyMealReminder(val); val ? scheduleMealReminder() : cancelMealReminder(); }}
          notifyMilestones={notifyMilestones}
          onToggleNotifyMilestones={setNotifyMilestones}
          userIcon={getUserIcon(session?.user?.id || '')}
          userIconColor={getUserColor(session?.user?.id || '')}
        />
      )}

      {/* === Overlay Pages === */}
      <ChatScreen
        show={showChat}
        onClose={() => { setShowChat(false); setChatOpeningContext(null); }}
        messages={chatMessages}
        setMessages={setChatMessages}
        openingContext={chatOpeningContext}
        userId={session?.user?.id}
        userName={userName}
        userCountry={userCountry}
        selectedPlan={selectedPlan}
        targetWeight={targetWeight}
        startingWeight={startingWeight}
        dailyCalorieGoal={dailyCalorieGoal}
        hydrationGoal={hydrationGoal}
        volumeUnit={volumeUnit}
        proteinGoal={proteinGoal}
        carbsGoal={carbsGoal}
        fatsGoal={fatsGoal}
        fastingSessions={fastingSessions}
        checkInHistory={checkInHistory}
        recentMeals={recentMeals}
        weightLogs={weightLogs}
        waterLogs={waterLogs}
      />

      <FastingCalendarPage
        show={showCalendar}
        onClose={() => setShowCalendar(false)}
        fastingSessions={fastingSessions}
        isFasting={isFasting}
        selectedPlan={selectedPlan}
        checkInHistory={checkInHistory}
        onShowCheckInPage={() => { setShowCheckInPage(true); }}
        volumeUnit={volumeUnit}
      />

      <CheckInPage
        show={showCheckInPage}
        onClose={() => setShowCheckInPage(false)}
        feelings={feelings}
        setFeelings={setFeelings}
        fastingStatus={fastingStatus}
        setFastingStatus={setFastingStatus}
        hungerLevel={hungerLevel}
        setHungerLevel={setHungerLevel}
        moods={moods}
        setMoods={setMoods}
        symptoms={symptoms}
        setSymptoms={setSymptoms}
        fastBreak={fastBreak}
        setFastBreak={setFastBreak}
        activities={activities}
        setActivities={setActivities}
        otherFactors={otherFactors}
        setOtherFactors={setOtherFactors}
        waterCount={waterCount}
        setWaterCount={setWaterCount}
        notes={notes}
        setNotes={setNotes}
        onSave={saveCheckIn}
        volumeUnit={volumeUnit}
        setVolumeUnit={setVolumeUnit}
        onViewWaterLogs={() => { setShowCheckInPage(false); setShowHydrationDetails(true); }}
      />

      <PlanSelectionPage
        show={showPlanPage}
        onClose={() => setShowPlanPage(false)}
        selectedPlan={selectedPlan}
        isFasting={isFasting}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan.id);
          upsertProfile({ selected_plan: plan.id }, 'save selected_plan');
        }}
      />

      <WeightLogPage
        show={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        weightLogs={weightLogs}
        setWeightLogs={setWeightLogs}
        weightUnit={weightUnit}
        setWeightUnit={setWeightUnit}
        onWeightSaved={(log) => dbSave(supabase.from('weight_logs').insert({ id: log.timestamp, user_id: session?.user?.id, date: log.date, weight: log.weight, unit: log.unit }), 'save weight_log', (msg) => showToast(msg, 'error'))}
        onWeightDeleted={(log) => dbSave(supabase.from('weight_logs').delete().eq('id', log.timestamp).eq('user_id', session?.user?.id), 'delete weight_log', (msg) => showToast(msg, 'error'))}
      />

      <HydrationDetailsPage
        show={showHydrationDetails}
        onClose={() => setShowHydrationDetails(false)}
        waterLogs={waterLogs}
        setWaterLogs={setWaterLogs}
        waterUnit={waterUnit}
        setWaterUnit={setWaterUnit}
        onWaterSaved={(log) => dbSave(supabase.from('water_logs').insert({ id: log.id, user_id: session?.user?.id, date: log.date, display_date: log.displayDate, amount: log.amount, unit: log.unit }), 'save water_log', (msg) => showToast(msg, 'error'))}
        onWaterDeleted={(log) => dbSave(supabase.from('water_logs').delete().eq('id', log.id).eq('user_id', session?.user?.id), 'delete water_log', (msg) => showToast(msg, 'error'))}
      />

      <CalorieDetailsPage
        show={showCalorieDetails}
        onClose={() => setShowCalorieDetails(false)}
        recentMeals={recentMeals}
      />

      <BMIDetailsPage
        show={showBMIDetails}
        onClose={() => setShowBMIDetails(false)}
        onShowWeightModal={() => {
          setShowBMIDetails(false);
          setShowWeightModal(true);
        }}
      />

      <FastingDetailsPage
        show={showFastingDetails}
        onClose={() => setShowFastingDetails(false)}
        fastingSessions={fastingSessions}
        checkInHistory={checkInHistory}
        onDeleteFastSession={handleDeleteFastSession}
      />

      {/* === Modals === */}
      <LogMealModal
        show={showLogMealModal}
        onClose={() => { setShowLogMealModal(false); setViewingMeal(null); }}
        logMealMethod={logMealMethod}
        onSaveMeal={async (meal) => {
          if (meal._updatePhoto) {
            // Background photo upload completed — update the photo URL silently
            setRecentMeals(prev => prev.map(m => m.id === meal.id ? { ...m, photo: meal.photo } : m));
            supabase.from('meals').update({ photo: meal.photo }).eq('id', meal.id);
            return;
          }
          setRecentMeals(prev => [meal, ...prev]);
          // Strip client-only fields before inserting to DB
          const { localPhoto, ...dbMeal } = meal;
          const { error } = await supabase.from('meals').insert({ ...dbMeal, user_id: session.user.id });
          if (error) showToast('Failed to save meal. Try again.', 'error');
          else showToast(`${meal.name || 'Meal'} logged!`);
        }}
        dailyCalorieGoal={dailyCalorieGoal}
        recentMeals={recentMeals}
        streak={(() => {
          let s = 0;
          const now = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dayStr = d.toDateString();
            if (recentMeals.some(m => m.date === dayStr)) s++;
            else break;
          }
          return s;
        })()}
        viewingMeal={viewingMeal}
      />

      <MakeRecipePage
        show={showMakeRecipePage}
        onClose={() => setShowMakeRecipePage(false)}
      />

      <FindRecipePage
        show={showFindRecipePage}
        onClose={() => setShowFindRecipePage(false)}
        savedRecipes={savedRecipes}
        onSaveMeal={(meal) => {
          const exists = savedRecipes.find(r => r.name === meal.name);
          if (exists) {
            setSavedRecipes(prev => prev.filter(r => r.name !== meal.name));
          } else {
            setSavedRecipes(prev => [meal, ...prev]);
          }
        }}
        onSayMeal={() => { setShowFindRecipePage(false); setLogMealMethod('say'); }}
        onWriteMeal={() => { setShowFindRecipePage(false); setLogMealMethod('write'); }}
      />

      <MakeRecipeModal
        show={showMakeRecipeModal}
        onClose={() => setShowMakeRecipeModal(false)}
        method={makeRecipeMethod}
      />

      <FindRecipeModal
        show={showFindRecipeModal}
        onClose={() => setShowFindRecipeModal(false)}
      />

      <EditProfileModal
        show={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        userName={userName}
        userEmail={userEmail}
        setUserName={setUserName}
        setUserEmail={setUserEmail}
        userCountry={userCountry}
        setUserCountry={setUserCountry}
        profileImage={profileImage}
        setProfileImage={setProfileImage}
        onSave={() => upsertProfile({ name: userName }, 'save profile name')}
      />

      <TimeEditModal
        show={showTimeModal}
        onClose={() => setShowTimeModal(false)}
        onSave={handleSaveTime}
        editingTime={editingTime}
        editDateStr={editDateStr}
        setEditDateStr={setEditDateStr}
        startHour={startHour}
        startMinute={startMinute}
        startSecond={startSecond}
        endHour={endHour}
        endMinute={endMinute}
        endSecond={endSecond}
        setStartHour={setStartHour}
        setStartMinute={setStartMinute}
        setStartSecond={setStartSecond}
        setEndHour={setEndHour}
        setEndMinute={setEndMinute}
        setEndSecond={setEndSecond}
      />

      {/* === End Fast Warning Modal === */}
      <Modal visible={showEndFastWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>{'\u23F1\uFE0F'}</Text>
            <Text style={styles.modalTitle}>End fast so soon?</Text>
            <Text style={styles.modalDesc}>
              You've been fasting for less than 30 minutes.{'\n'}This session won't be logged to your progress.
            </Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setShowEndFastWarning(false)}>
              <Text style={styles.modalPrimaryBtnText}>Continue Fasting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => confirmEndFast(false)}>
              <Text style={styles.modalSecondaryBtnText}>End Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === Bottom Navigation === */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        whispersUnlocked={userCount >= 25}
      />

      <FastingQuizPage
        show={showFastingQuiz}
        onClose={() => setShowFastingQuiz(false)}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan.id);
          upsertProfile({ selected_plan: plan.id }, 'save selected_plan from quiz');
          setShowFastingQuiz(false);
        }}
      />

      <NutritionQuizPage
        show={showNutritionQuiz}
        onClose={() => setShowNutritionQuiz(false)}
        onSaveGoals={(goals) => {
          setDailyCalorieGoal(goals.calories);
          setProteinGoal(goals.protein);
          setCarbsGoal(goals.carbs);
          setFatsGoal(goals.fats);
          setMacroStyle(closestMacroStyle(goals.protein, goals.carbs, goals.fats));
          setShowNutritionQuiz(false);
          showToast('Nutrition goals saved!');
        }}
      />

      {/* Toast notification */}
      {toastMessage !== '' && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
          <View style={[styles.toastIconCircle, toastType === 'error' && { backgroundColor: '#DC2626' }]}>
            <Text style={styles.toastCheckmark}>{toastType === 'error' ? '✕' : '✓'}</Text>
          </View>
          <Text style={styles.toastTitle}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  offlineBanner: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 100,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 9999,
  },
  toastIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCheckmark: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  toastSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  modalPrimaryBtn: {
    width: '100%',
    padding: 16,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    width: '100%',
    padding: 14,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FastingApp;
