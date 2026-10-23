import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Platform, Image, KeyboardAvoidingView } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { ensureAiConsent, AiConsentError } from '../lib/consent';
import { track } from '../lib/analytics';
import HeaderFade from './HeaderFade';

// "Fit it in": the person already has food (bought it, or it's at home) and wants portions that fit
// the calories they have left. Four steps: what you have → how much to use → working it out → your plate.

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

async function planPortions({ text, photoUri, budget, userCountry }) {
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
    body: JSON.stringify({ type: 'plan_portions', data: { text, base64, budget, userCountry } }),
  });
  let result;
  try { result = JSON.parse(await response.text()); } catch { throw new Error('Something went wrong. Try again.'); }
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
  return result;
}

// ¼, ½, ¾ for home measures ("1½ cups cooked").
const frac = (n) => {
  const q = Math.round(n * 4) / 4, w = Math.floor(q), r = q - w;
  const s = r === 0.25 ? '¼' : r === 0.5 ? '½' : r === 0.75 ? '¾' : '';
  return ((w === 0 && s ? '' : String(w)) + s) || '0';
};
const measureOf = (f, g) => {
  const n = g / f.unitGrams;
  if (f.unitGrams <= 40) { const c = Math.max(1, Math.round(n)); return `${c} ${c === 1 ? f.unitOne : f.unitMany}`; }
  return `${frac(n)} ${n > 1.125 ? f.unitMany : f.unitOne}`;
};

// An illustrative fullness curve: protein, fat and fibre slow how fast fullness fades.
const satietyOf = (P, C, F, fibre) => {
  const tau = 1.2 + P / 14 + F / 40 + C / 120 + fibre / 30;
  const full = (t) => 100 * (1 - Math.exp(-t / 0.35)) * Math.exp(-t / tau);
  const W = 318, top = 18, bot = 108, HUNGRY = 35;
  const X = (t) => (t / 6) * W, Y = (v) => bot - (v / 100) * (bot - top);
  const pts = []; let cross = 6;
  for (let t = 0; t <= 6.0001; t += 0.1) {
    pts.push(`${X(t).toFixed(1)} ${Y(full(t)).toFixed(1)}`);
    if (t > 0.5 && cross === 6 && full(t) < HUNGRY) cross = t;
  }
  const curve = `M${pts.join(' L')}`;
  const level = cross >= 4 ? ['High', '#D1FAE5', '#047857'] : cross >= 2.5 ? ['Medium', '#FEF3C7', '#B45309'] : ['Low', '#FEE2E2', '#B91C1C'];
  return { curve, area: `${curve} L${W} ${bot} L0 ${bot} Z`, hungerY: Y(HUNGRY), dotX: X(cross), hrs: String(Math.round(cross * 2) / 2).replace('.5', '½'), level };
};

