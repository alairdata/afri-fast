import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Animated, Easing,
  Platform, useWindowDimensions, Image, Alert, ActivityIndicator, Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import { track, EVENTS } from '../lib/analytics';
import { appleHealthSupported, connectAppleHealth } from '../lib/appleHealth';
import { requestNotificationPermissions } from '../lib/notifications';
import { mealReminderCopy } from '../lib/lumiVoice';
import {
  initAnonymousSubscriptions, loadPlans, loadIntroOffer, purchasePlan, restorePurchases, getSubscription,
} from '../lib/subscription';
import HealthSourcesPage from './HealthSourcesPage';
import LumiRive from './LumiRive';
import { showAlert } from '../lib/alert';

// ── Design tokens (the onboarding canvas) ──────────────────────────────────────
const C = {
  primary:     '#059669',
  primaryDark: '#047857',
  primarySoft: '#ecfdf5',
  selBg:       '#F2FBF6',
  mint:        '#E6F8EF',
  terra:       '#db6a3f',
  terraSoft:   '#fbeee7',
  ink:         '#16201b',
  ink700:      '#3a4640',
  ink600:      '#4b5a52',
  ink500:      '#6c7872',
  ink400:      '#97a19b',
  bg:          '#F7F8F5',
  plan:        '#fbfbf7',
  surface:     '#ffffff',
  sunken:      '#E9ECE8',
  line:        '#e9e9e1',
  cardLine:    '#E6E8E3',
  track:       '#E3E7E2',
  checkLine:   '#CBD2CD',
};

const LUMI = {
  welcome:  require('../../assets/lumi/lumi-welcome.png'),
  avatar:   require('../../assets/lumi/lumi-avatar.png'),
  think:    require('../../assets/lumi/lumi-think.png'),
  wave:     require('../../assets/lumi/lumi-wave.png'),
  cheer:    require('../../assets/lumi/lumi-cheer.png'),
  heart:    require('../../assets/lumi/lumi-heart.png'),
  auntie:   require('../../assets/lumi/lumi-auntie.png'),
  elder:    require('../../assets/lumi/lumi-elder.png'),
  stand:    require('../../assets/lumi/lumi-stand.png'),
  phone:    require('../../assets/lumi/lumi-phone.png'),
  target:   require('../../assets/lumi/lumi-target.png'),
  food:     require('../../assets/lumi/lumi-food.png'),
  idea:     require('../../assets/lumi/lumi-idea.png'),
  water:    require('../../assets/lumi/lumi-water.png'),
  building: require('../../assets/lumi/lumi-building.png'),
  forecast: require('../../assets/lumi/lumi-forecast.png'),
  gift:     require('../../assets/lumi/lumi-gift.png'),
  shocked:  require('../../assets/lumi/lumi-shocked.png'),
};

export const DEFAULT_DATA = {
  goal: '', struggles: [], name: '', tone: 'cheerleader', country: '', gender: '', age: 28,
  heightCm: 170, weightKg: 82, targetKg: 72, unitH: 'cm', unitW: 'kg',
  pace: 'moderate', activity: '', eatingStyle: '',
  foodContext: '', cuisines: [], whys: [], accountability: '',
  reminders: [], remindersOn: false, healthConnect: false, waterHabit: '', mealsPerDay: '',
};

// Five chapters, as on the canvas. The breather, the plan build-up and everything after the plan sit
// outside them (no chapter bar).
const CHAPTERS = [
  { name: 'Your goal',   ids: ['goal', 'demo', 'struggle'] },
  { name: 'About you',   ids: ['name', 'tone', 'country', 'gender', 'age'] },
  { name: 'Your body',   ids: ['height', 'weight', 'target', 'pace', 'activity'] },
  { name: 'Your eating', ids: ['eating', 'food', 'why'] },
  { name: 'Support',     ids: ['care', 'reminders', 'health'] },
];
const FLOW = [
  'hook',
  ...CHAPTERS[0].ids, ...CHAPTERS[1].ids, 'bodyIntro', ...CHAPTERS[2].ids, ...CHAPTERS[3].ids, ...CHAPTERS[4].ids,
  'commit', 'building', 'done', 'pro', 'wait', 'offer', 'widget', 'widgetSteps',
];
const chapterOf = (id) => {
  const c = CHAPTERS.findIndex((ch) => ch.ids.includes(id));
  if (c < 0) return null;
  const ids = CHAPTERS[c].ids;
  return { index: c, name: CHAPTERS[c].name, fill: (ids.indexOf(id) + 1) / (ids.length + 0.33) };
};

const OFFER_WINDOW_MS = 2 * 60 * 60 * 1000;

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
const tick = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
const openUrl = (url) => Linking.openURL(url).catch(() => {});
const firstName = (d) => (d.name ? d.name.trim().split(' ')[0] : '');

// ── Calorie calculator (Mifflin-St Jeor → TDEE) ───────────────────────────────
export function calcPlan(d) {
  const s = d.gender === 'Male' ? 5 : d.gender === 'Female' ? -161 : -78;
  const bmr = 10 * d.weightKg + 6.25 * d.heightCm - 5 * d.age + s;
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[d.activity] || 1.375;
  const tdee = bmr * factor;
  const DEFICIT = { slow: 275, moderate: 550, aggressive: 825, extreme: 1100 };
  const deficit = d.targetKg < d.weightKg ? (DEFICIT[d.pace] || 550) : 0;
  const floor = d.gender === 'Male' ? 1500 : 1200;
  let target = Math.round((tdee - deficit) / 10) * 10;
  if (target < floor) target = floor;
  const gap = d.weightKg - d.targetKg;
  const RATE = { slow: 0.25, moderate: 0.5, aggressive: 0.75, extreme: 1.0 };
  const rate = RATE[d.pace] || 0.5;
  const weeks = d.targetKg < d.weightKg && gap > 0 ? Math.max(1, Math.round(gap / rate)) : 0;
  const protein = Math.round(d.weightKg * 1.6);
  const water = Math.max(2, Math.round(d.weightKg * 0.033 * 10) / 10);
  return { tdee: Math.round(tdee), target, weeks, protein, water, deficit };
}

