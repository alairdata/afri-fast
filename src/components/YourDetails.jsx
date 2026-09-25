import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  GoalScreen, StruggleScreen, GenderScreen, AgeScreen, HeightScreen, TargetScreen,
  PaceScreen, ActivityScreen, EatingScreen, FoodScreen, WhyScreen, AccountabilityScreen,
  calcPlan, DEFAULT_DATA,
} from './PreAuthOnboarding';

const KG_TO_LB = 2.2046;

const numOrNull = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};
const toKg = (v, unit) => (unit === 'lb' ? v / KG_TO_LB : v);

const LABELS = {
  goal: { lose: 'Lose weight', eat: 'Eat better', consistent: 'Stay consistent', understand: 'Understand my body' },
  struggles: { forget: 'Forget to track', local: 'Local food calories', motivation: 'Lose motivation', eatout: 'Eat out a lot' },
  pace: { slow: 'Slow & steady', moderate: 'Balanced', aggressive: 'All-in', extreme: 'All-out' },
  activity: { sedentary: 'Mostly sitting', light: 'Lightly active', moderate: 'On my feet a lot', active: 'Very active' },
  eating: { omad: 'OMAD', '2x': 'Twice a day', '3x': 'Three meals', '4x': 'Small & often', flex: 'Flexible' },
  food: { home: 'Home-cooked', out: 'Bought / eating out', mix: 'A mix of both' },
  whys: { wedding: 'A big event', health: 'Health wake-up call', confident: 'Feeling confident', doctor: "Doctor's advice", curious: 'Just curious' },
  accountability: { gentle: 'Gentle nudges', firm: 'Firm reminders', alone: 'Leave me alone' },
};

const listLabel = (map, list) => (list && list.length ? list.map((v) => map[v] || v).join(', ') : '');

// Onboarding-shaped draft built from the app's current values, so the real onboarding screens can be
// reused for editing. Missing values stay empty (nothing pre-selected) except where the screens need
// a number to render (rulers).
function buildDraft(a) {
  const startingKg = numOrNull(a.startingWeight);
  const weightKg = a.latestWeightKg ?? (startingKg != null ? toKg(startingKg, a.weightUnit) : DEFAULT_DATA.weightKg);
  const h = numOrNull(a.height);
  const t = numOrNull(a.targetWeight);
  return {
    ...DEFAULT_DATA,
    goal: a.goal || '',
    struggles: a.struggles || [],
    gender: a.sex || '',
    age: a.age ?? DEFAULT_DATA.age,
    heightCm: h != null ? (a.heightUnit === 'ft' ? h * 30.48 : h) : DEFAULT_DATA.heightCm,
    unitH: a.heightUnit === 'ft' ? 'ft' : 'cm',
    weightKg,
    targetKg: t != null ? toKg(t, a.weightUnit) : weightKg,
    unitW: a.weightUnit === 'lb' ? 'lb' : 'kg',
    pace: a.pacePreference || '',
    activity: a.activityLevel || '',
    eatingStyle: a.eatingStyle === 'flexible' ? 'flex' : (a.eatingStyle || ''),
    foodContext: a.foodContext || '',
    cuisines: a.cuisines || [],
    whys: a.motivations || [],
    accountability: a.accountability || '',
  };
}

const heightSummary = (a) => {
  const h = numOrNull(a.height);
  if (h == null) return '';
  const cm = a.heightUnit === 'ft' ? h * 30.48 : h;
  if (a.heightUnit === 'ft') {
    const totalIn = Math.round(cm / 2.54);
    return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
  }
  return `${Math.round(cm)} cm`;
};

