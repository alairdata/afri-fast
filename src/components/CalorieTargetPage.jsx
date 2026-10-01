import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { computeTdeeSummary, projectGoal, fromKg, MIN_CALORIES, MAX_SURPLUS, MAX_TARGET_NO_TDEE } from '../lib/tdeeSummary';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const LINE = '#e9e9e1';
const RED = '#B91C1C';

// Same four answers (and wording) as the onboarding "How active is your day?" question.
const ACTIVITY_OPTIONS = [
  { v: 'sedentary', t: 'Mostly sitting', s: 'Desk job, little walking' },
  { v: 'light',     t: 'Lightly active', s: 'Some walking during the day' },
  { v: 'moderate',  t: 'On my feet a lot', s: 'Errands, carrying loads most days' },
  { v: 'active',    t: 'Very active', s: 'Hard physical work or training 5-6x a week' },
];

const fmt = (n) => Math.round(n).toLocaleString();
const floor10 = (n) => Math.floor(n / 10) * 10;

// "Daily calorie target": opened from the calorie pill on the Today tab. The person TYPES their target;
// we show what they burn in a day (which depends on how active they are), what the target means each
// week, and, when it points the right way, how long it takes to reach the goal weight. Goal weight is
// read-only here (changing it affects the whole plan, so it lives in Settings). Targets that are too low
// or far too high can't be saved.
const CalorieTargetPage = ({
  show, onClose, onSave, onOpenSettings,
  dailyCalorieGoal, weightUnit, targetWeight,
  weightLogs, recentMeals, startingWeight, age, sex, height, heightUnit, activityLevel,
}) => {
  const current = dailyCalorieGoal || 0;
  const [text, setText] = useState(String(current || ''));
  const [activity, setActivity] = useState(activityLevel || 'light');

  // Start from what is saved every time the page opens.
  useEffect(() => {
    if (!show) return;
    setText(String(dailyCalorieGoal || ''));
    setActivity(activityLevel || 'light');
  }, [show, dailyCalorieGoal, activityLevel]);

  // The activity picked here feeds the daily-burn estimate live.
  const summary = useMemo(() => computeTdeeSummary({
    weightLogs, recentMeals, weightUnit, startingWeight, targetWeight, age, sex, height, heightUnit, activityLevel: activity,
  }), [weightLogs, recentMeals, weightUnit, startingWeight, targetWeight, age, sex, height, heightUnit, activity]);

  if (!show) return null;

  const { tdee, currentWeightKg, targetWeightKg, usesLogs } = summary;
  const draft = parseInt(text, 10) || 0;
  const unitLabel = weightUnit === 'lbs' ? 'lb' : 'kg';
  const goalShown = targetWeight != null ? `${Math.round(targetWeight * 10) / 10} ${unitLabel}` : '--';
  const kgText = (kg) => `${Math.round(fromKg(Math.abs(kg), weightUnit) * 100) / 100} ${unitLabel}`;

  // What can be saved.
  const maxTarget = tdee != null ? floor10(tdee + MAX_SURPLUS) : MAX_TARGET_NO_TDEE;
  let limitError = null;
  if (draft > 0 && draft < MIN_CALORIES) {
    limitError = `${fmt(draft)} is below the lowest daily target we can set (${fmt(MIN_CALORIES)}). Eating this little for a long time can harm your health.`;
  } else if (draft > maxTarget) {
    limitError = tdee != null
      ? `${fmt(draft)} is ${fmt(draft - tdee)} above what you burn, which means gaining more than 1 kg a week. That is beyond what is considered healthy. The highest we can set for you is ${fmt(maxTarget)}.`
      : `${fmt(draft)} is higher than we can set. The highest is ${fmt(maxTarget)}.`;
  }

  const delta = tdee != null && draft > 0 ? tdee - draft : null; // > 0: deficit
  const proj = draft > 0 && !limitError
    ? projectGoal({ currentKg: currentWeightKg, targetKg: targetWeightKg, tdee, calories: draft })
    : { kind: 'unknown' };
  const changedTarget = draft > 0 && draft !== current;
  const changedActivity = activity !== (activityLevel || 'light');
  const canSave = !limitError && draft > 0 && (changedTarget || changedActivity);

  const dateText = proj.date
    ? proj.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(proj.date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
    : null;

  let weeklyText = '--';
  if (proj.weeklyKg != null && (proj.kind === 'lose' || proj.kind === 'gain' || proj.kind === 'away')) {
    const losing = proj.kind === 'lose' || (proj.kind === 'away' && !proj.wantsLoss);
    weeklyText = `${losing ? 'lose' : 'gain'} about ${kgText(proj.weeklyKg)} a week`;
  } else if (delta != null && Math.abs(delta) < 40) {
    weeklyText = 'about the same weight';
  }

  let headline = ''; let detail = ''; let tone = 'neutral';
  if (limitError) {
    headline = 'Choose another target'; detail = ''; tone = 'bad';
  } else if (proj.kind === 'lose' || proj.kind === 'gain') {
    headline = proj.weeks > 156 ? 'More than 3 years' : `About ${proj.weeks} ${proj.weeks === 1 ? 'week' : 'weeks'}`;
    detail = proj.weeks > 156
      ? `At this target you'd get to ${goalShown} very slowly. ${proj.kind === 'lose' ? 'A lower target' : 'A higher target'} would speed it up.`
      : `At ${fmt(draft)} calories a day you'd reach ${goalShown} around ${dateText}.`;
  } else if (proj.kind === 'away') {
    const losing = !proj.wantsLoss;
    headline = `You'd ${losing ? 'lose' : 'gain'} about ${kgText(proj.weeklyKg)} a week`;
    detail = `That moves you away from your goal of ${goalShown}. We can't say where it would stop, because your goal isn't to ${losing ? 'lose' : 'gain'} weight. ${proj.wantsLoss ? 'Lower the target to head toward your goal.' : 'Raise the target to head toward your goal.'}`;
    tone = 'warn';
  } else if (proj.kind === 'stalled') {
    headline = 'About the same weight';
    detail = proj.wantsLoss
      ? `This is close to what you burn, so your weight stays about where it is. Lower the target to move toward ${goalShown}.`
      : `This is close to what you burn, so your weight stays about where it is. Raise the target to move toward ${goalShown}.`;
  } else if (proj.kind === 'maintain') {
    headline = 'Holding steady';
    detail = `You're at your goal weight, so a target near ${tdee != null ? fmt(tdee) : 'your daily burn'} calories keeps you there.`;
  } else if (draft > 0) {
    headline = 'Add your details';
    detail = 'Add your age, height, weight and activity in Settings to see your daily burn and what this target means.';
  } else {
    headline = 'Enter a target'; detail = 'Type the calories you want to eat each day.';
  }

  const bump = (by) => setText(String(Math.max(0, (draft || current) + by)));

  return (
    <View style={styles.overlay}>
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.title}>Daily calorie target</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* The target: type it */}
          <Text style={styles.kicker}>YOUR TARGET</Text>
          <View style={styles.numberRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-50)} accessibilityLabel="Lower by 50">
              <Ionicons name="remove" size={22} color={INK} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <TextInput
                style={[styles.numberInput, !!limitError && { color: RED }]}
                value={text}
                onChangeText={(v) => setText(v.replace(/[^0-9]/g, '').slice(0, 5))}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="0"
                placeholderTextColor={INK400}
                maxLength={5}
                selectTextOnFocus
              />
              <Text style={styles.numberUnit}>calories a day</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => bump(50)} accessibilityLabel="Raise by 50">
              <Ionicons name="add" size={22} color={INK} />
            </TouchableOpacity>
          </View>

          {limitError ? (
            <View style={styles.errorBox}><Text style={styles.errorTxt}>{limitError}</Text></View>
          ) : changedTarget ? (
            <Text style={styles.wasTxt}>Currently {fmt(current)} calories a day</Text>
          ) : null}

          {/* Activity level: changes the daily burn, so it changes everything below */}
          <Text style={styles.section}>How active is your day?</Text>
          <View>
            {ACTIVITY_OPTIONS.map((o) => {
              const on = activity === o.v;
              return (
                <TouchableOpacity key={o.v} style={[styles.actRow, on && styles.actRowOn]} onPress={() => setActivity(o.v)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actTitle}>{o.t}</Text>
                    <Text style={styles.actSub}>{o.s}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark" size={20} color={INK} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* The maths */}
          <View style={{ marginTop: 14 }}>
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.rowLabel}>Your daily burn</Text>
                <Text style={styles.rowSub}>{tdee == null ? 'Needs your details' : usesLogs ? 'Calibrated from your logs' : 'Estimated from your details'}</Text>
              </View>
              <Text style={styles.rowVal}>{tdee != null ? `${fmt(tdee)} kcal` : '--'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { flex: 1 }]}>{delta != null && delta < 0 ? 'Daily surplus' : 'Daily deficit'}</Text>
              <Text style={styles.rowVal}>
                {delta == null ? '--' : Math.abs(delta) < 10 ? 'None' : `${delta > 0 ? '−' : '+'}${fmt(Math.abs(delta))} kcal`}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { flex: 1 }]}>Each week</Text>
              <Text style={[styles.rowVal, { flexShrink: 1, textAlign: 'right' }]}>{limitError ? '--' : weeklyText}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.rowLabel}>Goal weight</Text>
                <TouchableOpacity onPress={onOpenSettings}>
                  <Text style={styles.rowLink}>Change in Settings</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.rowVal}>{goalShown}</Text>
            </View>
          </View>

          {/* What it means */}
          <View style={[styles.proj, tone === 'warn' && styles.projWarn, tone === 'bad' && styles.projBad]}>
            <Text style={styles.projHead}>{headline}</Text>
            {detail ? <Text style={styles.projTxt}>{detail}</Text> : null}
            {proj.fast ? (
              <Text style={styles.projNote}>That's a quick pace. A smaller deficit is usually easier to keep up.</Text>
            ) : null}
            {proj.kind === 'gain' && delta != null && -delta > 500 ? (
              <Text style={styles.projNote}>Gaining more than about half a kilo a week is mostly fat rather than muscle.</Text>
            ) : null}
          </View>

          {changedActivity ? (
            <Text style={styles.actNote}>Saving also updates your activity level, so your daily burn changes across Logga, not just here.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDis]}
            disabled={!canSave}
            activeOpacity={0.85}
            onPress={() => { onSave && onSave(draft, activity); onClose && onClose(); }}
          >
            <Text style={[styles.saveTxt, !canSave && styles.saveTxtDis]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FAFC', zIndex: 10000,
  },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', height: SCREEN_HEIGHT, flexDirection: 'column', flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  kicker: { fontSize: 11.5, fontWeight: '800', color: INK400, letterSpacing: 1.8, textAlign: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stepBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#deded4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  numberInput: {
    fontSize: 56, fontWeight: '800', color: INK, letterSpacing: -2, textAlign: 'center',
    minWidth: 170, paddingVertical: 0, borderBottomWidth: 2, borderBottomColor: INK,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  numberUnit: { fontSize: 14, fontWeight: '600', color: INK500, marginTop: 6 },
  errorBox: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2' },
  errorTxt: { fontSize: 13.5, lineHeight: 19, color: RED },
  wasTxt: { textAlign: 'center', fontSize: 13, color: INK500, marginTop: 12 },
  section: { fontSize: 11.5, fontWeight: '800', color: INK400, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  actRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#deded4',
  },
  actRowOn: { borderColor: INK },
  actTitle: { fontSize: 15, fontWeight: '600', color: INK },
  actSub: { fontSize: 12.5, color: INK500, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: LINE },
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: '#3a4640' },
  rowSub: { fontSize: 12.5, color: INK400, marginTop: 2 },
  rowLink: { fontSize: 12.5, color: '#059669', fontWeight: '700', marginTop: 2 },
  rowVal: { fontSize: 15.5, fontWeight: '700', color: INK },
  proj: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  projWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  projBad: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  projHead: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  projTxt: { fontSize: 14, lineHeight: 20, color: INK500, marginTop: 6 },
  projNote: { fontSize: 12.5, lineHeight: 18, color: INK400, marginTop: 8 },
  actNote: { fontSize: 12.5, lineHeight: 18, color: INK400, marginTop: 12, textAlign: 'center' },
  footer: {
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: LINE,
  },
  saveBtn: { height: 54, borderRadius: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  saveBtnDis: { backgroundColor: LINE },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveTxtDis: { color: INK400 },
});

export default CalorieTargetPage;