const PACE_RATE = { slow: 0.25, moderate: 0.5, aggressive: 0.75, extreme: 1.0 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The month the goal lands in and the month after, e.g. "Aug – Sep 2027" (an estimate, so a range).
function predictedWindow(d, pace = d.pace) {
  const gap = d.weightKg - d.targetKg;
  if (!(gap > 0.5)) return null;
  const weeks = Math.max(1, Math.round(gap / (PACE_RATE[pace] || 0.5)));
  const a = new Date(Date.now() + weeks * 7 * 864e5);
  const b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
  const sameYear = a.getFullYear() === b.getFullYear();
  return {
    long: sameYear
      ? `${MONTHS[a.getMonth()]} – ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
      : `${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${MONTHS[b.getMonth()]} ${b.getFullYear()}`,
    short: `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]} ${String(b.getFullYear()).slice(2)}`,
    end: `${MONTHS[b.getMonth()]} ${b.getFullYear()}`,
  };
}

const weightText = (kg, unitW) => (unitW === 'lb' ? `${Math.round(kg * 2.2046)} lb` : `${Math.round(kg * 10) / 10} kg`);

// What onboarding hands back to the app (saved to the profile after sign-up).
function buildAnswers(d) {
  const plan = calcPlan(d);
  const goalDate = plan.weeks > 0
    ? new Date(Date.now() + plan.weeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;
  const r = d.reminders || [];
  const accountability = d.accountability
    || (r.includes('alone') ? 'alone' : r.includes('firm') ? 'firm' : r.length ? 'gentle' : '');
  return {
    preferredName: d.name,
    gender: d.gender,
    age: String(d.age),
    height: String(Math.round(d.heightCm)),
    heightUnit: 'cm',
    goal: d.goal,
    currentWeight: String(Math.round(d.weightKg * 10) / 10),
    targetWeight: String(Math.round(d.targetKg * 10) / 10),
    weightUnit: 'kg',
    conditions: '',
    completedAt: Date.now(),
    country: d.country,
    pace: d.pace,
    activity: d.activity,
    eatingStyle: d.eatingStyle,
    accountability,
    tone: d.tone,
    remindersOn: !!d.remindersOn && !r.includes('alone'),
    healthConnect: !!d.healthConnect,
    waterHabit: d.waterHabit,
    mealsPerDay: d.mealsPerDay,
    struggles: d.struggles,
    foodContext: d.foodContext,
    cuisines: d.cuisines,
    whys: d.whys,
    goalDate,
    dailyCalorieGoal: plan.target,
  };
}

// ── Small pieces ───────────────────────────────────────────────────────────────
function Sparkle({ size = 16, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={[{ position: 'absolute' }, style]}>
      <Path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#34D399" />
    </Svg>
  );
}

function Sparkles() {
  return (
    <>
      <Sparkle size={18} style={{ left: '6%', top: '12%' }} />
      <Sparkle size={14} style={{ left: '86%', top: '6%' }} />
      <Sparkle size={16} style={{ left: '90%', top: '58%' }} />
      <Sparkle size={12} style={{ left: '2%', top: '64%' }} />
    </>
  );
}

function PrimaryBtn({ label, onPress, disabled, busy }) {
  return (
    <TouchableOpacity
      style={[s.primaryBtn, disabled && s.primaryBtnDis]}
      onPress={disabled || busy ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryBtnTxt, disabled && s.primaryBtnTxtDis]}>{label}</Text>}
    </TouchableOpacity>
  );
}

function TextBtn({ label, onPress }) {
  return (
    <TouchableOpacity style={s.textBtn} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={s.textBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} style={[s.segBtn, on && s.segBtnOn]} onPress={() => onChange(o.value)} accessibilityRole="button">
            <Text style={[s.segBtnTxt, on && s.segBtnTxtOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Five chapter bars: finished chapters full, the current one part-filled.
function ChapterBars({ index, fill, dim }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
      {CHAPTERS.map((_, i) => (
        <View key={i} style={[s.bar, dim && { backgroundColor: 'rgba(22,32,27,0.12)' }]}>
          {i < index ? <View style={[s.barFill, { width: '100%' }]} /> : null}
          {i === index && fill > 0 ? <View style={[s.barFill, { width: `${Math.round(fill * 100)}%` }]} /> : null}
        </View>
      ))}
    </View>
  );
}

function TopBar({ chapter, onBack, showBack, noLabel }) {
  return (
    <View style={s.topWrap}>
      <View style={s.topRow}>
        <TouchableOpacity
          style={[s.backBtn, !showBack && { opacity: 0 }]}
          onPress={showBack ? onBack : undefined}
          disabled={!showBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </TouchableOpacity>
        {chapter ? <ChapterBars index={chapter.index} fill={chapter.fill} /> : <View style={{ flex: 1 }} />}
      </View>
      {chapter && !noLabel ? <Text style={s.chapterLabel}>Chapter {chapter.index + 1} of 5 · {chapter.name}</Text> : null}
    </View>
  );
}

// Lumi asks the question in a chat bubble.
function Bubble({ lumi = 'avatar', title, sub, hideLumi }) {
  return (
    <View style={s.bubbleRow}>
      {!hideLumi ? (
        <View style={s.bubbleAvatar}>
          {lumi === 'avatar'
            ? <LumiRive name="blink" width={56} height={54} />
            : <Image source={LUMI[lumi]} style={{ width: 56, height: 54 }} resizeMode="contain" accessibilityLabel="Lumi" />}
        </View>
      ) : null}
      <View style={[s.bubble, hideLumi && { borderBottomLeftRadius: 18 }]}>
        <Text style={s.bubbleTitle}>{title}</Text>
        {sub ? <Text style={s.bubbleSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// One answer. Single answers show a filled tick when chosen, multi answers a square box.
function Option({ icon, title, subtitle, selected, onPress, multi, compact, lead }) {
  return (
    <TouchableOpacity
      style={[s.opt, compact && s.optCompact, selected && s.optSel]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: !!selected }}
    >
      {lead || (icon ? <Ionicons name={icon} size={22} color={selected ? C.primary : C.ink500} style={{ marginRight: 14 }} /> : null)}
      <View style={{ flex: 1 }}>
        <Text style={s.optTitle}>{title}</Text>
        {subtitle ? <Text style={s.optSub}>{subtitle}</Text> : null}
      </View>
      {multi ? (
        <View style={[s.box, selected && s.boxOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
      ) : selected ? (
        <View style={s.radioOn}><Ionicons name="checkmark" size={13} color="#fff" /></View>
      ) : null}
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity style={[s.chip, selected && s.chipSel]} onPress={onPress} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected }}>
      <Text style={[s.chipText, selected && s.chipTextSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Vertical number wheel (age, height, weights) ──────────────────────────────
const ROW = 58;
function WheelPicker({ min, max, value, onChange, unit, unitColor = C.primary }) {
  const ref = useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const [live, setLive] = useState(clamp(value));
  const lastSent = useRef(value);
  const rangeKey = `${min}-${max}`;

  useEffect(() => { setLive(clamp(value)); lastSent.current = value; }, [value]);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: (clamp(value) - min) * ROW, animated: false }), 30);
    return () => clearTimeout(t);
  }, [rangeKey]);

  const onScroll = useCallback((e) => {
    const v = clamp(min + Math.round(e.nativeEvent.contentOffset.y / ROW));
    setLive((prev) => { if (prev !== v) tick(); return v; });
    if (v !== lastSent.current) { lastSent.current = v; onChange(v); }
  }, [min, max, onChange]);

  return (
    <View style={{ height: ROW * 5, alignSelf: 'stretch' }}>
      <View pointerEvents="none" style={[s.wheelPill, { top: ROW * 2 - 8, height: ROW + 16 }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        onScroll={onScroll}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
      >
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const v = min + i;
          const dist = Math.abs(v - live);
          return (
            <View key={v} style={s.wheelRow}>
              <Text style={dist === 0 ? s.wheelOn : dist === 1 ? s.wheelNear : s.wheelFar}>{v}</Text>
              {dist === 0 ? <Text style={[s.wheelUnit, { color: unitColor }]}>{unit}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Screen shell: top bar, Lumi bubble, body, footer ───────────────────────────
function ScreenShell({ children, footer, chapter, onBack, showBack, hideProgress, fixed, editing }) {
  const Body = fixed ? View : ScrollView;
  const bodyProps = fixed
    ? { style: [{ flex: 1 }, s.shellContent] }
    : { style: { flex: 1 }, contentContainerStyle: s.shellContent, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' };
  return (
    <View style={s.shell}>
      {!hideProgress ? <TopBar chapter={chapter} onBack={onBack} showBack={showBack} /> : null}
      <Body {...bodyProps}>{children}</Body>
      {footer ? <View style={[s.footer, editing && { paddingTop: 8 }]}>{footer}</View> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────────────────────

// The welcome screen's real plates, each tagged with its calories (the owner's photos).
const HOOK_PLATES = [
  { img: require('../../assets/welcome/jollof-plantain-chicken.jpg'), left: 4, top: 22, size: 168 },
  { img: require('../../assets/welcome/pepper-soup.jpg'), left: 200, top: 4, size: 120 },
  { img: require('../../assets/welcome/ampesi-egg-stew.jpg'), left: 186, top: 160, size: 132 },
  { img: require('../../assets/welcome/koose.jpg'), left: 62, top: 206, size: 108 },
];
const HOOK_TAGS = [
  { label: 'Jollof, plantain & chicken', kcal: 1010, style: { left: 0, top: 166 } },
  { label: 'Pepper soup', kcal: 250, style: { right: 14, top: 110 } },
  { label: 'Ampesi & egg stew', kcal: 450, style: { right: -4, top: 280 } },
  { label: 'Koose', kcal: 410, style: { left: 40, top: 302 } },
];

function HookScreen({ next, onLogin }) {
  return (
    <LinearGradient colors={['#E6F8EF', C.bg]} locations={[0, 0.6]} style={[s.shell, s.hook]}>
      <Image source={require('../../assets/logga-wordmark.png')} style={{ width: 92, height: 34 }} resizeMode="contain" accessibilityLabel="Logga" />
      <View style={s.hookHero}>
        <Sparkles />
        <View style={s.hookPlates} accessible accessibilityRole="image" accessibilityLabel="Real plates of jollof with plantain and chicken, pepper soup, ampesi with egg stew and koose, each tagged with its calories">
          {HOOK_PLATES.map((p, i) => (
            <Image key={i} source={p.img} style={[s.hookPlate, { left: p.left, top: p.top, width: p.size, height: p.size, borderRadius: p.size / 2 }]} />
          ))}
          {HOOK_TAGS.map((t) => (
            <View key={t.label} style={[s.hookTag, t.style]}>
              <View style={s.hookTagDot} />
              <Text style={s.hookTagTxt} numberOfLines={1}>{t.label} <Text style={{ color: C.primary, fontWeight: '800' }}>{t.kcal}</Text></Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.hookHeadline}>
        Eat the food you <Text style={{ color: C.primary }}>love</Text>.{'\n'}Reach your body goals.
      </Text>
      <Text style={s.hookSubline}>The best nutrition app that truly knows jollof, fufu and suya – counted the way you actually eat.</Text>
      <View style={s.hookCta}>
        <PrimaryBtn label="Get started" onPress={next} />
        <TouchableOpacity onPress={onLogin} style={s.hookLoginBtn} activeOpacity={0.7} accessibilityRole="button">
          <Text style={s.hookLoginTxt}>I already have an account</Text>
        </TouchableOpacity>
        <Text style={s.hookLegal}>
          By continuing, you agree to our{' '}
          <Text style={s.hookLegalLink} onPress={() => openUrl('https://www.logga.space/terms')} accessibilityRole="link">Terms of Use</Text>
          {' '}and{' '}
          <Text style={s.hookLegalLink} onPress={() => openUrl('https://www.logga.space/privacy')} accessibilityRole="link">Privacy Notice</Text>.
        </Text>
      </View>
    </LinearGradient>
  );
}

const DEMO_TAGS = [
  { label: 'Fried Plantain', kcal: 180, top: '22%', right: '6%' },
  { label: 'Jollof Rice',    kcal: 620, top: '45%', left: '6%'  },
  { label: 'Fried Chicken',  kcal: 210, top: '66%', right: '6%' },
];

function DemoScreen(p) {
  const { next } = p;
  const [phase, setPhase] = useState('capture');
  const [imgH, setImgH] = useState(400);
  const scanY    = useRef(new Animated.Value(0)).current;
  const barSlide = useRef(new Animated.Value(-72)).current;
  const tagFades = useRef(DEMO_TAGS.map(() => new Animated.Value(0))).current;

  const handleShutter = () => {
    tap();
    setPhase('scanning');
    Animated.timing(scanY, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      .start(() => setPhase('result'));
  };

  useEffect(() => {
    if (phase !== 'result') return;
    Animated.sequence([
      Animated.spring(barSlide, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }),
      Animated.stagger(180, tagFades.map((f) => Animated.spring(f, { toValue: 1, useNativeDriver: true, tension: 130, friction: 14 }))),
    ]).start();
  }, [phase]);

  const scanTranslate = scanY.interpolate({ inputRange: [0, 1], outputRange: [0, imgH - 4] });

  return (
    <View style={s.shell}>
      <TopBar chapter={p.chapter} onBack={p.onBack} showBack={p.showBack} />
      <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
        <Text style={s.eyebrow}>SEE IT IN ACTION</Text>
        <Text style={s.demoHeadline}>{phase !== 'result' ? "Let's see the magic." : 'Boom, it knows your plate.'}</Text>
        <Text style={s.demoSub}>
          {phase !== 'result'
            ? 'Tap the shutter. Point Logga at any plate, even jollof, and watch it read the calories.'
            : 'No weighing. No searching. This is how every meal will feel.'}
        </Text>
      </View>

      <View style={{ flex: 1, marginHorizontal: 16, marginTop: 16 }} onLayout={(e) => setImgH(e.nativeEvent.layout.height)}>
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden' }}>
          <Image source={require('../../assets/jollof-demo.jpg')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {phase === 'scanning' && <Animated.View style={[s.demoScanLine, { transform: [{ translateY: scanTranslate }] }]} />}
          {phase === 'result' && DEMO_TAGS.map((tag, i) => (
            <Animated.View key={tag.label} style={[s.demoTagRow, {
              top: tag.top, left: tag.left, right: tag.right,
              opacity: tagFades[i],
              transform: [{ scale: tagFades[i].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }]}>
              <View style={s.demoTagDot} />
              <View style={s.demoTagPill}>
                <Text style={s.demoTagTxt}>{tag.label} <Text style={{ color: C.primary }}>{tag.kcal}</Text></Text>
              </View>
            </Animated.View>
          ))}
          {phase === 'capture' && (
            <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' }}>
              <TouchableOpacity style={s.demoShutter} onPress={handleShutter} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Take a photo">
                <View style={s.demoShutterInner} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {phase === 'result' && (
          <Animated.View style={[s.demoDetectBar, { transform: [{ translateY: barSlide }] }]}>
            <View>
              <Text style={s.demoDetectTitle}>Detected · 3 items</Text>
              <Text style={s.demoDetectSub}>Tap any tag to adjust portion</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.demoKcal}>1010</Text>
              <Text style={s.demoKcalUnit}>KCAL</Text>
            </View>
          </Animated.View>
        )}
      </View>

      <View style={s.footer}>
        {phase !== 'result'
          ? <TextBtn label="Skip the demo" onPress={next} />
          : <PrimaryBtn label="That's the magic, continue" onPress={next} />}
      </View>
    </View>
  );
}

export function GoalScreen(p) {
  const { d, pick, next } = p;
  const opts = [
    { v: 'lose',       t: 'Lose weight',       s: 'Shed kilos at a healthy, steady pace', icon: 'trending-down-outline' },
    { v: 'eat',        t: 'Eat better',        s: 'More balance, less guilt',             icon: 'leaf-outline' },
    { v: 'consistent', t: 'Stay consistent',   s: 'Build a habit that finally sticks',    icon: 'flame-outline' },
    { v: 'understand', t: 'Understand my body', s: 'Learn what my meals really do',       icon: 'search-outline' },
  ];
  return (
    <ScreenShell {...p} footer={p.editing ? <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.goal} /> : null}>
      <Bubble hideLumi={p.editing} title="What brings you here?" sub="Pick the one that matters most right now." />
      <View style={s.opts}>
        {opts.map((o) => (
          <Option key={o.v} icon={o.icon} title={o.t} subtitle={o.s} selected={d.goal === o.v} onPress={() => pick('goal', o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

export function StruggleScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'forget',     t: 'I forget to track',             s: 'Life gets busy and logging slips', icon: 'notifications-off-outline' },
    { v: 'local',      t: "Don't know local food calories", s: 'No app counts a wrap of fufu',     icon: 'help-circle-outline' },
    { v: 'motivation', t: 'I lose motivation',              s: 'I start strong, then fade',        icon: 'battery-half-outline' },
    { v: 'eatout',     t: 'I eat out a lot',                s: 'Buka, mama-put, restaurants',      icon: 'storefront-outline' },
  ];
  const list = d.struggles || [];
  const toggle = (v) => { tap(); set('struggles', list.includes(v) ? list.filter((x) => x !== v) : [...list, v]); };
  return (
    <ScreenShell {...p} footer={
      <>
        <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={list.length === 0} />
        {!p.editing && <TextBtn label="Skip" onPress={next} />}
      </>
    }>
      <Bubble lumi="think" hideLumi={p.editing} title="What's tripped you up before?" sub="Pick all that ring true. No judgement." />
      <View style={s.opts}>
        {opts.map((o) => (
          <Option key={o.v} multi icon={o.icon} title={o.t} subtitle={o.s} selected={list.includes(o.v)} onPress={() => toggle(o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

function NameScreen(p) {
  const { d, set, next } = p;
  const first = firstName(d);
  const pop = useRef(new Animated.Value(first ? 1 : 0)).current;
  const shown = useRef(!!first);
  useEffect(() => {
    if (first && !shown.current) {
      shown.current = true;
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, tension: 120, friction: 9 }).start();
    } else if (!first && shown.current) {
      shown.current = false;
      pop.setValue(0);
    }
  }, [first]);
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.name.trim()} />}>
      <Bubble title="Nice! What should I call you?" sub="Just a first name is fine." />
      <View style={{ marginTop: 44, alignItems: 'center' }}>
        <TextInput
          style={s.nameInput}
          value={d.name}
          onChangeText={(v) => set('name', v)}
          placeholder="Your name"
          placeholderTextColor={C.ink400}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => d.name.trim() && next()}
          accessibilityLabel="Your name"
        />
        <View style={s.nameUnderline} />
      </View>
      <Animated.View style={{ marginTop: 28, alignItems: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
        <Image source={LUMI.wave} style={{ width: 210, height: 210 }} resizeMode="contain" accessibilityLabel="Lumi waving" />
        <View style={s.nameGreet}><Text style={s.nameGreetTxt}>Lovely to meet you{first ? `, ${first}` : ''}!</Text></View>
      </Animated.View>
    </ScreenShell>
  );
}

const TONES = [
  { v: 'cheerleader', t: 'Cheerleader',     s: 'Hype me up, celebrate every win',        img: 'cheer',  sample: (n) => `"Grilled tilapia instead of fried? Chale${n ? ` ${n}` : ''}, I see the vision! We move!"` },
  { v: 'gentle',      t: 'Gentle & kind',   s: 'Soft nudges, no pressure',               img: 'heart',  sample: (n) => `"You had fried yam today${n ? `, ${n}` : ''}, and that's okay. Tomorrow is another pot of soup."` },
  { v: 'auntie',      t: 'Straight Auntie', s: "She loves you, but she won't lie to you", img: 'auntie', sample: (n) => `"Ei${n ? ` ${n}` : ''}, another puff puff again? That's your fifth today o."` },
  { v: 'elder',       t: 'Wise Elder',      s: 'Calm, patient, the long view',           img: 'elder',  sample: (n) => `"The wise bird does not eat every worm it sees. Leave some for tomorrow, my child."` },
];
export const TONE_NAMES = Object.fromEntries(TONES.map((t) => [t.v, t.t]));

export function ToneScreen(p) {
  const { d, set, next } = p;
  const first = firstName(d);
  const picked = TONES.find((t) => t.v === d.tone) || TONES[0];
  // Continue saves what's shown, so an untouched screen still saves the highlighted voice.
  const go = () => { if (d.tone !== picked.v) set('tone', picked.v); next(); };
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={go} />}>
      <Bubble hideLumi={p.editing} title={`How should I talk to you${first ? `, ${first}` : ''}?`} />
      <View style={s.toneGrid}>
        {TONES.map((t) => {
          const on = t.v === picked.v;
          return (
            <TouchableOpacity
              key={t.v}
              style={[s.toneCard, on && s.toneCardOn]}
              onPress={() => { tap(); set('tone', t.v); }}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Image source={LUMI[t.img]} style={{ width: 84, height: 72 }} resizeMode="contain" accessibilityLabel="" />
              <Text style={s.toneTitle}>{t.t}</Text>
              <Text style={s.toneSub}>{t.s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.toneSample}>
        <Text style={s.toneSampleLabel}>{picked.t.toUpperCase()} SOUNDS LIKE</Text>
        <Text style={s.toneSampleTxt}>{picked.sample(first)}</Text>
      </View>
    </ScreenShell>
  );
}

function CountryScreen(p) {
  const { d, pick } = p;
  const FLAGS = {
    Nigeria: '🇳🇬', Ghana: '🇬🇭', Kenya: '🇰🇪', Tanzania: '🇹🇿',
    Uganda: '🇺🇬', Senegal: '🇸🇳', Cameroon: '🇨🇲', Ethiopia: '🇪🇹',
  };
  const list = ['Nigeria', 'Ghana', 'Kenya', 'Tanzania', 'Uganda', 'Senegal', 'Cameroon', 'Ethiopia', 'Other'];
  return (
    <ScreenShell {...p}>
      <Bubble title="Where are you cooking from?" sub="So we match dishes and portions to your kitchen." />
      <View style={[s.opts, { gap: 8 }]}>
        {list.map((c) => (
          <Option
            key={c}
            compact
            lead={c === 'Other'
              ? <Ionicons name="earth-outline" size={22} color={d.country === c ? C.primary : C.ink500} style={{ marginRight: 14, width: 30, textAlign: 'center' }} />
              : <Text style={{ fontSize: 24, marginRight: 14, width: 30, textAlign: 'center' }}>{FLAGS[c]}</Text>}
            title={c === 'Other' ? 'Somewhere else' : c}
            selected={d.country === c}
            onPress={() => pick('country', c)}
          />
        ))}
      </View>
    </ScreenShell>
  );
}

export function GenderScreen(p) {
  const { d, pick, next } = p;
  const opts = [
    { v: 'Female', t: 'Female',                    icon: 'female-outline' },
    { v: 'Male',   t: 'Male',                      icon: 'male-outline' },
    { v: 'Other',  t: 'Other / prefer not to say', icon: 'ellipse-outline' },
  ];
  return (
    <ScreenShell {...p} footer={p.editing ? <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.gender} /> : null}>
      <Bubble hideLumi={p.editing} title="What's your gender?" sub="This sharpens your calorie maths, nothing else." />
      <View style={s.opts}>
        {opts.map((o) => (
          <Option key={o.v} icon={o.icon} title={o.t} selected={d.gender === o.v} onPress={() => pick('gender', o.v)} />
        ))}
      </View>
      {!p.editing ? (
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <Image source={LUMI.stand} style={{ width: 260, height: 270, marginRight: 24 }} resizeMode="contain" accessibilityLabel="" />
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function AgeScreen(p) {
  const { d, set, next } = p;
  return (
    <ScreenShell {...p} fixed footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} />}>
      <Bubble lumi="think" hideLumi={p.editing} title="How old are you?" sub="Logga is for adults 18 and over." />
      <View style={s.wheelArea}>
        <WheelPicker min={18} max={90} value={Math.max(18, d.age || 18)} onChange={(v) => set('age', v)} unit="yrs" />
      </View>
    </ScreenShell>
  );
}

function BodyIntroScreen({ d, next }) {
  const first = firstName(d);
  return (
    <LinearGradient colors={['#EAF5FF', '#F3EFFF']} style={[s.shell, s.breather]}>
      <View style={{ alignSelf: 'stretch', paddingHorizontal: 4 }}>
        <ChapterBars index={2} fill={0} dim />
      </View>
      <Text style={s.breatherCount}>2 of 5 chapters done</Text>
      <View style={s.breatherMid}>
        <View style={{ width: 300, alignItems: 'center' }}>
          <Sparkles />
          <Image source={LUMI.phone} style={{ width: 270, height: 270 }} resizeMode="contain" accessibilityLabel="Lumi" />
        </View>
        <Text style={s.breatherTitle}>Great start{first ? `, ${first}` : ''}!</Text>
        <Text style={s.breatherSub}>Now a few quick ones about your body, so your plan fits you.</Text>
      </View>
      <View style={{ alignSelf: 'stretch' }}>
        <PrimaryBtn label="Let's go" onPress={next} />
      </View>
    </LinearGradient>
  );
}

export function HeightScreen(p) {
  const { d, set, next } = p;
  const inCm = d.unitH === 'cm';
  const totalIn = Math.round(d.heightCm / 2.54);
  return (
    <ScreenShell {...p} fixed footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} />}>
      <Bubble lumi="think" hideLumi={p.editing} title="How tall are you?" />
      <View style={s.wheelArea}>
        <WheelPicker
          min={inCm ? 130 : 48} max={inCm ? 220 : 84}
          value={inCm ? Math.round(d.heightCm) : totalIn}
          unit={inCm ? 'cm' : 'in'}
          onChange={(v) => set('heightCm', inCm ? v : Math.round(v * 2.54))}
        />
        <Text style={[s.wheelCaption, inCm && { opacity: 0 }]}>{Math.floor(totalIn / 12)}′ {totalIn % 12}″ · {Math.round(d.heightCm)} cm</Text>
      </View>
      <View style={s.segRow}>
        <Seg options={[{ value: 'cm', label: 'cm' }, { value: 'ft', label: 'ft/in' }]} value={d.unitH} onChange={(v) => set('unitH', v)} />
      </View>
    </ScreenShell>
  );
}

function WeightScreen(p) {
  const { d, set, next } = p;
  const inKg = d.unitW === 'kg';
  return (
    <ScreenShell {...p} fixed footer={<PrimaryBtn label="Continue" onPress={next} />}>
      <Bubble lumi="think" title="What do you weigh right now?" sub="Be honest. Only you and your plan see this." />
      <View style={s.wheelArea}>
        <WheelPicker
          min={inKg ? 40 : 88} max={inKg ? 170 : 375}
          value={inKg ? Math.round(d.weightKg) : Math.round(d.weightKg * 2.2046)}
          unit={inKg ? 'kg' : 'lb'}
          onChange={(v) => set('weightKg', inKg ? v : Math.round((v / 2.2046) * 10) / 10)}
        />
      </View>
      <View style={s.segRow}>
        <Seg options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lbs' }]} value={d.unitW} onChange={(v) => set('unitW', v)} />
      </View>
    </ScreenShell>
  );
}

export function TargetScreen(p) {
  const { d, set, next } = p;
  const inKg = d.unitW === 'kg';
  const gap = d.weightKg - d.targetKg;
  const gapShown = inKg ? `${Math.round(Math.abs(gap) * 10) / 10} kg` : `${Math.round(Math.abs(gap) * 2.2046)} lb`;
  const losing = gap > 0.5;
  const gaining = gap < -0.5;

  // Healthy-range guard: a goal weight below BMI 18.5 (the standard lower limit) for their height can't be
  // chosen. If they are already under that range, a loss goal isn't offered at all (maintain or gain only).
  const hM = d.heightCm > 0 ? d.heightCm / 100 : null;
  const minHealthyKg = hM ? 18.5 * hM * hM : null;
  const maxHealthyKg = hM ? 24.9 * hM * hM : null;
  const underweightNow = hM ? d.weightKg / (hM * hM) < 18.5 : false;
  const minAllowedKg = minHealthyKg == null ? null : (underweightNow ? d.weightKg : minHealthyKg);
  const blocked = minAllowedKg != null && d.targetKg + 0.05 < minAllowedKg;
  const toUnit = (kg) => (inKg ? kg : kg * 2.2046);
  const minShown = minAllowedKg != null ? Math.ceil(toUnit(minAllowedKg) - 0.001) : null;
  const maxShown = maxHealthyKg != null ? Math.floor(toUnit(maxHealthyKg)) : null;
  const unitWord = inKg ? 'kg' : 'lb';
  const guardMsg = !blocked ? '' : underweightNow
    ? `You're already under the healthy range for your height, so we can't plan a weight loss. Set your goal at ${minShown} ${unitWord} or more.`
    : `For your height, a healthy goal is between ${minShown} and ${maxShown} ${unitWord}. Pick a goal in that range, or talk to a doctor or dietitian about going lower.`;
  return (
    <ScreenShell {...p} fixed footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={blocked} />}>
      <Bubble lumi="target" hideLumi={p.editing} title="What's your goal weight?" sub="Aim for a healthy, reachable number. We'll pace it." />
      <View style={s.wheelArea}>
        <WheelPicker
          min={inKg ? 40 : 88} max={inKg ? 170 : 375}
          value={inKg ? Math.round(d.targetKg) : Math.round(d.targetKg * 2.2046)}
          unit={inKg ? 'kg' : 'lb'}
          unitColor={C.terra}
          onChange={(v) => set('targetKg', inKg ? v : Math.round((v / 2.2046) * 10) / 10)}
        />
      </View>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        {blocked ? (
          <View style={s.guardBox}><Text style={s.guardTxt}>{guardMsg}</Text></View>
        ) : (
          <View style={[s.gapPill, { backgroundColor: losing ? C.terraSoft : gaining ? C.primarySoft : C.sunken }]}>
            <Text style={[s.gapPillTxt, { color: losing ? C.terra : gaining ? C.primary : C.ink500 }]}>
              {losing ? `${gapShown} to lose` : gaining ? `${gapShown} to gain` : 'Maintain your weight'}
            </Text>
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

// The predicted line from today's weight to the goal, with the window it lands in.
// Under the pace options: how many weeks to the goal at the chosen pace, and a bar from today's weight to
// the goal that fills again (quicker for a faster pace) each time the pace changes.
const PACE_RATE = { slow: 0.25, moderate: 0.5, aggressive: 0.75, extreme: 1 };
function PaceSummary({ d }) {
  const rate = PACE_RATE[d.pace];
  const kg = Math.abs((d.weightKg || 0) - (d.targetKg || 0));
  const line = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rate) return;
    line.setValue(0); fill.setValue(0);
    Animated.timing(line, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(fill, { toValue: 1, duration: (0.8 + 0.25 / rate) * 1000, delay: 250, easing: Easing.bezier(0.3, 0.7, 0.2, 1), useNativeDriver: false }).start();
  }, [d.pace]);
  if (!rate || !kg || !d.targetKg) return null;
  const weeks = Math.max(1, Math.round(kg / rate));
  return (
    <View style={s.paceSum}>
      <Animated.Text style={[s.paceSumLine, { opacity: line, transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
        You'll reach <Text style={{ color: C.primary }}>{weightText(d.targetKg, d.unitW)}</Text> in about {weeks} {weeks === 1 ? 'week' : 'weeks'}
      </Animated.Text>
      <View style={s.paceTrack}>
        <Animated.View style={[s.paceFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
          <View style={s.paceDot} />
        </Animated.View>
      </View>
      <View style={s.paceEnds}>
        <Text style={s.paceEndTxt}>{weightText(d.weightKg, d.unitW)} today</Text>
        <Text style={s.paceEndTxt}>{weightText(d.targetKg, d.unitW)} goal</Text>
      </View>
    </View>
  );
}

export function PaceScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'slow',       t: 'Slow & steady', s: '~0.25 kg a week · easiest to stick with' },
    { v: 'moderate',   t: 'Balanced',      s: '~0.5 kg a week', badge: 'Recommended' },
    { v: 'aggressive', t: 'All-in',        s: '~0.75 kg a week · needs discipline' },
    { v: 'extreme',    t: 'All-out',       s: '~1.0 kg a week · needs strict discipline' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.pace} />}>
      <Bubble hideLumi={p.editing} title="How fast do you want to get there?" />
      <View style={[s.opts, { gap: 8, marginTop: 18 }]}>
        {opts.map((o) => (
          <Option
            key={o.v}
            compact
            title={o.badge ? <>{o.t}  <Text style={s.recBadge}> {o.badge} </Text></> : o.t}
            subtitle={o.s}
            selected={d.pace === o.v}
            onPress={() => { tap(); set('pace', o.v); }}
          />
        ))}
      </View>
      <PaceSummary d={d} />
    </ScreenShell>
  );
}

export function ActivityScreen(p) {
  const { d, pick, next } = p;
  const opts = [
    { v: 'sedentary', t: 'Mostly sitting',   s: 'Desk job, drive everywhere',                icon: 'laptop-outline' },
    { v: 'light',     t: 'Lightly active',   s: 'Some walking, to the market or office',     icon: 'walk-outline' },
    { v: 'moderate',  t: 'On my feet a lot', s: 'Trading, errands, carrying loads',          icon: 'bicycle-outline' },
    { v: 'active',    t: 'Very active',      s: 'Hard physical work or training 5-6x a week', icon: 'barbell-outline' },
  ];
  return (
    <ScreenShell {...p} footer={p.editing ? <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.activity} /> : null}>
      <Bubble hideLumi={p.editing} title="How active is a normal day?" sub="A normal day, not your best one." />
      <View style={s.opts}>
        {opts.map((o) => (
          <Option key={o.v} icon={o.icon} title={o.t} subtitle={o.s} selected={d.activity === o.v} onPress={() => pick('activity', o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

export function EatingScreen(p) {
  const { d, pick, next } = p;
  const opts = [
    { v: 'omad', t: 'One meal a day', icon: 'restaurant-outline' },
    { v: '2x',   t: 'Twice a day',    s: 'Two solid meals',          icon: 'copy-outline' },
    { v: '3x',   t: 'Three meals',    s: 'Breakfast, lunch, dinner', icon: 'partly-sunny-outline' },
    { v: '4x',   t: 'Small & often',  s: 'Four-ish small meals',     icon: 'apps-outline' },
    { v: 'flex', t: 'Flexible',       s: 'It changes day to day',    icon: 'swap-vertical-outline' },
  ];
  return (
    <ScreenShell {...p} footer={p.editing ? <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.eatingStyle} /> : null}>
      <Bubble hideLumi={p.editing} title="How do you like to eat?" sub="We'll time your reminders around it." />
      <View style={[s.opts, { gap: 8 }]}>
        {opts.map((o) => (
          <Option key={o.v} compact icon={o.icon} title={o.t} subtitle={o.s} selected={d.eatingStyle === o.v} onPress={() => pick('eatingStyle', o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

// Where food comes from keeps Continue: the optional cuisines sit underneath and would be skipped by
// moving on at the first tap.
export function FoodScreen(p) {
  const { d, set, next } = p;
  const where = [
    { v: 'home', t: 'Mostly home-cooked',          icon: 'home-outline' },
    { v: 'out',  t: 'Mostly bought or eating out', icon: 'restaurant-outline' },
    { v: 'mix',  t: 'A mix of both',               icon: 'swap-horizontal-outline' },
  ];
  const cuisines = ['Nigerian', 'Ghanaian', 'Kenyan', 'Swahili', 'Ethiopian', 'Senegalese', 'Continental', 'Fast food'];
  const toggleC = (c) => {
    tap();
    const has = d.cuisines.includes(c);
    set('cuisines', has ? d.cuisines.filter((x) => x !== c) : [...d.cuisines, c]);
  };
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.foodContext} />}>
      <Bubble lumi="food" hideLumi={p.editing} title="Where does your food come from?" />
      <View style={[s.opts, { gap: 8 }]}>
        {where.map((o) => (
          <Option key={o.v} compact icon={o.icon} title={o.t} selected={d.foodContext === o.v} onPress={() => { tap(); set('foodContext', o.v); }} />
        ))}
      </View>
      <Text style={s.sectionLabel}>CUISINES YOU EAT MOST · OPTIONAL</Text>
      <View style={s.chipsWrap}>
        {cuisines.map((c) => <Chip key={c} label={c} selected={d.cuisines.includes(c)} onPress={() => toggleC(c)} />)}
      </View>
    </ScreenShell>
  );
}

export function WhyScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'wedding',   t: 'A big event',             s: 'Wedding, shoot, reunion',    icon: 'calendar-outline' },
    { v: 'health',    t: 'A health wake-up call',   s: 'I want to get ahead of it',  icon: 'heart-outline' },
    { v: 'confident', t: 'To feel confident again', s: 'In my clothes, in my skin',  icon: 'sparkles-outline' },
    { v: 'doctor',    t: "Doctor's advice",         s: 'Following medical guidance', icon: 'medkit-outline' },
    { v: 'curious',   t: 'Just curious',            s: 'Seeing what I can do',       icon: 'search-outline' },
  ];
  const list = d.whys || [];
  const toggle = (v) => { tap(); set('whys', list.includes(v) ? list.filter((x) => x !== v) : [...list, v]); };
  return (
    <ScreenShell {...p} footer={
      <>
        <PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={list.length === 0} />
        {!p.editing && <TextBtn label="Skip" onPress={next} />}
      </>
    }>
      <Bubble lumi="heart" hideLumi={p.editing} title="What's your deeper why?" sub="On tough days, I'll remind you." />
      <View style={[s.opts, { gap: 8 }]}>
        {opts.map((o) => (
          <Option key={o.v} compact multi icon={o.icon} title={o.t} subtitle={o.s} selected={list.includes(o.v)} onPress={() => toggle(o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

// "How should I nudge you": how often reminders come (the voice they come in is the tone). Saved as
// accountability; lib/smartNotifications.js plans the reminders from it.
export const NUDGE_OPTS = [
  { v: 'gentle', t: 'Gentle nudges',  s: 'One reminder a day, at your main meal',          icon: 'heart-outline' },
  { v: 'firm',   t: 'Firm reminders', s: "A nudge for every meal you haven't logged",      icon: 'megaphone-outline' },
  { v: 'auto',   t: 'Decide for me',  s: 'I learn when you usually eat and time them',     icon: 'sparkles-outline' },
  { v: 'alone',  t: 'Leave me alone', s: "No reminders. I'll come to the app myself",      icon: 'moon-outline' },
];

// Used by Your Details (Settings) to edit how Lumi nudges.
export function AccountabilityScreen(p) {
  const { d, pick, next } = p;
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label={p.ctaLabel || 'Continue'} onPress={next} disabled={!d.accountability} />}>
      <Bubble hideLumi={p.editing} title="How should I nudge you?" sub="Reminders skip any meal you've already logged." />
      <View style={s.opts}>
        {NUDGE_OPTS.map((o) => (
          <Option key={o.v} icon={o.icon} title={o.t} subtitle={o.s} selected={d.accountability === o.v} onPress={() => pick('accountability', o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

function CareScreen(p) {
  const { d, next } = p;
  const first = firstName(d);
  const [sources, setSources] = useState(false);
  return (
    <LinearGradient colors={['#FFF1F2', C.bg]} locations={[0, 0.45]} style={s.shell}>
      <TopBar chapter={p.chapter} onBack={p.onBack} showBack={p.showBack} noLabel />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Image source={LUMI.heart} style={{ width: 170, height: 153, marginTop: 30 }} resizeMode="contain" accessibilityLabel="Lumi holding a heart" />
        <Text style={s.careTitle}>One honest thing{first ? `, ${first}` : ''}</Text>
        <Text style={s.careBody}>I'm here to help you see what you eat and how you're doing. I'm not a doctor, and Logga doesn't replace one.</Text>
        <View style={s.careCard}>
          <Ionicons name="medkit-outline" size={22} color={C.primary} style={{ marginTop: 1 }} />
          <Text style={s.careCardTxt}>Expecting a baby, living with a condition, or on medication? Have a chat with your doctor or dietitian before big changes to how you eat.</Text>
        </View>
        <TouchableOpacity onPress={() => setSources(true)} style={{ marginTop: 14, paddingVertical: 6 }} accessibilityRole="link">
          <Text style={s.careLink}>Where our guidance comes from</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={[s.footer, { backgroundColor: 'transparent' }]}>
        <PrimaryBtn label="Got it" onPress={next} />
      </View>
      <HealthSourcesPage visible={sources} onClose={() => setSources(false)} />
    </LinearGradient>
  );
}

function RemindersScreen(p) {
  const { d, set, next } = p;
  const [busy, setBusy] = useState(false);
  // One choice (how often); the sample below is a real reminder in the voice they picked.
  const mode = d.accountability || 'gentle';
  const choose = (v) => { tap(); set('accountability', v); set('reminders', [v]); };
  const sample = mealReminderCopy(d.tone, mode === 'gentle' ? 'dinner' : 'lunch', d.name);
  const setUp = async () => {
    if (busy) return;
    setBusy(true);
    if (!d.accountability) set('accountability', mode);
    let granted = false;
    if (Platform.OS !== 'web' && mode !== 'alone') {
      try { granted = await requestNotificationPermissions(); } catch (_) {}
    }
    set('remindersOn', granted);
    track('onboarding_reminders', { choice: mode, granted });
    setBusy(false);
    next();
  };
  const later = () => { set('remindersOn', false); next(); };
  return (
    <ScreenShell {...p} footer={
      <>
        <PrimaryBtn label={mode === 'alone' ? 'Continue' : 'Set up reminders'} onPress={setUp} busy={busy} />
        <TextBtn label="Set up later" onPress={later} />
        <Text style={s.remindersNote}>Saved to Settings, so you can change them any time.</Text>
      </>
    }>
      <View style={s.remindersHead}>
        <Image source={LUMI.auntie} style={{ width: 84, height: 90 }} resizeMode="contain" accessibilityLabel="" />
        <Text style={s.remindersTitle}>How should I nudge you?</Text>
      </View>
      <Text style={s.remindersSub}>A friendly nudge makes logging easy. They skip any meal you've already logged.</Text>
      {mode !== 'alone' && (
        <View style={s.notifCard}>
          <Image source={require('../../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 9 }} accessibilityLabel="" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.notifTitle}>{sample.title}</Text>
            <Text style={s.notifBody}>{sample.body}</Text>
          </View>
        </View>
      )}
      <View style={[s.opts, { gap: 8, marginTop: 16 }]}>
        {NUDGE_OPTS.map((o) => (
          <Option key={o.v} compact icon={o.icon} title={o.t} subtitle={o.s} selected={mode === o.v} onPress={() => choose(o.v)} />
        ))}
      </View>
    </ScreenShell>
  );
}

function HealthScreen(p) {
  const { set, next } = p;
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await connectAppleHealth().catch(() => false);
    set('healthConnect', !!ok);
    track('onboarding_apple_health', { connected: !!ok });
    setBusy(false);
    next();
  };
  return (
    <LinearGradient colors={['#EAF5FF', C.bg]} locations={[0, 0.6]} style={s.shell}>
      <TopBar chapter={p.chapter} onBack={p.onBack} showBack={p.showBack} noLabel />
      <View style={[s.breatherMid, { paddingHorizontal: 24 }]}>
        <View style={{ width: 300, alignItems: 'center' }}>
          <Sparkles />
          <Image source={LUMI.idea} style={{ width: 280, height: 270 }} resizeMode="contain" accessibilityLabel="Lumi with an idea" />
          <View style={s.healthTile}><Ionicons name="heart" size={32} color="#FF2D55" /></View>
        </View>
        <Text style={s.healthTitle}>Connect Apple Health</Text>
        <Text style={s.healthSub}>Your daily steps fill in by themselves, so your plan sees how active you really are.</Text>
        <View style={s.healthNote}>
          <Ionicons name="lock-closed-outline" size={14} color={C.ink600} />
          <Text style={s.healthNoteTxt}>Logga only reads steps and never uses them for ads</Text>
        </View>
      </View>
      <View style={[s.footer, { backgroundColor: 'transparent' }]}>
        <PrimaryBtn label="Connect Apple Health" onPress={connect} busy={busy} />
        <TextBtn label="I'll add my steps myself" onPress={() => { set('healthConnect', false); next(); }} />
      </View>
    </LinearGradient>
  );
}

const BUILD_STEPS = [
  'Working out your daily calories',
  'Matching dishes to your kitchen',
  'Setting your protein and water aims',
  'Getting your forecast ready',
];
const QUICK = {
  water: {
    lumi: 'water', at: [0, 100],
    title: 'How much water do you drink a day?',
    sub: 'Counted in sachets, so your water goal makes sense.',
    opts: [['none', 'Barely any'], ['1-2', '1 to 2 sachets'], ['3-4', '3 to 4 sachets'], ['5+', '5 sachets or more']],
    field: 'waterHabit',
  },
  meals: {
    lumi: 'think', at: [2, 100],
    title: 'How many meals do you usually eat a day?',
    sub: 'So your reminders land at the right times.',
    opts: [['1-2', '1 or 2 meals'], ['3', '3 meals'], ['3+snacks', '3 meals and snacks'], ['varies', 'It changes every day']],
    field: 'mealsPerDay',
  },
};

function QuickQuestion({ q, onAnswer }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [chosen, setChosen] = useState(null);
  useEffect(() => {
    Animated.spring(fade, { toValue: 1, useNativeDriver: true, tension: 110, friction: 12 }).start();
  }, []);
  const answer = (v) => {
    if (chosen) return;
    tap();
    setChosen(v);
    setTimeout(() => onAnswer(v), 300);
  };
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(22,32,27,0.38)', opacity: fade }]} />
      <View style={s.qqWrap}>
        <Animated.View style={[s.qqSheet, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={LUMI[q.lumi]} style={{ width: 70, height: 74, marginRight: 12 }} resizeMode="contain" accessibilityLabel="Lumi" />
            <View style={{ flex: 1 }}>
              <Text style={s.qqEyebrow}>QUICK QUESTION</Text>
              <Text style={s.qqTitle}>{q.title}</Text>
            </View>
          </View>
          <Text style={s.qqSub}>{q.sub}</Text>
          <View style={{ gap: 9, marginTop: 16 }}>
            {q.opts.map(([v, label]) => (
              <TouchableOpacity key={v} style={[s.qqOpt, chosen === v && s.optSel]} onPress={() => answer(v)} activeOpacity={0.8} accessibilityRole="button">
                <Text style={s.qqOptTxt}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.qqSkip} onPress={() => answer('skip')} accessibilityRole="button">
            <Text style={s.textBtnTxt}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// Four steps, each with its own bar. Two quick questions pop up on the way: water once step 1 is full,
// meals once step 3 is full. Then it moves on to the plan by itself.
function BuildingScreen({ d, set, next }) {
  const first = firstName(d);
  const [prog, setProg] = useState([0, 0, 0, 0]);
  const [ask, setAsk] = useState(null);
  const asked = useRef({});
  const paused = useRef(false);
  const done = useRef(false);

  const elapsed = useRef([0, 0, 0, 0]); // ms each bar has run (the bars are worked out from this)

  useEffect(() => {
    // How long each bar takes (about 12 s in all). Each starts quick and slows as it nears 100%, like real work.
    const STEP_MS = [2500, 3500, 3000, 3000];
    const DT = 40;
    const ease = (x) => 1 - Math.pow(1 - x, 2.5);
    const iv = setInterval(() => {
      if (paused.current || done.current) return;
      const el = elapsed.current;
      const i = el.findIndex((t, k) => t < STEP_MS[k]);
      if (i < 0) return;
      el[i] = Math.min(STEP_MS[i], el[i] + DT);
      const frac = el[i] / STEP_MS[i];
      let val = frac >= 1 ? 100 : ease(frac) * 100;
      for (const key of Object.keys(QUICK)) {
        const [si, pct] = QUICK[key].at;
        if (si === i && !asked.current[key] && val >= pct) {
          asked.current[key] = true;
          paused.current = true;
          val = pct;
          setAsk(key);
        }
      }
      setProg(el.map((t, k) => (k === i ? val : t >= STEP_MS[k] ? 100 : 0)));
      if (i === 3 && frac >= 1) {
        done.current = true;
        setTimeout(next, 500);
      }
    }, DT);
    return () => clearInterval(iv);
  }, []);

  const onAnswer = (v) => {
    if (v !== 'skip') set(QUICK[ask].field, v);
    setAsk(null);
    paused.current = false;
  };

  return (
    <View style={[s.shell, { backgroundColor: C.plan }]}>
      <View style={s.buildWrap}>
        <Image source={LUMI.building} style={{ width: 172, height: 130 }} resizeMode="contain" accessibilityLabel="Lumi" />
        <Text style={s.buildingTitle}>{first ? `Putting your plan together, ${first}` : 'Putting your plan together'}</Text>
        <View style={s.buildCard}>
          {BUILD_STEPS.map((label, i) => {
            const v = prog[i];
            const finished = v >= 100;
            const active = !finished && (i === 0 || prog[i - 1] >= 100);
            return (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={finished ? 'checkmark-circle' : active ? 'ellipse-outline' : 'ellipse-outline'}
                  size={20}
                  color={finished ? C.primary : active ? C.terra : C.line}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[s.buildStep, !finished && !active && { color: C.ink400 }]}>{label}</Text>
                    <Text style={[s.buildPct, finished && { color: C.primary }]}>{finished ? 'Done' : active ? `${Math.round(v)}%` : ''}</Text>
                  </View>
                  <View style={s.buildTrack}>
                    <View style={[s.buildFill, { width: `${v}%`, backgroundColor: finished ? C.primary : C.terra }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      {ask ? <QuickQuestion key={ask} q={QUICK[ask]} onAnswer={onAnswer} /> : null}
    </View>
  );
}

function DoneScreen({ d, onNext, onStartOver }) {
  const plan = calcPlan(d);
  const first = firstName(d) || 'friend';
  return (
    <View style={[s.shell, { backgroundColor: C.plan }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 26, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../../assets/logga-wordmark.png')} style={{ width: 84, height: 32, marginBottom: 22 }} resizeMode="contain" />
        <Text style={s.planKicker}>YOUR STARTING PLAN</Text>
        <Text style={s.planHeadline}>Here's where we'd start you, {first}.</Text>
        <View style={s.planNumberWrap}>
          <Text style={s.planNumber}>{plan.target.toLocaleString()}</Text>
          <Text style={s.planNumberUnit}>calories a day</Text>
        </View>
        <Text style={s.planNote}>Logga is a tracking tool, not medical advice. Talk to a qualified professional before changing your diet or exercise.</Text>
      </ScrollView>
      <View style={[s.footer, { backgroundColor: C.plan }]}>
        <PrimaryBtn label="Create my account" onPress={onNext} />
        <TextBtn label="Start over" onPress={onStartOver} />
      </View>
    </View>
  );
}

const fmtMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch (_) { return null; }
};

// Just before the plan is built: press and hold the ring to commit (about 1.6 s; it drains if let go early).
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 70;
const RING_LEN = 2 * Math.PI * RING_R;
function CommitScreen({ d, next, onBack }) {
  const first = firstName(d);
  const progress = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const run = useRef(null);
  const hold = () => {
    if (done) return;
    setHolding(true);
    tap();
    Animated.spring(press, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
    run.current?.stop();
    const left = 1 - progress.__getValue();
    run.current = Animated.timing(progress, { toValue: 1, duration: Math.max(1, 1600 * left), easing: Easing.linear, useNativeDriver: false });
    run.current.start(({ finished }) => {
      if (!finished) return;
      setDone(true); setHolding(false);
      Animated.spring(press, { toValue: 1, useNativeDriver: true }).start();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  };
  const release = () => {
    if (done || !holding) return;
    setHolding(false);
    Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
    run.current?.stop();
    const v = progress.__getValue();
    run.current = Animated.timing(progress, { toValue: 0, duration: 400 * v, easing: Easing.out(Easing.quad), useNativeDriver: false });
    run.current.start();
  };
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [RING_LEN, 0] });
  return (
    <LinearGradient colors={['#EAF5FF', C.bg]} locations={[0, 0.6]} style={s.shell}>
      <View style={s.topWrap}>
        <View style={s.topRow}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3, 4].map((i) => <View key={i} style={s.commitBar} />)}
          </View>
        </View>
      </View>
      <View style={s.commitBody}>
        <Text style={s.commitH1}>You're about to meet the best version of yourself.</Text>
        <Text style={s.commitSub}>Make a commitment, and let's build your plan.</Text>
        <View style={s.commitMid}>
          <Text style={s.commitPledge}>{first ? `I, ${first}, commit` : 'I commit'} to showing up for myself, one meal at a time.</Text>
          <View
            style={s.commitRing}
            onStartShouldSetResponder={() => true}
            onResponderGrant={hold}
            onResponderRelease={release}
            onResponderTerminate={release}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Press and hold to commit"
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => { progress.setValue(1); setDone(true); }}
          >
            <Svg width={148} height={148} viewBox="0 0 148 148" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={74} cy={74} r={RING_R} fill="none" stroke="#E3E7E2" strokeWidth={5} />
              <AnimatedCircle cx={74} cy={74} r={RING_R} fill="none" stroke={C.primary} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${RING_LEN}`} strokeDashoffset={dashOffset} />
            </Svg>
            <Animated.View style={[s.commitCore, { backgroundColor: done ? C.primary : C.ink, transform: [{ scale: press }] }]}>
              <Ionicons name={done ? 'checkmark' : 'finger-print'} size={done ? 46 : 48} color="#fff" />
            </Animated.View>
          </View>
          <Text style={[s.commitLabel, done && { color: C.primary }]}>{done ? "Committed. Let's do this." : holding ? 'Keep holding…' : 'Press and hold to commit'}</Text>
        </View>
      </View>
      <View style={s.footer}>
        <PrimaryBtn label="Build my plan" onPress={next} disabled={!done} />
      </View>
    </LinearGradient>
  );
}

