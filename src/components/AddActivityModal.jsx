import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform, Modal } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#F97316';

const ACTIVITY_TYPES = [
  { id: 'walking', label: 'Walking', icon: 'walk-outline', needsDistance: 'optional' },
  { id: 'running', label: 'Running', icon: 'body-outline', needsDistance: 'required' },
  { id: 'cycling', label: 'Cycling', icon: 'bicycle-outline', needsDistance: 'required' },
  { id: 'swimming', label: 'Swimming', icon: 'water-outline', needsDistance: 'optional' },
  { id: 'strength', label: 'Strength training', icon: 'barbell-outline', needsDistance: 'none' },
  { id: 'sports', label: 'Sports', icon: 'football-outline', needsDistance: 'none' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', needsDistance: 'optional' },
];

// Rough MET-based estimate — a ballpark, not a precise measurement.
const MET = { walking: 3.5, running: 9.8, cycling: 7.5, swimming: 6, strength: 6, sports: 7, other: 4 };
const estimateCalories = (type, durationMin, weightKg) => {
  if (!weightKg || !durationMin) return null;
  const met = MET[type] || 4;
  return Math.round(met * weightKg * (durationMin / 60));
};

const AddActivityModal = ({ show, onClose, onSave, currentWeightKg = null }) => {
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

  const selectType = (t) => { setType(t); setStep(2); };

  const canSave = () => {
    if (!type) return false;
    if (!duration || isNaN(parseInt(duration, 10))) return false;
    if (type.id === 'other' && !name.trim()) return false;
    if (type.needsDistance === 'required' && (!distance || isNaN(parseFloat(distance)))) return false;
    return true;
  };

  const save = () => {
    if (!canSave()) return;
    const durationMin = parseInt(duration, 10);
    const distanceVal = distance ? parseFloat(distance) : null;
    const entry = {
      id: Date.now(),
      type: type.id,
      name: type.id === 'other' ? name.trim() : type.label,
      date: when.toDateString(),
      timestamp: when.getTime(),
      durationMin,
      distance: distanceVal,
      distanceUnit: distanceVal ? distanceUnit : null,
      sessionType: sessionType.trim() || null,
      estimatedCalories: estimateCalories(type.id, durationMin, currentWeightKg),
    };
    onSave(entry);
    close();
  };

  if (!show) return null;

  return (
    <Modal visible={show} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {step === 2 ? (
              <TouchableOpacity style={styles.iconBtn} onPress={() => setStep(1)}>
                <Ionicons name="chevron-back" size={22} color={ACCENT} />
              </TouchableOpacity>
            ) : <View style={styles.iconBtn} />}
            <Text style={styles.title}>{step === 1 ? 'Add Activity' : type?.label}</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={close}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          {step === 1 && (
            <ScrollView contentContainerStyle={styles.typeGrid} showsVerticalScrollIndicator={false}>
              {ACTIVITY_TYPES.map((t) => (
                <TouchableOpacity key={t.id} style={styles.typeCard} onPress={() => selectType(t)}>
                  <View style={styles.typeIconWrap}>
                    <Ionicons name={t.icon} size={22} color={ACCENT} />
                  </View>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {step === 2 && type && (
            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
              {type.id === 'other' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Activity name</Text>
                  <TextInput style={styles.input} placeholder="e.g. Dancing" placeholderTextColor="#bbb" value={name} onChangeText={setName} />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput style={styles.input} placeholder="30" placeholderTextColor="#bbb" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              </View>

              {type.needsDistance !== 'none' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Distance {type.needsDistance === 'optional' ? '(optional)' : ''}</Text>
                  <View style={styles.distanceRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="2.5" placeholderTextColor="#bbb" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
                    <TouchableOpacity style={styles.unitPill} onPress={() => setDistanceUnit(u => u === 'km' ? 'mi' : 'km')}>
                      <Text style={styles.unitPillText}>{distanceUnit}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {type.id === 'strength' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Session type (optional)</Text>
                  <TextInput style={styles.input} placeholder="e.g. Push day" placeholderTextColor="#bbb" value={sessionType} onChangeText={setSessionType} />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>When</Text>
                <View style={styles.whenRow}>
                  {[0, 1, 2].map((daysAgo) => {
                    const d = new Date(); d.setDate(d.getDate() - daysAgo);
                    const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const active = when.toDateString() === d.toDateString();
                    return (
                      <TouchableOpacity key={daysAgo} style={[styles.whenChip, active && styles.whenChipActive]} onPress={() => setWhen(d)}>
                        <Text style={[styles.whenChipText, active && styles.whenChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {duration && !isNaN(parseInt(duration, 10)) && currentWeightKg && (
                <Text style={styles.estimateNote}>
                  Est. {estimateCalories(type.id, parseInt(duration, 10), currentWeightKg)} kcal burned — a rough estimate, not exact.
                </Text>
              )}

              <TouchableOpacity style={[styles.saveBtn, !canSave() && styles.saveBtnDisabled]} onPress={save} disabled={!canSave()}>
                <Text style={styles.saveBtnText}>Save Activity</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 430, alignSelf: 'center',
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  typeCard: {
    width: (SCREEN_WIDTH < 430 ? SCREEN_WIDTH : 430) / 2 - 26,
    backgroundColor: '#F7F9F8', borderRadius: 16, borderWidth: 1, borderColor: '#EDF0EE',
    padding: 14, alignItems: 'flex-start', gap: 10,
  },
  typeIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { fontSize: 13.5, fontWeight: '700', color: '#1F1F1F' },
  form: { padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1, borderColor: '#EDF0EE', backgroundColor: '#F7F9F8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F1F1F',
  },
  distanceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  unitPill: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)',
  },
  unitPillText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  whenRow: { flexDirection: 'row', gap: 8 },
  whenChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F7F9F8', borderWidth: 1, borderColor: '#EDF0EE',
  },
  whenChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  whenChipText: { fontSize: 12.5, fontWeight: '600', color: '#1F1F1F' },
  whenChipTextActive: { color: '#fff' },
  estimateNote: { fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 17 },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default AddActivityModal;
