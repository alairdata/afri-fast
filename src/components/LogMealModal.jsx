import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Animated, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Share, Modal } from 'react-native';
import Svg, { Path, Line, Polyline, Rect } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { uploadMealPhoto, enqueuePendingMealPhoto } from '../lib/mealPhotoUpload';

// Web-safe helper: convert a URI (blob URL or data URL) to base64 string
const readUriAsBase64 = async (uri) => {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) {
      return uri.split(',')[1];
    }
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
};

const DOT_COLORS = ['#4ade80', '#f59e0b', '#60a5fa', '#f472b6', '#a78bfa'];

// Match detected food names against recipe library — returns array of matching recipe IDs
const matchRecipes = (detectedFoods, recipes) => {
  const matched = new Set();
  detectedFoods.forEach(food => {
    const foodWords = food.name.toLowerCase().split(/\s+/);
    recipes.forEach(recipe => {
      const allNames = [
        recipe.name,
        ...Object.values(recipe.localNames || {}),
      ].map(n => n.toLowerCase());
      const recipeWords = allNames.flatMap(n => n.split(/\s+/));
      const hasMatch = foodWords.some(w => w.length > 2 && recipeWords.some(rw => rw.includes(w) || w.includes(rw)));
      if (hasMatch) matched.add(recipe.id);
    });
  });
  return [...matched];
};

export const saveCommunityPhotos = async (mealId, photoUrl, detectedFoods, recipes, userEmail) => {
  if (!photoUrl || !detectedFoods?.length) return;
  try {
    const recipeIds = matchRecipes(detectedFoods, recipes);
    console.log('[Community] matched recipe IDs:', recipeIds, 'foods:', detectedFoods.map(f => f.name));
    if (!recipeIds.length) return;
    const rows = recipeIds.map(recipe_id => ({
      recipe_id,
      meal_id: mealId,
      photo_url: photoUrl,
      user_email: userEmail || null,
      items: detectedFoods,
    }));
    const { error } = await supabase.from('recipe_community_photos').insert(rows);
    if (error) console.log('[Community photo insert error]', error.message, error.code);
    else console.log('[Community] saved', rows.length, 'photo(s)');
  } catch (e) {
    console.log('[Community photo save error]', e.message);
  }
};

const GEMINI_API_URL = '/api/gemini';

async function callGeminiApi(type, data) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gemini API error');
  return result;
}


const analyzeWithGemini = async (photoUri, onProgress, userCountry = '') => {
  try {
    onProgress?.(5);
    const base64 = await readUriAsBase64(photoUri);
    onProgress?.(15);

    // Animate progress while waiting for the server
    let pct = 15;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 2, 88);
      onProgress?.(pct);
    }, 400);

    let result;
    try {
      result = await callGeminiApi('scan_photo', { base64, userCountry });
    } finally {
      clearInterval(ticker);
    }

    onProgress?.(95);
    return result;
  } catch (e) {
    console.log('[Gemini] Error:', e.message);
    return { error: true, message: e.message };
  }
};

const analyzeTextWithGemini = async (mealText, onProgress) => {
  try {
    onProgress?.(8);
    let pct = 8;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 3, 88);
      onProgress?.(pct);
    }, 350);

    let result;
    try {
      result = await callGeminiApi('analyze_text', { mealText });
    } finally {
      clearInterval(ticker);
    }

    onProgress?.(95);
    return result;
  } catch (e) {
    console.log('[Gemini Text] Error:', e.message);
    return null;
  }
};

const lookupItemNutrition = async (itemName) => {
  try {
    return await callGeminiApi('lookup_nutrition', { itemName });
  } catch (e) {
    console.log('[Gemini Lookup] Error:', e.message);
    return null;
  }
};

const normalizeEditedQty = (foodName, oldQty, newQty) => {
  const trimmed = (newQty || '').trim();
  if (!trimmed) return oldQty || newQty;

  const hasLetters = /[a-zA-Z]/.test(trimmed);
  if (hasLetters) return trimmed;

  const fallbackName = (foodName || '').trim().toLowerCase() || 'serving';
  return `${trimmed} ${fallbackName}`;
};

const recalculateFoodPortionWithGemini = async (foodName, oldQty, newQty, currentNutrition = {}) => {
  const normalizedQty = normalizeEditedQty(foodName, oldQty, newQty);
  try {
    return await callGeminiApi('recalculate_portion', { foodName, oldQty, newQty: normalizedQty, currentNutrition });
  } catch (e) {
    console.log('[Gemini Portion Recalc] Error:', e.message);
    return null;
  }
};

const CI_FEELINGS = ['😌 Calm', '🎯 Focused', '⚡ Energized', '😴 Low energy', '🍽️ Hungry', '🤤 Very hungry', '😤 Irritable', '💪🏿 Motivated'];
const CI_FASTING_STATUS = ['✅ Fasting as planned', '⏰ Broke fast early', '⏳ Extended fast', '🍽️ Eating window day', '😴 Rest day (no fast)'];
const CI_HUNGER = ['😊 Not hungry', '🤔 Slightly hungry', '😋 Hungry', '🤤 Very hungry', '😫 Extreme hunger'];
const CI_MOODS = ['😌 Calm', '😊 Happy', '🎯 Focused', '💪🏿 Motivated', '😤 Irritable', '😰 Anxious', '😔 Low mood', '🌫️ Mentally foggy', '😓 Stressed'];
const CI_SYMPTOMS = ['✨ Everything feels fine', '😴 Low energy', '😵 Dizziness', '🤕 Headache', '💫 Weakness', '🥶 Cold sensitivity', '🍽️ Hunger pains', '🍫 Cravings', '🤢 Nausea', '🌫️ Brain fog', '🤔 Trouble concentrating', '😰 Shakiness'];
const CI_FAST_BREAK = ['🥗 Light meal', '🍔 Heavy meal', '🥩 Protein-focused', '🍞 Carb-heavy', '🍬 Sugary foods', '⚡ Ate too fast', '😊 Felt good after', '😣 Felt uncomfortable'];
const CI_ACTIVITIES = ["🚫 Didn't exercise", '🚶🏿 Walking', '🧘🏿 Yoga / stretching', '🏋🏿 Gym', '🏃🏿 Cardio', '💪🏿 Strength training', '⚽ Sports'];
const CI_OTHER = ['😓 Stress', '😴 Poor sleep', '😊 Good sleep', '✈️ Travel', '🧘🏿 Meditation', '🌬️ Breathwork', '🍷 Alcohol', '🎉 Social event', '🤒 Illness / injury'];