const GROUPS = [
  {
    title: 'About you',
    rows: [
      { key: 'gender', label: 'Sex', Screen: GenderScreen, fields: ['gender'], plan: true, summary: (a) => a.sex || '' },
      { key: 'age', label: 'Age', Screen: AgeScreen, fields: ['age'], plan: true, summary: (a) => (a.age != null ? `${a.age} yrs` : '') },
      { key: 'height', label: 'Height', Screen: HeightScreen, fields: ['heightCm'], plan: true, summary: heightSummary },
      { key: 'activity', label: 'Activity', Screen: ActivityScreen, fields: ['activity'], plan: true, summary: (a) => LABELS.activity[a.activityLevel] || '' },
    ],
  },
  {
    title: 'Your goal',
    rows: [
      { key: 'goal', label: 'Goal', Screen: GoalScreen, fields: ['goal'], summary: (a) => LABELS.goal[a.goal] || '' },
      {
        key: 'target', label: 'Goal weight', Screen: TargetScreen, fields: ['targetKg'], plan: true,
        summary: (a) => {
          const t = numOrNull(a.targetWeight);
          return t == null ? '' : `${Math.round(t * 10) / 10} ${a.weightUnit}`;
        },
      },
      { key: 'pace', label: 'Pace', Screen: PaceScreen, fields: ['pace'], plan: true, summary: (a) => LABELS.pace[a.pacePreference] || '' },
    ],
  },
  {
    title: 'Food',
    rows: [
      { key: 'eating', label: 'How you eat', Screen: EatingScreen, fields: ['eatingStyle'], summary: (a) => LABELS.eating[a.eatingStyle === 'flexible' ? 'flex' : a.eatingStyle] || '' },
      {
        key: 'food', label: 'Where food comes from', Screen: FoodScreen, fields: ['foodContext', 'cuisines'], long: true,
        summary: (a) => [LABELS.food[a.foodContext], (a.cuisines || []).join(', ')].filter(Boolean).join(' · '),
      },
    ],
  },
  {
    title: 'Coaching',
    rows: [
      { key: 'struggles', label: 'What you struggle with', Screen: StruggleScreen, fields: ['struggles'], long: true, summary: (a) => listLabel(LABELS.struggles, a.struggles) },
      { key: 'whys', label: 'Your deeper why', Screen: WhyScreen, fields: ['whys'], long: true, summary: (a) => listLabel(LABELS.whys, a.motivations) },
      { key: 'accountability', label: 'Keeping you on track', Screen: AccountabilityScreen, fields: ['accountability'], summary: (a) => LABELS.accountability[a.accountability] || '' },
    ],
  },
];

const ALL_ROWS = GROUPS.flatMap((g) => g.rows);