const PortionPlanner = ({ visible, onClose, caloriesLeft = 0, userCountry = '', onLogPlate }) => {
  const [step, setStep] = useState('input'); // input | budget | loading | plate
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const lowBudget = caloriesLeft < 150;
  const [useAll, setUseAll] = useState(false);
  const [amount, setAmount] = useState(450);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [grams, setGrams] = useState([]);
  const resultRef = useRef(null);

  // Fresh each time it opens.
  useEffect(() => {
    if (!visible) return;
    setStep('input'); setText(''); setPhoto(null); setPlan(null); setError(null);
    const left = Math.max(0, Math.round(caloriesLeft));
    setUseAll(false);
    setAmount(left >= 150 ? Math.min(left, Math.max(100, Math.round((left * 0.6) / 10) * 10)) : 300);
  }, [visible]);

  const sliderMax = lowBudget ? 1500 : Math.max(100, Math.round(caloriesLeft));
  const chosen = useAll && !lowBudget ? Math.round(caloriesLeft) : amount;

  // Working it out: the ring counts up while the plan is made and only reaches 100% once it's back.
  const run = () => {
    setStep('loading'); setPct(0); setError(null); resultRef.current = null;
    track('portion_plan_started', { has_photo: !!photo, calories: chosen });
    planPortions({ text: text.trim(), photoUri: photo, budget: chosen, userCountry })
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
        if (!r && p >= 92) return p;
        return p + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (pct === 100 && resultRef.current?.foods) {
      setPlan(resultRef.current);
      setGrams(resultRef.current.foods.map((f) => f.grams));
    }
  }, [pct]);

  const items = useMemo(() => (plan?.foods || []).map((f, i) => {
    const g = grams[i] ?? f.grams;
    const k = g / 100;
    return {
      ...f, g,
      cal: Math.round(f.kcal100 * k),
      protein: Math.round(f.protein100 * k * 10) / 10, carbs: Math.round(f.carbs100 * k * 10) / 10,
      fats: Math.round(f.fat100 * k * 10) / 10, fiber: Math.round((f.fiber100 || 0) * k * 10) / 10,
      sugar: Math.round((f.sugar100 || 0) * k * 10) / 10, sodium: Math.round((f.sodium100 || 0) * k),
      measure: measureOf(f, g),
    };
  }), [plan, grams]);
  const total = items.reduce((s, i) => s + i.cal, 0);
  const sum = (key) => items.reduce((s, i) => s + i[key], 0);
  const sat = useMemo(() => satietyOf(sum('protein'), sum('carbs'), sum('fats'), sum('fiber')), [items]);
  const setG = (i, d) => setGrams((prev) => prev.map((g, j) => (j === i ? Math.max(0, Math.min(1000, g + d)) : g)));

  const logPlate = () => {
    const foods = items.filter((i) => i.g > 0).map((i) => ({
      name: i.name, qty: `${i.measure} (${i.g} g)`, cal: i.cal, protein: i.protein, carbs: i.carbs, fats: i.fats,
      fiber: i.fiber, sugar: i.sugar, sodium: i.sodium,
    }));
    if (!foods.length) return;
    track('portion_plan_logged', { calories: total, target: chosen, items: foods.length });
    onLogPlate && onLogPlate({ title: plan?.title || null, foods });
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
  const labels = STEP_LABELS(chosen);
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
            <Text style={styles.h1}>{'Got food already?\nLet’s make it fit.'}</Text>
            <Text style={styles.kicker}>PERFECT FOR WHEN</Text>
            <View style={styles.whenCard}>
              {[
                ['bag-handle-outline', 'You just bought it', 'Waakye on the way home, a pack of kelewele'],
                ['help-circle-outline', 'You don’t know how it was made', 'No recipe, no label, no problem'],
                ['home-outline', 'It’s already at home', 'Leftovers, Sunday’s stew, whatever’s in the fridge'],
              ].map(([icon, title, sub], i) => (
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
              <TextInput
                style={styles.composerInput}
                placeholder="What do you have?"
                placeholderTextColor="#9CA3AF"
                value={text}
                onChangeText={setText}
                multiline
                accessibilityLabel="Tell Logga what food you have"
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
                  style={[styles.sendBtn, !canSend && { opacity: 0.35 }]}
                  disabled={!canSend}
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
            <Text style={styles.sheetTitle}>How much should this meal use?</Text>
            <Text style={styles.sheetSub}>
              {lowBudget ? 'You’ve reached today’s calories. Pick an amount and you’ll see how it fits.' : <>You have <Text style={{ color: INK, fontWeight: '700' }}>{Math.round(caloriesLeft).toLocaleString()} cal</Text> left today.</>}
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
            <Text style={styles.loadingTitle}>{error ? 'Couldn’t plan that' : ready ? 'Your plate is ready' : 'Fitting it in…'}</Text>
            <Text style={styles.loadingSub}>{error || `Working out portions for your ${chosen} cal`}</Text>
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
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('plate')}>
                <Text style={styles.primaryBtnText}>See your plate</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* 4. Your plate */}
      {step === 'plate' && plan && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 170 }}>
            <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 12 }]}>
              <TouchableOpacity style={styles.roundBtn} onPress={() => setStep('input')} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={INK} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.plateSmall}>{plan.title || 'Your plate'}</Text>
                <Text style={styles.plateBig}>Planned by Logga</Text>
              </View>
            </View>

            <View style={styles.satCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kickerDark}>SATIETY ESTIMATE</Text>
                  <Text style={styles.satHead}>Full for ~{sat.hrs} hrs</Text>
                  <Text style={styles.satSub}>Mostly from {Math.round(sum('protein'))}g of protein</Text>
                </View>
                <View style={[styles.levelPill, { backgroundColor: sat.level[1] }]}><Text style={[styles.levelText, { color: sat.level[2] }]}>{sat.level[0]}</Text></View>
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
              <View style={styles.axisRow}>{['Now', '2h', '4h', '6h'].map((l) => <Text key={l} style={styles.axisText}>{l}</Text>)}</View>
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

            <Text style={styles.hint}>Portions not right? Use − / + to change the weight.</Text>
            <View style={styles.portionsCard}>
              <View style={[styles.portionsHead, styles.rowDivider]}>
                <Text style={styles.kickerDark}>YOUR PORTIONS</Text>
                <Text style={styles.countText}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
              </View>
              {items.map((it, i) => (
                <View key={i} style={[styles.portionRow, styles.rowDivider]}>
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <Text style={styles.portionName}>{it.name}</Text>
                    <View style={styles.measureChip}><Text style={styles.measureText}>{it.measure} · {it.g} g</Text></View>
                  </View>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setG(i, -10)} accessibilityLabel={`Less ${it.name}`}>
                    <Ionicons name="remove" size={18} color={INK} />
                  </TouchableOpacity>
                  <View style={{ width: 44, alignItems: 'center' }}>
                    <Text style={styles.portionCal}>{it.cal}</Text>
                    <Text style={styles.portionCalUnit}>CAL</Text>
                  </View>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setG(i, 10)} accessibilityLabel={`More ${it.name}`}>
                    <Ionicons name="add" size={18} color={INK} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.kickerDark}>TOTAL</Text>
                <Text style={styles.totalText}>{total} cal</Text>
              </View>
            </View>

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
                <Text style={styles.primaryBtnText}>Log this plate</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('input')}>
              <Ionicons name="refresh" size={17} color={INK} />
              <Text style={styles.secondaryBtnText}>Try another combo</Text>
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
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: INK },
});

export default PortionPlanner;