const ShareCardImage = ({ uri, height, style }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: '100%', height }}>
      {!loaded && (
        <View style={[style, { height, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      )}
      <Image
        source={{ uri }}
        style={[style, { height, opacity: loaded ? 1 : 0 }]}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
};

const LogMealModal = ({ show, onClose, logMealMethod, onSaveMeal, dailyCalorieGoal = 2000, recentMeals = [], viewingMeal = null, selectedMealDate = null, checkInHistory = [], onSaveCheckIn, volumeUnit = 'glasses', recipeToLog = null, recipes = [], userEmail = null, userCountry = '' }) => {
  const streak = useMemo(() => {
    let s = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (recentMeals.some(m => m.date === d.toDateString())) s++;
      else break;
    }
    return s;
  }, [recentMeals]);
  const [showMiniCheckIn, setShowMiniCheckIn] = useState(false);
  const [miniFeelings, setMiniFeelings] = useState([]);
  const [miniFastingStatus, setMiniFastingStatus] = useState(null);
  const [miniHungerLevel, setMiniHungerLevel] = useState(null);
  const [miniMoods, setMiniMoods] = useState([]);
  const [miniSymptoms, setMiniSymptoms] = useState([]);
  const [miniFastBreak, setMiniFastBreak] = useState([]);
  const [miniActivities, setMiniActivities] = useState([]);
  const [miniOtherFactors, setMiniOtherFactors] = useState([]);

  const toggleMini = (val, state, setState) => {
    setState(state.includes(val) ? state.filter(v => v !== val) : [...state, val]);
  };

  const openMiniCheckIn = () => {
    setMiniFeelings([]);
    setMiniFastingStatus(null);
    setMiniHungerLevel(null);
    setMiniMoods([]);
    setMiniSymptoms([]);
    setMiniFastBreak([]);
    setMiniActivities([]);
    setMiniOtherFactors([]);
    setShowMiniCheckIn(true);
  };

  const saveMiniCheckIn = () => {
    if (onSaveCheckIn) {
      onSaveCheckIn({
        feelings: miniFeelings, fastingStatus: miniFastingStatus,
        hungerLevel: miniHungerLevel, moods: miniMoods,
        symptoms: miniSymptoms, fastBreak: miniFastBreak,
        activities: miniActivities, otherFactors: miniOtherFactors,
      });
    }
    setShowMiniCheckIn(false);
    setMiniFeelings([]); setMiniFastingStatus(null); setMiniHungerLevel(null);
    setMiniMoods([]); setMiniSymptoms([]); setMiniFastBreak([]);
    setMiniActivities([]); setMiniOtherFactors([]);
  };

  const renderCheckInWidget = () => {
    const dateStr = viewingMeal?.date || (selectedMealDate ? selectedMealDate.toDateString() : new Date().toDateString());
    const checkIns = checkInHistory.filter(c => c.date === dateStr);
    const hasCheckIns = checkIns.length > 0;
    const ci = checkIns[0] || null;
    const allItems = ci ? [
      ...(ci.feelings || []),
      ...(ci.hungerLevel ? [ci.hungerLevel] : []),
      ...(ci.moods || []),
      ...(ci.symptoms || []),
      ...(ci.fastBreak || []),
      ...(ci.activities || []),
      ...(ci.otherFactors || []),
      ...(ci.fastingStatus ? [ci.fastingStatus] : []),
    ] : [];
    const emojis = allItems.map(item => {
      const spaceIdx = item.indexOf(' ');
      return spaceIdx > 0 ? item.slice(0, spaceIdx) : null;
    }).filter(Boolean);

    return (
      <View style={{ marginHorizontal: 20, marginBottom: 12, marginTop: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#111', marginBottom: 10, paddingHorizontal: 20 }}>CHECK-IN</Text>
        {hasCheckIns ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 }}>
                {emojis.map((emoji, i) => (
                  <View key={i} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: i % 2 === 0 ? '#ECFDF5' : '#FFF7ED' }}>
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </View>
                ))}
                {ci.waterCount > 0 && (
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                    <Ionicons name="water" size={16} color="#3B82F6" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 1 }}>{ci.waterCount}</Text>
                    <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '500' }}>{volumeUnit}</Text>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }} onPress={openMiniCheckIn}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' }} onPress={openMiniCheckIn} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="clipboard-outline" size={24} color="#D1D5DB" />
              <Text style={{ fontSize: 14, color: '#9CA3AF', fontWeight: '500' }}>No check-in recorded</Text>
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermSaved, setMicPermSaved] = useState(false);

  // Auto-request camera permission when scan tab is opened — OS handles "don't ask again"
  // Skip when just viewing a logged meal (viewingMeal = share card mode, no camera needed)
  useEffect(() => {
    if (logMealMethod === 'scan' && !viewingMeal) {
      requestPermission();
    }
  }, [logMealMethod, viewingMeal]);

  useEffect(() => {
    AsyncStorage.getItem('afri-fast-mic-perm').then((mic) => {
      if (mic === 'granted') setMicPermSaved(true);
    });
  }, []);
  const cameraRef = useRef(null);
  const shareCardRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedPhotoSize, setCapturedPhotoSize] = useState(null);
  const [scanPhase, setScanPhase] = useState('camera');
  const [selectedMealType, setSelectedMealType] = useState(() => {
    const h = new Date().getHours();
    return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner';
  });
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState(null);
  const [scanFromScreen, setScanFromScreen] = useState(false);
  const [mealTitle, setMealTitle] = useState(null);
  const scanProgressRef = useRef(null);
  const [editingQtyIdx, setEditingQtyIdx] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [updatingQtyIdx, setUpdatingQtyIdx] = useState(null);
  const [editingCalIdx, setEditingCalIdx] = useState(null);
  const [editCalInputValue, setEditCalInputValue] = useState('');
  const [mealInput, setMealInput] = useState('');
  const [detectedFoods, setDetectedFoods] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [detectProgress, setDetectProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sayPhase, setSayPhase] = useState('idle'); // 'idle' | 'recording' | 'detecting' | 'results'
  const [writePhase, setWritePhase] = useState('idle'); // 'idle' | 'detecting' | 'results'

  const SCAN_MESSAGES = [
    'Checking food distribution...',
    'Identifying ingredients...',
    'Calculating macros...',
    'Recognising portion sizes...',
    'Cross-checking calorie data...',
    'Analysing protein content...',
    'Checking carb levels...',
    'Estimating fat content...',
    'Looking up fibre data...',
    'Almost there...',
  ];
  const [scanMsgIndex, setScanMsgIndex] = useState(0);
  const [sayMsgIndex, setSayMsgIndex] = useState(0);
  const [writeMsgIndex, setWriteMsgIndex] = useState(0);

  // When opened with a pre-built recipe, skip straight to the share card
  useLayoutEffect(() => {
    if (!show || !recipeToLog) return;
    const mealDate = selectedMealDate ? new Date(selectedMealDate) : new Date();
    const isToday = mealDate.toDateString() === new Date().toDateString();
    const timeStr = `${isToday ? 'Today' : mealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    const mealId = Date.now();
    if (onSaveMeal) {
      onSaveMeal({
        id: mealId,
        name: recipeToLog.name,
        calories: recipeToLog.calories || 0,
        protein: recipeToLog.protein || 0,
        carbs: recipeToLog.carbs || 0,
        fats: recipeToLog.fats || 0,
        time: timeStr,
        date: mealDate.toDateString(),
        photo: recipeToLog.imageUrl || null,
        method: 'recipe',
        items: (recipeToLog.ingredients || []).map(i => i.name),
      });
    }
    if (recipeToLog.imageUrl) setCapturedPhoto(recipeToLog.imageUrl);
    setCapturedPhotoSize(null);
    setScanPhase('shareCard');
  }, [show, recipeToLog]);

  useEffect(() => {
    if (scanPhase !== 'results' || detectedFoods.length > 0 || scanError) return;
    const id = setInterval(() => {
      setScanMsgIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
    }, 1800);
    return () => clearInterval(id);
  }, [scanPhase, detectedFoods.length, scanError]);

  // Trickle the progress bar so it never looks frozen during API wait
  useEffect(() => {
    if (scanPhase !== 'results' || detectedFoods.length > 0 || scanError) return;
    const id = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 94) return prev; // hold before 95 — let real updates finish it
        const step = prev < 18 ? 0.6 : prev < 88 ? 0.25 : 0.1;
        return Math.min(94, prev + step);
      });
    }, 150);
    return () => clearInterval(id);
  }, [scanPhase, detectedFoods.length, scanError]);

  // Write phase: trickle progress + rotating messages
  useEffect(() => {
    if (writePhase !== 'detecting') return;
    const id = setInterval(() => {
      setWriteDetectProgress(prev => {
        if (prev >= 94) return prev;
        const step = prev < 18 ? 0.6 : prev < 88 ? 0.25 : 0.1;
        return Math.min(94, prev + step);
      });
    }, 150);
    return () => clearInterval(id);
  }, [writePhase]);

  useEffect(() => {
    if (writePhase !== 'detecting') return;
    const id = setInterval(() => {
      setWriteMsgIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
    }, 1800);
    return () => clearInterval(id);
  }, [writePhase]);

  // Say phase: trickle progress + rotating messages
  useEffect(() => {
    if (sayPhase !== 'detecting') return;
    const id = setInterval(() => {
      setDetectProgress(prev => {
        if (prev >= 94) return prev;
        const step = prev < 18 ? 0.6 : prev < 88 ? 0.25 : 0.1;
        return Math.min(94, prev + step);
      });
    }, 150);
    return () => clearInterval(id);
  }, [sayPhase]);

  useEffect(() => {
    if (sayPhase !== 'detecting') return;
    const id = setInterval(() => {
      setSayMsgIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
    }, 1800);
    return () => clearInterval(id);
  }, [sayPhase]);

  const [writeError, setWriteError] = useState(null);
  const [correctedInput, setCorrectedInput] = useState(null);
  const [recentWrites, setRecentWrites] = useState([
    'jollof rice and chicken',
    'eba and egusi soup',
  ]);
  const [writeDetectProgress, setWriteDetectProgress] = useState(0);
  const writeDetectRef = useRef(null);
  const [isFoodEditMode, setIsFoodEditMode] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCal, setNewItemCal] = useState('');
  const [addItemDetecting, setAddItemDetecting] = useState(false);
  const voiceIntervalRef = useRef(null);
  const typeIntervalRef = useRef(null);
  const recordingRef = useRef(null);
  const webSpeechRef = useRef(null);
  const webTranscriptRef = useRef('');
  const [waveBars, setWaveBars] = useState(() => Array.from({ length: 30 }, () => 4));
  const waveIntervalRef = useRef(null);
  const detectIntervalRef = useRef(null);

  useEffect(() => {
    if (viewingMeal && show) {
      setCapturedPhoto(viewingMeal.localPhoto || viewingMeal.photo || null);
      setDetectedFoods(viewingMeal.foods || []);
      setMealTitle(viewingMeal.name || null);
      setScanPhase('shareCard');
    }
  }, [viewingMeal, show]);

  // Reset write form whenever the modal is opened fresh for writing
  useEffect(() => {
    if (show && logMealMethod === 'write' && !viewingMeal) {
      resetWrite();
    }
  }, [show, logMealMethod]);

  if (!show) return null;

  const handleClose = () => {
    resetSay();
    resetWrite();
    resetScan();
    setDetectedFoods([]);
    setMealInput('');
    // Clear mini check-in so next meal always opens blank
    setMiniFeelings([]); setMiniFastingStatus(null); setMiniHungerLevel(null);
    setMiniMoods([]); setMiniSymptoms([]); setMiniFastBreak([]);
    setMiniActivities([]); setMiniOtherFactors([]);
    setShowMiniCheckIn(false);
    onClose();
  };

  const resetScan = () => {
    setCapturedPhoto(null);
    setCapturedPhotoSize(null);
    setScanPhase('camera');
    setScanProgress(0);
    setScanError(null);
    setScanFromScreen(false);
    setMealTitle(null);
    if (scanProgressRef.current) clearInterval(scanProgressRef.current);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4 });
      setCapturedPhoto(photo.uri);
      if (photo.width && photo.height) setCapturedPhotoSize({ width: photo.width, height: photo.height });
      setScanPhase('results');
      setDetectedFoods([]);
      setScanProgress(0);
      setScanError(null);
      const results = await analyzeWithGemini(photo.uri, setScanProgress, userCountry);
      setScanProgress(100);
      if (results?.error) {
        setScanError("Couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (results?.notFood) {
        setScanError(`No food detected — ${results.identified}. Try a clearer photo.`);
        return;
      }
      setScanFromScreen(results?.fromScreen || false);
      setMealTitle(results?.title || null);
      setTimeout(() => {
        setDetectedFoods((results?.foods || []).map((f, i) => ({ ...f, id: i })));
      }, 300);
    } catch (e) {
      console.log('Camera error:', e);
      if (scanProgressRef.current) clearInterval(scanProgressRef.current);
      setScanError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.4,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setCapturedPhoto(asset.uri);
    if (asset.width && asset.height) setCapturedPhotoSize({ width: asset.width, height: asset.height });
    setScanPhase('results');
    setDetectedFoods([]);
    setScanProgress(0);
    setScanError(null);
    const results = await analyzeWithGemini(asset.uri, setScanProgress, userCountry);
    setScanProgress(100);
    if (results?.error) {
      setScanError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    if (results?.notFood) {
      setScanError(`No food detected — ${results.identified}. Try a clearer photo.`);
      return;
    }
    setScanFromScreen(results?.fromScreen || false);
    setMealTitle(results?.title || null);
    setTimeout(() => {
      setDetectedFoods((results?.foods || []).map((f, i) => ({ ...f, id: i })));
    }, 300);
  };

  const resetWrite = () => {
    setWritePhase('idle');
    setWriteDetectProgress(0);
    setMealInput('');
    setDetectedFoods([]);
    setWriteError(null);
    setCorrectedInput(null);
    clearInterval(writeDetectRef.current);
  };

  const quickSuggestions = ['Jollof Rice', 'Eba & Soup', 'Plantain & Egg', 'Moi Moi', 'Suya', 'Fried Rice', 'Pepper Soup', 'Akara & Pap'];

  const isDuplicateFood = (name, existingFoods) => {
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm = normalize(name);
    return existingFoods.some(f => normalize(f.name) === norm);
  };

  const getDuplicateIndices = (foods) => {
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const seen = {};
    const dupes = new Set();
    foods.forEach((f, i) => {
      const key = normalize(f.name);
      if (seen[key] !== undefined) {
        dupes.add(seen[key]);
        dupes.add(i);
      } else {
        seen[key] = i;
      }
    });
    return dupes;
  };

  const submitWrite = async () => {
    if (!mealInput.trim()) return;
    setWriteError(null);
    setRecentWrites(prev => {
      const filtered = prev.filter(r => r !== mealInput.trim());
      return [mealInput.trim(), ...filtered].slice(0, 5);
    });
    setWritePhase('detecting');
    setWriteDetectProgress(0);

    // Try up to 3 times — Gemini can be inconsistent
    let results = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      results = await analyzeTextWithGemini(mealInput.trim());
      if (results && !results.notFood) break;
      if (results?.notFood) break; // genuine not-food, no point retrying
    }

    setWriteDetectProgress(100);
    if (!results) {
      setWriteError("Couldn't reach the server. Check your connection and try again.");
      setWritePhase('idle');
      return;
    }
    if (results.notFood) {
      setWriteError("Couldn't identify any food in that. Try being more specific — e.g. \"fufu with light soup and chicken\"");
      setWritePhase('idle');
      return;
    }
    setMealTitle(results.title || null);
    const typed = mealInput.trim();
    const corrected = results.correctedInput || null;
    setCorrectedInput(corrected && corrected.toLowerCase() !== typed.toLowerCase() ? corrected : null);
    setDetectedFoods((results.foods || []).map((f, i) => ({ ...f, id: i })));
    setWritePhase('results');
  };

  const convertToDataUrl = async (uri) => {
    if (!uri) return null;
    if (Platform.OS !== 'web') return uri;
    if (uri.startsWith('data:')) return uri;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(uri);
        reader.readAsDataURL(blob);
      });
    } catch {
      return uri;
    }
  };

  const handleSaveMeal = async () => {
    if (detectedFoods.length > 0 && onSaveMeal) {
      const mealDate = selectedMealDate ? new Date(selectedMealDate) : new Date();
      const isToday = mealDate.toDateString() === new Date().toDateString();
      const mealId = Date.now();
      const timeStr = `${isToday ? 'Today' : mealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      const photoUrl = await uploadMealPhoto(capturedPhoto) || await convertToDataUrl(capturedPhoto);
      onSaveMeal({
        id: mealId,
        name: mealTitle || detectedFoods.map(f => f.name).join(', '),
        calories: detectedFoods.reduce((sum, f) => sum + f.cal, 0),
        protein: detectedFoods.reduce((sum, f) => sum + (f.protein || 0), 0),
        carbs: detectedFoods.reduce((sum, f) => sum + (f.carbs || 0), 0),
        fats: detectedFoods.reduce((sum, f) => sum + (f.fats || 0), 0),
        time: timeStr,
        items: detectedFoods.map(f => `${f.name} (${f.qty})`),
        date: mealDate.toDateString(),
        photo: photoUrl,
        foods: detectedFoods,
      });
      saveCommunityPhotos(mealId, photoUrl, detectedFoods, recipes, userEmail);
    }
    handleClose();
  };

  const resetSay = () => {
    setIsRecording(false);
    setVoiceTranscript('');
    setSayPhase('idle');
    setDetectProgress(0);
    setDetectedFoods([]);
    clearInterval(voiceIntervalRef.current);
    clearInterval(typeIntervalRef.current);
    clearInterval(detectIntervalRef.current);
  };

  const startRec = async () => {
    setVoiceTranscript('');
    webTranscriptRef.current = '';
    waveIntervalRef.current = setInterval(() => {
      setWaveBars(Array.from({ length: 30 }, () => 4 + Math.random() * 26));
    }, 120);
    setIsRecording(true);
    setSayPhase('recording');

    if (Platform.OS === 'web') {
      // Web: use SpeechRecognition API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        clearInterval(waveIntervalRef.current);
        setIsRecording(false);
        setSayPhase('idle');
        alert('Voice recognition is not supported in this browser. Try Chrome or Edge.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        webTranscriptRef.current = transcript;
        setVoiceTranscript(transcript);
      };
      recognition.onerror = () => {
        clearInterval(waveIntervalRef.current);
        setIsRecording(false);
        setSayPhase('idle');
      };
      webSpeechRef.current = recognition;
      recognition.start();
    } else {
      // Native: use expo-av
      try {
        if (!micPermSaved) {
          const { granted } = await Audio.requestPermissionsAsync();
          if (!granted) {
            clearInterval(waveIntervalRef.current);
            setIsRecording(false);
            setSayPhase('idle');
            return;
          }
          setMicPermSaved(true);
          AsyncStorage.setItem('afri-fast-mic-perm', 'granted');
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
      } catch (e) {
        console.log('[Audio] Start error:', e.message);
        clearInterval(waveIntervalRef.current);
        setIsRecording(false);
        setSayPhase('idle');
      }
    }
  };

  const cancelRec = async () => {
    clearInterval(waveIntervalRef.current);
    if (Platform.OS === 'web') {
      webSpeechRef.current?.stop();
      webSpeechRef.current = null;
    } else {
      try {
        await recordingRef.current?.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (_) {}
    }
    resetSay();
  };

  const confirmRec = async () => {
    clearInterval(waveIntervalRef.current);
    setIsRecording(false);

    if (Platform.OS === 'web') {
      // Stop recognition and use transcript
      webSpeechRef.current?.stop();
      webSpeechRef.current = null;
      const transcript = webTranscriptRef.current.trim();
      if (!transcript) { setSayPhase('idle'); return; }
      setSayPhase('detecting');
      setDetectProgress(0);
      let results = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        results = await analyzeTextWithGemini(transcript);
        if (results && !results.notFood) break;
        if (results?.notFood) break;
      }
      setDetectProgress(100);
      if (!results || results.notFood) { setSayPhase('idle'); return; }
      setMealTitle(results.title || null);
      setVoiceTranscript(results.correctedInput || transcript);
      setDetectedFoods((results.foods || []).map((f, i) => ({ ...f, id: i })));
      setSayPhase('results');
      return;
    }

    // Native: send audio to Gemini
    try {
      await recordingRef.current?.stopAndUnloadAsync();
    } catch (_) {}
    const uri = recordingRef.current?.getURI();
    recordingRef.current = null;
    if (!uri) { setSayPhase('idle'); return; }
    setSayPhase('detecting');
    setDetectProgress(0);
    try {
      const base64 = await readUriAsBase64(uri);
      const result = await callGeminiApi('analyze_audio', { base64 });
      setDetectProgress(100);
      if (!result || result.notFood) { setSayPhase('idle'); return; }
      setMealTitle(result.title || null);
      setVoiceTranscript(result.title || 'Meal detected');
      setDetectedFoods((result.foods || []).map((f, i) => ({
        name: f.name || 'Unknown', qty: f.qty || '1 serving',
        cal: f.cal || 0, protein: f.protein || 0,
        carbs: f.carbs || 0, fats: f.fats || 0, fiber: f.fiber || 0, id: i,
      })));
      setSayPhase('results');
    } catch (e) {
      console.log('[Gemini Audio] Error:', e.message);
      setSayPhase('idle');
    }
  };

  const getTotalCal = () => detectedFoods.reduce((sum, f) => sum + f.cal, 0);

  const logMeal = () => {
    if (detectedFoods.length > 0 && onSaveMeal) {
      const mealDate = selectedMealDate ? new Date(selectedMealDate) : new Date();
      const isToday = mealDate.toDateString() === new Date().toDateString();
      const mealId = Date.now();
      const timeStr = `${isToday ? 'Today' : mealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      // Save immediately with local photo URI so it appears in the list right away
      onSaveMeal({
        id: mealId,
        name: mealTitle || detectedFoods.map(f => f.name).join(', '),
        calories: detectedFoods.reduce((sum, f) => sum + f.cal, 0),
        protein: detectedFoods.reduce((sum, f) => sum + (f.protein || 0), 0),
        carbs: detectedFoods.reduce((sum, f) => sum + (f.carbs || 0), 0),
        fats: detectedFoods.reduce((sum, f) => sum + (f.fats || 0), 0),
        time: timeStr,
        items: detectedFoods.map(f => `${f.name} (${f.qty})`),
        date: mealDate.toDateString(),
        photo: capturedPhoto,        // local URI — loads instantly in same session
        localPhoto: capturedPhoto,   // kept even after remote URL replaces photo
        foods: detectedFoods,
      });
      // Upload photo in background, then swap in the remote URL (localPhoto stays for fast display).
      // If the upload fails, stage the file and enqueue it for retry on next app open.
      if (capturedPhoto) {
        uploadMealPhoto(capturedPhoto).then(photoUrl => {
          if (photoUrl) {
            Image.prefetch(photoUrl).catch(() => {});
            onSaveMeal({ id: mealId, _updatePhoto: true, photo: photoUrl });
            saveCommunityPhotos(mealId, photoUrl, detectedFoods, recipes, userEmail);
          } else {
            enqueuePendingMealPhoto({ mealId, localUri: capturedPhoto, items: detectedFoods });
          }
        }).catch(() => {
          enqueuePendingMealPhoto({ mealId, localUri: capturedPhoto, items: detectedFoods });
        });
      }
    }
    setScanPhase('shareCard');
  };

  return (
    <KeyboardAvoidingView style={styles.weightPageOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.weightPage}>
        <View style={styles.weightPageHeader}>
          <TouchableOpacity
            onPress={logMealMethod === 'write' && writePhase === 'results' ? resetWrite : handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerSubtitle}>LOG FOOD</Text>
            <Text style={styles.headerTitle}>
              {logMealMethod === 'scan' ? 'Scan your meal' : logMealMethod === 'write' ? 'Write your meal' : logMealMethod === 'recipe' ? 'Make your meal' : 'Say your meal'}
            </Text>
          </View>
        </View>


        {/* Scan Results — non-scrollable, full view */}
        {logMealMethod === 'scan' && scanPhase === 'results' && (
            <ScrollView style={styles.scanResultsContainer} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {capturedPhoto && (
                <Image source={{ uri: capturedPhoto }} style={styles.scanResultImage} />
              )}

              {detectedFoods.length === 0 ? (
                <View style={styles.detectSection}>
                  {scanError ? (
                    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 12 }}>
                      <Ionicons name="cloud-offline-outline" size={36} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15, textAlign: 'center' }}>{scanError}</Text>
                      <TouchableOpacity onPress={resetScan} style={{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#059669', borderRadius: 20 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : scanProgress >= 100 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 12 }}>
                      <Ionicons name="search-outline" size={36} color="#9CA3AF" />
                      <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15, textAlign: 'center' }}>Couldn't identify any food items.{'\n'}Try a clearer photo.</Text>
                      <TouchableOpacity onPress={resetScan} style={{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#059669', borderRadius: 20 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.detectLabelRow}>
                        <Text style={styles.detectLabel}>{SCAN_MESSAGES[scanMsgIndex]}</Text>
                        <Text style={styles.detectPct}>{Math.round(scanProgress)}%</Text>
                      </View>
                      <View style={styles.detectTrack}>
                        <View style={[styles.detectFill, { width: Math.round(scanProgress) + '%' }]} />
                      </View>
                    </>
                  )}
                </View>
              ) : (
                <View>
                  {/* Retake row */}
                  <View style={styles.reRecordRow}>
                    <View style={styles.reRecordLine} />
                    <TouchableOpacity style={styles.reRecordBtn} onPress={resetScan}>
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.reRecordLine} />
                  </View>

                  {/* Food List Card — same as say page */}
                  {scanFromScreen && (
                    <View style={styles.screenScanBanner}>
                      <Ionicons name="monitor-outline" size={16} color="#92400e" />
                      <Text style={styles.screenScanBannerText}>
                        Looks like this was scanned from a screen. Portions may not be accurate — good idea to rescan when you have the actual meal in front of you.
                      </Text>
                    </View>
                  )}
                  <Text style={styles.portionNote}>Portions not right? Tap the green label to adjust.</Text>
                  <View style={styles.foodCard}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>DETECTED FOODS</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.foodCardCount}>{detectedFoods.length} items</Text>
                        <TouchableOpacity onPress={() => { setIsFoodEditMode(p => !p); setShowAddItem(false); }}>
                          <Text style={[styles.foodCardEditBtn, isFoodEditMode && { color: '#059669' }]}>
                            {isFoodEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {getDuplicateIndices(detectedFoods).size > 0 && (
                      <View style={styles.dupeBanner}>
                        <Ionicons name="warning-outline" size={14} color="#92400e" />
                        <Text style={styles.dupeBannerText}>Duplicate items found — remove extras so they're not double-counted</Text>
                      </View>
                    )}
                    {detectedFoods.map((food, i) => (
                      <View key={i} style={styles.foodRow}>
                        {isFoodEditMode && (
                          <TouchableOpacity style={styles.foodDeleteBtn} onPress={() => setDetectedFoods(prev => prev.filter((_, idx) => idx !== i))}>
                            <Ionicons name="remove-circle" size={22} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.foodName}>{food.name}</Text>
                            {getDuplicateIndices(detectedFoods).has(i) && (
                              <View style={styles.dupeFoodBadge}><Text style={styles.dupeFoodBadgeText}>duplicate</Text></View>
                            )}
                          </View>
                          {editingQtyIdx === i ? (
                            <View style={styles.editQtyRow}>
                              <TextInput
                                style={styles.editQtyInput}
                                value={editQtyValue}
                                onChangeText={setEditQtyValue}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.editQtyDone}
                                onPress={async () => {
                                  if (!editQtyValue.trim()) {
                                    setEditingQtyIdx(null);
                                    return;
                                  }

                                  const newQty = editQtyValue.trim();
                                  setEditingQtyIdx(null);
                                  setUpdatingQtyIdx(i);

                                  const bareNum = /^\d+(\.\d+)?$/.test(newQty) ? parseFloat(newQty) : null;
                                  if (bareNum !== null && bareNum > 0) {
                                    setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                      ...f,
                                      qty: `${newQty} serving${bareNum !== 1 ? 's' : ''}`,
                                      cal: Math.round(food.cal * bareNum),
                                      protein: Math.round(food.protein * bareNum * 10) / 10,
                                      carbs: Math.round(food.carbs * bareNum * 10) / 10,
                                      fats: Math.round(food.fats * bareNum * 10) / 10,
                                      fiber: Math.round(food.fiber * bareNum * 10) / 10,
                                    } : f));
                                    setUpdatingQtyIdx(null);
                                    return;
                                  }

                                  const recalculated = await recalculateFoodPortionWithGemini(food.name, food.qty, newQty, food);

                                  setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                    ...f,
                                    name: recalculated?.name || f.name,
                                    qty: recalculated?.qty || normalizeEditedQty(food.name, food.qty, newQty),
                                    cal: (recalculated?.cal > 0) ? recalculated.cal : f.cal,
                                    protein: recalculated?.protein ?? f.protein ?? 0,
                                    carbs: recalculated?.carbs ?? f.carbs ?? 0,
                                    fats: recalculated?.fats ?? f.fats ?? 0,
                                    fiber: recalculated?.fiber ?? f.fiber ?? 0,
                                  } : f));

                                  setUpdatingQtyIdx(null);
                                }}
                                disabled={updatingQtyIdx === i}
                              >
                                <Text style={styles.editQtyDoneText}>Done</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.foodQtyEditable}
                              onPress={() => { setEditingQtyIdx(i); setEditQtyValue(food.qty); }}
                            >
                              <Text style={styles.foodQtyEditableText}>{food.qty}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {editingQtyIdx !== i && (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, f.cal - 25) } : f))}>
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', minWidth: 50 }}>
                              {updatingQtyIdx === i ? (
                                <ActivityIndicator size="small" color="#059669" />
                              ) : isFoodEditMode && editingCalIdx === i ? (
                                <TextInput
                                  style={styles.calInlineInput}
                                  value={editCalInputValue}
                                  onChangeText={setEditCalInputValue}
                                  keyboardType="numeric"
                                  autoFocus
                                  selectTextOnFocus
                                  onBlur={() => {
                                    const val = parseInt(editCalInputValue);
                                    if (!isNaN(val)) setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, val) } : f));
                                    setEditingCalIdx(null);
                                  }}
                                />
                              ) : (
                                <TouchableOpacity
                                  disabled={!isFoodEditMode}
                                  onPress={() => { setEditingCalIdx(i); setEditCalInputValue(String(food.cal)); }}
                                >
                                  <Text style={[styles.foodCal, isFoodEditMode && { textDecorationLine: 'underline', color: '#059669' }]}>{food.cal}</Text>
                                </TouchableOpacity>
                              )}
                              <Text style={styles.foodCalLabel}>CAL</Text>
                            </View>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: f.cal + 25 } : f))}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}

                    {/* Add item row */}
                    {isFoodEditMode && (
                      showAddItem ? (
                        <View style={styles.addItemRow}>
                          <TextInput
                            style={styles.addItemNameInput}
                            placeholder="Item name"
                            placeholderTextColor="#aaa"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[styles.addItemConfirm, addItemDetecting && { opacity: 0.6 }]}
                            disabled={addItemDetecting}
                            onPress={async () => {
                              if (!newItemName.trim()) return;
                              setAddItemDetecting(true);
                              const result = await lookupItemNutrition(newItemName.trim());
                              setDetectedFoods(prev => [...prev, result || {
                                name: newItemName.trim(),
                                qty: '1 serving',
                                cal: 0,
                                protein: 0, carbs: 0, fats: 0, fiber: 0,
                              }]);
                              setNewItemName('');
                              setAddItemDetecting(false);
                              setShowAddItem(false);
                            }}
                          >
                            {addItemDetecting
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.addItemConfirmText}>Add</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAddItem(true)}>
                          <Ionicons name="add-circle-outline" size={18} color="#059669" />
                          <Text style={styles.addItemBtnText}>Add item</Text>
                        </TouchableOpacity>
                      )
                    )}

                    <View style={styles.foodTotal}>
                      <Text style={styles.foodTotalLabel}>TOTAL</Text>
                      <Text style={styles.foodTotalValue}>{detectedFoods.reduce((s, f) => s + f.cal, 0)} cal</Text>
                    </View>
                  </View>

                  {/* Meal type selector */}
                  <View style={[styles.foodCard, { marginTop: 16 }]}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>MEAL TYPE</Text>
                    </View>
                    <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                      {['Breakfast', 'Lunch', 'Snack', 'Dinner'].map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setSelectedMealType(type)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            backgroundColor: selectedMealType === type ? '#059669' : '#F9FAFB',
                            borderWidth: 1.5,
                            borderColor: selectedMealType === type ? '#059669' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: selectedMealType === type ? '#fff' : '#9CA3AF' }}>
                            {type.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {renderCheckInWidget()}

                  {/* Log Meal */}
                  <TouchableOpacity style={styles.logBtn} onPress={logMeal}>
                    <Text style={styles.logBtnText}>Log Meal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
        )}

        {/* Write Method — idle / detecting states */}
        {logMealMethod === 'write' && scanPhase !== 'shareCard' && writePhase !== 'results' && (
          <View style={{ flex: 1, padding: 20 }}>
            {/* Input Box */}
            <View style={styles.writeInputWrapper}>
              {writePhase === 'idle' ? (
                <TextInput
                  multiline
                  style={styles.writeInput}
                  placeholder={"e.g. Two wraps of fufu with light soup and fish, plus a bottle of water..."}
                  placeholderTextColor="#9dbfab"
                  value={mealInput}
                  onChangeText={(t) => { setMealInput(t); setWriteError(null); }}
                  cursorColor="#059669"
                  selectionColor="rgba(5,150,105,0.18)"
                />
              ) : (
                <Text style={styles.writeInputText}>{mealInput}</Text>
              )}
            </View>

            {/* Suggestion chips */}
            {writePhase === 'idle' && (
              <View style={styles.chipRow}>
                {['Jollof rice', 'Fufu + soup', 'Waakye', 'Eba + egusi', 'Suya'].map((s, i) => (
                  <TouchableOpacity key={i} style={styles.chip} onPress={() => setMealInput(prev => prev ? prev + ', ' + s : s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Error banner */}
            {writeError && writePhase === 'idle' && (
              <View style={styles.writeErrorBanner}>
                <Ionicons name="warning-outline" size={18} color="#fff" />
                <Text style={styles.writeErrorText}>
                  That doesn't look like a food. Try something like "Jollof Rice" or "Fufu and Egusi".
                </Text>
              </View>
            )}

            {/* Bottom row */}
            {writePhase === 'idle' && (
              <View style={styles.writeBottomRow}>
                <Text style={styles.writeNaturalHint}>Just describe it naturally 🌿</Text>
                <TouchableOpacity
                  style={[styles.writeDetectBtn, mealInput.trim().length === 0 && { opacity: 0.4 }]}
                  onPress={submitWrite}
                  disabled={mealInput.trim().length === 0}
                >
                  <Text style={styles.writeDetectBtnText}>Detect meal  →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Detecting Progress */}
            {writePhase === 'detecting' && (
              <View style={styles.detectSection}>
                <View style={styles.detectLabelRow}>
                  <Text style={styles.detectLabel}>
                    {writeDetectProgress >= 100 ? 'Foods detected!' : SCAN_MESSAGES[writeMsgIndex]}
                  </Text>
                  <Text style={styles.detectPct}>{Math.round(writeDetectProgress)}%</Text>
                </View>
                <View style={styles.detectTrack}>
                  <View style={[styles.detectFill, { width: Math.round(writeDetectProgress) + '%' }]} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Write Results — full-height scrollable layout, mirrors scan results */}
        {logMealMethod === 'write' && writePhase === 'results' && (
          <ScrollView style={styles.scanResultsContainer} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Re-write row */}
            <View style={[styles.reRecordRow, { marginHorizontal: 20 }]}>
              <View style={styles.reRecordLine} />
              <TouchableOpacity style={styles.reRecordBtn} onPress={resetWrite}>
                <Ionicons name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={styles.reRecordLine} />
            </View>

            {correctedInput && (
              <Text style={{ fontSize: 12, color: '#059669', marginBottom: 8, marginHorizontal: 20 }}>
                Showing results for "{correctedInput}"
              </Text>
            )}

            <Text style={[styles.portionNote, { marginHorizontal: 20 }]}>Portions not right? Tap the green label to adjust.</Text>

            <View style={styles.foodCard}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>DETECTED FOODS</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.foodCardCount}>{detectedFoods.length} items</Text>
                        <TouchableOpacity onPress={() => { setIsFoodEditMode(p => !p); setShowAddItem(false); }}>
                          <Text style={[styles.foodCardEditBtn, isFoodEditMode && { color: '#059669' }]}>
                            {isFoodEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {getDuplicateIndices(detectedFoods).size > 0 && (
                      <View style={styles.dupeBanner}>
                        <Ionicons name="warning-outline" size={14} color="#92400e" />
                        <Text style={styles.dupeBannerText}>Duplicate items found — remove extras so they're not double-counted</Text>
                      </View>
                    )}
                    {detectedFoods.map((food, i) => (
                      <View key={i} style={styles.foodRow}>
                        {isFoodEditMode && (
                          <TouchableOpacity style={styles.foodDeleteBtn} onPress={() => setDetectedFoods(prev => prev.filter((_, idx) => idx !== i))}>
                            <Ionicons name="remove-circle" size={22} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.foodName}>{food.name}</Text>
                            {getDuplicateIndices(detectedFoods).has(i) && (
                              <View style={styles.dupeFoodBadge}><Text style={styles.dupeFoodBadgeText}>duplicate</Text></View>
                            )}
                          </View>
                          {editingQtyIdx === i ? (
                            <View style={styles.editQtyRow}>
                              <TextInput
                                style={styles.editQtyInput}
                                value={editQtyValue}
                                onChangeText={setEditQtyValue}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.editQtyDone}
                                onPress={async () => {
                                  if (!editQtyValue.trim()) { setEditingQtyIdx(null); return; }
                                  const newQty = editQtyValue.trim();
                                  setEditingQtyIdx(null);
                                  setUpdatingQtyIdx(i);
                                  const bareNum2 = /^\d+(\.\d+)?$/.test(newQty) ? parseFloat(newQty) : null;
                                  if (bareNum2 !== null && bareNum2 > 0) {
                                    setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                      ...f,
                                      qty: `${newQty} serving${bareNum2 !== 1 ? 's' : ''}`,
                                      cal: Math.round(food.cal * bareNum2),
                                      protein: Math.round(food.protein * bareNum2 * 10) / 10,
                                      carbs: Math.round(food.carbs * bareNum2 * 10) / 10,
                                      fats: Math.round(food.fats * bareNum2 * 10) / 10,
                                      fiber: Math.round(food.fiber * bareNum2 * 10) / 10,
                                    } : f));
                                    setUpdatingQtyIdx(null);
                                    return;
                                  }
                                  const recalculated = await recalculateFoodPortionWithGemini(food.name, food.qty, newQty, food);
                                  setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                    ...f,
                                    name: recalculated?.name || f.name,
                                    qty: recalculated?.qty || normalizeEditedQty(food.name, food.qty, newQty),
                                    cal: (recalculated?.cal > 0) ? recalculated.cal : f.cal,
                                    protein: recalculated?.protein ?? f.protein ?? 0,
                                    carbs: recalculated?.carbs ?? f.carbs ?? 0,
                                    fats: recalculated?.fats ?? f.fats ?? 0,
                                    fiber: recalculated?.fiber ?? f.fiber ?? 0,
                                  } : f));
                                  setUpdatingQtyIdx(null);
                                }}
                                disabled={updatingQtyIdx === i}
                              >
                                <Text style={styles.editQtyDoneText}>Done</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.foodQtyEditable}
                              onPress={() => { setEditingQtyIdx(i); setEditQtyValue(food.qty); }}
                            >
                              <Text style={styles.foodQtyEditableText}>{food.qty}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {editingQtyIdx !== i && (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, f.cal - 25) } : f))}>
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', minWidth: 50 }}>
                              {updatingQtyIdx === i ? (
                                <ActivityIndicator size="small" color="#059669" />
                              ) : isFoodEditMode && editingCalIdx === i ? (
                                <TextInput
                                  style={styles.calInlineInput}
                                  value={editCalInputValue}
                                  onChangeText={setEditCalInputValue}
                                  keyboardType="numeric"
                                  autoFocus
                                  selectTextOnFocus
                                  onBlur={() => {
                                    const val = parseInt(editCalInputValue);
                                    if (!isNaN(val)) setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, val) } : f));
                                    setEditingCalIdx(null);
                                  }}
                                />
                              ) : (
                                <TouchableOpacity
                                  disabled={!isFoodEditMode}
                                  onPress={() => { setEditingCalIdx(i); setEditCalInputValue(String(food.cal)); }}
                                >
                                  <Text style={[styles.foodCal, isFoodEditMode && { textDecorationLine: 'underline', color: '#059669' }]}>{food.cal}</Text>
                                </TouchableOpacity>
                              )}
                              <Text style={styles.foodCalLabel}>CAL</Text>
                            </View>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: f.cal + 25 } : f))}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}

                    {/* Add item */}
                    {isFoodEditMode && (
                      showAddItem ? (
                        <View style={styles.addItemRow}>
                          <TextInput
                            style={styles.addItemNameInput}
                            placeholder="Item name"
                            placeholderTextColor="#aaa"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[styles.addItemConfirm, addItemDetecting && { opacity: 0.6 }]}
                            disabled={addItemDetecting}
                            onPress={async () => {
                              if (!newItemName.trim()) return;
                              setAddItemDetecting(true);
                              const result = await lookupItemNutrition(newItemName.trim());
                              setDetectedFoods(prev => [...prev, result || { name: newItemName.trim(), qty: '1 serving', cal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }]);
                              setNewItemName('');
                              setAddItemDetecting(false);
                              setShowAddItem(false);
                            }}
                          >
                            {addItemDetecting
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.addItemConfirmText}>Add</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAddItem(true)}>
                          <Ionicons name="add-circle-outline" size={18} color="#059669" />
                          <Text style={styles.addItemBtnText}>Add item</Text>
                        </TouchableOpacity>
                      )
                    )}

                    <View style={styles.foodTotal}>
                      <Text style={styles.foodTotalLabel}>TOTAL</Text>
                      <Text style={styles.foodTotalValue}>{detectedFoods.reduce((s, f) => s + f.cal, 0)} cal</Text>
                    </View>
                  </View>

                  <View style={[styles.foodCard, { marginTop: 16 }]}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>MEAL TYPE</Text>
                    </View>
                    <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                      {['Breakfast', 'Lunch', 'Snack', 'Dinner'].map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setSelectedMealType(type)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            backgroundColor: selectedMealType === type ? '#059669' : '#F9FAFB',
                            borderWidth: 1.5,
                            borderColor: selectedMealType === type ? '#059669' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: selectedMealType === type ? '#fff' : '#9CA3AF' }}>
                            {type.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

            {renderCheckInWidget()}

            <TouchableOpacity style={[styles.logBtn, { marginHorizontal: 20 }]} onPress={logMeal}>
              <Text style={styles.logBtnText}>Log Meal</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Share Card Screen — full-height, no double padding */}
        {scanPhase === 'shareCard' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.shareCardScreen} showsVerticalScrollIndicator={false}>
              {/* Success label */}
              <View style={styles.shareCardSuccessRow}>
                <View style={styles.shareCardSuccessBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.shareCardSuccessText}>Meal logged!</Text>
                </View>
              </View>

              {/* The visible card */}
              <View ref={shareCardRef} collapsable={false} style={styles.shareCardVisible}>
                {/* IMAGE PANEL — natural aspect ratio */}
                {(() => {
                  const screenWidth = Dimensions.get('window').width - 48;
                  const imgHeight = capturedPhotoSize
                    ? Math.min((screenWidth * capturedPhotoSize.height) / capturedPhotoSize.width, 620)
                    : 380;
                  return (
                    <View style={[styles.shareCardImgPanel, { height: imgHeight }]}>
                      {capturedPhoto && (
                        <ShareCardImage uri={capturedPhoto} height={imgHeight} style={styles.shareCardImage} />
                      )}
                    </View>
                  );
                })()}

                {/* INFO PANEL — everything below the image */}
                <View style={styles.shareCardInfoPanel}>
                  {/* Top row: on track label (left) + streak (right) */}
                  <View style={styles.shareCardTopRow}>
                    {(() => {
                      const dateStr = selectedMealDate ? new Date(selectedMealDate).toDateString() : new Date().toDateString();
                      const dayCal = recentMeals.filter(m => m.date === dateStr).reduce((s, m) => s + (m.calories || 0), 0);
                      const over = dayCal > dailyCalorieGoal;
                      return (
                        <View style={[styles.shareCardTrackBadge, over && { backgroundColor: 'rgba(249,115,22,0.2)', borderColor: 'rgba(249,115,22,0.35)' }]}>
                          <Text style={[styles.shareCardTrackText, over && { color: '#f97316' }]}>
                            {over ? 'Over Goal ✕' : 'On Track ✓'}
                          </Text>
                        </View>
                      );
                    })()}
                    <View style={styles.shareCardStreakBadge}>
                      <Text style={styles.shareCardStreakNum}>{streak}🔥</Text>
                      <Text style={styles.shareCardStreakLabel}>Day Streak</Text>
                    </View>
                  </View>
                </View>

                {/* KCAL + PROGRESS */}
                {(() => {
                  const dateStr = selectedMealDate ? new Date(selectedMealDate).toDateString() : new Date().toDateString();
                  const dayTotal = recentMeals.filter(m => m.date === dateStr).reduce((s, m) => s + (m.calories || 0), 0);
                  const mealCal = detectedFoods.length > 0
                    ? detectedFoods.reduce((s, f) => s + (f.cal || 0), 0)
                    : (viewingMeal?.calories || 0);
                  const rawPct = dailyCalorieGoal > 0 ? dayTotal / dailyCalorieGoal : 0;
                  const isOver = rawPct > 1;
                  const barPct = Math.min(rawPct, 1);
                  return (
                    <View style={styles.shareCardKcalSection}>
                      <View style={styles.shareCardKcalRow}>
                        <View style={styles.shareCardKcalBig}>
                          <Text style={[styles.shareCardKcalNumber, mealCal >= 1000 && { fontSize: 40, letterSpacing: -2 }]}>{mealCal}</Text>
                          <Text style={styles.shareCardKcalUnit}>kcal</Text>
                        </View>
                        <View style={styles.shareCardProgressCol}>
                          <View style={styles.shareCardProgressMeta}>
                            <Text style={styles.shareCardProgressText}>{dayTotal.toLocaleString()} out of {(dailyCalorieGoal || 0).toLocaleString()} daily goal</Text>
                            <Text style={[styles.shareCardProgressPct, isOver && { color: '#f97316' }]}>{Math.round(rawPct * 100)}%</Text>
                          </View>
                          <View style={styles.shareCardProgressBar}>
                            <LinearGradient
                              colors={isOver ? ['#f97316', '#ef4444'] : ['#22c55e', '#86efac']}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                              style={[styles.shareCardProgressFill, { width: `${Math.round(barPct * 100)}%` }]}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* FOOTER */}
                {(() => {
                  const now = new Date();
                  const mealType = selectedMealType;
                  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <View style={styles.shareCardFooter}>
                      <Text style={styles.shareCardFooterDate}>
                        {dateStr} · <Text style={styles.shareCardFooterMealType}>{mealType}</Text>
                      </Text>
                      <LinearGradient colors={['#22c55e', '#16a34a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareCardCtaBtn}>
                        <Text style={styles.shareCardCtaText}>Made with AfriFast →</Text>
                      </LinearGradient>
                    </View>
                  );
                })()}
              </View>

              {/* Action buttons */}
              <View style={styles.shareCardActions}>
                <TouchableOpacity style={styles.shareCardShareBtn} onPress={async () => {
                  try {
                    // Build text details to share alongside the card image
                    const todayStr = new Date().toDateString();
                    const todayMeals = recentMeals.filter(m => m.date === todayStr);
                    const totalCal = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
                    const totalProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
                    const totalCarbs = todayMeals.reduce((s, m) => s + (m.carbs || 0), 0);
                    const totalFats = todayMeals.reduce((s, m) => s + (m.fats || 0), 0);
                    const hasFoods = detectedFoods.length > 0;
                    const mealCal = hasFoods ? detectedFoods.reduce((s, f) => s + (f.cal || 0), 0) : (viewingMeal?.calories || 0);
                    const mealProtein = hasFoods ? detectedFoods.reduce((s, f) => s + (f.protein || 0), 0) : (viewingMeal?.protein || 0);
                    const mealCarbs = hasFoods ? detectedFoods.reduce((s, f) => s + (f.carbs || 0), 0) : (viewingMeal?.carbs || 0);
                    const mealFats = hasFoods ? detectedFoods.reduce((s, f) => s + (f.fats || 0), 0) : (viewingMeal?.fats || 0);
                    const foodLines = hasFoods
                      ? detectedFoods.map(f => `${f.name}${f.qty ? ` (${f.qty})` : ''} - ${f.cal} cal`).join('\n')
                      : (viewingMeal?.name || mealTitle || '').split(',').map(f => f.trim()).filter(Boolean).join('\n');
                    const now2 = new Date();
                    const mealType = selectedMealType.toLowerCase();
                    const dateStr = now2.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                    const detailsText = [
                      `Today ${dateStr}'s ${mealType} was ${mealTitle || 'my meal'} — ${mealCal} cal`,
                      '',
                      '*Here is the breakdown:*',
                      foodLines,
                      '',
                      `Overall Calories for Today: ${totalCal.toLocaleString()} / ${dailyCalorieGoal.toLocaleString()} kcal`,
                      '',
                      'Tracked on AfriFast',
                    ].join('\n');

                    if (Platform.OS === 'web') {
                      const node = shareCardRef.current;
                      if (!node) return;
                      const h2c = (await import('html2canvas')).default;
                      const canvas = await h2c(node, {
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#111111',
                        scale: 2,
                      });
                      const dataUrl = canvas.toDataURL('image/png');
                      const res = await fetch(dataUrl);
                      const blob = await res.blob();
                      const file = new File([blob], 'afri-fast-meal.png', { type: 'image/png' });
                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'My Meal — AfriFast', text: detailsText });
                      } else {
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = 'afri-fast-meal.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    } else {
                      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
                      await Share.share({
                        title: 'My Meal — AfriFast',
                        message: detailsText,
                        url: uri,
                      });
                    }
                  } catch (e) {
                    console.warn('Share failed:', e);
                    alert('Could not share. Try a screenshot instead.');
                  }
                }}>
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={styles.shareCardShareBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareCardDoneBtn} onPress={() => { resetScan(); onClose(); }}>
                  <Text style={styles.shareCardDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
          </ScrollView>
        )}

        <ScrollView style={[styles.weightPageContent, (scanPhase === 'shareCard' || logMealMethod === 'write' || (logMealMethod === 'scan' && scanPhase === 'results')) && { display: 'none', flex: 0 }]}>

          {/* Say Method */}
          {logMealMethod === 'say' && (
            <View style={styles.sayMealContainer}>

              {/* Listening indicator - visible during recording */}
              {sayPhase === 'recording' && (
                <View style={styles.listeningIndicator}>
                  <Text style={styles.listeningText}>Listening...</Text>
                </View>
              )}

              {/* Waveform Strip - visible during recording */}
              {sayPhase === 'recording' && (
                <View style={styles.waveStrip}>
                  <TouchableOpacity style={styles.waveBtn} onPress={cancelRec}>
                    <Text style={styles.waveBtnText}>✕</Text>
                  </TouchableOpacity>
                  <View style={styles.waveBarArea}>
                    <View style={styles.waveBars}>
                      {waveBars.map((h, i) => (
                        <View key={i} style={[styles.waveBar, { height: h }]} />
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.waveBtn} onPress={confirmRec}>
                    <Text style={styles.waveBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Detecting Progress */}
              {sayPhase === 'detecting' && (
                <View style={styles.detectSection}>
                  <Text style={styles.detectLabel}>
                    {detectProgress >= 100 ? 'Foods detected!' : SCAN_MESSAGES[sayMsgIndex]}
                  </Text>
                  <View style={styles.detectTrack}>
                    <View style={[styles.detectFill, { width: detectProgress + '%' }]} />
                  </View>
                </View>
              )}

              {/* Results - Re-record mic + Food list */}
              {sayPhase === 'results' && (
                <View style={{ flex: 1 }}>
                  {/* Re-record row */}
                  <View style={styles.reRecordRow}>
                    <View style={styles.reRecordLine} />
                    <TouchableOpacity style={styles.reRecordBtn} onPress={resetSay}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Polyline points="1 4 1 10 7 10" />
                        <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </Svg>
                    </TouchableOpacity>
                    <View style={styles.reRecordLine} />
                  </View>

                  {/* Food List Card */}
                  <View style={styles.foodCard}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>DETECTED FOODS</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.foodCardCount}>{detectedFoods.length} items</Text>
                        <TouchableOpacity onPress={() => { setIsFoodEditMode(p => !p); setShowAddItem(false); }}>
                          <Text style={[styles.foodCardEditBtn, isFoodEditMode && { color: '#059669' }]}>
                            {isFoodEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {getDuplicateIndices(detectedFoods).size > 0 && (
                      <View style={styles.dupeBanner}>
                        <Ionicons name="warning-outline" size={14} color="#92400e" />
                        <Text style={styles.dupeBannerText}>Duplicate items found — remove extras so they're not double-counted</Text>
                      </View>
                    )}
                    {detectedFoods.map((food, i) => (
                      <View key={i} style={styles.foodRow}>
                        {isFoodEditMode && (
                          <TouchableOpacity style={styles.foodDeleteBtn} onPress={() => setDetectedFoods(prev => prev.filter((_, idx) => idx !== i))}>
                            <Ionicons name="remove-circle" size={22} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.foodName}>{food.name}</Text>
                            {getDuplicateIndices(detectedFoods).has(i) && (
                              <View style={styles.dupeFoodBadge}><Text style={styles.dupeFoodBadgeText}>duplicate</Text></View>
                            )}
                          </View>
                          {editingQtyIdx === i ? (
                            <View style={styles.editQtyRow}>
                              <TextInput
                                style={styles.editQtyInput}
                                value={editQtyValue}
                                onChangeText={setEditQtyValue}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.editQtyDone}
                                onPress={async () => {
                                  if (!editQtyValue.trim()) {
                                    setEditingQtyIdx(null);
                                    return;
                                  }
                                  const newQty = editQtyValue.trim();
                                  setEditingQtyIdx(null);
                                  setUpdatingQtyIdx(i);
                                  const bareNum3 = /^\d+(\.\d+)?$/.test(newQty) ? parseFloat(newQty) : null;
                                  if (bareNum3 !== null && bareNum3 > 0) {
                                    setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                      ...f,
                                      qty: `${newQty} serving${bareNum3 !== 1 ? 's' : ''}`,
                                      cal: Math.round(food.cal * bareNum3),
                                      protein: Math.round(food.protein * bareNum3 * 10) / 10,
                                      carbs: Math.round(food.carbs * bareNum3 * 10) / 10,
                                      fats: Math.round(food.fats * bareNum3 * 10) / 10,
                                      fiber: Math.round(food.fiber * bareNum3 * 10) / 10,
                                    } : f));
                                    setUpdatingQtyIdx(null);
                                    return;
                                  }
                                  const recalculated = await recalculateFoodPortionWithGemini(food.name, food.qty, newQty, food);
                                  setDetectedFoods(prev => prev.map((f, idx) => idx === i ? {
                                    ...f,
                                    name: recalculated?.name || f.name,
                                    qty: recalculated?.qty || normalizeEditedQty(food.name, food.qty, newQty),
                                    cal: (recalculated?.cal > 0) ? recalculated.cal : f.cal,
                                    protein: recalculated?.protein ?? f.protein ?? 0,
                                    carbs: recalculated?.carbs ?? f.carbs ?? 0,
                                    fats: recalculated?.fats ?? f.fats ?? 0,
                                    fiber: recalculated?.fiber ?? f.fiber ?? 0,
                                  } : f));
                                  setUpdatingQtyIdx(null);
                                }}
                                disabled={updatingQtyIdx === i}
                              >
                                <Text style={styles.editQtyDoneText}>Done</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.foodQtyEditable}
                              onPress={() => { setEditingQtyIdx(i); setEditQtyValue(food.qty || '1 serving'); }}
                            >
                              <Text style={styles.foodQtyEditableText}>{food.qty || '1 serving'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {editingQtyIdx !== i && (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, f.cal - 25) } : f))}>
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', minWidth: 50 }}>
                              {updatingQtyIdx === i ? (
                                <ActivityIndicator size="small" color="#059669" />
                              ) : isFoodEditMode && editingCalIdx === i ? (
                                <TextInput
                                  style={styles.calInlineInput}
                                  value={editCalInputValue}
                                  onChangeText={setEditCalInputValue}
                                  keyboardType="numeric"
                                  autoFocus
                                  selectTextOnFocus
                                  onBlur={() => {
                                    const val = parseInt(editCalInputValue);
                                    if (!isNaN(val)) setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: Math.max(0, val) } : f));
                                    setEditingCalIdx(null);
                                  }}
                                />
                              ) : (
                                <TouchableOpacity
                                  disabled={!isFoodEditMode}
                                  onPress={() => { setEditingCalIdx(i); setEditCalInputValue(String(food.cal)); }}
                                >
                                  <Text style={[styles.foodCal, isFoodEditMode && { textDecorationLine: 'underline', color: '#059669' }]}>{food.cal}</Text>
                                </TouchableOpacity>
                              )}
                              <Text style={styles.foodCalLabel}>CAL</Text>
                            </View>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setDetectedFoods(prev => prev.map((f, idx) => idx === i ? { ...f, cal: f.cal + 25 } : f))}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}

                    {/* Add item row */}
                    {isFoodEditMode && (
                      showAddItem ? (
                        <View style={styles.addItemRow}>
                          <TextInput
                            style={styles.addItemNameInput}
                            placeholder="Item name"
                            placeholderTextColor="#aaa"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[styles.addItemConfirm, addItemDetecting && { opacity: 0.6 }]}
                            disabled={addItemDetecting}
                            onPress={async () => {
                              if (!newItemName.trim()) return;
                              setAddItemDetecting(true);
                              const result = await lookupItemNutrition(newItemName.trim());
                              setDetectedFoods(prev => [...prev, result || {
                                name: newItemName.trim(),
                                qty: '1 serving',
                                cal: 0,
                                protein: 0, carbs: 0, fats: 0, fiber: 0,
                              }]);
                              setNewItemName('');
                              setAddItemDetecting(false);
                              setShowAddItem(false);
                            }}
                          >
                            {addItemDetecting
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.addItemConfirmText}>Add</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAddItem(true)}>
                          <Ionicons name="add-circle-outline" size={18} color="#059669" />
                          <Text style={styles.addItemBtnText}>Add item</Text>
                        </TouchableOpacity>
                      )
                    )}

                    <View style={styles.foodTotal}>
                      <Text style={styles.foodTotalLabel}>TOTAL</Text>
                      <Text style={styles.foodTotalValue}>{getTotalCal()} cal</Text>
                    </View>
                  </View>

                  <View style={[styles.foodCard, { marginTop: 16 }]}>
                    <View style={styles.foodCardHead}>
                      <Text style={styles.foodCardTitle}>MEAL TYPE</Text>
                    </View>
                    <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                      {['Breakfast', 'Lunch', 'Snack', 'Dinner'].map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setSelectedMealType(type)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            backgroundColor: selectedMealType === type ? '#059669' : '#F9FAFB',
                            borderWidth: 1.5,
                            borderColor: selectedMealType === type ? '#059669' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: selectedMealType === type ? '#fff' : '#9CA3AF' }}>
                            {type.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {renderCheckInWidget()}

                  {/* Log Button */}
                  <TouchableOpacity style={styles.logBtn} onPress={logMeal}>
                    <Text style={styles.logBtnText}>Log this meal</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Mic Button - only in idle */}
              {sayPhase === 'idle' && (
                <View style={styles.sayMicSection}>
                  <Text style={styles.sayMicLabel}>Tap to record</Text>
                  <Text style={styles.sayMicSublabel}>Speak your meal clearly</Text>
                  <View style={styles.sayMicOuter}>
                    <View style={styles.sayMicInner}>
                      <TouchableOpacity style={styles.sayMicButton} onPress={startRec} activeOpacity={0.75}>
                        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <Line x1="12" y1="19" x2="12" y2="23" />
                          <Line x1="8" y1="23" x2="16" y2="23" />
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Success Overlay */}
              {showSuccess && (
                <View style={styles.successOverlay}>
                  <View style={styles.successCheck}>
                    <Text style={{ fontSize: 28, color: '#fff' }}>✓</Text>
                  </View>
                  <Text style={styles.successTitle}>Meal logged</Text>
                  <Text style={styles.successSub}>{getTotalCal()} cal added</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Scan — Camera (absolute full screen overlay) */}
      {logMealMethod === 'scan' && scanPhase === 'camera' && (
        <View style={styles.cameraAbsolute}>
          {!permission?.granted ? (
            <View style={styles.cameraPermission}>
              <Ionicons name="camera-outline" size={48} color="#D1D5DB" />
              <Text style={styles.cameraPermissionText}>Camera access is required to scan your meal</Text>
              <Text style={[styles.cameraPermissionText, { fontSize: 13, marginTop: -8 }]}>Please enable it in your device Settings</Text>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" zoom={0}>
                <View style={styles.scanOverlay}>
                  <View style={styles.scanCornerTL} />
                  <View style={styles.scanCornerTR} />
                  <View style={styles.scanCornerBL} />
                  <View style={styles.scanCornerBR} />
                </View>
                <Text style={styles.scanHint}>Step back so your whole meal fits in frame</Text>
              </CameraView>
              {/* Back button */}
              <TouchableOpacity style={styles.cameraBackBtn} onPress={handleClose}>
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </TouchableOpacity>
              {/* Not-food error banner */}
              {scanError && (
                <View style={styles.scanErrorBanner}>
                  <Ionicons name="warning-outline" size={18} color="#fff" />
                  <Text style={styles.scanErrorText}>
                    That's a <Text style={{ fontWeight: '800' }}>{scanError}</Text>, not food. Point your camera at your meal and try again.
                  </Text>
                </View>
              )}
              {/* Capture button */}
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
              {/* Gallery picker */}
              <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
                <Ionicons name="image-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Check-In Sheet */}
      <Modal visible={showMiniCheckIn} transparent animationType="slide" onRequestClose={() => setShowMiniCheckIn(false)}>
        <TouchableOpacity style={miniStyles.backdrop} activeOpacity={1} onPress={() => setShowMiniCheckIn(false)}>
          <TouchableOpacity style={miniStyles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={miniStyles.handle} />
            <Text style={miniStyles.sheetTitle}>How are you feeling?</Text>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

              <Text style={miniStyles.sectionLabel}>How are you feeling</Text>
              <View style={miniStyles.chipRow}>
                {CI_FEELINGS.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniFeelings.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniFeelings, setMiniFeelings)}>
                    <Text style={[miniStyles.chipText, miniFeelings.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Fasting status</Text>
              <View style={miniStyles.chipRow}>
                {CI_FASTING_STATUS.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniFastingStatus === chip && miniStyles.chipSelected]} onPress={() => setMiniFastingStatus(miniFastingStatus === chip ? null : chip)}>
                    <Text style={[miniStyles.chipText, miniFastingStatus === chip && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Hunger level</Text>
              <View style={miniStyles.chipRow}>
                {CI_HUNGER.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniHungerLevel === chip && miniStyles.chipSelected]} onPress={() => setMiniHungerLevel(miniHungerLevel === chip ? null : chip)}>
                    <Text style={[miniStyles.chipText, miniHungerLevel === chip && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Mood</Text>
              <View style={miniStyles.chipRow}>
                {CI_MOODS.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniMoods.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniMoods, setMiniMoods)}>
                    <Text style={[miniStyles.chipText, miniMoods.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Fasting-related symptoms</Text>
              <View style={miniStyles.chipRow}>
                {CI_SYMPTOMS.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniSymptoms.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniSymptoms, setMiniSymptoms)}>
                    <Text style={[miniStyles.chipText, miniSymptoms.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>How did you break your fast?</Text>
              <View style={miniStyles.chipRow}>
                {CI_FAST_BREAK.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniFastBreak.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniFastBreak, setMiniFastBreak)}>
                    <Text style={[miniStyles.chipText, miniFastBreak.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Physical activity</Text>
              <View style={miniStyles.chipRow}>
                {CI_ACTIVITIES.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniActivities.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniActivities, setMiniActivities)}>
                    <Text style={[miniStyles.chipText, miniActivities.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[miniStyles.sectionLabel, { marginTop: 16 }]}>Other</Text>
              <View style={miniStyles.chipRow}>
                {CI_OTHER.map(chip => (
                  <TouchableOpacity key={chip} style={[miniStyles.chip, miniOtherFactors.includes(chip) && miniStyles.chipSelected]} onPress={() => toggleMini(chip, miniOtherFactors, setMiniOtherFactors)}>
                    <Text style={[miniStyles.chipText, miniOtherFactors.includes(chip) && miniStyles.chipTextSelected]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={miniStyles.saveBtn} onPress={saveMiniCheckIn}>
                <Text style={miniStyles.saveBtnText}>Save Check-In</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const miniStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#059669',
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 24,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

const styles = StyleSheet.create({
  weightPageOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 9999,
  },
  weightPage: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
  },
  weightPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  weightPageContent: {
    flex: 1,
    padding: 20,
    paddingTop: 8,
  },
  logMealContent: {
    padding: 20,
  },
  // Camera
  cameraAbsolute: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 10000,
    overflow: 'hidden',
  },
  cameraBackBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cameraPermission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  cameraPermissionText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  cameraPermissionBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  cameraPermissionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  scanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCornerTL: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#059669',
    borderTopLeftRadius: 8,
  },
  scanCornerTR: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#059669',
    borderTopRightRadius: 8,
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: '30%',
    left: '10%',
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#059669',
    borderBottomLeftRadius: 8,
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: '30%',
    right: '10%',
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#059669',
    borderBottomRightRadius: 8,
  },
  scanHint: {
    position: 'absolute',
    bottom: '22%',
    alignSelf: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanErrorBanner: {
    position: 'absolute',
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanErrorText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  correctionBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  correctionText: {
    fontSize: 13,
    color: '#6b7280',
  },
  correctionHighlight: {
    fontWeight: '700',
    color: '#111',
  },
  writeErrorBanner: {
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  writeErrorText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  captureBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  galleryBtn: {
    position: 'absolute',
    bottom: 52,
    right: 40,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  // Analyzing (unused)
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  analyzingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  // Scan Results
  scanResultsContainer: {
    flex: 1,
    paddingTop: 8,
  },
  scanResultImage: {
    width: '92%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    resizeMode: 'contain',
    alignSelf: 'center',
    backgroundColor: '#111',
  },
  scanRetakeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: -8,
    marginBottom: 12,
  },
  scanRetakeSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  scanResultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  scanResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  scanResultItemLeft: {
    flex: 1,
  },
  scanResultItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  scanResultItemQty: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scanResultItemRight: {
    alignItems: 'flex-end',
  },
  scanResultItemCal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  scanResultItemMacros: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scanResultTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    marginTop: 4,
  },
  scanResultTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  scanResultTotalCal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  screenScanBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  screenScanBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
  },
  portionNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 10,
  },
  scanActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  logBtnFlex: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareMealBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── SHARE CARD ──────────────────────────────────────────────────
  shareCard: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 390,
    backgroundColor: '#111',
    borderRadius: 28,
    overflow: 'hidden',
  },
  shareCardScreen: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  shareCardSuccessRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 18,
  },
  shareCardSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  shareCardSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  shareCardVisible: {
    alignSelf: 'stretch',
    backgroundColor: '#111',
    borderRadius: 24,
    overflow: 'hidden',
    fontFamily: 'Inter',
  },
  shareCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  shareCardShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareCardShareBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  shareCardDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareCardDoneBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
  // Image panel
  shareCardImgPanel: {
    width: '100%',
  },
  shareCardImage: {
    width: '100%',
    resizeMode: 'cover',
  },
  shareCardInfoPanel: {
    backgroundColor: '#111',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  shareCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  // Brand badge
  shareCardBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 30,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 12,
    gap: 8,
  },
  shareCardBrandIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCardBrandIconText: {
    fontSize: 13,
  },
  shareCardBrandName: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
  },
  // On Track badge — top right
  shareCardTrackBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  shareCardTrackText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  shareCardMealInfo: {
    marginBottom: 8,
  },
  shareCardTodayLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginBottom: 3,
  },
  shareCardMealName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  shareCardMealNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  shareCardStreakBadge: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  shareCardStreakNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f97316',
    lineHeight: 22,
  },
  shareCardStreakLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  // Kcal section
  shareCardKcalSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#111',
  },
  shareCardKcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shareCardKcalBig: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  shareCardKcalNumber: {
    fontFamily: 'Inter',
    fontSize: 50,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 50,
    letterSpacing: -2,
  },
  shareCardKcalUnit: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
    marginBottom: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  shareCardProgressCol: {
    flex: 1,
  },
  shareCardProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shareCardProgressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  shareCardProgressPct: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },
  shareCardProgressBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  shareCardProgressFill: {
    height: 5,
    borderRadius: 10,
  },
  // Items section
  shareCardItems: {
    backgroundColor: '#0e0e0e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  shareCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  shareCardDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  shareCardItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e5e5e5',
  },
  shareCardItemPortion: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    marginTop: 2,
  },
  shareCardItemCal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    minWidth: 56,
    textAlign: 'right',
  },
  shareCardMore: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'center',
  },
  // Macros — 1px gap dividers via wrapper background
  shareCardMacrosWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 1,
  },
  shareCardMacroItem: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareCardMacroVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  shareCardMacroLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    marginTop: 2,
  },
  // Footer
  shareCardFooter: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0d0d',
  },
  shareCardFooterDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
  },
  shareCardFooterMealType: {
    color: 'rgba(255,255,255,0.42)',
    fontWeight: '600',
  },
  shareCardCtaBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  shareCardCtaText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scanLogBtn: {
    backgroundColor: '#059669',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  scanLogBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  scanRetakeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  scanRetakeBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  mealInputContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  mealInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  mealTextarea: {
    width: '100%',
    minHeight: 120,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    borderRadius: 14,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  analyzeMealBtn: {
    padding: 16,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
  },
  analyzeMealBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sayMealContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  writeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  writeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  writeAiBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  writeAiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  writeInputWrapper: {
    backgroundColor: '#f4fbf7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c6e8d4',
    padding: 16,
    marginHorizontal: 20,
    minHeight: 320,
  },
  writeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  writeInputText: {
    fontSize: 17,
    color: '#111',
    fontWeight: '500',
    lineHeight: 26,
  },
  writeBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
  },
  writeNaturalHint: {
    fontSize: 13,
    color: '#7dab92',
    fontWeight: '400',
  },
  writeDetectBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  writeDetectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  listeningIndicator: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  listeningText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    letterSpacing: 0.5,
  },
  sayTranscriptBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    minHeight: 110,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  sayTranscriptText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 23,
  },
  sayTranscriptPlaceholder: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
    lineHeight: 23,
  },
  writeInput: {
    fontSize: 15,
    color: '#111',
    fontWeight: '400',
    lineHeight: 22,
    minHeight: 290,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingBottom: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  writeExtras: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  writeHint: {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 18,
  },
  writeExtrasLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#aaa',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginTop: 14,
  },
  chip: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  recentItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    flexShrink: 0,
  },
  recentItemText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  recentItemArrow: {
    fontSize: 16,
    color: '#ccc',
  },
  waveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 40,
    height: 56,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  waveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  waveBarArea: {
    flex: 1,
    height: 36,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  waveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  waveBar: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },
  detectSection: {
    marginHorizontal: 20,
    marginBottom: 14,
    marginTop: 40,
  },
  detectLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detectLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#999',
  },
  detectPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  dupeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  dupeWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  detectTrack: {
    backgroundColor: '#E5E7EB',
    borderRadius: 100,
    height: 3,
    overflow: 'hidden',
  },
  detectFill: {
    height: '100%',
    backgroundColor: '#111',
    borderRadius: 100,
  },
  reRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
  },
  reRecordLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  reRecordBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 14,
  },
  foodCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  dupeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  dupeBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  dupeFoodBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  dupeFoodBadgeText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '600',
  },
  foodCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  foodCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#111',
  },
  calInlineInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    minWidth: 50,
    textAlign: 'center',
    paddingVertical: 0,
  },
  foodCardEditBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
  },
  foodDeleteBtn: {
    marginRight: 10,
    justifyContent: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  addItemBtnText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  addItemNameInput: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addItemCalInput: {
    width: 60,
    fontSize: 13,
    color: '#111',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    textAlign: 'center',
  },
  addItemConfirm: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addItemConfirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  foodCardCount: {
    fontSize: 11,
    color: '#999',
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  foodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  foodQty: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  foodQtyEditable: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  foodQtyEditableText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  editQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editQtyInput: {
    flex: 1,
    fontSize: 13,
    color: '#1F1F1F',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  editQtyDone: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editQtyDoneText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  foodCal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  foodCalLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#aaa',
  },
  foodCalEdit: {
    fontSize: 12,
    color: '#111',
    fontWeight: '500',
    marginTop: 2,
  },
  editCalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  editCalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    width: 60,
    textAlign: 'center',
  },
  editCalLabel: {
    fontSize: 11,
    color: '#aaa',
    marginLeft: 4,
    marginRight: 8,
  },
  editCalSave: {
    backgroundColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  foodTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  foodTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#111',
  },
  foodTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  checkInWidget: {
    marginBottom: 12,
  },
  checkInWidgetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  ciSymptomsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
  },
  ciEmojiRowFixed: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ciEmojiScrollArea: {
    flex: 1,
  },
  ciEmojiScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  ciEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ciEmojiCircleText: {
    fontSize: 22,
  },
  ciWaterBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  ciWaterBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 1,
  },
  ciWaterBadgeLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  ciSymptomsEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  ciSymptomsEmptyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ciSymptomsEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  ciSymptomsAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ciEmojiAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  logBtn: {
    backgroundColor: '#059669',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  successOverlay: {
    position: 'absolute',
    top: -80,
    left: -22,
    right: -22,
    bottom: -40,
    backgroundColor: '#111',
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  successCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  successSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  sayMicSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 48,
  },
  sayMicOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayMicInner: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayMicButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayMicLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  sayMicSublabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  detectedFoodsSection: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  detectedFoodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 16,
  },
  detectedFoodsList: {
    flexDirection: 'column',
    gap: 10,
  },
  detectedFoodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 10,
  },
  detectedFoodInfo: {
    flexDirection: 'column',
    gap: 2,
  },
  detectedFoodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  detectedFoodPortion: {
    fontSize: 12,
    color: '#888',
  },
  detectedFoodCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  detectedFoodsTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  detectedFoodsTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  detectedFoodsTotalValue: {
    color: '#059669',
    fontSize: 18,
    fontWeight: '600',
  },
  saveMealBtn: {
    width: '100%',
    marginTop: 20,
    padding: 16,
    backgroundColor: '#10B981',
    borderRadius: 14,
    alignItems: 'center',
  },
  saveMealBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LogMealModal;