export default function YourDetails({
  colors, dailyCalorieGoal, onSaveDetails, onApplyCalories, ...app
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [expanded, setExpanded] = useState({});
  const draftRef = useRef(null);
  const editingRef = useRef(null);
  const pickLock = useRef(false);

  const open = (row) => {
    const d = buildDraft(app);
    draftRef.current = d;
    editingRef.current = row.key;
    setDraft(d);
    setEditingKey(row.key);
  };

  const close = () => {
    editingRef.current = null;
    setEditingKey(null);
  };

  const set = (k, v) => {
    draftRef.current = { ...draftRef.current, [k]: v };
    setDraft(draftRef.current);
  };

  const save = () => {
    const row = ALL_ROWS.find((r) => r.key === editingRef.current);
    if (!row) return;
    const d = draftRef.current;
    const changes = {};
    row.fields.forEach((f) => { changes[f] = d[f]; });
    onSaveDetails(changes);
    if (row.plan) {
      const plan = calcPlan(d);
      setSuggestion(plan.target !== dailyCalorieGoal ? plan.target : null);
    }
    close();
  };

  const pick = (k, v) => {
    set(k, v);
    if (pickLock.current) return;
    pickLock.current = true;
    setTimeout(() => { pickLock.current = false; save(); }, 280);
  };

  const editingRow = ALL_ROWS.find((r) => r.key === editingKey);

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[st.cardTitle, { color: colors.textSecondary }]}>Your Details</Text>
      <Text style={[st.cardSub, { color: colors.textMuted }]}>Your onboarding answers. Tap one to change it.</Text>

      {suggestion != null && (
        <View style={st.suggest}>
          <Text style={st.suggestTxt}>
            Based on your update, your suggested daily target is{' '}
            <Text style={{ fontWeight: '800' }}>{suggestion.toLocaleString()} cal</Text>
            {dailyCalorieGoal ? ` (you're on ${Number(dailyCalorieGoal).toLocaleString()}).` : '.'}
          </Text>
          <View style={st.suggestBtns}>
            <TouchableOpacity style={st.suggestPrimary} onPress={() => { onApplyCalories(suggestion); setSuggestion(null); }}>
              <Text style={st.suggestPrimaryTxt}>Update to {suggestion.toLocaleString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.suggestGhost} onPress={() => setSuggestion(null)}>
              <Text style={st.suggestGhostTxt}>Keep mine</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {GROUPS.map((group) => (
        <View key={group.title}>
          <Text style={[st.groupTitle, { color: colors.textMuted }]}>{group.title}</Text>
          {group.rows.map((row, i) => {
            const summary = row.summary(app);
            const isOpen = !!expanded[row.key];
            return (
              <View key={row.key} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={st.row}>
                  <TouchableOpacity style={st.rowMain} activeOpacity={0.6} onPress={() => open(row)}>
                    <Text style={[st.rowLabel, { color: colors.text }]}>{row.label}</Text>
                    {!row.long && (
                      <Text style={[st.rowValue, !summary && { color: '#9CA3AF' }]} numberOfLines={1}>{summary || 'Not set'}</Text>
                    )}
                  </TouchableOpacity>
                  {row.long ? (
                    <TouchableOpacity
                      style={st.rowArrow}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setExpanded((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                    >
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#ccc" />
                  )}
                </View>
                {row.long && isOpen && (
                  <View style={st.detailBox}>
                    <Text style={[st.detailTxt, !summary && { color: '#9CA3AF' }]}>{summary || 'Not set'}</Text>
                    <TouchableOpacity onPress={() => open(row)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={st.detailEdit}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      <Modal visible={!!editingRow} animationType="slide" onRequestClose={close}>
        <View style={st.modal}>
          <View style={st.modalHeader}>
            <TouchableOpacity style={st.modalBack} onPress={close}>
              <Ionicons name="chevron-back" size={20} color="#3a4640" />
            </TouchableOpacity>
            <Text style={st.modalTitle}>{editingRow?.label}</Text>
            <View style={{ width: 34 }} />
          </View>
          {editingRow && draft ? (
            <editingRow.Screen
              key={editingRow.key}
              d={draft}
              set={set}
              pick={pick}
              next={save}
              back={close}
              editing
              hideProgress
              ctaLabel="Save"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  cardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardSub: { fontSize: 12, marginTop: 4, marginBottom: 6 },
  groupTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  rowArrow: { paddingVertical: 14, paddingLeft: 6 },
  rowLabel: { fontSize: 15, fontWeight: '600', flexShrink: 0 },
  detailBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F4F4EE', borderRadius: 10, padding: 12, marginBottom: 12 },
  detailTxt: { flex: 1, fontSize: 13.5, lineHeight: 19, color: '#3a4640' },
  detailEdit: { fontSize: 13.5, fontWeight: '700', color: '#059669' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#059669', fontWeight: '600' },
  suggest: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  suggestTxt: { fontSize: 13.5, lineHeight: 19, color: '#065F46' },
  suggestBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  suggestPrimary: { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  suggestPrimaryTxt: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  suggestGhost: { paddingVertical: 10, paddingHorizontal: 10 },
  suggestGhostTxt: { color: '#047857', fontWeight: '600', fontSize: 13.5 },
  modal: { flex: 1, backgroundColor: '#fbfbf7' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingHorizontal: 22, paddingBottom: 6,
  },
  modalBack: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f4f4ee', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#16201b' },
});
