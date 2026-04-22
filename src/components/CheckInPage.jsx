import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, TextInput, StyleSheet, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScoreSlider = ({ value, onChange, lowLabel, highLabel }) => (
  <View>
    <View style={ss.scoreRow}>
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <TouchableOpacity
          key={n}
          style={[ss.scoreBtn, value === n && ss.scoreBtnSelected]}
          onPress={() => onChange(n)}
        >
          <Text style={[ss.scoreBtnText, value === n && ss.scoreBtnTextSelected]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {(lowLabel || highLabel) && (
      <View style={ss.scoreLabelRow}>
        <Text style={ss.scoreLabel}>{lowLabel}</Text>
        <Text style={ss.scoreLabel}>{highLabel}</Text>
      </View>
    )}
  </View>
);

const Chips = ({ options, selected, onToggle, maxSelect = null, singleSelect = false }) => (
  <View style={ss.chipsContainer}>
    {options.map(opt => {
      const isSelected = singleSelect ? selected === opt : (selected || []).includes(opt);
      const disabled = !isSelected && maxSelect != null && (selected || []).length >= maxSelect;
      return (
        <Pressable
          key={opt}
          style={[ss.chip, isSelected && ss.chipSelected, disabled && ss.chipDisabled]}
          onPress={() => !disabled && onToggle(opt)}
        >
          <Text style={[ss.chipText, isSelected && ss.chipTextSelected]}>{opt}</Text>
        </Pressable>
      );
    })}
  </View>
);

const SectionCard = ({ title, subtitle, children }) => (
  <View style={ss.section}>
    <Text style={ss.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={ss.sectionSubtitle}>{subtitle}</Text> : null}
    {children}
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CheckInPage = ({
  show, onClose, onSave,
  waterCount, setWaterCount,
  notes, setNotes,
  volumeUnit, setVolumeUnit,
  onViewWaterLogs,
  initialData,
}) => {
  const [checkInDate, setCheckInDate] = useState(new Date());
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [waterEntries, setWaterEntries] = useState([]);

  // ── Section 1: Overall Wellbeing ─────────────────────────────────────────
  const [wellbeingScore, setWellbeingScore] = useState(null);

  // ── Section 2: Emotional State ───────────────────────────────────────────
  const [emotionalMoods, setEmotionalMoods] = useState([]);

  // ── Section 3: Fasting Status ────────────────────────────────────────────
  const [fastingStatus, setFastingStatus] = useState(null);
  const [fastingDuration, setFastingDuration] = useState(null);
  const [planningToBreak, setPlanningToBreak] = useState(null);

  // ── Section 4: Hunger & Appetite ─────────────────────────────────────────
  const [hungerScore, setHungerScore] = useState(null);
  const [hungerTypes, setHungerTypes] = useState([]);
  const [hasCravings, setHasCravings] = useState(null);
  const [cravingTypes, setCravingTypes] = useState([]);

  // ── Section 5: Fasting Symptoms ──────────────────────────────────────────
  const [fastingSymptoms, setFastingSymptoms] = useState([]);
  const [symptomSeverity, setSymptomSeverity] = useState(null);

  // ── Section 6: Breaking the Fast ─────────────────────────────────────────
  const [fastBreakTime, setFastBreakTime] = useState('');
  const [fastBreakFoods, setFastBreakFoods] = useState([]);
  const [fastBreakIntentionality, setFastBreakIntentionality] = useState(null);
  const [physicalAfterEating, setPhysicalAfterEating] = useState([]);
  const [emotionalAfterEating, setEmotionalAfterEating] = useState([]);

  // ── Section 7: Energy ────────────────────────────────────────────────────
  const [energyScore, setEnergyScore] = useState(null);
  const [energyChange, setEnergyChange] = useState(null);

  // ── Section 8: Physical Activity ─────────────────────────────────────────
  const [exercisedToday, setExercisedToday] = useState(null);
  const [exerciseTypes, setExerciseTypes] = useState([]);
  const [exerciseDuration, setExerciseDuration] = useState(null);
  const [exerciseIntensity, setExerciseIntensity] = useState(null);
  const [exercisedWhileFasting, setExercisedWhileFasting] = useState(null);
  const [bodyFeelDuringExercise, setBodyFeelDuringExercise] = useState([]);

  // ── Section 9: Sleep ─────────────────────────────────────────────────────
  const [sleepHours, setSleepHours] = useState(null);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [wakeUpFeeling, setWakeUpFeeling] = useState(null);

  // ── Section 11: Stress & Mental Load ─────────────────────────────────────
  const [stressScore, setStressScore] = useState(null);
  const [stressContributors, setStressContributors] = useState([]);
  const [focusLevel, setFocusLevel] = useState(null);

  // ── Section 12: Context ──────────────────────────────────────────────────
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [typicalDay, setTypicalDay] = useState(null);

  // ── Section 13: Daily Goal Check ─────────────────────────────────────────
  const [fastingGoalMet, setFastingGoalMet] = useState(null);
  const [tomorrowConfidence, setTomorrowConfidence] = useState(null);

  // Pre-populate from existing check-in when opened
  useEffect(() => {
    if (show && initialData) {
      setWellbeingScore(initialData.wellbeingScore ?? null);
      setEmotionalMoods(initialData.emotionalMoods ?? []);
      setFastingStatus(initialData.fastingStatus ?? null);
      setFastingDuration(initialData.fastingDuration ?? null);
      setPlanningToBreak(initialData.planningToBreak ?? null);
      setHungerScore(initialData.hungerScore ?? null);
      setHungerTypes(initialData.hungerTypes ?? []);
      setHasCravings(initialData.hasCravings ?? null);
      setCravingTypes(initialData.cravingTypes ?? []);
      setFastingSymptoms(initialData.fastingSymptoms ?? []);
      setSymptomSeverity(initialData.symptomSeverity ?? null);
      setFastBreakTime(initialData.fastBreakTime ?? '');
      setFastBreakFoods(initialData.fastBreakFoods ?? []);
      setFastBreakIntentionality(initialData.fastBreakIntentionality ?? null);
      setPhysicalAfterEating(initialData.physicalAfterEating ?? []);
      setEmotionalAfterEating(initialData.emotionalAfterEating ?? []);
      setEnergyScore(initialData.energyScore ?? null);
      setEnergyChange(initialData.energyChange ?? null);
      setExercisedToday(initialData.exercisedToday ?? null);
      setExerciseTypes(initialData.exerciseTypes ?? []);
      setExerciseDuration(initialData.exerciseDuration ?? null);
      setExerciseIntensity(initialData.exerciseIntensity ?? null);
      setExercisedWhileFasting(initialData.exercisedWhileFasting ?? null);
      setBodyFeelDuringExercise(initialData.bodyFeelDuringExercise ?? []);
      setSleepHours(initialData.sleepHours ?? null);
      setSleepQuality(initialData.sleepQuality ?? null);
      setWakeUpFeeling(initialData.wakeUpFeeling ?? null);
      setStressScore(initialData.stressScore ?? null);
      setStressContributors(initialData.stressContributors ?? []);
      setFocusLevel(initialData.focusLevel ?? null);
      setCurrentLocation(initialData.currentLocation ?? null);
      setCurrentCompany(initialData.currentCompany ?? null);
      setTypicalDay(initialData.typicalDay ?? null);
      setFastingGoalMet(initialData.fastingGoalMet ?? null);
      setTomorrowConfidence(initialData.tomorrowConfidence ?? null);
    }
  }, [show]);

  const isToday = checkInDate.toDateString() === new Date().toDateString();
  const formatCheckInDate = () => checkInDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const toggle = (val, arr, setArr) => setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const isFasting = fastingStatus === '⏳ Currently fasting';
  const fastBroken = fastingStatus === '🍽️ I broke my fast today';

  const handleSave = () => {
    const v2 = {
      wellbeingScore, emotionalMoods,
      fastingStatus, fastingDuration, planningToBreak,
      hungerScore, hungerTypes, hasCravings, cravingTypes,
      fastingSymptoms, symptomSeverity,
      fastBreakTime, fastBreakFoods, fastBreakIntentionality, physicalAfterEating, emotionalAfterEating,
      energyScore, energyChange,
      exercisedToday, exerciseTypes, exerciseDuration, exerciseIntensity, exercisedWhileFasting, bodyFeelDuringExercise,
      sleepHours, sleepQuality, wakeUpFeeling,
      stressScore, stressContributors, focusLevel,
      currentLocation, currentCompany, typicalDay,
      fastingGoalMet, tomorrowConfidence,
      waterCount, notes,
    };
    // Legacy field mappings for backward compat
    const legacy = {
      feelings: emotionalMoods.slice(0, 4),
      fastingStatus: fastingStatus || '',
      hungerLevel: hungerScore ? `${hungerScore}/10` : '',
      moods: emotionalMoods,
      symptoms: fastingSymptoms,
      fastBreak: fastBreakFoods,
      activities: exerciseTypes,
      otherFactors: stressContributors,
    };
    onSave?.({ ...legacy, ...v2 });
  };

  return (
    <Modal visible={show} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={ss.overlay}>
        <View style={ss.page}>

          {/* Header */}
          <View style={ss.header}>
            <TouchableOpacity style={ss.navBtn} onPress={() => {
              const prev = new Date(checkInDate); prev.setDate(prev.getDate() - 1); setCheckInDate(prev);
            }}>
              <Ionicons name="chevron-back" size={22} color="#059669" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={ss.headerDate}>{formatCheckInDate()}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ss.navBtn, isToday && { opacity: 0.3 }]}
              onPress={() => {
                if (!isToday) {
                  const next = new Date(checkInDate); next.setDate(next.getDate() + 1);
                  if (next <= new Date()) setCheckInDate(next);
                }
              }}
              disabled={isToday}
            >
              <Ionicons name="chevron-forward" size={22} color="#059669" />
            </TouchableOpacity>
          </View>

          <ScrollView style={ss.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>

            {/* ── Section 1: Overall Wellbeing ─────────────────────────── */}
            <SectionCard title="🌡️ Overall Wellbeing" subtitle="How are you feeling overall right now?">
              <ScoreSlider value={wellbeingScore} onChange={setWellbeingScore} lowLabel="1 Terrible" highLabel="10 Amazing" />
            </SectionCard>

            {/* ── Section 2: Emotional State ───────────────────────────── */}
            <SectionCard title="💭 Emotional State" subtitle="Which of these best describes your mood? Pick all that apply.">
              <Text style={ss.groupLabel}>Positive</Text>
              <Chips
                options={['😌 Calm','😊 Happy','💪 Motivated','🙏 Grateful','🎯 Focused','⚡ Energized','😇 Content','🌟 Hopeful','🏆 Proud']}
                selected={emotionalMoods}
                onToggle={v => toggle(v, emotionalMoods, setEmotionalMoods)}
              />
              <Text style={[ss.groupLabel, { marginTop: 10 }]}>Negative</Text>
              <Chips
                options={['😰 Anxious','😤 Irritable','😢 Sad','😴 Tired','😩 Overwhelmed','😓 Stressed','😑 Unmotivated','😞 Lonely','😖 Frustrated','😶 Numb']}
                selected={emotionalMoods}
                onToggle={v => toggle(v, emotionalMoods, setEmotionalMoods)}
              />
              <Text style={[ss.groupLabel, { marginTop: 10 }]}>Neutral</Text>
              <Chips
                options={['😐 Indifferent','😵 Distracted','🌀 Restless']}
                selected={emotionalMoods}
                onToggle={v => toggle(v, emotionalMoods, setEmotionalMoods)}
              />
            </SectionCard>

            {/* ── Section 3: Fasting Status ─────────────────────────────── */}
            <SectionCard title="⏱️ Fasting Status" subtitle="What is your fasting status right now?">
              <Chips
                options={['⏳ Currently fasting','🍽️ I broke my fast today','❌ I did not fast today','🌙 Fasting window hasn\'t started yet']}
                selected={fastingStatus}
                onToggle={setFastingStatus}
                singleSelect
              />
              {isFasting && (
                <>
                  <Text style={ss.followUpLabel}>How long have you been fasting?</Text>
                  <Chips
                    options={['Under 4 hrs','4–8 hrs','8–12 hrs','12–16 hrs','16–20 hrs','20+ hrs']}
                    selected={fastingDuration}
                    onToggle={setFastingDuration}
                    singleSelect
                  />
                  <Text style={ss.followUpLabel}>Are you planning to break your fast today?</Text>
                  <Chips
                    options={['✅ Yes','❌ No','🤔 Not sure']}
                    selected={planningToBreak}
                    onToggle={setPlanningToBreak}
                    singleSelect
                  />
                </>
              )}
            </SectionCard>

            {/* ── Section 4: Hunger & Appetite ─────────────────────────── */}
            <SectionCard title="🍽️ Hunger & Appetite" subtitle="How hungry are you right now?">
              <ScoreSlider value={hungerScore} onChange={setHungerScore} lowLabel="1 Not hungry" highLabel="10 Unbearably hungry" />
              <Text style={ss.followUpLabel}>What kind of hunger are you feeling?</Text>
              <Chips
                options={['🫃 Physical stomach hunger','🧠 Head hunger (craving, not physical)','💔 Emotional hunger','😴 Boredom hunger','🤷 Not sure']}
                selected={hungerTypes}
                onToggle={v => toggle(v, hungerTypes, setHungerTypes)}
              />
              <Text style={ss.followUpLabel}>Are you experiencing any cravings?</Text>
              <Chips
                options={['✅ Yes','❌ No']}
                selected={hasCravings}
                onToggle={setHasCravings}
                singleSelect
              />
              {hasCravings === '✅ Yes' && (
                <>
                  <Text style={ss.followUpLabel}>What are you craving?</Text>
                  <Chips
                    options={['🍬 Sweet','🧂 Salty','🥩 Savory','🍟 Fried','🍞 Starchy/Carbs','🍎 Fruits','🥩 Meat','🧀 Dairy','🧊 Something cold','☕ Something warm','🤷 Nothing specific']}
                    selected={cravingTypes}
                    onToggle={v => toggle(v, cravingTypes, setCravingTypes)}
                  />
                </>
              )}
            </SectionCard>

            {/* ── Section 5: Fasting Symptoms (show if fasting) ────────── */}
            {isFasting && (
              <SectionCard title="🩺 Fasting Symptoms" subtitle="Are you experiencing any of the following?">
                <Text style={ss.groupLabel}>Physical</Text>
                <Chips
                  options={['🤕 Headache','😵 Dizziness','🤢 Nausea','😴 Fatigue','💪 Muscle weakness','😣 Stomach cramping','🫃 Bloating','💓 Heart palpitations','🥶 Feeling cold','👄 Dry mouth']}
                  selected={fastingSymptoms}
                  onToggle={v => toggle(v, fastingSymptoms, setFastingSymptoms)}
                />
                <Text style={[ss.groupLabel, { marginTop: 10 }]}>Cognitive</Text>
                <Chips
                  options={['🌫️ Brain fog','🤔 Difficulty concentrating','😶 Forgetfulness','🐢 Slow thinking']}
                  selected={fastingSymptoms}
                  onToggle={v => toggle(v, fastingSymptoms, setFastingSymptoms)}
                />
                <Text style={[ss.groupLabel, { marginTop: 10 }]}>Mood-related</Text>
                <Chips
                  options={['😤 Irritability','🎭 Mood swings','😰 Anxiety','😑 Low motivation']}
                  selected={fastingSymptoms}
                  onToggle={v => toggle(v, fastingSymptoms, setFastingSymptoms)}
                />
                <Text style={[ss.groupLabel, { marginTop: 10 }]}>Positive</Text>
                <Chips
                  options={['✨ Mental clarity','🪶 Feeling light','🎯 Improved focus','💪 Sense of control','✅ No symptoms']}
                  selected={fastingSymptoms}
                  onToggle={v => toggle(v, fastingSymptoms, setFastingSymptoms)}
                />
                <Text style={ss.followUpLabel}>How severe are your symptoms overall?</Text>
                <Chips
                  options={['🟢 None','🟡 Mild','🟠 Moderate','🔴 Severe']}
                  selected={symptomSeverity}
                  onToggle={setSymptomSeverity}
                  singleSelect
                />
              </SectionCard>
            )}

            {/* ── Section 6: Breaking the Fast (show if fast broken) ────── */}
            {fastBroken && (
              <SectionCard title="🍴 Breaking the Fast">
                <Text style={ss.followUpLabel}>What time did you break your fast?</Text>
                <TextInput
                  style={ss.timeInput}
                  placeholder="e.g. 12:30 PM"
                  placeholderTextColor="#9CA3AF"
                  value={fastBreakTime}
                  onChangeText={setFastBreakTime}
                />
                <Text style={ss.followUpLabel}>How did you break your fast?</Text>
                <Chips
                  options={['💧 Water / plain fluids','☕ Coffee or tea (no additives)','🧋 Coffee or tea (with milk/sugar)','🍎 Fresh fruit','🥤 Smoothie or juice','🥗 Light snack','🍛 Small meal','🍽️ Full meal','📦 Processed/packaged food','😩 I overate']}
                  selected={fastBreakFoods}
                  onToggle={v => toggle(v, fastBreakFoods, setFastBreakFoods)}
                />
                <Text style={ss.followUpLabel}>How intentional was your fast-breaking?</Text>
                <Chips
                  options={['🎯 Very intentional — I planned it','🤔 Somewhat intentional','😬 Impulsive — I gave in to a craving','🙈 I had no choice (social/work situation)']}
                  selected={fastBreakIntentionality}
                  onToggle={setFastBreakIntentionality}
                  singleSelect
                />
                <Text style={ss.followUpLabel}>How do you feel physically after eating?</Text>
                <Chips
                  options={['⚡ Energized','😊 Satisfied','😐 Neutral','🫃 Bloated','🤢 Nauseous','😴 Sluggish','🤢 Overfull','🍽️ Still hungry','😔 Guilty','😞 Regretful']}
                  selected={physicalAfterEating}
                  onToggle={v => toggle(v, physicalAfterEating, setPhysicalAfterEating)}
                />
                <Text style={ss.followUpLabel}>How do you feel emotionally after eating?</Text>
                <Chips
                  options={['🏆 Proud','😐 Neutral','😞 Disappointed','😌 Relieved','😔 Guilty','😊 Happy','🤷 Indifferent']}
                  selected={emotionalAfterEating}
                  onToggle={v => toggle(v, emotionalAfterEating, setEmotionalAfterEating)}
                />
              </SectionCard>
            )}

            {/* ── Section 7: Energy Level ───────────────────────────────── */}
            <SectionCard title="⚡ Energy Level" subtitle="What is your energy level right now?">
              <ScoreSlider value={energyScore} onChange={setEnergyScore} lowLabel="1 Completely drained" highLabel="10 Extremely energetic" />
              <Text style={ss.followUpLabel}>How has your energy changed compared to earlier today?</Text>
              <Chips
                options={['⬆️ Much better','↗️ Slightly better','➡️ About the same','↘️ Slightly worse','⬇️ Much worse','🌅 This is my first check-in today']}
                selected={energyChange}
                onToggle={setEnergyChange}
                singleSelect
              />
            </SectionCard>

            {/* ── Section 8: Physical Activity ─────────────────────────── */}
            <SectionCard title="🏃 Physical Activity" subtitle="Have you exercised today?">
              <Chips
                options={['✅ Yes','❌ No','⏳ Planning to later']}
                selected={exercisedToday}
                onToggle={setExercisedToday}
                singleSelect
              />
              {exercisedToday === '✅ Yes' && (
                <>
                  <Text style={ss.followUpLabel}>What type of activity?</Text>
                  <Chips
                    options={['🚶 Walking','🏃 Running','🏋️ Strength training','🧘 Yoga / stretching','🚴 Cycling','💥 HIIT','💃 Dance','🏊 Swimming','⚽ Sports','🧹 Housework / manual tasks','🔲 Other']}
                    selected={exerciseTypes}
                    onToggle={v => toggle(v, exerciseTypes, setExerciseTypes)}
                  />
                  <Text style={ss.followUpLabel}>How long did you exercise?</Text>
                  <Chips
                    options={['Under 15 min','15–30 min','30–45 min','45–60 min','Over 60 min']}
                    selected={exerciseDuration}
                    onToggle={setExerciseDuration}
                    singleSelect
                  />
                  <Text style={ss.followUpLabel}>How intense was it?</Text>
                  <Chips
                    options={['🟢 Light','🟡 Moderate','🟠 Intense','🔴 Very intense']}
                    selected={exerciseIntensity}
                    onToggle={setExerciseIntensity}
                    singleSelect
                  />
                  <Text style={ss.followUpLabel}>Did you exercise while fasting?</Text>
                  <Chips
                    options={['✅ Yes','❌ No']}
                    selected={exercisedWhileFasting}
                    onToggle={setExercisedWhileFasting}
                    singleSelect
                  />
                  <Text style={ss.followUpLabel}>How did your body feel during activity?</Text>
                  <Chips
                    options={['💪 Strong','😐 Normal','😩 Weak','😵 Dizzy','⚡ Energized','😴 Sluggish']}
                    selected={bodyFeelDuringExercise}
                    onToggle={v => toggle(v, bodyFeelDuringExercise, setBodyFeelDuringExercise)}
                  />
                </>
              )}
            </SectionCard>

            {/* ── Section 9: Sleep ──────────────────────────────────────── */}
            <SectionCard title="😴 Sleep" subtitle="How many hours did you sleep last night?">
              <Chips
                options={['Under 4 hrs','4–5 hrs','5–6 hrs','6–7 hrs','7–8 hrs','8–9 hrs','Over 9 hrs']}
                selected={sleepHours}
                onToggle={setSleepHours}
                singleSelect
              />
              <Text style={ss.followUpLabel}>How would you rate your sleep quality?</Text>
              <ScoreSlider value={sleepQuality} onChange={setSleepQuality} lowLabel="1 Terrible" highLabel="10 Perfect" />
              <Text style={ss.followUpLabel}>How did you wake up this morning?</Text>
              <Chips
                options={['🌟 Refreshed','😵 Groggy','😐 Okay','😴 Tired','🔄 Woke up multiple times','😫 Couldn\'t sleep']}
                selected={wakeUpFeeling}
                onToggle={setWakeUpFeeling}
                singleSelect
              />
            </SectionCard>

            {/* ── Section 10: Water (existing — unchanged) ──────────────── */}
            <View style={ss.section}>
              <View style={ss.waterHeader}>
                <Text style={ss.sectionTitle}>💧 Water</Text>
                <TouchableOpacity style={ss.unitBtn} onPress={() => setShowUnitPicker(!showUnitPicker)}>
                  <Text style={ss.unitBtnText}>{volumeUnit}</Text>
                  <Text style={ss.unitArrow}>{showUnitPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
              </View>
              {showUnitPicker && (
                <View style={ss.unitDropdown}>
                  {['oz','mL','sachet','bottle'].map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[ss.unitOption, volumeUnit === unit && ss.unitOptionActive]}
                      onPress={() => { setVolumeUnit?.(unit); setShowUnitPicker(false); }}
                    >
                      <Text style={[ss.unitOptionText, volumeUnit === unit && ss.unitOptionTextActive]}>{unit}</Text>
                      {volumeUnit === unit && <Text style={ss.unitCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={ss.waterCard}>
                <View style={ss.waterCounter}>
                  <TouchableOpacity style={ss.waterBtn} onPress={() => setWaterCount(Math.max(0, waterCount - 1))}>
                    <Text style={{ color: '#059669', fontSize: 20, fontWeight: '700' }}>−</Text>
                  </TouchableOpacity>
                  <View style={ss.waterDisplay}>
                    <Text style={ss.waterAmount}>{waterCount}</Text>
                    <Text style={ss.waterUnit}>{volumeUnit}</Text>
                  </View>
                  <TouchableOpacity style={ss.waterBtn} onPress={() => setWaterCount(waterCount + 1)}>
                    <Text style={{ color: '#059669', fontSize: 20, fontWeight: '700' }}>+</Text>
                  </TouchableOpacity>
                </View>
                {waterEntries.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, maxHeight: 40 }} contentContainerStyle={{ gap: 8 }}>
                    {waterEntries.map((entry, i) => (
                      <TouchableOpacity key={i} style={ss.waterEntryChip} onPress={() => setWaterEntries(waterEntries.filter((_, idx) => idx !== i))}>
                        <Text style={ss.waterEntryText}>{entry.amount} {entry.unit}</Text>
                        <Text style={ss.waterEntryRemove}>✕</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={ss.waterActions}>
                <TouchableOpacity onPress={onViewWaterLogs}>
                  <Text style={ss.waterViewLogs}>View all logs</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (waterCount > 0) {
                    setWaterEntries([...waterEntries, { amount: waterCount, unit: volumeUnit }]);
                    setWaterCount(0);
                  }
                }}>
                  <Text style={ss.waterSaveLog}>+ Save log</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Section 11: Stress & Mental Load ─────────────────────── */}
            <SectionCard title="🧠 Stress & Mental Load" subtitle="How stressed do you feel right now?">
              <ScoreSlider value={stressScore} onChange={setStressScore} lowLabel="1 Very calm" highLabel="10 Extremely stressed" />
              <Text style={ss.followUpLabel}>What is contributing to your stress? (optional)</Text>
              <Chips
                options={['💼 Work/school','💰 Finances','❤️ Relationships','🏥 Health','⏰ Time pressure','✅ Nothing specific','🔲 Other']}
                selected={stressContributors}
                onToggle={v => toggle(v, stressContributors, setStressContributors)}
              />
              <Text style={ss.followUpLabel}>How is your ability to focus right now?</Text>
              <Chips
                options={['🎯 Sharp','😐 Normal','🌀 Scattered','💫 Completely distracted']}
                selected={focusLevel}
                onToggle={setFocusLevel}
                singleSelect
              />
            </SectionCard>

            {/* ── Section 12: Context ───────────────────────────────────── */}
            <SectionCard title="📍 Context">
              <Text style={ss.followUpLabel}>Where are you right now?</Text>
              <Chips
                options={['🏠 Home','💼 Work/school','🚗 Commuting','🌳 Outdoors','👥 Social setting','🔲 Other']}
                selected={currentLocation}
                onToggle={setCurrentLocation}
                singleSelect
              />
              <Text style={ss.followUpLabel}>Who are you with?</Text>
              <Chips
                options={['🧘 Alone','👨‍👩‍👧 With family','👫 With friends','🏙️ In a public setting','🏢 At work/class']}
                selected={currentCompany}
                onToggle={setCurrentCompany}
                singleSelect
              />
              <Text style={ss.followUpLabel}>Is today a typical day for you?</Text>
              <Chips
                options={['✅ Yes, fairly normal','🔥 Busier than usual','😌 More relaxed than usual','🌀 Unusual/disrupted day']}
                selected={typicalDay}
                onToggle={setTypicalDay}
                singleSelect
              />
            </SectionCard>

            {/* ── Section 13: Daily Goal Check (hide if they didn't fast at all) ── */}
            {fastingStatus !== '❌ I did not fast today' && fastingStatus !== '🌙 Fasting window hasn\'t started yet' && (
            <SectionCard title="🎯 Daily Goal Check">
              <Text style={ss.followUpLabel}>Did you meet your fasting goal today?</Text>
              <Chips
                options={['✅ Yes, fully','⚠️ Partially — I fell short of my target window','❌ No — I didn\'t fast today','📅 Goal not set for today']}
                selected={fastingGoalMet}
                onToggle={setFastingGoalMet}
                singleSelect
              />
              <Text style={ss.followUpLabel}>How confident are you about tomorrow's fast?</Text>
              <Chips
                options={['💪 Very confident','🙂 Somewhat confident','🤔 Uncertain','❌ Not planning to fast']}
                selected={tomorrowConfidence}
                onToggle={setTomorrowConfidence}
                singleSelect
              />
            </SectionCard>
            )}

            {/* ── Notes (unchanged) ─────────────────────────────────────── */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={ss.section}>
                <Text style={ss.sectionTitle}>📝 Notes</Text>
                <View style={ss.notesCard}>
                  <TextInput
                    multiline
                    style={ss.notesInput}
                    placeholder="Add notes about your fast, hunger, energy, or anything unusual today."
                    placeholderTextColor="#999"
                    value={notes}
                    onChangeText={text => setNotes(text)}
                  />
                </View>
              </View>
            </KeyboardAvoidingView>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Save button */}
          <View style={ss.footer}>
            <TouchableOpacity style={ss.saveBtn} onPress={handleSave}>
              <Text style={ss.saveBtnText}>Save Check-In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#F8FAFC' },
  page: { flex: 1, flexDirection: 'column' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  headerDate: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },

  scroll: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 20 },

  section: {
    marginTop: 20, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(5,150,105,0.06)',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F1F1F', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  groupLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  followUpLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 10 },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 9, paddingHorizontal: 13, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.12)',
    backgroundColor: 'rgba(5,150,105,0.04)',
    marginRight: 8, marginBottom: 8,
  },
  chipSelected: { backgroundColor: '#059669', borderColor: 'transparent' },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, color: '#444' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  scoreBtn: {
    flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(5,150,105,0.06)', borderWidth: 1, borderColor: 'rgba(5,150,105,0.1)',
  },
  scoreBtnSelected: { backgroundColor: '#059669', borderColor: 'transparent' },
  scoreBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  scoreBtnTextSelected: { color: '#fff' },
  scoreLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scoreLabel: { fontSize: 11, color: '#9CA3AF' },

  timeInput: {
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1F1F1F',
    backgroundColor: 'rgba(5,150,105,0.03)',
  },

  // Water section (unchanged styles)
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, zIndex: 100 },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  unitBtnText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  unitArrow: { fontSize: 8, color: '#059669' },
  unitDropdown: {
    position: 'absolute', right: 0, top: 32, width: 120, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden', zIndex: 100, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  unitOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  unitOptionActive: { backgroundColor: '#ECFDF5' },
  unitOptionText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  unitOptionTextActive: { color: '#059669', fontWeight: '600' },
  unitCheck: { fontSize: 14, color: '#059669', fontWeight: '700' },
  waterCard: { backgroundColor: 'rgba(5,150,105,0.02)', borderRadius: 12, padding: 20, paddingBottom: 24 },
  waterCounter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  waterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(5,150,105,0.1)', alignItems: 'center', justifyContent: 'center' },
  waterDisplay: { alignItems: 'center', marginHorizontal: 20 },
  waterAmount: { fontSize: 32, fontWeight: '700', color: '#1F1F1F' },
  waterUnit: { fontSize: 14, color: '#999', marginLeft: 4 },
  waterEntryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  waterEntryText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  waterEntryRemove: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  waterActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  waterViewLogs: { fontSize: 13, fontWeight: '600', color: '#0EA5E9' },
  waterSaveLog: { fontSize: 13, fontWeight: '600', color: '#059669' },

  notesCard: { backgroundColor: 'rgba(5,150,105,0.02)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  notesInput: { width: '100%', minHeight: 100, fontSize: 14, color: '#1F1F1F', lineHeight: 21, backgroundColor: 'transparent', textAlignVertical: 'top', padding: 0 },

  footer: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'web' ? 24 : 32,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  saveBtn: {
    width: '100%', padding: 16, borderRadius: 14, backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(5,150,105,1)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default CheckInPage;