// After closing Pro, when the first-month offer is still on: Lumi has something for them, then the offer.
function WaitScreen({ d, onShow }) {
  const first = firstName(d);
  const gift = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const rise = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    Animated.spring(gift, { toValue: 1, useNativeDriver: true, tension: 70, friction: 6 }).start();
    rise.forEach((v, i) => Animated.timing(v, { toValue: 1, duration: 500, delay: 250 + i * 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start());
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const t = setTimeout(() => loop.start(), 700);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);
  const up = (v) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] });
  return (
    <LinearGradient colors={['#E8F8EF', '#F6FCF8', '#FFFFFF']} locations={[0, 0.45, 0.8]} style={s.shell}>
      <View style={s.waitMid}>
        <Animated.View style={{ opacity: gift, transform: [
          { scale: gift.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          { rotate: gift.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '0deg'] }) },
          { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        ] }}>
          <Image source={LUMI.gift} style={{ width: 220, height: 210 }} resizeMode="contain" accessibilityLabel="Lumi holding a gift" />
        </Animated.View>
        <Animated.Text style={[s.waitH1, up(rise[0])]}>{first ? `Wait, ${first}!` : 'Wait!'}</Animated.Text>
        <Animated.Text style={[s.waitSub, up(rise[1])]}>I have something here for you.</Animated.Text>
      </View>
      <Animated.View style={[s.footer, { backgroundColor: 'transparent' }, up(rise[2])]}>
        <PrimaryBtn label="Show me" onPress={onShow} />
      </Animated.View>
    </LinearGradient>
  );
}

