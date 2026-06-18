import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Animated, Platform, useWindowDimensions, Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  primary:     '#059669',
  primarySoft: '#ecfdf5',
  terra:       '#db6a3f',
  terraSoft:   '#fbeee7',
  amber:       '#f0a534',
  ink:         '#16201b',
  ink700:      '#3a4640',
  ink500:      '#6c7872',
  ink400:      '#97a19b',
  bg:          '#fbfbf7',
  surface:     '#ffffff',
  sunken:      '#f4f4ee',
  line:        '#e9e9e1',
  line2:       '#deded4',
  green50:     '#ecfdf5',
};

const DEFAULT_DATA = {
  goal: '', struggles: [], name: '', country: '', gender: '', age: 28,
  heightCm: 170, weightKg: 82, targetKg: 72, unitH: 'cm', unitW: 'kg',
  pace: 'moderate', activity: '', eatingStyle: '',
  foodContext: '', cuisines: [], whys: [], accountability: '',
};

const FLOW = [
  'hook', 'goal', 'demo', 'struggle', 'name', 'country', 'gender', 'age',
  'bodyIntro', 'height', 'weight', 'target', 'pace', 'activity',
  'eating', 'food', 'why', 'accountability', 'building', 'done',
];
const FULL_BLEED = new Set(['hook', 'bodyIntro', 'building', 'done']);
const COUNTED = FLOW.filter(id => !FULL_BLEED.has(id)).length;

// ── Calorie calculator (Mifflin-St Jeor → TDEE) ───────────────────────────────
function calcPlan(d) {
  const s = d.gender === 'Male' ? 5 : d.gender === 'Female' ? -161 : -78;
  const bmr = 10 * d.weightKg + 6.25 * d.heightCm - 5 * d.age + s;
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[d.activity] || 1.375;
  const tdee = bmr * factor;
  const DEFICIT = { slow: 250, moderate: 500, aggressive: 750 };
  const deficit = d.targetKg < d.weightKg ? (DEFICIT[d.pace] || 500) : 0;
  const floor = d.gender === 'Male' ? 1500 : 1200;
  let target = Math.round((tdee - deficit) / 10) * 10;
  if (target < floor) target = floor;
  const gap = d.weightKg - d.targetKg;
  const RATE = { slow: 0.25, moderate: 0.5, aggressive: 0.75 };
  const rate = RATE[d.pace] || 0.5;
  const weeks = d.targetKg < d.weightKg && gap > 0 ? Math.max(1, Math.round(gap / rate)) : 0;
  const protein = Math.round(d.weightKg * 1.6);
  const water = Math.max(2, Math.round(d.weightKg * 0.033 * 10) / 10);
  return { tdee: Math.round(tdee), target, weeks, protein, water, deficit };
}

