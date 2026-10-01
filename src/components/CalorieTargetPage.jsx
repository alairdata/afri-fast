import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { computeTdeeSummary, projectGoal, PACE_DEFICIT, fromKg } from '../lib/tdeeSummary';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const LINE = '#e9e9e1';

const round10 = (n) => Math.round(n / 10) * 10;
const fmt = (n) => Math.round(n).toLocaleString();

// "Daily calorie target": opened from the calorie pill on the Today tab. Shows what the person burns
// in a day (TDEE), lets them move the target, and shows live what that means for reaching their goal
// weight. The goal weight itself is read-only here: changing it affects the whole plan, so it lives
// in Settings.
const CalorieTargetPage = ({
  show, onClose, onSave, onOpenSettings,
  dailyCalorieGoal, pacePreference, weightUnit, targetWeight,
  weightLogs, recentMeals, startingWeight, age, sex, height, heightUnit, activityLevel,
}) => {
  const current = dailyCalorieGoal || 0;
  const [draft, setDraft] = useState(current);

  // Start from the saved target every time the page opens.
  useEffect(() => { if (show) setDraft(dailyCalorieGoal || 0); }, [show, dailyCalorieGoal]);

  const summary = useMemo(() => computeTdeeSummary({
    weightLogs, recentMeals, weightUnit, startingWeight, targetWeight, age, sex, height, heightUnit, activityLevel,
  }), [weightLogs, recentMeals, weightUnit, startingWeight, targetWeight, age, sex, height, heightUnit, activityLevel]);

  if (!show) return null;

  const { tdee, floor, currentWeightKg, targetWeightKg, usesLogs } = summary;
  const sliderMin = Math.min(floor, round10(current || floor));
  const sliderMax = Math.max(round10((tdee || 2400) + 600), round10(current || 0), sliderMin + 200);
  const clamp = (v) => Math.min(sliderMax, Math.max(sliderMin, v));
  const setTarget = (v) => setDraft(clamp(round10(v)));

  const delta = tdee != null ? tdee - draft : null; // > 0: deficit
  const proj = projectGoal({ currentKg: currentWeightKg, targetKg: targetWeightKg, tdee, calories: draft });
  const weeklyShown = proj.weeklyKg != null ? fromKg(Math.abs(proj.weeklyKg), weightUnit) : null;
  const unitLabel = weightUnit === 'lbs' ? 'lb' : 'kg';
  const goalShown = targetWeight != null ? `${Math.round(targetWeight * 10) / 10} ${unitLabel}` : '--';

  const gapKg = currentWeightKg != null && targetWeightKg != null ? currentWeightKg - targetWeightKg : null;
  const recommended = tdee != null
    ? Math.max(floor, round10(tdee - (gapKg != null && gapKg > 0.5 ? (PACE_DEFICIT[pacePreference] || PACE_DEFICIT.moderate) : 0)))
    : null;

  const changed = draft !== current;
  const dateText = proj.date
    ? proj.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(proj.date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
    : null;

  let headline = '';
  let detail = '';
  if (proj.kind === 'lose' || proj.kind === 'gain') {
    headline = proj.weeks > 156 ? 'More than 3 years' : `About ${proj.weeks} ${proj.weeks === 1 ? 'week' : 'weeks'}`;
    detail = proj.weeks > 156
      ? `At this target you'd get to ${goalShown} very slowly. ${proj.kind === 'lose' ? 'A lower target' : 'A higher target'} would speed it up.`
      : `At ${fmt(draft)} calories a day you'd reach ${goalShown} around ${dateText}.`;
  } else if (proj.kind === 'stalled') {
    headline = 'Weight stays about the same';
    detail = proj.wantsLoss
      ? `At or above your daily burn, your weight won't come down. Lower the target to move toward ${goalShown}.`
      : `At or below your daily burn, your weight won't go up. Raise the target to move toward ${goalShown}.`;
  } else if (proj.kind === 'maintain') {
    headline = 'Holding steady';
    detail = `You're at your goal weight, so a target near ${tdee != null ? fmt(tdee) : 'your daily burn'} calories keeps you there.`;
  } else {
    headline = 'Add your details';
    detail = 'Add your age, height, weight and activity in Settings to see your daily burn and how long this target takes.';
  }

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

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* The number, with ± and a slider */}
          <Text style={styles.kicker}>YOUR TARGET</Text>
          <View style={styles.numberRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setTarget(draft - 50)} accessibilityLabel="Lower by 50">
              <Ionicons name="remove" size={22} color={INK} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.number}>{fmt(draft)}</Text>
              <Text style={styles.numberUnit}>calories a day</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setTarget(draft + 50)} accessibilityLabel="Raise by 50">
              <Ionicons name="add" size={22} color={INK} />
            </TouchableOpacity>
          </View>

          <Slider
            style={{ width: '100%', height: 40, marginTop: 6 }}
            minimumValue={sliderMin}
            maximumValue={sliderMax}
            step={10}
            value={draft}
            onValueChange={(v) => setDraft(clamp(round10(v)))}
            minimumTrackTintColor={INK}
            maximumTrackTintColor={LINE}
            thumbTintColor={INK}
          />
          <View style={styles.sliderEnds}>
            <Text style={styles.sliderEndTxt}>{fmt(sliderMin)}</Text>
            <Text style={styles.sliderEndTxt}>{fmt(sliderMax)}</Text>
          </View>

          {changed ? <Text style={styles.wasTxt}>Currently {fmt(current)} calories a day</Text> : null}

          {/* The maths */}
          <View style={{ marginTop: 18 }}>
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
                {delta == null ? '--' : delta === 0 ? 'None' : `${delta > 0 ? '−' : '+'}${fmt(Math.abs(delta))} kcal`}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { flex: 1 }]}>Pace</Text>
              <Text style={styles.rowVal}>
                {weeklyShown != null && (proj.kind === 'lose' || proj.kind === 'gain')
                  ? `about ${Math.round(weeklyShown * 100) / 100} ${unitLabel} a week` : '--'}
              </Text>
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
          <View style={styles.proj}>
            <Text style={styles.projHead}>{headline}</Text>
            <Text style={styles.projTxt}>{detail}</Text>
            {proj.fast ? (
              <Text style={styles.projNote}>That's a quick pace. A smaller deficit is usually easier to keep up.</Text>
            ) : null}
          </View>

          {recommended != null && recommended !== draft ? (
            <TouchableOpacity onPress={() => setDraft(clamp(recommended))} style={styles.recBtn}>
              <Text style={styles.recTxt}>Use the recommended {fmt(recommended)} for your pace</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !changed && styles.saveBtnDis]}
            disabled={!changed}
            activeOpacity={0.85}
            onPress={() => { onSave && onSave(draft); onClose && onClose(); }}
          >
            <Text style={[styles.saveTxt, !changed && styles.saveTxtDis]}>Save target</Text>
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
  number: { fontSize: 60, fontWeight: '800', color: INK, lineHeight: 66, letterSpacing: -2.5 },
  numberUnit: { fontSize: 14, fontWeight: '600', color: INK500, marginTop: 0 },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderEndTxt: { fontSize: 11.5, color: INK400, fontWeight: '600' },
  wasTxt: { textAlign: 'center', fontSize: 13, color: INK500, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: LINE },
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: '#3a4640' },
  rowSub: { fontSize: 12.5, color: INK400, marginTop: 2 },
  rowLink: { fontSize: 12.5, color: '#059669', fontWeight: '700', marginTop: 2 },
  rowVal: { fontSize: 15.5, fontWeight: '700', color: INK },
  proj: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  projHead: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  projTxt: { fontSize: 14, lineHeight: 20, color: INK500, marginTop: 6 },
  projNote: { fontSize: 12.5, lineHeight: 18, color: INK400, marginTop: 8 },
  recBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  recTxt: { fontSize: 14, fontWeight: '700', color: '#059669' },
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