// What Logga Pro gives, as listed on the Pro screen.
const PRO_FEATURES = [
  ['restaurant-outline', 'Unlimited meal logging'],
  ['pie-chart-outline', 'Extensive macro breakdowns for every meal'],
  ['sparkles-outline', 'Unlimited AI insights on your progress'],
  ['trending-up-outline', 'Accurate weight predictions to help you plan'],
  ['calendar-outline', 'Predicted burnout days to keep you on track'],
  ['book-outline', 'Unlocked, unlimited recipes'],
  ['basket-outline', 'Build recipes from scratch with what’s already in your kitchen'],
  ['options-outline', 'Tailor your calorie targets per day'],
];

function ProScreen({ d, plans, onRetry, onClose, onPurchased }) {
  const [choice, setChoice] = useState('yearly');
  const [busy, setBusy] = useState(false);
  useEffect(() => { track(EVENTS.PAYWALL_VIEWED, { reason: 'onboarding' }); }, []);
  const yearly = plans?.yearly;
  const monthly = plans?.monthly;
  const selected = choice === 'yearly' ? yearly : monthly;
  const trial = choice === 'yearly' ? !!plans?.trialYearly : !!plans?.trialMonthly;
  const yp = yearly?.product;
  const mp = monthly?.product;
  const yearlyPerMonth = yp ? fmtMoney(Math.floor((yp.price / 12) * 100) / 100, yp.currencyCode) : null;
  const saving = yp && mp && mp.price * 12 > yp.price ? Math.round((1 - yp.price / (mp.price * 12)) * 100) : 0;
  const win = predictedWindow(d);

  const cta = trial ? 'Start my free week' : 'Continue';
  const legal = 'Payment is charged to your Apple ID. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period'
    + (trial ? ' or free trial' : '') + '. Manage or cancel any time in your Apple ID settings.';

  const buy = async () => {
    if (!selected || busy) return;
    setBusy(true);
    track(EVENTS.PURCHASE_STARTED, { plan: choice, trial, reason: 'onboarding' });
    try {
      const result = await purchasePlan(selected);
      if (result === 'purchased') { track(EVENTS.SUBSCRIBED, { plan: choice, trial, reason: 'onboarding' }); onPurchased(); }
      else track(EVENTS.PURCHASE_CANCELLED, { plan: choice });
    } catch (e) {
      track(EVENTS.PURCHASE_FAILED, { plan: choice, message: String(e?.message || '').slice(0, 120) });
      showAlert("Couldn't complete the purchase", 'Nothing was charged. Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const found = await restorePurchases();
      track(EVENTS.PURCHASES_RESTORED, { found });
      if (found) { showAlert('Welcome back', 'Your Logga Pro subscription is active again.'); onPurchased(); }
      else showAlert('No subscription found', "We couldn't find a Logga Pro subscription on this Apple ID.");
    } catch (_) {
      showAlert("Couldn't restore", 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const PlanCard = ({ id, children }) => {
    const on = choice === id;
    return (
      <TouchableOpacity style={[s.planCard, on && s.planCardOn]} onPress={() => { tap(); setChoice(id); }} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ checked: on }}>
        {children}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.shell, { backgroundColor: '#fff' }]}>
      <View style={s.proTop}>
        <TouchableOpacity onPress={restore} accessibilityRole="button" style={{ paddingVertical: 8 }}>
          <Text style={s.proRestore}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={s.proClose}>
          <Ionicons name="close" size={18} color={C.ink500} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.proBody} showsVerticalScrollIndicator={false}>
        <View style={s.proHeadRow}>
          <Text style={s.proHeadline}>
            {win ? `Reach ${weightText(d.targetKg, d.unitW)} by\n${win.end}.` : 'Reach your goal with\nLogga Pro.'}
          </Text>
          <Image source={require('../../assets/logga-wordmark.png')} style={{ width: 84, height: 32 }} resizeMode="contain" accessibilityLabel="Logga" />
        </View>
        <View style={s.proFeatures}>
          {PRO_FEATURES.map(([icon, label]) => (
            <View key={label} style={s.proFeature}>
              <View style={s.proFeatureIcon}><Ionicons name={icon} size={19} color={C.ink} /></View>
              <Text style={s.proFeatureTxt}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, minHeight: 24 }} />
        {plans === undefined ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 28 }} />
        ) : !plans ? (
          <TouchableOpacity style={s.proRetry} onPress={onRetry} accessibilityRole="button">
            <Text style={s.proRetryTxt}>Prices couldn't load. Tap to try again.</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.planRow}>
            <PlanCard id="yearly">
              {saving > 0 ? <View style={s.bestBadge}><Text style={s.bestBadgeTxt}>Save {saving}%</Text></View> : null}
              <Text style={s.planLen}>12 months</Text>
              <Text style={s.planPrice}>{yp?.priceString || ''}</Text>
              {yearlyPerMonth ? <Text style={s.planPer}>{yearlyPerMonth}/mo</Text> : null}
              <Text style={[s.trialChip, !plans?.trialYearly && { color: 'transparent' }]}>7 days free</Text>
            </PlanCard>
            <PlanCard id="monthly">
              <Text style={s.planLen}>1 month</Text>
              <Text style={s.planPrice}>{mp?.priceString || ''}</Text>
              <Text style={s.planPer}>billed monthly</Text>
              <Text style={[s.trialChip, !plans?.trialMonthly && { color: 'transparent' }]}>7 days free</Text>
            </PlanCard>
          </View>
        )}
      </ScrollView>
      <View style={[s.footer, { backgroundColor: '#fff', paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 22 : 16 }]}>
        <PrimaryBtn label={cta} onPress={buy} busy={busy} />
        <Text style={s.proLegal}>{legal}</Text>
        <View style={s.legalLinks}>
          <Text style={s.legalLink} onPress={() => openUrl('https://www.logga.space/terms')}>Terms of Use</Text>
          <Text style={s.legalLink} onPress={() => openUrl('https://www.logga.space/privacy')}>Privacy Policy</Text>
        </View>
      </View>
    </View>
  );
}

