import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Platform, Modal, KeyboardAvoidingView } from 'react-native';

const INK = '#16201b';
const MUTED = '#6c7872';
const LINE = '#E7ECE9';
const FIELD = '#F5F7F6';
const ACCENT = '#F97316';

// Each activity gets its own colour so the grid is easy to scan.
const ACTIVITY_TYPES = [
  { id: 'walking', label: 'Walking', sub: 'Walks, errands', icon: 'walk-outline', color: '#059669', needsDistance: 'optional' },
  { id: 'running', label: 'Running', sub: 'Jogs, runs', icon: 'body-outline', color: '#F97316', needsDistance: 'required' },
  { id: 'cycling', label: 'Cycling', sub: 'Bike, spin', icon: 'bicycle-outline', color: '#2563EB', needsDistance: 'required' },
  { id: 'swimming', label: 'Swimming', sub: 'Laps, pool', icon: 'water-outline', color: '#0891B2', needsDistance: 'optional' },
  { id: 'strength', label: 'Strength', sub: 'Gym, weights', icon: 'barbell-outline', color: '#7C3AED', needsDistance: 'none' },
  { id: 'sports', label: 'Sports', sub: 'Football, tennis…', icon: 'football-outline', color: '#D97706', needsDistance: 'none' },
  { id: 'other', label: 'Other', sub: 'Dance, yoga…', icon: 'sparkles-outline', color: '#64748B', needsDistance: 'optional' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90];
const SESSION_PRESETS = ['Full body', 'Upper body', 'Lower body', 'Push', 'Pull', 'Legs'];

// Rough MET-based estimate — a ballpark, not a precise measurement.
const MET = { walking: 3.5, running: 9.8, cycling: 7.5, swimming: 6, strength: 6, sports: 7, other: 4 };
const estimateCalories = (type, durationMin, weightKg) => {
  if (!weightKg || !durationMin) return null;
  const met = MET[type] || 4;
  return Math.round(met * weightKg * (durationMin / 60));
};

const AddActivityModal = ({ show, onClose, onSave, currentWeightKg = null, hideWalking = false }) => {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [sessionType, setSessionType] = useState('');
  const [when, setWhen] = useState(new Date());

  const reset = () => {
    setStep(1); setType(null); setName(''); setDuration(''); setDistance('');
    setDistanceUnit('km'); setSessionType(''); setWhen(new Date());
  };

  const close = () => { reset(); onClose(); };

  const selectType = (t) => { setType(t); setStep(2); if (!duration) setDuration('30'); };

  const minutes = parseInt(duration, 10);
  const validMinutes = !isNaN(minutes) && minutes > 0;
  const bumpDuration = (by) => setDuration(String(Math.max(5, (validMinutes ? minutes : 0) + by)));

  const canSave = () => {
    if (!type || !validMinutes) return false;
    if (type.id === 'other' && !name.trim()) return false;
    if (type.needsDistance === 'required' && (!distance || isNaN(parseFloat(distance)))) return false;
    return true;
  };

  const save = () => {
    if (!canSave()) return;
    const distanceVal = distance ? parseFloat(distance) : null;
    const entry = {
      id: Date.now(),
      type: type.id,
      name: type.id === 'other' ? name.trim() : type.label,
      date: when.toDateString(),
      timestamp: when.getTime(),
      durationMin: minutes,
      distance: distanceVal,
      distanceUnit: distanceVal ? distanceUnit : null,
      sessionType: sessionType.trim() || null,
      estimatedCalories: estimateCalories(type.id, minutes, currentWeightKg),
    };
    onSave(entry);
    close();
  };

  if (!show) return null;

  const kcal = type && validMinutes ? estimateCalories(type.id, minutes, currentWeightKg) : null;
  const tint = type?.color || ACCENT;

  return (
    <Modal visible={show} animationType="slide" transparent onRequestClose={close}>
      {/* Lifts the whole sheet above the keyboard, so what you type is always visible. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              {step === 2 ? (
                <TouchableOpacity style={styles.iconBtn} onPress={() => setStep(1)} accessibilityLabel="Back">
                  <Ionicons name="chevron-back" size={22} color={INK} />
                </TouchableOpacity>
              ) : <View style={styles.iconBtn} />}
              <Text style={styles.title}>{step === 1 ? 'Log an activity' : type?.label}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={close} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            {step === 1 && (
              <ScrollView contentContainerStyle={styles.pickBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.lead}>What did you do?</Text>
                <View style={styles.typeGrid}>
                  {/* With Apple Health connected, walking already arrives as steps, so it isn't logged twice. */}
                  {ACTIVITY_TYPES.filter((t) => !(hideWalking && t.id === 'walking')).map((t) => (
                    <TouchableOpacity key={t.id} style={styles.typeCard} onPress={() => selectType(t)} activeOpacity={0.8}>
                      <View style={[styles.typeIconWrap, { backgroundColor: `${t.color}1A` }]}>
                        <Ionicons name={t.icon} size={22} color={t.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.typeLabel}>{t.label}</Text>
                        <Text style={styles.typeSub} numberOfLines={1}>{t.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.footnote}>
                  {hideWalking
                    ? 'Your walking comes in from Apple Health as steps. Log workouts and other activities here.'
                    : 'Days with 5,000+ steps already count as active days. Log anything extra here.'}
                </Text>
              </ScrollView>
            )}

            {step === 2 && type && (
              <>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
                  {type.id === 'other' && (
                    <View style={styles.section}>
                      <Text style={styles.label}>What was it?</Text>
                      <TextInput style={styles.input} placeholder="e.g. Dancing" placeholderTextColor="#aab3ae" value={name} onChangeText={setName} returnKeyType="done" />
                    </View>
                  )}

                  {/* Duration: tap a preset, nudge with - / +, or type it */}
                  <View style={styles.section}>
                    <Text style={styles.label}>How long?</Text>
                    <View style={styles.durationRow}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => bumpDuration(-5)} accessibilityLabel="5 minutes less">
                        <Ionicons name="remove" size={22} color={INK} />
                      </TouchableOpacity>
                      <View style={styles.durationValue}>
                        <TextInput
                          style={styles.durationInput}
                          value={duration}
                          onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, '').slice(0, 3))}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#c4ccc8"
                          maxLength={3}
                        />
                        <Text style={styles.durationUnit}>min</Text>
                      </View>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => bumpDuration(5)} accessibilityLabel="5 minutes more">
                        <Ionicons name="add" size={22} color={INK} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.chipRow}>
                      {DURATION_PRESETS.map((m) => {
                        const on = minutes === m;
                        return (
                          <TouchableOpacity key={m} style={[styles.chip, on && { backgroundColor: tint, borderColor: tint }]} onPress={() => setDuration(String(m))}>
                            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {type.needsDistance !== 'none' && (
                    <View style={styles.section}>
                      <Text style={styles.label}>Distance{type.needsDistance === 'optional' ? ' (optional)' : ''}</Text>
                      <View style={styles.distanceRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="2.5"
                          placeholderTextColor="#aab3ae"
                          value={distance}
                          onChangeText={(v) => setDistance(v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                        />
                        <View style={styles.segment}>
                          {['km', 'mi'].map((u) => (
                            <TouchableOpacity key={u} style={[styles.segBtn, distanceUnit === u && styles.segBtnOn]} onPress={() => setDistanceUnit(u)}>
                              <Text style={[styles.segTxt, distanceUnit === u && styles.segTxtOn]}>{u}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {type.id === 'strength' && (
                    <View style={styles.section}>
                      <Text style={styles.label}>Focus (optional)</Text>
                      <View style={styles.chipRow}>
                        {SESSION_PRESETS.map((p) => {
                          const on = sessionType === p;
                          return (
                            <TouchableOpacity key={p} style={[styles.chip, on && { backgroundColor: tint, borderColor: tint }]} onPress={() => setSessionType(on ? '' : p)}>
                              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{p}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.label}>When?</Text>
                    <View style={styles.chipRow}>
                      {[0, 1, 2].map((daysAgo) => {
                        const d = new Date(); d.setDate(d.getDate() - daysAgo);
                        const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                        const on = when.toDateString() === d.toDateString();
                        return (
                          <TouchableOpacity key={daysAgo} style={[styles.chip, styles.chipWide, on && { backgroundColor: INK, borderColor: INK }]} onPress={() => setWhen(d)}>
                            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {kcal ? (
                    <View style={[styles.estimate, { backgroundColor: `${tint}12`, borderColor: `${tint}33` }]}>
                      <Ionicons name="flame" size={20} color={tint} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.estimateBig}>≈ {kcal} kcal burned</Text>
                        <Text style={styles.estimateSmall}>A rough estimate from your weight and time, not exact.</Text>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.footer}>
                  <TouchableOpacity style={[styles.saveBtn, !canSave() && styles.saveBtnDisabled]} onPress={save} disabled={!canSave()} activeOpacity={0.85}>
                    <Text style={styles.saveBtnText}>{validMinutes ? `Save ${minutes} min of ${type.id === 'other' ? (name.trim() || 'activity') : type.label.toLowerCase()}` : 'Save activity'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 430, alignSelf: 'center',
    backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#DDE3E0', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.2 },

  pickBody: { paddingHorizontal: 16, paddingBottom: 12 },
  lead: { fontSize: 14, color: MUTED, marginBottom: 12, marginLeft: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  typeCard: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 12, minHeight: 64,
  },
  typeIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  typeSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  footnote: { fontSize: 12, color: MUTED, lineHeight: 17, marginTop: 14, textAlign: 'center' },

  form: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8 },
  section: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: LINE, backgroundColor: FIELD,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: INK,
  },

  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  stepBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: FIELD, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  durationValue: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flex: 1 },
  durationInput: { fontSize: 44, fontWeight: '800', color: INK, letterSpacing: -1.5, textAlign: 'center', minWidth: 80, padding: 0 },
  durationUnit: { fontSize: 16, fontWeight: '600', color: MUTED, marginLeft: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipWide: { flex: 1 },
  chipTxt: { fontSize: 14, fontWeight: '600', color: INK },
  chipTxtOn: { color: '#fff' },

  distanceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  segment: { flexDirection: 'row', backgroundColor: FIELD, borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 3 },
  segBtn: { paddingHorizontal: 14, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTxt: { fontSize: 14, fontWeight: '600', color: MUTED },
  segTxtOn: { color: INK },

  estimate: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  estimateBig: { fontSize: 16, fontWeight: '800', color: INK },
  estimateSmall: { fontSize: 12, color: MUTED, marginTop: 2 },

  footer: { paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE },
  saveBtn: { backgroundColor: INK, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default AddActivityModal;
