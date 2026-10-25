import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Platform, Image, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { ensureAiConsent, AiConsentError } from '../lib/consent';
import { track } from '../lib/analytics';
import HeaderFade from './HeaderFade';
import { SourcesLink } from './HealthSourcesPage';
import { estimateSatiety, satietyCurve, formatFullFor, gramsOf } from '../lib/satiety';
import { saveCustomRecipe } from '../lib/savedRecipes';
import { fillMethodStep } from '../lib/recipeMethod';
import { uploadMealPhoto } from '../lib/mealPhotoUpload';

// The recipe's AI photo (a data URI) uploaded to storage, so a saved recipe keeps it. Null if it can't be uploaded.
async function uploadRecipeImage(dataUri) {
  if (!dataUri || !String(dataUri).startsWith('data:')) return null;
  try {
    if (Platform.OS === 'web') return await uploadMealPhoto(dataUri);
    const path = `${FileSystem.cacheDirectory}recipe-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(path, dataUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
    return await uploadMealPhoto(path);
  } catch (_) {
    return null;
  }
}

// Two flows share this screen:
//   "Fit it in" (mode 'fit'): food they already have, portioned to fit the calories they have left.
//   "Build a recipe from my kitchen" (mode 'kitchen'): a recipe made from their ingredients, scaled to a calorie
//   amount per person, with method, an AI photo and Save recipe.
// Four steps either way: what you have → how much to use → working it out → the result.

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const INK = '#1F1F1F';
const MUTED = '#6B7280';
const GREEN = '#059669';

const STEP_LABELS = (cal) => [
  'Reading what you have',
  'Recognising each food',
  'Estimating calories in each food',
  'Balancing protein, carbs and fats',
  `Splitting ${cal} cal into portions`,
  'Turning grams into cups and ladles',
];

const COPY = {
  fit: {
    h1: 'Got food already?\nLet\u2019s make it fit.',
    when: [
      ['bag-handle-outline', 'You just bought it', 'Waakye on the way home, a pack of kelewele'],
      ['help-circle-outline', 'You don\u2019t know how it was made', 'No recipe, no label, no problem'],
      ['home-outline', 'It\u2019s already at home', 'Leftovers, Sunday\u2019s stew, whatever\u2019s in the fridge'],
    ],
    inputLabel: 'Tell Logga what food you have',
    sheetTitle: 'How much should this meal use?',
    steps: STEP_LABELS,
    loadingTitle: 'Fitting it in\u2026', readyTitle: 'Your plate is ready', errorTitle: 'Couldn\u2019t plan that',
    loadingSub: (cal) => `Working out portions for your ${cal} cal`,
    seeBtn: 'See your plate',
  },
  kitchen: {
    h1: 'What\u2019s in your kitchen?\nLet\u2019s build a recipe.',
    when: [
      ['basket-outline', 'Your fridge is half full', 'A few tomatoes, an onion, some chicken'],
      ['help-circle-outline', 'You\u2019re out of ideas', 'Tell us what\u2019s around, we\u2019ll do the thinking'],
      ['home-outline', 'You want to use up leftovers', 'Yesterday\u2019s rice, half a tin of beans'],
    ],
    inputLabel: 'Tell Logga what ingredients you have',
    sheetTitle: 'How many calories for this recipe?',
    steps: (cal) => ['Reading your ingredients', 'Matching dishes you can make', 'Picking the best one for you', 'Working out calories per ingredient', `Scaling it to ${cal} cal`, 'Writing your step-by-step method'],
    loadingTitle: 'Building your recipe\u2026', readyTitle: 'Your recipe is ready', errorTitle: 'Couldn\u2019t build a recipe',
    loadingSub: (cal) => `Creating a recipe that fits your ${cal} cal`,
    seeBtn: 'See your recipe',
  },
};

// Generated recipe photos, kept for the session so reopening a recipe never pays for a second picture.
const recipeImageCache = new Map();

const readUriAsBase64 = async (uri) => {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) return uri.split(',')[1];
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
};

async function planPortions({ text, photoUri, budget, userCountry, type = 'plan_portions', servings }) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  let base64 = null;
  if (photoUri) {
    let uri = photoUri;
    if (Platform.OS !== 'web') {
      uri = (await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 900 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })).uri;
    }
    base64 = await readUriAsBase64(uri);
  }
  const response = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data: { text, base64, budget, userCountry, servings } }),
  });
  let result;
  try { result = JSON.parse(await response.text()); } catch { throw new Error('Something went wrong. Try again.'); }
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
  return result;
}

async function transcribe(uri) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  const base64 = await readUriAsBase64(uri);
  const response = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'transcribe_audio', data: { base64 } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not hear that');
  return result.text || '';
}

async function callApi(type, data) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  const response = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || 'AI service error');
  return result;
}

// ¼, ½, ¾ for home measures ("1½ cups cooked").
const frac = (n) => {
  const q = Math.round(n * 4) / 4, w = Math.floor(q), r = q - w;
  const s = r === 0.25 ? '¼' : r === 0.5 ? '½' : r === 0.75 ? '¾' : '';
  return ((w === 0 && s ? '' : String(w)) + s) || '0';
};
// A planned food (per-100 g values + grams) as a scan-style food row: "1½ cups cooked (230 g)".
const toFood = (f) => {
  const k = f.grams / 100;
  const r1 = (v) => Math.round((v || 0) * k * 10) / 10;
  return {
    name: f.name, qty: `${measureOf(f, f.grams)} (${f.grams} g)`, grams: f.grams, cal: Math.round(f.kcal100 * k),
    protein: r1(f.protein100), carbs: r1(f.carbs100), fats: r1(f.fat100), fiber: r1(f.fiber100), sugar: r1(f.sugar100), sodium: Math.round((f.sodium100 || 0) * k),
  };
};

const measureOf = (f, g) => {
  const n = g / f.unitGrams;
  if (f.unitGrams <= 40) { const c = Math.max(1, Math.round(n)); return `${c} ${c === 1 ? f.unitOne : f.unitMany}`; }
  return `${frac(n)} ${n > 1.125 ? f.unitMany : f.unitOne}`;
};

const PortionPlanner = ({ visible, onClose, caloriesLeft = 0, userCountry = '', onLogPlate, tdee = null, mode = 'fit', userId = null }) => {
  const kitchen = mode === 'kitchen';
  const copy = COPY[kitchen ? 'kitchen' : 'fit'];
  const [step, setStep] = useState('input'); // input | budget | loading | plate
  const [servings, setServings] = useState(1);
  const [recipeImage, setRecipeImage] = useState(null); // data URI, or 'failed'
  const [savedRecipe, setSavedRecipe] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const lowBudget = caloriesLeft < 150;
  const [useAll, setUseAll] = useState(false);
  const [amount, setAmount] = useState(450);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  // The plate as a list of foods, the same shape (and editing) as a scanned meal's detected foods.
  const [foods, setFoods] = useState([]);
  const resultRef = useRef(null);
  const [isFoodEditMode, setIsFoodEditMode] = useState(false);
  const [editingQtyIdx, setEditingQtyIdx] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [updatingQtyIdx, setUpdatingQtyIdx] = useState(null);
  const [editingCalIdx, setEditingCalIdx] = useState(null);
  const [editCalInputValue, setEditCalInputValue] = useState('');
  const editCalInputRef = useRef('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [addItemDetecting, setAddItemDetecting] = useState(false);
  // Voice: 'idle' | 'listening' | 'transcribing'. The words land in the text box so they can be checked first.
  const [voice, setVoice] = useState('idle');
  const [voiceNote, setVoiceNote] = useState(null);
  const recordingRef = useRef(null);
  const speechRef = useRef(null);
  const baseTextRef = useRef('');
  const joinText = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(a.trim() ? ', ' : '');

  const startVoice = async () => {
    setVoiceNote(null);
    baseTextRef.current = text;
    if (Platform.OS === 'web') {
      const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!SR) { setVoiceNote('Voice isn’t supported in this browser. Try Chrome, or type it.'); return; }
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (e) => {
        let said = '';
        for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
        setText(joinText(baseTextRef.current, said));
      };
      rec.onerror = () => setVoice('idle');
      rec.onend = () => setVoice((v) => (v === 'listening' ? 'idle' : v));
      speechRef.current = rec;
      rec.start();
      setVoice('listening');
      return;
    }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setVoiceNote('Allow the microphone in Settings to use voice.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setVoice('listening');
    } catch (_) {
      setVoiceNote('Couldn’t start the microphone. Try again, or type it.');
    }
  };

  const stopVoice = async () => {
    if (Platform.OS === 'web') {
      speechRef.current?.stop();
      speechRef.current = null;
      setVoice('idle');
      return;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    try { await rec?.stopAndUnloadAsync(); } catch (_) {}
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch (_) {}
    const uri = rec?.getURI();
    if (!uri) { setVoice('idle'); return; }
    setVoice('transcribing');
    try {
      const said = await transcribe(uri);
      if (said) setText(joinText(baseTextRef.current, said));
      else setVoiceNote('Didn’t catch that. Try again, or type it.');
    } catch (e) {
      setVoiceNote(e instanceof AiConsentError ? 'AI features are off. Turn them on in Settings › Privacy Settings.' : 'Didn’t catch that. Try again, or type it.');
    }
    setVoice('idle');
  };

  // Stop listening if the planner closes mid-recording.
  useEffect(() => {
    if (visible) return undefined;
    speechRef.current?.stop?.();
    recordingRef.current?.stopAndUnloadAsync?.().catch(() => {});
    recordingRef.current = null;
    setVoice('idle');
    return undefined;
  }, [visible]);

  // Fresh each time it opens.
  useEffect(() => {
    if (!visible) return;
    setStep('input'); setText(''); setPhoto(null); setPlan(null); setError(null); setServings(1); setRecipeImage(null); setSavedRecipe(false);
    const left = Math.max(0, Math.round(caloriesLeft));
    setUseAll(false);
    setAmount(left >= 150 ? Math.min(left, Math.max(100, Math.round((left * 0.6) / 10) * 10)) : 300);
  }, [visible]);

  const sliderMax = lowBudget ? 1500 : Math.max(100, Math.round(caloriesLeft));
  const chosen = useAll && !lowBudget ? Math.round(caloriesLeft) : amount;

  // Working it out: the ring counts up while the plan is made and only reaches 100% once it's back.
  // While the answer is still being worked out past 92%, the ring keeps creeping (each step slower, never past 99)
  // so it never looks stuck.
  const slowTicksRef = useRef(0);
  const run = () => {
    setStep('loading'); setPct(0); setError(null); resultRef.current = null; slowTicksRef.current = 0;
    setRecipeImage(null); setSavedRecipe(false);
    track(kitchen ? 'kitchen_recipe_started' : 'portion_plan_started', { has_photo: !!photo, calories: chosen, servings: kitchen ? servings : undefined });
    planPortions({ text: text.trim(), photoUri: photo, budget: chosen, userCountry, type: kitchen ? 'build_recipe' : 'plan_portions', servings: kitchen ? servings : undefined })
      .then((r) => { resultRef.current = r; })
      .catch((e) => { resultRef.current = { error: e instanceof AiConsentError ? 'AI features are off. Turn them on in Settings › Privacy Settings.' : e.message }; });
  };
  useEffect(() => {
    if (step !== 'loading') return undefined;
    const timer = setInterval(() => {
      setPct((p) => {
        const r = resultRef.current;
        if (r && (r.error || r.notFood)) {
          clearInterval(timer);
          setError(r.error || `That doesn't look like food${r.identified ? ` (${r.identified})` : ''}. Try describing it in words.`);
          return p;
        }
        if (p >= 100) { clearInterval(timer); return 100; }
        if (!r && p >= 92) {
          slowTicksRef.current += 1;
          if (p < 99 && slowTicksRef.current >= 20 + (p - 92) * 15) { slowTicksRef.current = 0; return p + 1; }
          return p;
        }
        return p + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (pct === 100 && resultRef.current?.foods) {
      setPlan(resultRef.current);
      setFoods(resultRef.current.foods.map(toFood));
    }
  }, [pct]);

  useEffect(() => {
    if (!kitchen || step !== 'plate' || !plan?.title || recipeImage) return;
    const key = plan.title + '|' + (plan.foods || []).map((f) => f.name).join(',');
    if (recipeImageCache.has(key)) { setRecipeImage(recipeImageCache.get(key)); return; }
    let cancelled = false;
    callApi('recipe_image', { title: plan.title, ingredients: (plan.foods || []).map((f) => f.name) })
      .then((r) => { const uri = `data:${r.mimeType || 'image/png'};base64,${r.data}`; recipeImageCache.set(key, uri); if (!cancelled) setRecipeImage(uri); })
      .catch(() => { if (!cancelled) setRecipeImage('failed'); });
    return () => { cancelled = true; };
  }, [kitchen, step, plan]);

  const items = foods;
  const total = items.reduce((s, i) => s + (i.cal || 0), 0);
  const sum = (key) => items.reduce((s, i) => s + (i[key] || 0), 0);
  // How long this plate should keep them full: their energy use, the foods' measured Satiety Index, protein,
  // fibre and density, tuned by how long they usually go between logged meals (src/lib/satiety.js).
  const satEst = useMemo(() => estimateSatiety({ foods: items, tdee }), [items, tdee]);
  const sat = useMemo(() => satietyCurve(satEst.hours), [satEst.hours]);
  const LEVEL_COLORS = { 'Very satisfying': ['#D1FAE5', '#047857'], Satisfying: ['#ECFDF5', '#047857'], Light: ['#FEF3C7', '#B45309'] };

  // Scale a food's calories and nutrients together (the scan screen's −/+ and typed calories).
  const scaleFood = (f, newCal) => {
    const ratio = f.cal > 0 ? newCal / f.cal : 0;
    const r1 = (v) => (ratio > 0 ? Math.round((v || 0) * ratio * 10) / 10 : v);
    return { ...f, cal: newCal, grams: ratio > 0 ? Math.round(gramsOf(f) * ratio) : f.grams, protein: r1(f.protein), carbs: r1(f.carbs), fats: r1(f.fats), fiber: r1(f.fiber), sugar: r1(f.sugar), sodium: ratio > 0 ? Math.round((f.sodium || 0) * ratio) : f.sodium };
  };
  const nudgeCal = (i, d) => setFoods((prev) => prev.map((f, idx) => (idx === i ? scaleFood(f, Math.max(0, f.cal + d)) : f)));
  const resetEditing = () => { setIsFoodEditMode(false); setEditingQtyIdx(null); setEditingCalIdx(null); setShowAddItem(false); setNewItemName(''); };

  const saveQty = async (i) => {
    const food = foods[i];
    if (!editQtyValue.trim()) { setEditingQtyIdx(null); return; }
    const raw = editQtyValue.trim();
    const newQty = /[a-zA-Z]/.test(raw) ? raw : `${raw} ${(food.name || 'serving').toLowerCase()}`;
    setEditingQtyIdx(null);
    setUpdatingQtyIdx(i);
    const r = await callApi('recalculate_portion', { foodName: food.name, oldQty: food.qty, newQty, currentNutrition: food }).catch(() => null);
    setFoods((prev) => prev.map((f, idx) => (idx === i ? {
      ...f,
      name: r?.name || f.name,
      qty: r?.qty || newQty,
      grams: (() => { const g = String(r?.qty || newQty).match(/(\d+(?:\.\d+)?)\s*g\b/i); if (g) return Number(g[1]); const c = r?.cal > 0 ? r.cal : f.cal; return f.cal > 0 ? Math.round(gramsOf(f) * (c / f.cal)) : undefined; })(),
      cal: r?.cal > 0 ? r.cal : f.cal,
      protein: r?.protein ?? f.protein ?? 0, carbs: r?.carbs ?? f.carbs ?? 0, fats: r?.fats ?? f.fats ?? 0,
      fiber: r?.fiber ?? f.fiber ?? 0, sugar: r?.sugar ?? f.sugar ?? 0, sodium: r?.sodium ?? f.sodium ?? 0,
    } : f)));
    setUpdatingQtyIdx(null);
  };

  const addItem = async () => {
    const name = newItemName.trim();
    if (!name) return;
    setAddItemDetecting(true);
    const r = await callApi('lookup_nutrition', { itemName: name }).catch(() => null);
    setFoods((prev) => [...prev, r ? { ...r, grams: gramsOf(r) } : { name, qty: '1 serving', cal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0 }]);
    setNewItemName('');
    setAddItemDetecting(false);
    setShowAddItem(false);
  };

  const methodSteps = useMemo(() => {
    if (!plan) return [];
    if (!plan.methodTemplate?.length) return plan.method || [];
    const people = plan.servings || servings;
    const ingredients = (plan.foods || []).map((pf) => {
      const cur = foods.find((f) => f.name === pf.name);
      return { name: pf.name, grams: cur ? gramsOf(cur) * people : null, unitGrams: pf.unitGrams, unitOne: pf.unitOne, unitMany: pf.unitMany };
    });
    return plan.methodTemplate.map((step) => fillMethodStep(step, ingredients));
  }, [plan, foods, servings]);

  const logPlate = () => {
    const toLog = foods.filter((f) => (f.cal || 0) > 0).map(({ name, qty, cal, protein, carbs, fats, fiber, sugar, sodium }) => ({ name, qty, cal, protein, carbs, fats, fiber, sugar, sodium }));
    if (!toLog.length) return;
    track('portion_plan_logged', { calories: total, target: chosen, items: toLog.length });
    onLogPlate && onLogPlate({ title: plan?.title || null, foods: toLog });
  };

  const saveRecipe = async () => {
    if (!plan || savedRecipe) return;
    setSavedRecipe('saving');
    const r1 = (k) => Math.round(foods.reduce((s, f) => s + (f[k] || 0), 0));
    // keep the photo with the saved recipe (uploaded, so it isn't lost when the app closes)
    const imageUrl = recipeImage && recipeImage !== 'failed' ? await uploadRecipeImage(recipeImage) : null;
    await saveCustomRecipe(userId, {
      id: `k-${Date.now()}`,
      name: plan.title || 'My recipe',
      category: 'From my kitchen',
      description: plan.description || '',
      calories: total, protein: r1('protein'), carbs: r1('carbs'), fats: r1('fats'), fiber: r1('fiber'), sugar: r1('sugar'), sodium: r1('sodium'),
      prepTime: plan.minutes ? `${plan.minutes} min` : '', cookTime: '',
      servings: 1, yield: '1 serving',
      ingredients: foods.map((f) => ({ name: f.name, amount: f.qty })),
      instructions: methodSteps,
      note: plan.tip || '',
      imageUrl, aiImage: !!imageUrl, localNames: {}, countries: [],
    });
    setSavedRecipe(true);
    track('kitchen_recipe_saved', { calories: total });
  };

  const pickPhoto = async (fromCamera) => {
    try {
      if (fromCamera && Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
      }
      const res = fromCamera && Platform.OS !== 'web'
        ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
      if (!res.canceled && res.assets?.[0]?.uri) setPhoto(res.assets[0].uri);
    } catch (_) {}
  };

  if (!visible) return null;
  const canSend = text.trim().length > 0 || !!photo;
  const labels = copy.steps(chosen);
  const stepIdx = Math.min(labels.length, Math.floor((pct * labels.length) / 100));
  const shown = labels.slice(0, Math.min(stepIdx, labels.length - 1) + 1);
  const ready = pct >= 100 && !!resultRef.current?.foods;
  const C = 2 * Math.PI * 60;

  return (
    <View style={styles.overlay}>
      <HeaderFade bg="#F9FAFB" />

      {/* 1. What you have (also sits behind the "how much" sheet) */}
      {(step === 'input' || step === 'budget') && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.roundBtn} onPress={() => onClose && onClose(true)} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={INK} />
              </TouchableOpacity>
              <View style={styles.leftChip}>
                <Ionicons name="leaf-outline" size={14} color="#047857" />
                <Text style={styles.leftChipText}>{lowBudget ? 'At your goal today' : `${Math.round(caloriesLeft).toLocaleString()} cal left today`}</Text>
              </View>
            </View>
            <Text style={styles.h1}>{copy.h1}</Text>
            <Text style={styles.kicker}>PERFECT FOR WHEN</Text>
            <View style={styles.whenCard}>
              {copy.when.map(([icon, title, sub], i) => (
                <View key={title} style={[styles.whenRow, i < 2 && styles.rowDivider]}>
                  <View style={styles.whenIcon}><Ionicons name={icon} size={16} color={INK} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whenTitle}>{title}</Text>
                    <Text style={styles.whenSub}>{sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              {photo && (
                <View style={styles.photoChip}>
                  <Image source={{ uri: photo }} style={styles.photoThumb} />
                  <TouchableOpacity onPress={() => setPhoto(null)} style={styles.photoRemove} accessibilityLabel="Remove photo">
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {voice !== 'idle' && (
                <View style={styles.listeningRow}>
                  <View style={styles.listeningDot} />
                  <Text style={styles.listeningText}>{voice === 'listening' ? 'Listening… tap stop when you’re done' : 'Writing down what you said…'}</Text>
                </View>
              )}
              {voiceNote && voice === 'idle' && <Text style={styles.voiceNote}>{voiceNote}</Text>}
              <TextInput
                style={styles.composerInput}
                placeholder="What do you have?"
                placeholderTextColor="#9CA3AF"
                value={text}
                onChangeText={setText}
                multiline
                accessibilityLabel={copy.inputLabel}
              />
              <View style={styles.composerRow}>
                <TouchableOpacity style={styles.composerBtnOutline} onPress={() => pickPhoto(false)} accessibilityLabel="Add a photo">
                  <Ionicons name="add" size={20} color={INK} />
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.composerBtn} onPress={() => pickPhoto(true)} accessibilityLabel="Take a photo">
                    <Ionicons name="camera-outline" size={20} color={INK} />
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[styles.composerBtn, voice === 'listening' && styles.micOn]}
                  onPress={voice === 'listening' ? stopVoice : startVoice}
                  disabled={voice === 'transcribing'}
                  accessibilityLabel={voice === 'listening' ? 'Stop recording' : 'Say it'}
                >
                  <Ionicons name={voice === 'listening' ? 'stop' : 'mic-outline'} size={voice === 'listening' ? 16 : 20} color={voice === 'listening' ? '#fff' : INK} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, (!canSend || voice !== 'idle') && { opacity: 0.35 }]}
                  disabled={!canSend || voice !== 'idle'}
                  onPress={() => setStep('budget')}
                  accessibilityLabel="Send"
                >
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* 2. How much should this meal use? */}
      {step === 'budget' && (
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setStep('input')} accessibilityLabel="Cancel" />
          <LinearGradient colors={['#DDF6E7', '#E9F8EF', '#F4FBF7', '#FFFFFF']} locations={[0, 0.12, 0.3, 0.5]} style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{copy.sheetTitle}</Text>
            <Text style={styles.sheetSub}>
              {lowBudget ? 'You’ve reached today’s calories. Pick an amount and you’ll see how it fits.' : <>You have <Text style={{ color: INK, fontWeight: '700' }}>{Math.round(caloriesLeft).toLocaleString()} cal</Text> left today.{kitchen ? ' We’ll build the recipe to fit.' : ''}</>}
            </Text>

            {!lowBudget && (
              <TouchableOpacity style={[styles.option, useAll && styles.optionOn]} onPress={() => setUseAll(true)} accessibilityRole="radio" accessibilityState={{ selected: useAll }}>
                <View style={[styles.radio, useAll && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Use all of it</Text>
                  <Text style={styles.optionSub}>{Math.round(caloriesLeft).toLocaleString()} cal · this is your last meal today</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={[styles.option, { flexDirection: 'column', alignItems: 'stretch' }, !useAll && styles.optionOn]}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => setUseAll(false)} accessibilityRole="radio" accessibilityState={{ selected: !useAll }}>
                <View style={[styles.radio, !useAll && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{lowBudget ? 'Choose an amount' : 'Just part of it'}</Text>
                  <Text style={styles.optionSub}>{lowBudget ? 'This meal will go over today’s goal' : 'Save some for later today'}</Text>
                </View>
              </TouchableOpacity>
              {!useAll && (
                <View style={styles.amountBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Text style={styles.amountNum}>{amount} <Text style={styles.amountUnit}>cal</Text></Text>
                    {!lowBudget && <Text style={styles.amountLeft}>{Math.max(0, Math.round(caloriesLeft) - amount)} left for later</Text>}
                  </View>
                  <Slider
                    style={{ width: '100%', height: 36, marginTop: 6 }}
                    minimumValue={100}
                    maximumValue={sliderMax}
                    step={10}
                    value={Math.min(amount, sliderMax)}
                    onValueChange={(v) => setAmount(Math.round(v))}
                    minimumTrackTintColor={GREEN}
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor={GREEN}
                    accessibilityLabel="Calories for this meal"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[300, 450, 600].filter((v) => v <= sliderMax).map((v) => (
                      <TouchableOpacity key={v} style={[styles.quick, amount === v && styles.quickOn]} onPress={() => setAmount(v)}>
                        <Text style={[styles.quickText, amount === v && { color: '#fff' }]}>{v} cal</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {kitchen && (
              <View style={[styles.option, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Cooking for</Text>
                  <Text style={styles.optionSub}>Calories above are per person</Text>
                </View>
                <TouchableOpacity style={styles.stepBtnRound} onPress={() => setServings((n) => Math.max(1, n - 1))} accessibilityLabel="Fewer servings">
                  <Ionicons name="remove" size={16} color={INK} />
                </TouchableOpacity>
                <Text style={styles.servingsNum}>{servings}</Text>
                <TouchableOpacity style={styles.stepBtnRound} onPress={() => setServings((n) => Math.min(8, n + 1))} accessibilityLabel="More servings">
                  <Ionicons name="add" size={16} color={INK} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={run} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('input')} style={{ alignSelf: 'center', padding: 8, marginTop: 6 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* 3. Fitting it in: a 0 to 100% ring with the steps ticking in */}
      {step === 'loading' && (
        <View style={{ flex: 1 }}>
          <View style={styles.loadingTop}>
            <View style={{ width: 140, height: 140 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
              <Svg width={140} height={140} viewBox="0 0 140 140" style={StyleSheet.absoluteFill}>
                <Circle cx={70} cy={70} r={60} fill="#fff" stroke="#E3F5EA" strokeWidth={10} />
                <Circle cx={70} cy={70} r={60} fill="none" stroke={GREEN} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 70 70)" />
              </Svg>
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={styles.pctText}>{pct}<Text style={styles.pctSign}>%</Text></Text>
              </View>
            </View>
            <Text style={styles.loadingTitle}>{error ? copy.errorTitle : ready ? copy.readyTitle : copy.loadingTitle}</Text>
            <Text style={styles.loadingSub}>{error || copy.loadingSub(chosen)}</Text>
          </View>
          {!error && (
            <View style={styles.stepsCard}>
              {shown.map((label, i) => {
                const done = i < stepIdx;
                return (
                  <View key={label} style={[styles.stepRow, i < shown.length - 1 && styles.rowDivider]}>
                    <View style={{ width: 24, alignItems: 'center' }}>
                      {done
                        ? <View style={styles.stepDone}><Ionicons name="checkmark" size={13} color="#fff" /></View>
                        : <Ionicons name="sync" size={16} color={GREEN} />}
                    </View>
                    <Text style={styles.stepText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.bottomCta}>
            {error ? (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={run}><Text style={styles.primaryBtnText}>Try again</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setStep('input')} style={{ alignSelf: 'center', padding: 8, marginTop: 6 }}><Text style={styles.cancelText}>Change what I have</Text></TouchableOpacity>
              </>
            ) : ready ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { resetEditing(); setStep('plate'); }}>
                <Text style={styles.primaryBtnText}>{copy.seeBtn}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* 4. Your plate */}
      {step === 'plate' && plan && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: kitchen ? 230 : 170 }}>
            <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 12 }]}>
              <TouchableOpacity style={styles.roundBtn} onPress={() => setStep('input')} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={INK} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.plateSmall}>{kitchen ? 'Built from your kitchen' : (plan.title || 'Your plate')}</Text>
                <Text style={styles.plateBig}>{kitchen ? 'Your recipe' : 'Planned by Logga'}</Text>
              </View>
            </View>

            {kitchen && (
              <View style={styles.heroCard}>
                <View style={styles.heroImageBox}>
                  {recipeImage && recipeImage !== 'failed'
                    ? <Image source={{ uri: recipeImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : recipeImage === 'failed'
                      ? <LinearGradient colors={['#FDE7C8', '#F6C38B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 40 }}>🍲</Text></LinearGradient>
                      : <View style={[StyleSheet.absoluteFill, styles.heroShimmer]}><ActivityIndicator color={GREEN} /></View>}
                  {recipeImage && recipeImage !== 'failed' && (
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles-outline" size={11} color="#fff" />
                      <Text style={styles.aiBadgeText}>AI image · how it could look</Text>
                    </View>
                  )}
                </View>
                <View style={{ padding: 16 }}>
                  <Text style={styles.heroKicker}>MADE FROM WHAT YOU HAVE</Text>
                  <Text style={styles.heroTitle}>{plan.title}</Text>
                  {!!plan.description && <Text style={styles.heroDesc}>{plan.description}</Text>}
                  <View style={styles.heroChips}>
                    {!!plan.minutes && <Text style={styles.heroChip}>{plan.minutes} min</Text>}
                    <Text style={styles.heroChip}>{plan.servings || servings} {(plan.servings || servings) === 1 ? 'serving' : 'servings'}</Text>
                    {!!plan.usedCount && !!plan.totalCount && <Text style={[styles.heroChip, styles.heroChipGreen]}>Uses {plan.usedCount} of your {plan.totalCount} ingredients</Text>}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.satCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kickerDark}>SATIETY ESTIMATE</Text>
                  <Text style={styles.satHead}>Full for ~{formatFullFor(satEst.hours)}</Text>
                  <Text style={styles.satSub}>{satEst.driver ? `Mostly from ${satEst.driver}` : `${Math.round(satEst.protein)}g of protein on this plate`}</Text>
                </View>
                <View style={[styles.levelPill, { backgroundColor: LEVEL_COLORS[satEst.level][0] }]}><Text style={[styles.levelText, { color: LEVEL_COLORS[satEst.level][1] }]}>{satEst.level}</Text></View>
              </View>
              <View style={{ marginTop: 14 }}>
                <Svg width="100%" height={128} viewBox="0 0 318 128" preserveAspectRatio="none" accessibilityLabel="Estimated fullness over the next 6 hours">
                  <Defs>
                    <SvgGradient id="satFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#34D399" stopOpacity="0.45" />
                      <Stop offset="1" stopColor="#34D399" stopOpacity="0" />
                    </SvgGradient>
                  </Defs>
                  <Path d={`M0 ${sat.hungerY} H318`} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" />
                  <Path d={sat.area} fill="url(#satFill)" />
                  <Path d={sat.curve} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" />
                  <Circle cx={sat.dotX} cy={sat.hungerY} r={6} fill="#fff" stroke="#F59E0B" strokeWidth={3} />
                </Svg>
                <Text style={[styles.hungryLabel, { top: sat.hungerY - 22 }]}>Hungry again</Text>
              </View>
              <View style={styles.axisRow}>{sat.ticks.map((l) => <Text key={l} style={styles.axisText}>{l}</Text>)}</View>
              <View style={styles.satBasisRow}>
                <Text style={styles.satBasis}>
                  Based on how much food this is, its protein and fibre, how filling these foods are, and your body's energy needs.
                </Text>
                <SourcesLink topic="satiety" only label="Sources" color={MUTED} />
              </View>
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.budgetText}>{total} of {chosen} cal</Text>
                  <Text style={[styles.budgetText, { fontWeight: '700', color: total > chosen ? '#B91C1C' : '#047857' }]}>
                    {total > chosen ? `${total - chosen} cal over` : `${chosen - total} to spare`}
                  </Text>
                </View>
                <View style={styles.budgetTrack}>
                  {total > chosen
                    ? <View style={[styles.budgetFill, { width: '100%', backgroundColor: '#DC2626' }]} />
                    : <LinearGradient colors={['#6EE7B7', GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.budgetFill, { width: `${Math.min(100, Math.round((total / chosen) * 100))}%` }]} />}
                </View>
              </View>
            </View>

            <Text style={styles.portionNote}>Calories and nutrients are AI estimates. Portions not right? Tap the green label to adjust.</Text>
            <View style={styles.foodCard}>
              <View style={styles.foodCardHead}>
                <Text style={styles.foodCardTitle}>{kitchen ? 'INGREDIENTS (PER PERSON)' : 'YOUR PORTIONS'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.foodCardCount}>{foods.length} items</Text>
                  <TouchableOpacity onPress={() => { setIsFoodEditMode((v) => !v); setShowAddItem(false); }}>
                    <Text style={[styles.foodCardEditBtn, isFoodEditMode && { color: GREEN }]}>{isFoodEditMode ? 'Done' : 'Edit'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {foods.map((food, i) => (
                <View key={i} style={styles.foodRow}>
                  {isFoodEditMode && (
                    <TouchableOpacity style={styles.foodDeleteBtn} onPress={() => setFoods((prev) => prev.filter((_, idx) => idx !== i))} accessibilityLabel={`Remove ${food.name}`}>
                      <Ionicons name="remove-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    {editingQtyIdx === i ? (
                      <View style={styles.editQtyRow}>
                        <TextInput style={styles.editQtyInput} value={editQtyValue} onChangeText={setEditQtyValue} autoFocus />
                        <TouchableOpacity style={styles.editQtyDone} onPress={() => saveQty(i)} disabled={updatingQtyIdx === i}>
                          <Text style={styles.editQtyDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.foodQtyEditable} onPress={() => { setEditingQtyIdx(i); setEditQtyValue(food.qty); }}>
                        <Text style={styles.foodQtyEditableText}>{food.qty}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {editingQtyIdx !== i && (
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => nudgeCal(i, -25)} accessibilityLabel={`Less ${food.name}`}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <View style={{ alignItems: 'center', minWidth: 50 }}>
                        {updatingQtyIdx === i ? (
                          <ActivityIndicator size="small" color={GREEN} />
                        ) : isFoodEditMode && editingCalIdx === i ? (
                          <TextInput
                            style={styles.calInlineInput}
                            value={editCalInputValue}
                            onChangeText={(t) => { setEditCalInputValue(t); editCalInputRef.current = t; }}
                            keyboardType="numeric"
                            autoFocus
                            selectTextOnFocus
                            onBlur={() => {
                              const val = parseInt(editCalInputRef.current, 10);
                              if (!isNaN(val) && val >= 0) setFoods((prev) => prev.map((f, idx) => (idx === i ? scaleFood(f, val) : f)));
                              setEditingCalIdx(null);
                            }}
                          />
                        ) : (
                          <TouchableOpacity disabled={!isFoodEditMode} onPress={() => { setEditingCalIdx(i); setEditCalInputValue(String(food.cal)); editCalInputRef.current = String(food.cal); }}>
                            <Text style={[styles.foodCal, isFoodEditMode && { textDecorationLine: 'underline', color: GREEN }]}>{food.cal}</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={styles.foodCalLabel}>CAL</Text>
                      </View>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => nudgeCal(i, 25)} accessibilityLabel={`More ${food.name}`}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              {isFoodEditMode && (showAddItem ? (
                <View style={styles.addItemRow}>
                  <TextInput style={styles.addItemNameInput} placeholder="Item name" placeholderTextColor="#aaa" value={newItemName} onChangeText={setNewItemName} autoFocus />
                  <TouchableOpacity style={[styles.addItemConfirm, addItemDetecting && { opacity: 0.6 }]} disabled={addItemDetecting} onPress={addItem}>
                    {addItemDetecting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.addItemConfirmText}>Add</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAddItem(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={GREEN} />
                  <Text style={styles.addItemBtnText}>Add item</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.foodTotal}>
                <Text style={styles.foodTotalLabel}>TOTAL</Text>
                <Text style={styles.foodTotalValue}>{total} cal</Text>
              </View>
            </View>

            {kitchen && methodSteps.length > 0 && (
              <View style={styles.methodCard}>
                <Text style={[styles.kickerDark, { marginBottom: 12 }]}>METHOD{(plan.servings || servings) > 1 ? ` · FOR ${plan.servings || servings}` : ''}</Text>
                {methodSteps.map((m, i) => (
                  <View key={i} style={styles.methodRow}>
                    <View style={styles.methodNum}><Text style={styles.methodNumText}>{i + 1}</Text></View>
                    <Text style={styles.methodText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!plan.tip && (
              <LinearGradient colors={['#EAF9F1', '#C7EEDA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tip}>
                <Ionicons name="bulb-outline" size={18} color="#0B3D2E" />
                <Text style={styles.tipText}>{plan.tip}</Text>
              </LinearGradient>
            )}
            <Text style={styles.disclaimer}>Calories and fullness are estimates.</Text>
          </ScrollView>

          <View style={styles.bottomCta}>
            <TouchableOpacity onPress={logPlate} activeOpacity={0.85} disabled={total <= 0}>
              <LinearGradient colors={['#34D399', GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.primaryBtn, styles.logBtn, total <= 0 && { opacity: 0.5 }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{kitchen ? 'Log this meal' : 'Log this plate'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {kitchen && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveRecipe} disabled={savedRecipe}>
                <Ionicons name={savedRecipe ? 'bookmark' : 'bookmark-outline'} size={17} color={savedRecipe ? GREEN : INK} />
                <Text style={[styles.secondaryBtnText, savedRecipe && { color: GREEN }]}>{savedRecipe === 'saving' ? 'Saving…' : savedRecipe ? 'Saved to your recipes' : 'Save recipe'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={kitchen ? styles.textBtn : styles.secondaryBtn} onPress={() => setStep('input')}>
              <Ionicons name="refresh" size={17} color={INK} />
              <Text style={styles.secondaryBtnText}>{kitchen ? 'Try another recipe' : 'Try another combo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F9FAFB', zIndex: 10000,
    paddingTop: Platform.OS === 'web' ? 12 : 50,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  leftChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  leftChipText: { fontSize: 13, fontWeight: '700', color: '#047857' },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32, color: INK, paddingHorizontal: 20, marginTop: 20 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#4B5563', marginTop: 32, marginBottom: 10, paddingHorizontal: 20 },
  kickerDark: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: INK },
  whenCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F0F1F3' },
  whenIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  whenTitle: { fontSize: 15, fontWeight: '600', color: INK },
  whenSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },
  composer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 28, paddingTop: 12, paddingRight: 12, paddingBottom: 10, paddingLeft: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  composerInput: { fontSize: 16, lineHeight: 22, color: INK, minHeight: 26, maxHeight: 110, paddingVertical: 2, outlineStyle: 'none' },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  composerBtnOutline: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  composerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: '#DC2626' },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  listeningText: { fontSize: 12.5, fontWeight: '600', color: '#B91C1C' },
  voiceNote: { fontSize: 12.5, color: MUTED, marginBottom: 6 },
  editText: { fontSize: 14, fontWeight: '600', color: MUTED },
  portionNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 14, marginBottom: 10, marginHorizontal: 20 },
  foodCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', marginHorizontal: 20, overflow: 'hidden' },
  foodCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  foodCardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#111' },
  foodCardCount: { fontSize: 11, color: '#999' },
  foodCardEditBtn: { fontSize: 13, fontWeight: '600', color: '#aaa' },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  foodDeleteBtn: { marginRight: 10, justifyContent: 'center' },
  foodName: { fontSize: 13, fontWeight: '600', color: '#111' },
  foodQtyEditable: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  foodQtyEditableText: { fontSize: 12, color: GREEN, fontWeight: '600' },
  editQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  editQtyInput: { flex: 1, fontSize: 13, color: INK, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: GREEN },
  editQtyDone: { backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  editQtyDoneText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  qtyControl: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '600', color: '#111' },
  foodCal: { fontSize: 15, fontWeight: '700', color: '#111' },
  foodCalLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, color: '#aaa' },
  calInlineInput: { fontSize: 15, fontWeight: '700', color: GREEN, borderBottomWidth: 1.5, borderBottomColor: GREEN, minWidth: 50, textAlign: 'center', paddingVertical: 0 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  addItemBtnText: { fontSize: 13, color: GREEN, fontWeight: '600' },
  addItemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  addItemNameInput: { flex: 1, fontSize: 13, color: '#111', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  addItemConfirm: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addItemConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  foodTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 13, paddingHorizontal: 20, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  foodTotalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#111' },
  foodTotalValue: { fontSize: 18, fontWeight: '700', color: '#111' },
  gramsEdit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gramsInput: { minWidth: 56, height: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1.5, borderColor: GREEN, backgroundColor: '#fff', fontSize: 14, fontWeight: '700', color: INK, textAlign: 'center' },
  photoChip: { alignSelf: 'flex-start', marginBottom: 8 },
  photoThumb: { width: 56, height: 56, borderRadius: 12 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 34 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, lineHeight: 27, color: INK },
  sheetSub: { fontSize: 14, color: '#4B5563', marginTop: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  optionOn: { borderWidth: 2, borderColor: GREEN },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB' },
  radioOn: { borderWidth: 6, borderColor: GREEN },
  optionTitle: { fontSize: 15, fontWeight: '700', color: INK },
  optionSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  amountBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F1F3' },
  amountNum: { fontSize: 30, fontWeight: '800', letterSpacing: -1, color: INK },
  amountUnit: { fontSize: 15, fontWeight: '600', color: MUTED, letterSpacing: 0 },
  amountLeft: { fontSize: 13, fontWeight: '600', color: '#047857' },
  quick: { flex: 1, height: 36, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  quickOn: { backgroundColor: INK, borderColor: INK },
  quickText: { fontSize: 13, fontWeight: '600', color: INK },
  primaryBtn: { marginTop: 18, height: 54, borderRadius: 16, backgroundColor: INK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelText: { fontSize: 14, fontWeight: '600', color: MUTED },
  loadingTop: { paddingTop: 34, paddingHorizontal: 24, alignItems: 'center' },
  pctText: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: INK },
  pctSign: { fontSize: 18, fontWeight: '700', color: MUTED },
  loadingTitle: { marginTop: 28, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: INK, textAlign: 'center' },
  loadingSub: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#4B5563', textAlign: 'center' },
  stepsCard: { marginTop: 28, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 6, paddingHorizontal: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  stepDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 14, fontWeight: '600', color: INK, flex: 1 },
  bottomCta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34, backgroundColor: 'rgba(249,250,251,0.96)', gap: 10 },
  plateSmall: { fontSize: 13, color: '#4B5563' },
  plateBig: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: INK },
  satCard: { marginTop: 16, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(5,150,105,0.1)', paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16 },
  satHead: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 6, color: INK },
  satSub: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  levelPill: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  levelText: { fontSize: 12, fontWeight: '700' },
  hungryLabel: { position: 'absolute', right: 0, fontSize: 11, fontWeight: '600', color: '#B45309', backgroundColor: '#fff', paddingLeft: 6 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11, color: MUTED },
  satBasisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  satBasis: { flex: 1, fontSize: 11.5, lineHeight: 16, color: MUTED },
  budgetText: { fontSize: 13, fontWeight: '600', color: INK },
  budgetTrack: { height: 8, borderRadius: 4, backgroundColor: '#E7F3EC', overflow: 'hidden' },
  budgetFill: { height: 8, borderRadius: 4 },
  hint: { marginTop: 14, marginBottom: 10, marginHorizontal: 20, fontSize: 13, lineHeight: 19, color: MUTED, textAlign: 'center' },
  portionsCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  portionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 18 },
  countText: { fontSize: 13, color: MUTED },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 18 },
  portionName: { fontSize: 15, fontWeight: '500', color: INK },
  measureChip: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EEF7F1' },
  measureText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F3F7', alignItems: 'center', justifyContent: 'center' },
  portionCal: { fontSize: 17, fontWeight: '700', color: INK },
  portionCalUnit: { fontSize: 10, letterSpacing: 1.5, color: MUTED },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 18, backgroundColor: '#FAFAFB' },
  totalText: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: INK },
  tip: { marginTop: 14, marginHorizontal: 20, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#0B3D2E' },
  disclaimer: { marginTop: 12, fontSize: 11.5, color: '#9CA3AF', textAlign: 'center' },
  logBtn: { marginTop: 0, backgroundColor: 'transparent' },
  secondaryBtn: { height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  textBtn: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepBtnRound: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F3F7', alignItems: 'center', justifyContent: 'center' },
  servingsNum: { minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: '700', color: INK },
  heroCard: { marginTop: 16, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(5,150,105,0.1)', overflow: 'hidden' },
  heroImageBox: { height: 200, backgroundColor: '#F3F4F6' },
  heroShimmer: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  aiBadge: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.6)' },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: GREEN },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28, color: INK, marginTop: 6 },
  heroDesc: { fontSize: 13, lineHeight: 19, color: '#4B5563', marginTop: 6 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  heroChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#F3F4F6', fontSize: 12, fontWeight: '600', color: INK, overflow: 'hidden' },
  heroChipGreen: { backgroundColor: '#ECFDF5', color: '#047857', fontWeight: '700' },
  methodCard: { marginTop: 14, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 16, paddingHorizontal: 18 },
  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  methodNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  methodNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  methodText: { flex: 1, fontSize: 14, lineHeight: 21, color: '#374151' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: INK },
});

export default PortionPlanner;