// The one-time first-month offer, shown once after closing the Pro screen. The countdown is real: the
// deadline is saved, and once it passes or the offer is skipped it doesn't come back.
export function OfferScreen({ d, offer, deadline, onDone, reason = 'onboarding_offer' }) {
  const first = firstName(d);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheet = useRef(new Animated.Value(0)).current;
  useEffect(() => { track(EVENTS.PAYWALL_VIEWED, { reason }); }, []);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    Animated.spring(sheet, { toValue: confirming ? 1 : 0, useNativeDriver: true, tension: 90, friction: 13 }).start();
  }, [confirming]);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  useEffect(() => { if (left === 0) onDone(false); }, [left === 0]);
  const pad = (n) => String(n).padStart(2, '0');
  const intro = offer.pkg.product.introPrice;
  const pct = offer.pkg.product.price > 0 ? Math.round((1 - intro.price / offer.pkg.product.price) * 100) : 0;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    track(EVENTS.PURCHASE_STARTED, { plan: 'monthly_offer', reason });
    try {
      const result = await purchasePlan(offer.pkg);
      if (result === 'purchased') { track(EVENTS.SUBSCRIBED, { plan: 'monthly_offer', reason }); onDone(true); }
      else track(EVENTS.PURCHASE_CANCELLED, { plan: 'monthly_offer' });
    } catch (e) {
      track(EVENTS.PURCHASE_FAILED, { plan: 'monthly_offer', message: String(e?.message || '').slice(0, 120) });
      showAlert("Couldn't complete the purchase", 'Nothing was charged. Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.shell, { backgroundColor: C.bg }]}>
      <TouchableOpacity onPress={() => setConfirming(true)} style={s.offerClose} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={22} color={C.ink500} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 100 : 80, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Text style={s.offerEyebrow}>A GIFT FOR YOU{first ? `, ${first.toUpperCase()}` : ''}</Text>
        <Text style={s.offerTitle}>Your first month of Pro for <Text style={{ color: C.primary }}>{offer.introPrice}</Text></Text>
        <View style={{ width: 300, alignItems: 'center', marginTop: 10 }}>
          <Sparkles />
          <Image source={LUMI.gift} style={{ width: 220, height: 210 }} resizeMode="contain" accessibilityLabel="Lumi with a gift" />
        </View>
        <View style={s.offerCard}>
          <Text style={s.offerEnds}>OFFER ENDS IN</Text>
          <View style={s.countRow}>
            {[String(Math.floor(left / 3600)), pad(Math.floor(left / 60) % 60), pad(left % 60)].map((v, k) => (
              <React.Fragment key={k}>
                {k ? <Text style={s.countColon}>:</Text> : null}
                <View style={s.countBox}><Text style={s.countTxt}>{v}</Text></View>
              </React.Fragment>
            ))}
          </View>
          <View style={s.offerPriceRow}>
            <Text style={s.offerStrike}>{offer.price}</Text>
            <Text style={s.offerPrice}>{offer.introPrice}</Text>
            <Text style={s.offerPer}>first month</Text>
          </View>
        </View>
        <Text style={s.offerTerms}>First month {offer.introPrice}, then {offer.price} each month.{'\n'}Cancel anytime.</Text>
      </ScrollView>
      <View style={s.footer}>
        <PrimaryBtn label="Claim my offer" onPress={claim} busy={busy} />
        <Text style={s.proLegal}>Payment is charged to your Apple ID. The subscription renews automatically at {offer.price} a month unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your Apple ID settings.</Text>
        <View style={s.legalLinks}>
          <Text style={s.legalLink} onPress={() => openUrl('https://www.logga.space/terms')}>Terms of Use</Text>
          <Text style={s.legalLink} onPress={() => openUrl('https://www.logga.space/privacy')}>Privacy Policy</Text>
        </View>
      </View>

      {confirming ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(22,32,27,0.38)', opacity: sheet }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setConfirming(false)} accessibilityLabel="Back to my offer" />
          </Animated.View>
          <Animated.View style={[s.skipSheet, { transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] }]}>
            <View style={s.sheetHandle} />
            <Image source={LUMI.shocked} style={{ width: 150, height: 170, alignSelf: 'center' }} resizeMode="contain" accessibilityLabel="Shocked Lumi" />
            <Text style={s.skipTitle}>Are you sure you want to skip {pct > 0 ? `${pct}% off` : 'this offer'}?</Text>
            <Text style={s.skipBody}>Your first month of Pro for {offer.introPrice} instead of {offer.price}. Once you skip, this offer won't come back.</Text>
            <PrimaryBtn label="Back to my offer" onPress={() => setConfirming(false)} />
            <TextBtn label="Skip this offer forever" onPress={() => onDone(false)} />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

// kcal: the calories shown on the sample widget (the new plan's target, or an existing account's goal).
export function WidgetScreen({ d, kcal, onShow, onLater }) {
  const target = kcal || calcPlan(d).target;
  return (
    <View style={[s.shell, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 70 : 50 }]}>
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={s.widgetTitle}>Put Logga on your home screen</Text>
        <Text style={s.widgetSub}>See calories left and add water without opening the app.</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#9BD3B8', '#5FA7C9']} style={s.phone}>
          <Text style={s.phoneTime}>9:41</Text>
          <View style={s.widget}>
            <View style={s.widgetRing}>
              <Text style={s.widgetKcal}>{target.toLocaleString()}</Text>
              <Text style={s.widgetKcalLbl}>kcal left</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 5 }} />
                <Text style={s.widgetApp}>Logga</Text>
              </View>
              <Text style={s.widgetLine}>Nothing logged yet</Text>
              <View style={s.widgetWater}><Text style={s.widgetWaterTxt}>+ Water</Text></View>
            </View>
          </View>
          <View style={s.appGrid}>
            {Array.from({ length: 8 }, (_, k) => (
              <View key={k} style={{ alignItems: 'center', width: '25%', marginBottom: 14 }}>
                <View style={s.appIcon} />
                <View style={s.appLabel} />
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>
      <Text style={s.widgetHint}>Press and hold your home screen, tap +, then search "Logga".</Text>
      <View style={s.footer}>
        <PrimaryBtn label="Show me how" onPress={onShow} />
        <TextBtn label="Maybe later" onPress={onLater} />
      </View>
    </View>
  );
}

export function WidgetStepsScreen({ onBack, onDone }) {
  const steps = [
    ['Touch and hold an empty spot on your home screen', 'Keep holding until the apps start to jiggle.'],
    ['Tap Edit in the top-left corner', 'Then choose Add Widget.'],
    ['Search for Logga', 'It shows up as soon as you type the first letters.'],
    ['Pick a size and tap Add Widget', 'The small one shows calories left; the medium one adds water too.'],
    ['Drag it where you like, then tap Done', "That's it. Your day is now one glance away."],
  ];
  return (
    <View style={s.shell}>
      <TopBar onBack={onBack} showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Image source={LUMI.phone} style={{ width: 96, height: 96, marginRight: 12 }} resizeMode="contain" accessibilityLabel="" />
          <View style={{ flex: 1 }}>
            <Text style={s.stepsTitle}>Add the Logga widget</Text>
            <Text style={s.stepsSub}>Takes about 20 seconds.</Text>
          </View>
        </View>
        <View style={s.stepsCard}>
          {steps.map(([t, sub], k) => (
            <View key={t} style={[s.stepRow, k === steps.length - 1 && { marginBottom: 0 }]}>
              <View style={s.stepNum}><Text style={s.stepNumTxt}>{k + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{t}</Text>
                <Text style={s.stepSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <PrimaryBtn label="Got it" onPress={onDone} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
const SINGLE_ANSWER = new Set(['goal', 'country', 'gender', 'activity', 'eatingStyle']);

export default function PreAuthOnboarding({ initialData, initialStep, onComplete, onLogin }) {
  const [idx, setIdx] = useState(() => Math.max(0, FLOW.indexOf(initialStep)));
  const [data, setData] = useState({ ...DEFAULT_DATA, ...(initialData || {}) });
  const [plans, setPlans] = useState(undefined); // undefined = still loading, null = can't sell here
  const [offer, setOffer] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [pro, setPro] = useState(getSubscription().isPro && getSubscription().ready);

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  // Screens that don't apply here are stepped over in both directions.
  const isIos = Platform.OS === 'ios';
  const skip = (id) => {
    if (id === 'health') return !(isIos && appleHealthSupported());
    if (id === 'pro') return !isIos || pro;
    if (id === 'offer' || id === 'wait') return !offer || pro || !deadline || deadline <= Date.now();
    if (id === 'widget' || id === 'widgetSteps') return !isIos;
    return false;
  };
  const skipRef = useRef(skip);
  skipRef.current = skip;

  const advanceTimer = useRef(null);
  const finishedRef = useRef(false);
  const move = (dir) => setIdx((i) => {
    let j = i + dir;
    while (j > 0 && j < FLOW.length && skipRef.current(FLOW[j])) j += dir;
    return Math.max(0, Math.min(j, FLOW.length - 1));
  });
  // Clearing the pending auto-advance means a quick Continue/Back tap can't skip a screen.
  const next = () => { clearTimeout(advanceTimer.current); move(1); };
  const back = () => { clearTimeout(advanceTimer.current); move(-1); };
  useEffect(() => () => clearTimeout(advanceTimer.current), []);
  // Choosing a single answer selects it, gives a light haptic tap so you feel it register, then moves
  // on after a short beat (long enough to see the tick).
  const pick = (k, v) => {
    set(k, v);
    tap();
    clearTimeout(advanceTimer.current);
    if (SINGLE_ANSWER.has(k)) advanceTimer.current = setTimeout(() => move(1), 450);
  };

  // From the plan screen: wipe the answers and begin again at the first question.
  const startOver = () => {
    const go = () => { setData({ ...DEFAULT_DATA }); setIdx(FLOW.indexOf('goal')); };
    if (Platform.OS === 'web') { if (typeof window === 'undefined' || window.confirm('Start over? Your answers will be cleared.')) go(); return; }
    showAlert('Start over?', 'Your answers will be cleared and you can go through the questions again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start over', style: 'destructive', onPress: go },
    ]);
  };

  // Get the Pro prices ready while the plan builds, so the Pro screen opens with real prices. Every new
  // onboarding shows Pro, the offer and the widget screens; only someone already on Pro skips Pro and the
  // offer, and the offer also needs Apple to say this Apple ID can still get the intro price.
  const screen = FLOW[idx];
  const plansStarted = useRef(false);
  const loadPro = async () => {
    try {
      await initAnonymousSubscriptions();
      const sub = getSubscription();
      if (sub.isPro) { setPro(true); setPlans(null); return; }
      const [p, o] = await Promise.all([loadPlans().catch(() => null), loadIntroOffer()]);
      setPlans(p?.yearly || p?.monthly ? p : null);
      if (o) setOffer(o);
    } catch (_) {
      setPlans(null);
    }
  };
  useEffect(() => {
    if (plansStarted.current || FLOW.indexOf(screen) < FLOW.indexOf('care')) return;
    plansStarted.current = true;
    if (!isIos) { setPlans(null); return; }
    loadPro();
  }, [screen]);
  // From the Pro screen when the prices couldn't load: try again.
  const retryPlans = () => { setPlans(undefined); loadPro(); };

  // Wait a few seconds for the prices before leaving the plan screen, so Pro opens with them.
  const [waitingPlans, setWaitingPlans] = useState(false);
  useEffect(() => {
    if (!waitingPlans) return undefined;
    if (plans !== undefined) { setWaitingPlans(false); nextOrFinish(); return undefined; }
    // Never hold anyone on a spinner: after a few seconds, carry on (Pro then offers a retry).
    const t = setTimeout(() => setPlans((p) => (p === undefined ? null : p)), 6000);
    return () => clearTimeout(t);
  }, [waitingPlans, plans]);
  const fromPlan = () => {
    if (plans === undefined && isIos) { setWaitingPlans(true); return; }
    nextOrFinish();
  };

  // The offer's two hours start when this onboarding first reaches it.
  useEffect(() => {
    if (!offer || deadline || pro) return;
    if (FLOW[idx + 1] !== 'offer' && screen !== 'pro') return;
    setDeadline(Date.now() + OFFER_WINDOW_MS);
  }, [screen, offer]);

  // Funnel: started -> each screen -> completed (or skipped), the same shape as SUAI's onboarding events.
  useEffect(() => { track(EVENTS.ONBOARDING_STARTED); }, []);
  useEffect(() => { track(EVENTS.ONBOARDING_SCREEN_VIEWED, { screen, index: idx }); }, [idx]);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    track(EVENTS.ONBOARDING_COMPLETED);
    Promise.resolve(onComplete?.(buildAnswers(data), data)).finally(() => { finishedRef.current = false; });
  };
  // Past the plan, "next" off the end of the flow (or onto a skipped widget) means done.
  const nextOrFinish = () => {
    let j = idx + 1;
    while (j < FLOW.length && skip(FLOW[j])) j += 1;
    if (j >= FLOW.length || FLOW[j] === 'widgetSteps') finish();
    else next();
  };

  const chapter = chapterOf(screen);
  const sharedProps = { d: data, set, pick, next, back, chapter, onBack: back, showBack: idx > 0 };

  switch (screen) {
    case 'hook':      return <HookScreen next={next} onLogin={onLogin} />;
    case 'goal':      return <GoalScreen {...sharedProps} />;
    case 'demo':      return <DemoScreen {...sharedProps} />;
    case 'struggle':  return <StruggleScreen {...sharedProps} />;
    case 'name':      return <NameScreen {...sharedProps} />;
    case 'tone':      return <ToneScreen {...sharedProps} />;
    case 'country':   return <CountryScreen {...sharedProps} />;
    case 'gender':    return <GenderScreen {...sharedProps} />;
    case 'age':       return <AgeScreen {...sharedProps} />;
    case 'bodyIntro': return <BodyIntroScreen d={data} next={next} />;
    case 'height':    return <HeightScreen {...sharedProps} />;
    case 'weight':    return <WeightScreen {...sharedProps} />;
    case 'target':    return <TargetScreen {...sharedProps} />;
    case 'pace':      return <PaceScreen {...sharedProps} />;
    case 'activity':  return <ActivityScreen {...sharedProps} />;
    case 'eating':    return <EatingScreen {...sharedProps} />;
    case 'food':      return <FoodScreen {...sharedProps} />;
    case 'why':       return <WhyScreen {...sharedProps} />;
    case 'care':      return <CareScreen {...sharedProps} />;
    case 'reminders': return <RemindersScreen {...sharedProps} />;
    case 'health':    return <HealthScreen {...sharedProps} />;
    case 'commit':    return <CommitScreen d={data} next={next} onBack={back} />;
    case 'building':  return <BuildingScreen d={data} set={set} next={next} />;
    case 'done':
      return waitingPlans
        ? <View style={[s.shell, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.plan }]}><ActivityIndicator color={C.ink} /></View>
        : <DoneScreen d={data} onNext={fromPlan} onStartOver={startOver} />;
    case 'pro':
      return (
        <ProScreen
          d={data}
          plans={plans}
          onRetry={retryPlans}
          onClose={nextOrFinish}
          onPurchased={() => { setPro(true); setIdx(FLOW.indexOf('widget')); if (!isIos) finish(); }}
        />
      );
    case 'wait':      return <WaitScreen d={data} onShow={next} />;
    case 'offer':
      return (
        <OfferScreen
          d={data}
          offer={offer}
          deadline={deadline}
          onDone={(bought) => {
            if (bought) setPro(true);
            setOffer(null);
            nextOrFinish();
          }}
        />
      );
    case 'widget':      return <WidgetScreen d={data} onShow={next} onLater={finish} />;
    case 'widgetSteps': return <WidgetStepsScreen onBack={back} onDone={finish} />;
    default:            return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bg },
  shellContent: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 22, backgroundColor: C.bg },

  // Top bar
  topWrap: { paddingTop: Platform.OS === 'ios' ? 56 : 38, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: C.primary },
  chapterLabel: { paddingLeft: 48, paddingTop: 6, fontSize: 12, fontWeight: '700', color: C.ink500 },

  // Lumi bubble
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 28 },
  bubbleAvatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'flex-end' },
  bubble: {
    flex: 1, backgroundColor: C.surface, borderRadius: 18, borderBottomLeftRadius: 6,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#0B3D2E', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  bubbleTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  bubbleSub: { marginTop: 4, fontSize: 13.5, lineHeight: 19, fontWeight: '600', color: C.ink500 },

  // Typography
  eyebrow: { fontSize: 12, fontWeight: '800', color: C.primary, letterSpacing: 1.2 },
  textBtn: { width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnTxt: { fontSize: 14, fontWeight: '700', color: C.ink500 },

  // Buttons
  primaryBtn: { width: '100%', height: 56, borderRadius: 999, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDis: { backgroundColor: C.line },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  primaryBtnTxtDis: { color: C.ink400 },

  // Segmented control
  segRow: { alignItems: 'center', marginBottom: 20 },
  seg: { flexDirection: 'row', backgroundColor: C.sunken, borderRadius: 999, padding: 4 },
  segBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  segBtnOn: { backgroundColor: C.surface },
  segBtnTxt: { fontSize: 14, fontWeight: '700', color: C.ink500 },
  segBtnTxtOn: { color: C.ink, fontWeight: '800' },

  // Options
  opts: { gap: 10, marginTop: 24 },
  opt: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.cardLine,
  },
  optCompact: { padding: 13 },
  optSel: { backgroundColor: C.selBg, borderWidth: 2, borderColor: C.primary },
  optTitle: { fontSize: 15.5, fontWeight: '800', color: C.ink },
  optSub: { fontSize: 13, fontWeight: '600', color: C.ink500, marginTop: 2, lineHeight: 18 },
  radioOn: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.checkLine, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  boxOn: { backgroundColor: C.primary, borderColor: C.primary },
  recBadge: { fontSize: 10.5, fontWeight: '800', color: '#fff', backgroundColor: C.primary, borderRadius: 6, overflow: 'hidden' },

  // Chips
  sectionLabel: { marginTop: 22, fontSize: 12, fontWeight: '800', color: C.ink500, letterSpacing: 0.6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.cardLine },
  chipSel: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  chipTextSel: { color: '#fff' },

  // Wheel
  wheelArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wheelPill: {
    position: 'absolute', left: '22%', right: '22%', borderRadius: 20, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  wheelRow: { height: ROW, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingTop: 4 },
  wheelOn: { fontSize: 50, lineHeight: 58, fontWeight: '800', color: C.ink, letterSpacing: -2 },
  wheelNear: { fontSize: 32, lineHeight: 50, fontWeight: '700', color: '#A9B2AD' },
  wheelFar: { fontSize: 26, lineHeight: 50, fontWeight: '700', color: '#D3D8D5' },
  wheelUnit: { fontSize: 22, fontWeight: '800', marginLeft: 10 },
  wheelCaption: { textAlign: 'center', marginTop: 4, fontSize: 14, fontWeight: '700', color: C.ink400 },

  // Hook
  hook: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingHorizontal: 24 },
  hookHero: { flex: 1, width: 340, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  hookPlates: { width: 340, height: 330 },
  hookPlate: { position: 'absolute', borderWidth: 4, borderColor: '#fff', backgroundColor: '#E5E7EB', shadowColor: '#0B3D2E', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  hookTag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#0B3D2E', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  hookTagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  hookTagTxt: { fontSize: 11.5, fontWeight: '700', color: C.ink },
  hookHeadline: { marginTop: 12, marginHorizontal: -8, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8, color: C.ink },
  hookSubline: { marginTop: 14, fontSize: 15, lineHeight: 22, color: C.ink600, textAlign: 'center' },
  hookCta: { alignSelf: 'stretch', paddingTop: 22, paddingBottom: Platform.OS === 'ios' ? 28 : 22 },
  hookLegal: { marginTop: 6, marginHorizontal: 12, fontSize: 12, lineHeight: 17, color: '#8A938E', textAlign: 'center' },
  hookLegalLink: { color: C.ink600, fontWeight: '600', textDecorationLine: 'underline' },
  hookLoginBtn: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  hookLoginTxt: { fontSize: 15, fontWeight: '700', color: C.ink600 },

  // Demo
  demoHeadline: { marginTop: 6, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, color: C.ink },
  demoSub: { marginTop: 6, fontSize: 14.5, lineHeight: 21, color: C.ink600 },
  demoShutter: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  demoShutterInner: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.15)', backgroundColor: '#fff' },
  demoScanLine: {
    position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: C.primary, opacity: 0.9,
    shadowColor: C.primary, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  demoDetectBar: {
    position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, zIndex: 10,
  },
  demoDetectTitle: { fontSize: 13, fontWeight: '800', color: C.ink },
  demoDetectSub: { fontSize: 11.5, color: C.ink500, marginTop: 1 },
  demoKcal: { fontSize: 20, fontWeight: '800', color: C.ink },
  demoKcalUnit: { fontSize: 10, fontWeight: '800', color: C.ink500 },
  demoTagRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoTagDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34D399', borderWidth: 3, borderColor: 'rgba(52,211,153,0.35)' },
  demoTagPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff' },
  demoTagTxt: { fontSize: 12.5, fontWeight: '800', color: C.ink },

  // Name
  nameInput: { alignSelf: 'stretch', textAlign: 'center', fontSize: 40, fontWeight: '800', color: C.ink, letterSpacing: -0.8, paddingVertical: 4 },
  nameUnderline: { width: 160, height: 3, borderRadius: 2, backgroundColor: C.primary, marginTop: 4 },
  nameGreet: { marginTop: 10, backgroundColor: C.mint, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18 },
  nameGreetTxt: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: '#065f46', textAlign: 'center' },

  // Tone
  toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  toneCard: {
    width: '47.5%', alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 10, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.cardLine,
  },
  toneCardOn: { backgroundColor: C.selBg, borderWidth: 2, borderColor: C.primary },
  toneTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  toneSub: { fontSize: 12, lineHeight: 16, color: C.ink600, textAlign: 'center' },
  toneSample: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  toneSampleLabel: { fontSize: 11.5, fontWeight: '800', color: C.primary, letterSpacing: 0.6 },
  toneSampleTxt: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '600', color: C.ink },

  // Breather
  breather: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 22 },
  breatherCount: { marginTop: 6, fontSize: 12, fontWeight: '700', color: C.ink600 },
  breatherMid: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  breatherTitle: { marginTop: 16, fontSize: 32, lineHeight: 38, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6, color: C.ink },
  breatherSub: { marginTop: 14, fontSize: 16, lineHeight: 23, color: '#374151', textAlign: 'center' },

  // Target
  gapPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  gapPillTxt: { fontSize: 14, fontWeight: '800' },
  guardBox: { padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', alignSelf: 'stretch' },
  guardTxt: { fontSize: 13.5, lineHeight: 19, color: '#B91C1C', textAlign: 'center' },

  // Pace chart
  paceSum: { marginTop: 30, paddingHorizontal: 4 },
  paceSumLine: { fontSize: 18, lineHeight: 25, fontWeight: '800', letterSpacing: -0.3, color: C.ink },
  paceTrack: { marginTop: 18, height: 6, borderRadius: 3, backgroundColor: '#E3E7E2' },
  paceFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: C.primary },
  paceDot: { position: 'absolute', right: -11, top: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary, borderWidth: 4, borderColor: '#fff', shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  paceEnds: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  paceEndTxt: { fontSize: 12.5, fontWeight: '600', color: '#8A938E' },

  // Care
  careTitle: { marginTop: 34, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', color: C.ink },
  careBody: { marginTop: 14, fontSize: 15, lineHeight: 23, color: '#374151', textAlign: 'center' },
  careCard: {
    marginTop: 18, alignSelf: 'stretch', flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 18, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  careCardTxt: { flex: 1, fontSize: 14, lineHeight: 21, color: '#374151' },
  careLink: { fontSize: 14, fontWeight: '700', color: C.primaryDark, textDecorationLine: 'underline' },

  // Reminders
  remindersHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 24 },
  remindersTitle: { flex: 1, fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, color: C.ink },
  remindersSub: { marginTop: 10, fontSize: 14.5, lineHeight: 21, color: C.ink600 },
  notifCard: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  notifTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  notifBody: { fontSize: 13, color: C.ink600 },
  remindersNote: { fontSize: 11.5, color: C.ink500, textAlign: 'center' },

  // Health
  healthTile: {
    position: 'absolute', top: -6, right: 4, width: 62, height: 62, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F2F52', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  healthTitle: { marginTop: 18, fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, color: C.ink },
  healthSub: { marginTop: 14, fontSize: 15, lineHeight: 22, color: '#374151', textAlign: 'center' },
  healthNote: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthNoteTxt: { fontSize: 12.5, color: C.ink600 },

  // Building
  buildWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buildingTitle: { marginTop: 18, fontSize: 20, fontWeight: '800', textAlign: 'center', color: C.ink },
  buildCard: {
    alignSelf: 'stretch', gap: 16, marginTop: 26, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.07, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  buildStep: { fontSize: 14.5, fontWeight: '700', color: C.ink, flexShrink: 1 },
  buildPct: { fontSize: 12.5, fontWeight: '800', color: C.ink500, marginLeft: 8 },
  buildTrack: { height: 5, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden', marginTop: 7 },
  buildFill: { height: 5, borderRadius: 3 },

  // Quick question
  qqWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  qqSheet: {
    alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 28, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 50, shadowOffset: { width: 0, height: 20 }, elevation: 12,
  },
  qqEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: C.primary },
  qqTitle: { marginTop: 2, fontSize: 20, lineHeight: 25, fontWeight: '800', color: C.ink },
  qqSub: { marginTop: 6, fontSize: 13.5, lineHeight: 19, fontWeight: '600', color: C.ink500 },
  qqOpt: { paddingVertical: 15, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.cardLine },
  qqOptTxt: { fontSize: 15.5, fontWeight: '800', color: C.ink },
  qqSkip: { height: 42, marginTop: 6, alignItems: 'center', justifyContent: 'center' },

  // Plan
  planKicker: { fontSize: 11.5, fontWeight: '800', color: C.ink400, letterSpacing: 1.8, marginBottom: 8 },
  planHeadline: { fontSize: 26, fontWeight: '800', color: C.ink, lineHeight: 32, letterSpacing: -0.6 },
  planNumberWrap: { marginTop: 16, marginBottom: 18 },
  planNumber: { fontSize: 64, fontWeight: '800', color: C.ink, lineHeight: 70, letterSpacing: -2.5 },
  planNumberUnit: { fontSize: 16, fontWeight: '600', color: C.ink500, marginTop: 2 },
  planNote: { fontSize: 12, lineHeight: 17, color: C.ink400, marginTop: 8 },

  // Pro
  proTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 52 : 32, paddingLeft: 24, paddingRight: 16 },
  proRestore: { fontSize: 14, fontWeight: '600', color: '#8A938E' },
  proClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F2' },
  proBody: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18 },
  proHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  proFeatures: { marginTop: 28, gap: 15 },
  proFeature: { flexDirection: 'row', gap: 12 },
  proFeatureIcon: { width: 22, alignItems: 'center', paddingTop: 1 },
  proFeatureTxt: { flex: 1, fontSize: 14.5, lineHeight: 21, fontWeight: '600', letterSpacing: -0.15, color: C.ink },
  commitBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.primary },
  commitBody: { flex: 1, paddingHorizontal: 28, paddingTop: 52 },
  commitH1: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: C.ink },
  commitSub: { marginTop: 14, fontSize: 15, lineHeight: 22, color: '#6c7872' },
  commitMid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  commitPledge: { marginBottom: 30, maxWidth: 260, textAlign: 'center', fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#374151' },
  commitRing: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  commitCore: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, borderRadius: 62, alignItems: 'center', justifyContent: 'center', shadowColor: '#16201b', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  commitLabel: { marginTop: 18, minHeight: 20, fontSize: 14, fontWeight: '600', color: '#6c7872' },
  waitMid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
  waitH1: { marginTop: 28, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, textAlign: 'center', color: C.ink },
  waitSub: { marginTop: 10, fontSize: 17, lineHeight: 25, color: '#6c7872', textAlign: 'center' },
  proRetry: { marginTop: 22, padding: 16, borderRadius: 16, backgroundColor: C.mint, alignItems: 'center' },
  proRetryTxt: { fontSize: 14, fontWeight: '700', color: C.ink600 },
  proHeadline: { flex: 1, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: C.ink },
  planRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  planCard: {
    flex: 1, alignItems: 'center', paddingTop: 22, paddingBottom: 16, paddingHorizontal: 10,
    borderRadius: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E6E8E3',
  },
  planCardOn: { borderWidth: 2, borderColor: C.ink },
  bestBadge: { position: 'absolute', top: -11, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: C.primary },
  bestBadgeTxt: { fontSize: 11.5, fontWeight: '700', color: '#fff' },
  planLen: { fontSize: 14, fontWeight: '600', color: '#6c7872' },
  planPrice: { marginTop: 6, fontSize: 26, lineHeight: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  planPer: { marginTop: 2, fontSize: 13, color: '#6c7872' },
  trialChip: { marginTop: 8, fontSize: 12.5, fontWeight: '600', color: C.primary },
  proTerms: { fontSize: 13, fontWeight: '700', color: C.ink600, textAlign: 'center', marginBottom: 10 },
  proLegal: { marginTop: 10, fontSize: 10.5, lineHeight: 14, color: C.ink400, textAlign: 'center' },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 6 },
  legalLink: { fontSize: 11.5, fontWeight: '700', color: C.ink500, textDecorationLine: 'underline' },

  // Offer
  offerClose: { position: 'absolute', zIndex: 5, top: Platform.OS === 'ios' ? 54 : 34, left: 20, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sunken },
  offerEyebrow: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2, color: C.primary },
  offerTitle: { marginTop: 8, fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6, color: C.ink },
  offerCard: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: 12, paddingVertical: 16, borderRadius: 20, backgroundColor: C.surface,
    shadowColor: '#0B3D2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  offerEnds: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: C.ink500 },
  countRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  countBox: { minWidth: 46, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center' },
  countTxt: { fontSize: 22, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  countColon: { fontSize: 22, fontWeight: '800', color: C.ink, marginHorizontal: 6 },
  offerPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  offerStrike: { fontSize: 16, fontWeight: '700', color: C.ink400, textDecorationLine: 'line-through' },
  offerPrice: { fontSize: 28, fontWeight: '800', color: C.primary },
  offerPer: { fontSize: 14, fontWeight: '700', color: C.ink500 },
  offerTerms: { marginTop: 14, fontSize: 13.5, lineHeight: 20, color: C.ink600, textAlign: 'center' },
  skipSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 6 },
  skipTitle: { marginTop: 6, fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center', color: C.ink },
  skipBody: { marginTop: 8, marginBottom: 18, fontSize: 14.5, lineHeight: 21, color: C.ink600, textAlign: 'center' },

  // Widget
  widgetTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, color: C.ink },
  widgetSub: { marginTop: 8, fontSize: 15, lineHeight: 22, color: C.ink600 },
  phone: { width: 260, height: 360, borderRadius: 36, paddingTop: 14, paddingHorizontal: 16, overflow: 'hidden' },
  phoneTime: { alignSelf: 'center', fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 14 },
  widget: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 22, backgroundColor: '#fff', marginBottom: 18 },
  widgetRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 7, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  widgetKcal: { fontSize: 16, fontWeight: '800', color: C.ink },
  widgetKcalLbl: { fontSize: 9.5, fontWeight: '700', color: C.ink500 },
  widgetApp: { marginLeft: 6, fontSize: 12.5, fontWeight: '800', color: C.ink },
  widgetLine: { marginTop: 6, fontSize: 11.5, fontWeight: '600', color: C.ink500 },
  widgetWater: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E0F2FE' },
  widgetWaterTxt: { fontSize: 11.5, fontWeight: '800', color: '#0369A1' },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  appIcon: { width: 44, height: 44, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.45)' },
  appLabel: { marginTop: 5, width: 30, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  widgetHint: { paddingHorizontal: 30, fontSize: 13, lineHeight: 19, color: C.ink500, textAlign: 'center' },

  // Widget steps
  stepsTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: C.ink },
  stepsSub: { marginTop: 4, fontSize: 14, color: C.ink600 },
  stepsCard: { marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: C.surface },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt: { fontSize: 13.5, fontWeight: '800', color: C.primaryDark },
  stepTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: C.ink },
  stepSub: { marginTop: 2, fontSize: 13, lineHeight: 18, color: C.ink500 },
});