// ── Horizontal ruler picker ────────────────────────────────────────────────────
function RulerPicker({ min, max, value, onChange, unit, accent }) {
  const GAP = 14;
  const { width: SW } = useWindowDimensions();
  const scrollRef = useRef(null);
  const rangeKey = `${min}-${max}`;
  const prevRange = useRef(rangeKey);

  useEffect(() => {
    const changed = prevRange.current !== rangeKey;
    prevRange.current = rangeKey;
    const offset = Math.max(0, (value - min)) * GAP;
    const delay = changed ? 20 : 80;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: offset, animated: false });
    }, delay);
    return () => clearTimeout(t);
  }, [rangeKey]); // only re-scroll when range/unit changes

  const handleScrollEnd = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / GAP);
    const v = Math.max(min, Math.min(max, min + idx));
    if (v !== value) onChange(v);
  }, [min, max, value, onChange]);

  const count = max - min;
  const ac = accent || C.primary;
  const halfW = SW / 2;

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={s.rulerVal}>{value}</Text>
        <Text style={s.rulerUnit}>{unit}</Text>
      </View>
      <View style={{ position: 'relative' }}>
        {/* downward-pointing center indicator */}
        <View style={[s.rulerCursorWrap, { left: halfW - 1.5 }]}>
          <View style={[s.rulerArrow, { borderTopColor: ac }]} />
          <View style={[s.rulerLine, { backgroundColor: ac }]} />
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={GAP}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
        >
          <View style={{ flexDirection: 'row', paddingHorizontal: halfW }}>
            {Array.from({ length: count + 1 }, (_, i) => {
              const v = min + i;
              const major = v % 5 === 0;
              return (
                <View key={i} style={{ width: GAP, alignItems: 'center', justifyContent: 'flex-end', height: 54 }}>
                  <View style={{
                    width: 2, borderRadius: 2,
                    height: major ? 34 : 18,
                    backgroundColor: major ? C.ink400 : C.line2,
                  }} />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ── Option card ────────────────────────────────────────────────────────────────
function OptionCard({ icon, title, subtitle, selected, onPress, multi, compact }) {
  return (
    <TouchableOpacity
      style={[s.optCard, selected && s.optCardSel, compact && s.optCardCompact]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon != null && (
        <View style={[s.optIconWrap, selected && s.optIconWrapSel]}>
          {icon}
        </View>
      )}
      <View style={s.optText}>
        <Text style={s.optTitle}>{title}</Text>
        {subtitle ? <Text style={s.optSub}>{subtitle}</Text> : null}
      </View>
      <View style={[s.optSel, selected && s.optSelOn, multi && s.optSelMulti]}>
        {selected ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity style={[s.chip, selected && s.chipSel]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.chipText, selected && s.chipTextSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────────────
function PrimaryBtn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[s.primaryBtn, disabled && s.primaryBtnDis]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <Text style={[s.primaryBtnTxt, disabled && s.primaryBtnTxtDis]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TextBtn({ label, onPress }) {
  return (
    <TouchableOpacity style={s.textBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.textBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Segmented unit toggle ──────────────────────────────────────────────────────
function Seg({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const on = v === value;
        return (
          <TouchableOpacity key={v} style={[s.segBtn, on && s.segBtnOn]} onPress={() => onChange(v)}>
            <Text style={[s.segBtnTxt, on && s.segBtnTxtOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Progress bar + back ────────────────────────────────────────────────────────
function ProgressTop({ step, total, onBack, showBack }) {
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View style={s.progressWrap}>
      <TouchableOpacity
        style={[s.backBtn, !showBack && { opacity: 0 }]}
        onPress={showBack ? onBack : undefined}
        disabled={!showBack}
      >
        <Ionicons name="chevron-back" size={18} color={C.ink700} />
      </TouchableOpacity>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={s.progressCount}>
        {step}<Text style={{ opacity: 0.5 }}>/{total}</Text>
      </Text>
    </View>
  );
}

// ── Screen shell ───────────────────────────────────────────────────────────────
function ScreenShell({ children, footer, step, total, onBack, showBack, hideProgress }) {
  return (
    <View style={s.shell}>
      {!hideProgress && (
        <ProgressTop step={step} total={total} onBack={onBack} showBack={showBack} />
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.shellContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────────────────────

function MascotFace({ happy }) {
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prevHappy = useRef(happy);
  const [eyeRY, setEyeRY] = useState(5);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 900, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const blink = () => { setEyeRY(1); setTimeout(() => setEyeRY(5), 150); };
    blink();
    const iv = setInterval(blink, 2800 + Math.random() * 1200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (happy && !prevHappy.current) {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.22, duration: 170, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1,    duration: 170, useNativeDriver: true }),
      ]).start();
    }
    prevHappy.current = happy;
  }, [happy]);

  return (
    <Animated.View style={{ transform: [{ translateY: bob }, { scale: pop }] }}>
      <Svg width={90} height={90} viewBox="0 0 90 90">
        <Circle cx="45" cy="45" r="42" fill={happy ? '#d1fae5' : '#f4f4ee'} />
        <Ellipse cx="32" cy="38" rx="5" ry={eyeRY} fill={happy ? C.primary : C.ink700} />
        <Ellipse cx="58" cy="38" rx="5" ry={eyeRY} fill={happy ? C.primary : C.ink700} />
        {happy
          ? <Path d="M 30 55 Q 45 68 60 55" stroke={C.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
          : <Path d="M 33 57 Q 45 57 57 57" stroke={C.ink400}  strokeWidth={3} fill="none" strokeLinecap="round" />
        }
      </Svg>
    </Animated.View>
  );
}

function HookScreen({ next, onLogin }) {
  const rock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rock, { toValue: 1,  duration: 1800, useNativeDriver: true }),
        Animated.timing(rock, { toValue: -1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = rock.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-4deg', '0deg', '4deg'] });

  return (
    <View style={[s.shell, { backgroundColor: C.bg }]}>
      {/* Brand */}
      <View style={s.hookBrand}>
        <View style={s.hookLogo}>
          <Ionicons name="leaf" size={16} color="#fff" />
        </View>
        <Text style={s.hookBrandTxt}>
          Afri<Text style={{ color: C.primary }}>Fast</Text>
        </Text>
      </View>

      {/* Hero */}
      <View style={s.hookHero}>
        <View style={s.hookHeroCircle} />
        <View style={s.hookIllo}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Text style={s.hookIlloEmoji}>🍛</Text>
          </Animated.View>
          <Text style={s.hookIlloSub}>jollof · fufu · suya · egusi</Text>
        </View>
      </View>

      {/* Statement */}
      <View style={s.hookStatement}>
        <Text style={s.hookHeadline}>
          Eat the food you{' '}
          <Text style={{ color: C.primary }}>love.</Text>{' '}
          Reach the body you want.
        </Text>
        <Text style={s.hookSubline}>
          The first nutrition app that truly knows jollof, fufu and suya — counted the way you actually eat.
        </Text>
      </View>

      {/* CTA */}
      <View style={s.hookCta}>
        <PrimaryBtn label="Let's start →" onPress={next} />
        <TouchableOpacity onPress={onLogin} style={s.hookLoginBtn} activeOpacity={0.7}>
          <Text style={s.hookLoginTxt}>I already have an account</Text>
        </TouchableOpacity>
        <Text style={s.hookNotice}>Takes about 3 minutes · No card needed</Text>
      </View>
    </View>
  );
}

function DemoScreen(p) {
  const { next } = p;
  const { width: SW } = useWindowDimensions();
  const imgH = SW * 1.35;

  return (
    <View style={[s.shell, { backgroundColor: C.bg }]}>
      <ProgressTop {...p} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18 }}>
          <Text style={s.eyebrow}>SEE IT IN ACTION +</Text>
          <Text style={[s.headline, { marginTop: 6 }]}>Let's see the magic.</Text>
          <Text style={[s.subline, { marginTop: 8 }]}>
            Tap the shutter — point AfriFast at any plate, even jollof, and watch it read the calories.
          </Text>
        </View>

        {/* Camera frame */}
        <View style={{ marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', height: imgH }}>
          <Image
            source={require('../../assets/jollof-demo.jpg')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {/* Corner brackets */}
          {[
            { top: 14, left: 14 },
            { top: 14, right: 14 },
            { bottom: 60, left: 14 },
            { bottom: 60, right: 14 },
          ].map((pos, i) => (
            <View key={i} style={[s.demoBracket, pos,
              i === 1 || i === 3 ? { transform: [{ scaleX: -1 }] } : null,
              i === 2 || i === 3 ? { transform: [{ scaleY: -1 }] } : null,
            ]} />
          ))}
          {/* Shutter button */}
          <TouchableOpacity
            style={s.demoShutter}
            onPress={next}
            activeOpacity={0.85}
          >
            <View style={s.demoShutterInner} />
          </TouchableOpacity>
        </View>

        {/* Skip */}
        <TouchableOpacity onPress={next} style={s.demoSkip} activeOpacity={0.7}>
          <Text style={s.demoSkipTxt}>Skip the demo</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function GoalScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'lose',       t: 'Lose weight',        s: 'Shed kilos at a healthy, steady pace',   icon: 'trending-down-outline' },
    { v: 'eat',        t: 'Eat better',          s: 'More balance, less guilt',                icon: 'nutrition-outline' },
    { v: 'consistent', t: 'Stay consistent',     s: 'Build a habit that finally sticks',       icon: 'flame-outline' },
    { v: 'understand', t: 'Understand my body',  s: 'Learn what my meals really do',           icon: 'search-outline' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.goal} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.eyebrow}>Your goal</Text>
        <Text style={s.headline}>What brings you here?</Text>
        <Text style={s.subline}>Pick the one that matters most right now.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 11 }}>
            <OptionCard
              icon={<Ionicons name={o.icon} size={24} color={d.goal === o.v ? C.primary : C.ink700} />}
              title={o.t} subtitle={o.s}
              selected={d.goal === o.v} onPress={() => set('goal', o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function StruggleScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'forget',     t: 'I forget to track',                 s: 'Life gets busy and logging slips',      icon: 'notifications-off-outline' },
    { v: 'local',      t: "Don't know local food calories",     s: 'No app counts a wrap of fufu',          icon: 'help-circle-outline' },
    { v: 'motivation', t: 'I lose motivation',                  s: 'I start strong, then fade',             icon: 'battery-half-outline' },
    { v: 'eatout',     t: 'I eat out a lot',                    s: 'Buka, mama-put, restaurants',           icon: 'storefront-outline' },
  ];
  const list = d.struggles || [];
  const toggle = (v) => set('struggles', list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <ScreenShell {...p} footer={
      <>
        <PrimaryBtn label="Continue" onPress={next} disabled={list.length === 0} />
        <TextBtn label="Skip" onPress={next} />
      </>
    }>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>What's tripped you up before?</Text>
        <Text style={s.subline}>Pick all that ring true — no judgement.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 11 }}>
            <OptionCard
              multi
              icon={<Ionicons name={o.icon} size={24} color={list.includes(o.v) ? C.primary : C.ink700} />}
              title={o.t} subtitle={o.s}
              selected={list.includes(o.v)} onPress={() => toggle(o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function NameScreen(p) {
  const { d, set, next } = p;
  const happy = d.name.trim().length > 0;
  const first = d.name.trim().split(' ')[0];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.name.trim()} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.eyebrow}>About you · 1 of 4</Text>
        <Text style={s.headline}>First, what should we call you?</Text>
        <Text style={s.subline}>We like to keep things personal — like family.</Text>
      </View>
      <View style={s.nameInputWrap}>
        <TextInput
          style={s.nameInput}
          value={d.name}
          onChangeText={(v) => set('name', v)}
          placeholder="Type your name"
          placeholderTextColor={C.ink400}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => d.name.trim() && next()}
        />
      </View>
      <View style={s.nameMascotWrap}>
        <MascotFace happy={happy} />
        <View style={[s.nameGreet, { backgroundColor: happy ? C.primarySoft : C.sunken, marginTop: 14 }]}>
          <Text style={[s.nameGreetTxt, { color: happy ? C.primary : C.ink400 }]}>
            {happy ? `Lovely to meet you, ${first}!` : "Go on — I'm all ears."}
          </Text>
        </View>
      </View>
    </ScreenShell>
  );
}

function CountryScreen(p) {
  const { d, set, next } = p;
  const FLAGS = {
    Nigeria: '🇳🇬', Ghana: '🇬🇭', Kenya: '🇰🇪', Tanzania: '🇹🇿',
    Uganda: '🇺🇬', Senegal: '🇸🇳', Cameroon: '🇨🇲', Ethiopia: '🇪🇹', Other: '🌍',
  };
  const list = ['Nigeria','Ghana','Kenya','Tanzania','Uganda','Senegal','Cameroon','Ethiopia','Other'];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.country} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.eyebrow}>About you · 2 of 4</Text>
        <Text style={s.headline}>Where are you cooking from?</Text>
        <Text style={s.subline}>So we match dishes and portions to your kitchen.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {list.map((c, i) => (
          <View key={c} style={i > 0 && { marginTop: 9 }}>
            <OptionCard compact
              icon={<Text style={{ fontSize: 22 }}>{FLAGS[c]}</Text>}
              title={c} selected={d.country === c} onPress={() => set('country', c)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function GenderScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'Female', t: 'Female',                    icon: 'female-outline' },
    { v: 'Male',   t: 'Male',                      icon: 'male-outline' },
    { v: 'Other',  t: 'Other / prefer not to say', icon: 'transgender-outline' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.gender} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.eyebrow}>About you · 3 of 4</Text>
        <Text style={s.headline}>What's your sex?</Text>
        <Text style={s.subline}>This sharpens your calorie maths — nothing else.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 11 }}>
            <OptionCard
              icon={<Ionicons name={o.icon} size={24} color={d.gender === o.v ? C.primary : C.ink700} />}
              title={o.t} selected={d.gender === o.v} onPress={() => set('gender', o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function AgeScreen(p) {
  const { d, set, next } = p;
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.eyebrow}>About you · 4 of 4</Text>
        <Text style={s.headline}>How old are you?</Text>
        <Text style={s.subline}>Drag the dial to your age.</Text>
      </View>
      <View style={{ marginTop: 32, paddingBottom: 30 }}>
        <RulerPicker min={14} max={90} value={d.age} onChange={(v) => set('age', v)} unit="yrs" />
      </View>
    </ScreenShell>
  );
}

function BodyIntroScreen({ d, next }) {
  const first = d.name ? d.name.split(' ')[0] : '';
  return (
    <View style={[s.shell, s.centeredScreen, { backgroundColor: C.bg }]}>
      <Text style={{ fontSize: 64, marginBottom: 18 }}>📐</Text>
      <Text style={[s.eyebrow, { textAlign: 'center' }]}>
        Halfway there{first ? `, ${first}` : ''}
      </Text>
      <Text style={[s.headline, { textAlign: 'center', marginTop: 8 }]}>Now, a few{'\n'}body basics</Text>
      <Text style={[s.subline, { textAlign: 'center', maxWidth: 280 }]}>
        These give us your real calorie target — the science bit. Quick, promise.
      </Text>
      <View style={[s.footer, { width: '100%' }]}>
        <PrimaryBtn label="I'm ready" onPress={next} />
      </View>
    </View>
  );
}

function HeightScreen(p) {
  const { d, set, next } = p;
  const inCm = d.unitH === 'cm';
  const rulerMin = inCm ? 130 : 48;
  const rulerMax = inCm ? 220 : 84;
  const rulerVal = inCm ? Math.round(d.heightCm) : Math.round(d.heightCm / 2.54);
  const ftDisplay = (() => {
    const totalIn = Math.round(d.heightCm / 2.54);
    return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″ · ${Math.round(d.heightCm)} cm`;
  })();
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
        <Text style={[s.headline, { flex: 1 }]}>How tall are you?</Text>
        <Seg
          options={[{ value: 'cm', label: 'cm' }, { value: 'ft', label: 'ft/in' }]}
          value={d.unitH}
          onChange={(v) => set('unitH', v)}
        />
      </View>
      <View style={{ paddingVertical: 32, paddingBottom: 30 }}>
        <RulerPicker
          min={rulerMin} max={rulerMax}
          value={rulerVal}
          unit={inCm ? 'cm' : 'in'}
          onChange={(v) => set('heightCm', inCm ? v : Math.round(v * 2.54))}
        />
        {!inCm && <Text style={s.rulerCaption}>{ftDisplay}</Text>}
      </View>
    </ScreenShell>
  );
}

function WeightScreen(p) {
  const { d, set, next } = p;
  const inKg = d.unitW === 'kg';
  const rulerMin = inKg ? 40 : 88;
  const rulerMax = inKg ? 170 : 375;
  const rulerVal = inKg ? Math.round(d.weightKg) : Math.round(d.weightKg * 2.2046);
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.headline}>What's your weight now?</Text>
          <Text style={s.subline}>Be honest — only you and your plan see this.</Text>
        </View>
        <Seg
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={d.unitW}
          onChange={(v) => set('unitW', v)}
        />
      </View>
      <View style={{ paddingVertical: 32, paddingBottom: 30 }}>
        <RulerPicker
          min={rulerMin} max={rulerMax}
          value={rulerVal}
          unit={inKg ? 'kg' : 'lb'}
          onChange={(v) => set('weightKg', inKg ? v : Math.round((v / 2.2046) * 10) / 10)}
        />
      </View>
    </ScreenShell>
  );
}

function TargetScreen(p) {
  const { d, set, next } = p;
  const inKg = d.unitW === 'kg';
  const rulerMin = inKg ? 40 : 88;
  const rulerMax = inKg ? 170 : 375;
  const rulerVal = inKg ? Math.round(d.targetKg) : Math.round(d.targetKg * 2.2046);
  const gap = d.weightKg - d.targetKg;
  const gapAbs = Math.round(Math.abs(gap) * 10) / 10;
  const gapAbsLb = Math.round(Math.abs(gap) * 2.2046);
  const gapShown = inKg ? `${gapAbs} kg` : `${gapAbsLb} lb`;
  const losing = gap > 0.5;
  const gaining = gap < -0.5;
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} />}>
      <View style={{ marginTop: 8 }}>
        <Text style={s.headline}>What's your goal weight?</Text>
        <Text style={s.subline}>Aim for a healthy, reachable number — we'll pace it.</Text>
      </View>
      <View style={{ paddingVertical: 32, paddingBottom: 30 }}>
        <RulerPicker
          min={rulerMin} max={rulerMax}
          value={rulerVal}
          unit={inKg ? 'kg' : 'lb'}
          accent={C.terra}
          onChange={(v) => set('targetKg', inKg ? v : Math.round((v / 2.2046) * 10) / 10)}
        />
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <View style={[s.gapPill, {
            backgroundColor: losing ? C.terraSoft : gaining ? C.primarySoft : C.sunken,
          }]}>
            <Text style={[s.gapPillTxt, {
              color: losing ? C.terra : gaining ? C.primary : C.ink500,
            }]}>
              {losing ? `${gapShown} to lose` : gaining ? `${gapShown} to gain` : 'Maintain your weight'}
            </Text>
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

function PaceScreen(p) {
  const { d, set, next } = p;
  const gap = Math.max(0, d.weightKg - d.targetKg);
  const opts = [
    { v: 'slow',       t: 'Slow & steady',  s: '~0.25 kg a week · easiest to stick with',     rate: 0.25, bars: 1 },
    { v: 'moderate',   t: 'Balanced',        s: '~0.5 kg a week · our recommendation',          rate: 0.5,  bars: 2 },
    { v: 'aggressive', t: 'All-in',          s: '~0.75 kg a week · fastest, needs discipline',  rate: 0.75, bars: 3 },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.pace} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>How fast do you want to go?</Text>
        <Text style={s.subline}>This sets your daily deficit. Change it whenever life shifts.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => {
          const on = d.pace === o.v;
          const wk = gap > 0 ? Math.max(1, Math.round(gap / o.rate)) : 0;
          return (
            <TouchableOpacity key={o.v} style={[s.paceCard, on && s.paceCardOn, i > 0 && { marginTop: 11 }]}
              onPress={() => set('pace', o.v)} activeOpacity={0.8}>
              <View style={[s.paceIcon, on && s.paceIconOn]}>
                {[1, 2, 3].map(level => (
                  <View key={level} style={{
                    width: 8, borderRadius: 3,
                    height: 8 + level * 8,
                    backgroundColor: level <= o.bars ? (on ? C.primary : C.ink700) : C.line2,
                  }} />
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.paceTitle}>{o.t}</Text>
                <Text style={s.paceSub}>{o.s}</Text>
                {wk > 0 ? (
                  <Text style={[s.paceWeeks, { color: on ? C.primary : C.ink400 }]}>
                    ≈ {wk} weeks to your goal
                  </Text>
                ) : null}
              </View>
              <View style={[s.optSel, on && s.optSelOn]}>
                {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.paceNote}>
        <Text style={s.paceNoteTxt}>
          Slower paces protect your energy and muscle. Most people thrive on{' '}
          <Text style={{ color: C.primary, fontWeight: '700' }}>Balanced</Text>.
        </Text>
      </View>
    </ScreenShell>
  );
}

function ActivityScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'sedentary', t: 'Mostly sitting',        s: 'Desk job, drive everywhere, little walking',     icon: 'laptop-outline' },
    { v: 'light',     t: 'Lightly active',         s: 'Some walking — to the market, around the office', icon: 'walk-outline' },
    { v: 'moderate',  t: 'On my feet a lot',        s: 'Trading, errands, carrying loads most days',     icon: 'bicycle-outline' },
    { v: 'active',    t: 'Very active',             s: 'Hard physical work or training 5–6× a week',     icon: 'barbell-outline' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.activity} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>How active is your day?</Text>
        <Text style={s.subline}>A normal day, not your best one. This sets your burn.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 11 }}>
            <OptionCard
              icon={<Ionicons name={o.icon} size={24} color={d.activity === o.v ? C.primary : C.ink700} />}
              title={o.t} subtitle={o.s}
              selected={d.activity === o.v} onPress={() => set('activity', o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function EatingScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'omad',  t: 'OMAD',          s: 'One meal a day',         icon: '🍽️' },
    { v: '2x',    t: 'Twice a day',   s: 'Two solid meals',        icon: '🍽️🍽️' },
    { v: '3x',    t: 'Three meals',   s: 'Breakfast, lunch, dinner', icon: '☀️🌤️🌙' },
    { v: '4x',    t: 'Small & often', s: 'Four-ish small meals',   icon: '🕐' },
    { v: 'flex',  t: 'Flexible',      s: 'It changes day to day',  icon: '↕️' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.eatingStyle} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>How do you like to eat?</Text>
        <Text style={s.subline}>We'll time your reminders around it.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 10 }}>
            <OptionCard compact
              icon={<Text style={{ fontSize: 20 }}>{o.icon}</Text>}
              title={o.t} subtitle={o.s}
              selected={d.eatingStyle === o.v} onPress={() => set('eatingStyle', o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function FoodScreen(p) {
  const { d, set, next } = p;
  const where = [
    { v: 'home', t: 'Mostly home-cooked',        icon: '🏠' },
    { v: 'out',  t: 'Mostly bought / eating out', icon: '🍴' },
    { v: 'mix',  t: 'A mix of both',              icon: '🔄' },
  ];
  const cuisines = ['Nigerian', 'Ghanaian', 'Kenyan', 'Swahili', 'Ethiopian', 'Senegalese', 'Continental', 'Fast food'];
  const toggleC = (c) => {
    const has = d.cuisines.includes(c);
    set('cuisines', has ? d.cuisines.filter(x => x !== c) : [...d.cuisines, c]);
  };
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Continue" onPress={next} disabled={!d.foodContext} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>Where does your food come from?</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {where.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 10 }}>
            <OptionCard compact
              icon={<Text style={{ fontSize: 22 }}>{o.icon}</Text>}
              title={o.t} selected={d.foodContext === o.v} onPress={() => set('foodContext', o.v)}
            />
          </View>
        ))}
      </View>
      <View style={{ marginTop: 20 }}>
        <Text style={s.sectionLabel}>
          Cuisines you eat most{' '}
          <Text style={{ fontWeight: '500', textTransform: 'none', letterSpacing: 0 }}>· optional</Text>
        </Text>
        <View style={s.chipsWrap}>
          {cuisines.map(c => (
            <Chip key={c} label={c} selected={d.cuisines.includes(c)} onPress={() => toggleC(c)} />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

function WhyScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'wedding',    t: 'A big event',           s: 'Wedding, shoot, reunion',         icon: '💍' },
    { v: 'health',     t: 'A health wake-up call',  s: 'I want to get ahead of it',       icon: '❤️' },
    { v: 'confident',  t: 'To feel confident again', s: 'In my clothes, in my skin',       icon: '✨' },
    { v: 'doctor',     t: "Doctor's advice",         s: 'Following medical guidance',      icon: '🩺' },
    { v: 'curious',    t: 'Just curious',            s: 'Seeing what I can do',            icon: '🔍' },
  ];
  const list = d.whys || [];
  const toggle = (v) => set('whys', list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <ScreenShell {...p} footer={
      <>
        <PrimaryBtn label="Continue" onPress={next} disabled={list.length === 0} />
        <TextBtn label="Skip" onPress={next} />
      </>
    }>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>What's your deeper why?</Text>
        <Text style={s.subline}>Pick all that move you — on tough days, we'll remind you.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 10 }}>
            <OptionCard compact multi
              icon={<Text style={{ fontSize: 22 }}>{o.icon}</Text>}
              title={o.t} subtitle={o.s}
              selected={list.includes(o.v)} onPress={() => toggle(o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function AccountabilityScreen(p) {
  const { d, set, next } = p;
  const opts = [
    { v: 'gentle', t: 'Gentle nudges',   s: 'Kind, encouraging check-ins',            icon: 'heart-outline' },
    { v: 'firm',   t: 'Firm reminders',  s: "Keep me honest — don't let me slack",     icon: 'megaphone-outline' },
    { v: 'alone',  t: 'Leave me alone',  s: "I'll come to the app myself",             icon: 'moon-outline' },
  ];
  return (
    <ScreenShell {...p} footer={<PrimaryBtn label="Lock it in" onPress={next} disabled={!d.accountability} />}>
      <View style={{ marginTop: 32 }}>
        <Text style={s.headline}>How should we keep you on track?</Text>
        <Text style={s.subline}>You can change this anytime in settings.</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {opts.map((o, i) => (
          <View key={o.v} style={i > 0 && { marginTop: 11 }}>
            <OptionCard
              icon={<Ionicons name={o.icon} size={24} color={d.accountability === o.v ? C.primary : C.ink700} />}
              title={o.t} subtitle={o.s}
              selected={d.accountability === o.v} onPress={() => set('accountability', o.v)}
            />
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function BuildingScreen({ d, next }) {
  const spin = useRef(new Animated.Value(0)).current;
  const msgs = [
    'Crunching your numbers…',
    'Calibrating local food portions…',
    'Setting your daily target…',
    'Almost ready…',
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const first = d.name ? d.name.split(' ')[0] : 'your';

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
    const t1 = setInterval(() => setMsgIdx(x => Math.min(x + 1, msgs.length - 1)), 700);
    const t2 = setTimeout(() => { clearInterval(t1); next(); }, 3100);
    return () => { clearInterval(t1); clearTimeout(t2); };
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[s.shell, s.centeredScreen, { backgroundColor: C.bg }]}>
      <View style={s.buildingSpinnerWrap}>
        <View style={s.buildingTrack} />
        <Animated.View style={[s.buildingArc, { transform: [{ rotate }] }]} />
        <View style={s.buildingLogoWrap}>
          <Ionicons name="leaf" size={28} color={C.primary} />
        </View>
      </View>
      <Text style={s.buildingTitle}>Building {first}'s plan</Text>
      <Text key={msgIdx} style={s.buildingMsg}>{msgs[msgIdx]}</Text>
    </View>
  );
}

function DoneScreen({ d, onComplete }) {
  const plan = calcPlan(d);
  const first = d.name ? d.name.split(' ')[0] : 'friend';

  const handleFinish = () => {
    onComplete({
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
      accountability: d.accountability,
    });
  };

  return (
    <ScrollView
      style={[s.shell, { backgroundColor: C.bg }]}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 64 : 48, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Check icon */}
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View style={s.doneCheck}>
          <Ionicons name="checkmark" size={38} color="#fff" />
        </View>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 22 }}>
        <Text style={[s.eyebrow, { textAlign: 'center' }]}>You're all set, {first}!</Text>
        <Text style={[s.headline, { textAlign: 'center', marginTop: 8 }]}>Here's your daily target</Text>
      </View>

      {/* Calorie hero card */}
      <View style={s.calCard}>
        <Text style={s.calLabel}>Eat around</Text>
        <Text style={s.calNumber}>{plan.target.toLocaleString()}</Text>
        <Text style={s.calUnit}>calories a day</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <View style={s.calPill}>
            <Text style={s.calPillLabel}>Maintenance</Text>
            <Text style={s.calPillVal}>{plan.tdee.toLocaleString()} kcal</Text>
          </View>
          {plan.deficit > 0 ? (
            <View style={[s.calPill, { backgroundColor: C.terraSoft }]}>
              <Text style={s.calPillLabel}>Daily deficit</Text>
              <Text style={[s.calPillVal, { color: C.terra }]}>−{plan.deficit}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', gap: 11, marginTop: 11 }}>
        <View style={s.statCard}>
          <Ionicons name="nutrition-outline" size={24} color={C.ink700} />
          <View style={{ marginLeft: 10 }}>
            <Text style={s.statLabel}>Protein / day</Text>
            <Text style={s.statVal}>{plan.protein} g</Text>
          </View>
        </View>
        <View style={s.statCard}>
          <Ionicons name="water-outline" size={24} color={C.ink700} />
          <View style={{ marginLeft: 10 }}>
            <Text style={s.statLabel}>Water / day</Text>
            <Text style={s.statVal}>{plan.water} L</Text>
          </View>
        </View>
      </View>

      {/* Projection */}
      {plan.weeks > 0 ? (
        <View style={s.projCard}>
          <Ionicons name="trending-down-outline" size={28} color={C.primary} />
          <Text style={[s.projTxt, { marginLeft: 12 }]}>
            On track to reach{' '}
            <Text style={{ color: C.primary, fontWeight: '700' }}>{Math.round(d.targetKg)} kg</Text>
            {' '}in about{' '}
            <Text style={{ color: C.primary, fontWeight: '700' }}>{plan.weeks} weeks</Text>
            {' '}— eating the food you love.
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 28 }}>
        <PrimaryBtn label="Create my account →" onPress={handleFinish} />
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export default function PreAuthOnboarding({ initialData, onComplete, onLogin }) {
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState({ ...DEFAULT_DATA, ...(initialData || {}) });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const next = () => setIdx(i => Math.min(i + 1, FLOW.length - 1));
  const back = () => setIdx(i => Math.max(i - 1, 0));

  const screen = FLOW[idx];
  const isFull = FULL_BLEED.has(screen);
  const stepNum = FLOW.slice(0, idx + 1).filter(id => !FULL_BLEED.has(id)).length;

  const sharedProps = {
    d: data, set, next, back,
    step: stepNum, total: COUNTED,
    onBack: back, showBack: idx > 0 && !isFull,
    hideProgress: isFull,
  };

  switch (screen) {
    case 'hook':           return <HookScreen next={next} onLogin={onLogin} />;
    case 'goal':           return <GoalScreen {...sharedProps} />;
    case 'demo':           return <DemoScreen {...sharedProps} />;
    case 'struggle':       return <StruggleScreen {...sharedProps} />;
    case 'name':           return <NameScreen {...sharedProps} />;
    case 'country':        return <CountryScreen {...sharedProps} />;
    case 'gender':         return <GenderScreen {...sharedProps} />;
    case 'age':            return <AgeScreen {...sharedProps} />;
    case 'bodyIntro':      return <BodyIntroScreen d={data} next={next} />;
    case 'height':         return <HeightScreen {...sharedProps} />;
    case 'weight':         return <WeightScreen {...sharedProps} />;
    case 'target':         return <TargetScreen {...sharedProps} />;
    case 'pace':           return <PaceScreen {...sharedProps} />;
    case 'activity':       return <ActivityScreen {...sharedProps} />;
    case 'eating':         return <EatingScreen {...sharedProps} />;
    case 'food':           return <FoodScreen {...sharedProps} />;
    case 'why':            return <WhyScreen {...sharedProps} />;
    case 'accountability': return <AccountabilityScreen {...sharedProps} />;
    case 'building':       return <BuildingScreen d={data} next={next} />;
    case 'done':           return <DoneScreen d={data} onComplete={onComplete} />;
    default:               return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bg },
  shellContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24 },
  centeredScreen: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },

  // Progress
  progressWrap: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 22, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.sunken,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  progressTrack: {
    flex: 1, height: 7, borderRadius: 999,
    backgroundColor: C.sunken, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: C.primary },
  progressCount: {
    fontSize: 12, fontWeight: '700', color: C.ink400,
    minWidth: 34, textAlign: 'right', marginLeft: 12,
  },

  // Footer
  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 36 : 24, backgroundColor: C.bg },

  // Typography
  eyebrow: {
    fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 2, color: C.primary, marginBottom: 6,
  },
  headline: { fontSize: 27, fontWeight: '800', color: C.ink, lineHeight: 33, letterSpacing: -0.5 },
  subline:  { fontSize: 15, fontWeight: '500', color: C.ink500, lineHeight: 22, marginTop: 8 },

  // Buttons
  primaryBtn: {
    width: '100%', height: 56, borderRadius: 999,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  primaryBtnDis: { backgroundColor: '#cfd6d1', shadowOpacity: 0, elevation: 0 },
  primaryBtnTxt: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  primaryBtnTxtDis: { color: 'rgba(255,255,255,0.55)' },
  textBtn: { width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnTxt: { fontSize: 15, fontWeight: '600', color: C.ink400 },

  // Segmented control
  seg: { flexDirection: 'row', backgroundColor: C.sunken, borderRadius: 999, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  segBtnOn: {
    backgroundColor: C.surface,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  segBtnTxt: { fontSize: 13, fontWeight: '700', color: C.ink400 },
  segBtnTxtOn: { color: C.ink },

  // Option card
  optCard: {
    flexDirection: 'row', alignItems: 'center', padding: 15,
    borderRadius: 16, backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  optCardSel: { backgroundColor: C.primarySoft, borderColor: C.primary },
  optCardCompact: { padding: 13 },
  optIconWrap: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: C.sunken, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  optIconWrapSel: { backgroundColor: '#fff' },
  optText: { flex: 1 },
  optTitle: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
  optSub: { fontSize: 13, fontWeight: '500', color: C.ink500, marginTop: 2 },
  optSel: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: C.line2,
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  optSelOn: { backgroundColor: C.primary, borderColor: C.primary },
  optSelMulti: { borderRadius: 7 },

  // Chip
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line,
  },
  chipSel: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: C.ink700 },
  chipTextSel: { color: '#fff' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 2, color: C.ink400,
  },

  // Ruler picker
  rulerVal: { fontSize: 60, fontWeight: '800', color: C.ink, lineHeight: 70, letterSpacing: -2 },
  rulerUnit: { fontSize: 20, fontWeight: '700', color: C.ink400, marginTop: 4 },
  rulerCursorWrap: { position: 'absolute', top: 0, alignItems: 'center', zIndex: 3 },
  rulerArrow: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  rulerLine: { width: 3, height: 46, borderRadius: 3 },
  rulerCaption: { textAlign: 'center', marginTop: 8, fontSize: 14, fontWeight: '600', color: C.ink400 },

  // Hook screen
  hookBrand: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  hookLogo: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  hookBrandTxt: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  hookHero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hookHeroCircle: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: C.green50, opacity: 0.8,
  },
  hookIllo: { alignItems: 'center', zIndex: 1 },
  hookIlloEmoji: { fontSize: 300 },
  hookIlloSub: { fontSize: 13, color: C.ink400, fontWeight: '600', marginTop: 10, letterSpacing: 0.5 },
  hookStatement: { paddingHorizontal: 28, paddingBottom: 8, alignItems: 'center' },
  hookHeadline: {
    fontSize: 32, fontWeight: '800', color: C.ink, lineHeight: 38,
    letterSpacing: -0.8, textAlign: 'center', marginBottom: 12,
  },
  hookSubline: { fontSize: 15.5, fontWeight: '500', color: C.ink500, lineHeight: 22, textAlign: 'center' },
  hookCta: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 16 },
  hookNotice: { textAlign: 'center', marginTop: 12, fontSize: 13, color: C.ink400, fontWeight: '600' },
  hookLoginBtn: { alignItems: 'center', marginTop: 18, paddingVertical: 6 },
  hookLoginTxt: { fontSize: 14, fontWeight: '600', color: C.ink },

  // Demo screen
  demoBracket: {
    position: 'absolute', width: 28, height: 28,
    borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderRadius: 4,
  },
  demoShutter: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  demoShutterInner: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: '#fff',
  },
  demoSkip: { alignItems: 'center', paddingVertical: 18 },
  demoSkipTxt: { fontSize: 14, fontWeight: '600', color: C.ink400 },

  // Name screen
  nameInputWrap: { marginTop: 30, borderBottomWidth: 2.5, borderBottomColor: C.primary, paddingBottom: 8 },
  nameInput: { fontSize: 26, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },
  nameMascotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 16, paddingTop: 24 },
  mascotFace: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.sunken, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  mascotFaceHappy: { backgroundColor: C.primarySoft },
  nameGreet: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  nameGreetTxt: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Target gap pill
  gapPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  gapPillTxt: { fontSize: 14.5, fontWeight: '700' },

  // Pace screen
  paceCard: {
    flexDirection: 'row', alignItems: 'center', padding: 15,
    borderRadius: 16, backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.line,
  },
  paceCardOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  paceIcon: {
    width: 46, height: 46, borderRadius: 13, backgroundColor: C.sunken,
    alignItems: 'flex-end', justifyContent: 'center',
    flexDirection: 'row', paddingBottom: 6, paddingHorizontal: 6,
    marginRight: 14,
  },
  paceIconOn: { backgroundColor: '#fff' },
  paceTitle: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
  paceSub: { fontSize: 13, fontWeight: '500', color: C.ink500, marginTop: 2 },
  paceWeeks: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  paceNote: { marginTop: 16, padding: 14, backgroundColor: C.green50, borderRadius: 16 },
  paceNoteTxt: { fontSize: 13, color: C.ink700, fontWeight: '500', lineHeight: 20 },

  // Building screen
  buildingSpinnerWrap: {
    width: 96, height: 96, marginBottom: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  buildingTrack: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    borderWidth: 5, borderColor: C.green50,
  },
  buildingArc: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    borderWidth: 5, borderColor: 'transparent', borderTopColor: C.primary,
  },
  buildingLogoWrap: { position: 'absolute' },
  buildingTitle: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 10 },
  buildingMsg: { fontSize: 15, fontWeight: '500', color: C.ink500, textAlign: 'center' },

  // Done screen
  doneCheck: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  calCard: {
    backgroundColor: C.surface, borderRadius: 22,
    borderWidth: 1.5, borderColor: C.line, padding: 26, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  calLabel: { fontSize: 13, fontWeight: '700', color: C.ink400, textTransform: 'uppercase', letterSpacing: 2 },
  calNumber: { fontSize: 66, fontWeight: '800', color: C.primary, lineHeight: 74, letterSpacing: -2 },
  calUnit: { fontSize: 15, fontWeight: '700', color: C.ink700 },
  calPill: {
    backgroundColor: C.sunken, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7, alignItems: 'center',
  },
  calPillLabel: { fontSize: 10.5, fontWeight: '700', color: C.ink400, textTransform: 'uppercase', letterSpacing: 1 },
  calPillVal: { fontSize: 14, fontWeight: '800', color: C.ink700 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1.5, borderColor: C.line, padding: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  statLabel: { fontSize: 11.5, fontWeight: '700', color: C.ink400 },
  statVal: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 2 },
  projCard: {
    marginTop: 11, backgroundColor: C.green50, borderRadius: 18,
    padding: 16, flexDirection: 'row', alignItems: 'center',
  },
  projTxt: { flex: 1, fontSize: 14, color: C.ink700, fontWeight: '500', lineHeight: 20 },
});
