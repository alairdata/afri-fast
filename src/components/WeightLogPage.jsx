import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform, Keyboard, Alert, Share } from 'react-native';
import InfoTip from './InfoTip';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 24) / 7);

const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const RANGES = [7, 30, 90];

const isLb = (u) => u === 'lb' || u === 'lbs';
const toKg = (w, u) => (isLb(u) ? w * 0.453592 : w);
const convert = (w, from, to) => {
  if (isLb(from) === isLb(to)) return Number(w);
  return isLb(to) ? Number(w) * 2.20462 : Number(w) / 2.20462;
};
const round1 = (n) => Math.round(n * 10) / 10;

const BMI_BANDS = [
  { max: 18.5, label: 'Underweight', color: '#3B82F6' },
  { max: 25, label: 'Normal', color: '#10B981' },
  { max: 30, label: 'Overweight', color: '#F59E0B' },
  { max: Infinity, label: 'Obese', color: '#EF4444' },
];

const WeightLogPage = ({ show, onClose, weightLogs, setWeightLogs, weightUnit, setWeightUnit, onWeightSaved, onWeightDeleted, height, heightUnit }) => {
  const [newWeight, setNewWeight] = useState('');
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showCalendar, setShowCalendar] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(0);

  const unit = isLb(weightUnit) ? 'lb' : 'kg';

  // A weight far from the nearest earlier weigh-in is checked with the person before saving (typo, wrong
  // unit), instead of being saved and quietly ignored later. Shown inline: pop-ups don't work on the web.
  const [confirm, setConfirm] = useState(null); // { value, message, lbValue? }
  const checkWeight = (value) => {
    const ts = selectedDate.getTime();
    const logs = [...(weightLogs || [])].map((l) => ({ ...l, ts: l.timestamp || new Date(l.date).getTime() })).filter((l) => !isNaN(l.ts));
    if (!logs.length) return null;
    const before = logs.filter((l) => l.ts <= ts).sort((a, b) => b.ts - a.ts)[0] || logs.sort((a, b) => a.ts - b.ts)[0];
    const prevKg = toKg(Number(before.weight), before.unit);
    const valueKg = toKg(value, unit);
    const days = Math.abs(ts - before.ts) / 86400000;
    const allowed = Math.max(2.5, prevKg * 0.025) + days * 0.3; // water swings plus a fast-but-real weekly loss
    if (Math.abs(valueKg - prevKg) <= allowed) return null;
    const prevShown = round1(convert(before.weight, before.unit, unit));
    const diff = round1(Math.abs(value - prevShown));
    const ratio = valueKg / prevKg;
    const whenText = days < 1 ? 'earlier the same day' : days < 1.5 ? 'the day before' : `${Math.round(days)} days earlier`;
    if (unit === 'kg' && ratio > 2 && ratio < 2.45) {
      return { value, lbValue: round1(value / 2.20462), message: `${value} kg is more than double your last weigh-in (${prevShown} kg). Did you mean ${value} lb?` };
    }
    if (unit === 'lb' && ratio > 0.4 && ratio < 0.5) {
      return { value, message: `${value} lb is less than half your last weigh-in (${prevShown} lb). Did you enter kilograms?` };
    }
    return { value, message: `That's ${diff} ${unit} ${value > prevShown ? 'more' : 'less'} than your weigh-in ${whenText} (${prevShown} ${unit}). Is that right?` };
  };

  const saveWeight = (force = false, overrideValue = null, overrideUnit = null) => {
    const value = overrideValue != null ? overrideValue : parseFloat(newWeight);
    if (!(value > 0)) return;
    if (!force) {
      const flag = checkWeight(value);
      if (flag) { Keyboard.dismiss(); setConfirm(flag); return; }
    }
    setConfirm(null);
    Keyboard.dismiss();
    const logUnit = overrideUnit || unit;
    // The picked day at the current time of day, so two weigh-ins on one day get different ids (the id is
    // the timestamp); reusing selectedDate's fixed time made the second one clash on save and delete.
    const nowT = new Date();
    const ts = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), nowT.getHours(), nowT.getMinutes(), nowT.getSeconds(), nowT.getMilliseconds()).getTime();
    const newLog = { date: selectedDate.toDateString(), timestamp: ts, weight: overrideUnit ? round1(overrideValue * 2.20462) : value, unit: logUnit };
    // Insert in date order, not always at the front -- logging a past date (via the calendar picker
    // above) must not make it look like your most recent weigh-in everywhere weightLogs[0] is read
    // as "current weight" (BMI card, weight stats, activity calorie estimates).
    setWeightLogs([...weightLogs, newLog].sort((a, b) => b.timestamp - a.timestamp));
    onWeightSaved && onWeightSaved(newLog);
    setNewWeight('');
  };

  // Delete is confirmed inline on the row: Alert pop-ups with buttons don't show on the web.
  const [pendingDelete, setPendingDelete] = useState(null);
  const askDelete = (log) => setPendingDelete((p) => (p === log ? null : log));
  const confirmDelete = (log) => {
    setWeightLogs(weightLogs.filter((l) => l !== log));
    onWeightDeleted && onWeightDeleted(log);
    setPendingDelete(null);
  };


  // Every weigh-in as a spreadsheet (CSV), handed to the phone's share sheet.
  const exportLogs = async () => {
    if (!weightLogs.length) { Alert.alert('Nothing to export yet', 'Save a weigh-in first.'); return; }
    const rows = [...weightLogs]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map((l) => {
        const d = new Date(l.timestamp || l.date);
        const iso = isNaN(d.getTime()) ? l.date : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return `${iso},${l.weight},${l.unit}`;
      });
    try { await Share.share({ title: 'Logga weight log', message: ['date,weight,unit', ...rows].join('\n') }); } catch (_) {}
  };

  // Calendar grid
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calCells.length % 7 !== 0) calCells.push(null);

  if (!show) return null;

  const isToday = selectedDate.toDateString() === today.toDateString();
  const sorted = [...(weightLogs || [])].sort((a, b) => (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime()));

  // BMI from the latest weigh-in and the height in Your Details
  const latest = sorted[0] || null;
  const heightNum = parseFloat(height);
  const heightM = heightNum ? (heightUnit === 'ft' ? heightNum * 0.3048 : heightNum / 100) : 0;
  const bmi = latest && heightM > 0 ? toKg(latest.weight, latest.unit) / (heightM * heightM) : null;
  const band = bmi ? BMI_BANDS.find((b) => bmi < b.max) : null;
  const bmiPos = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100)) : 0;

  // Trends over the last N days
  const rangeDays = RANGES[rangeIdx];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (rangeDays - 1));
  const inRange = sorted.filter((l) => (l.timestamp || new Date(l.date).getTime()) >= start.getTime()).map((l) => convert(l.weight, l.unit, unit));
  const change = inRange.length >= 2 ? inRange[0] - inRange[inRange.length - 1] : null;
  const avg = inRange.length ? inRange.reduce((s, w) => s + w, 0) / inRange.length : null;
  const lowest = inRange.length ? Math.min(...inRange) : null;

  return (
    <View style={styles.overlay}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color="#1F1F1F" />
          </TouchableOpacity>
          <Text style={styles.title}>Weight Log</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCalendar((v) => !v)} accessibilityLabel="Pick a day">
            <Ionicons name={showCalendar ? 'calendar' : 'calendar-outline'} size={20} color="#059669" />
          </TouchableOpacity>
        </View>

        {/* Calendar overlay */}
        {showCalendar && (
          <>
            <TouchableOpacity style={styles.calendarBackdrop} activeOpacity={1} onPress={() => setShowCalendar(false)} />
            <View style={styles.calendarCard}>
              <View style={styles.calMonthRow}>
                <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
                  <Ionicons name="chevron-back" size={18} color="#059669" />
                </TouchableOpacity>
                <Text style={styles.calMonthLabel}>{FULL_MONTHS[month]} {year}</Text>
                <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}>
                  <Ionicons name="chevron-forward" size={18} color="#059669" />
                </TouchableOpacity>
              </View>
              <View style={styles.calDayLabels}>
                {DAY_LABELS.map((d, i) => (
                  <View key={i} style={{ width: CELL_SIZE, alignItems: 'center' }}>
                    <Text style={styles.calDayLabelText}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.calGrid}>
                {calCells.map((day, i) => {
                  if (!day) return <View key={i} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
                  const cellDate = new Date(year, month, day);
                  const isSelected = cellDate.toDateString() === selectedDate.toDateString();
                  const isTodayCell = cellDate.toDateString() === today.toDateString();
                  const isFuture = cellDate > today;
                  return (
                    <TouchableOpacity
                      key={i}
                      disabled={isFuture}
                      style={[styles.calCell, { width: CELL_SIZE, height: CELL_SIZE }, isSelected && styles.calCellSelected, !isSelected && isTodayCell && styles.calCellToday, isFuture && { opacity: 0.3 }]}
                      onPress={() => { setSelectedDate(cellDate); setShowCalendar(false); }}
                    >
                      <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, !isSelected && isTodayCell && styles.calCellTextToday]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Weight input */}
          <View style={styles.inputCard}>
            <Text style={styles.kicker}>{isToday ? "TODAY'S WEIGHT" : `WEIGHT FOR ${MONTHS[selectedDate.getMonth()].toUpperCase()} ${selectedDate.getDate()}`}</Text>
            <View style={styles.inputRow}>
              <TextInput
                placeholder={latest ? String(round1(convert(latest.weight, latest.unit, unit))) : unit === 'kg' ? '72' : '160'}
                placeholderTextColor="#C4C8CC"
                value={newWeight}
                onChangeText={(t) => { setNewWeight(t); setConfirm(null); }}
                onSubmitEditing={() => saveWeight()}
                returnKeyType="done"
                style={styles.bigInput}
                keyboardType="decimal-pad"
                accessibilityLabel="Current weight"
              />
              <TouchableOpacity style={styles.unitBtn} onPress={() => setWeightUnit(unit === 'kg' ? 'lb' : 'kg')} accessibilityLabel={`Change unit, ${unit === 'kg' ? 'kilograms' : 'pounds'} selected`}>
                <Text style={styles.unitText}>{unit}</Text>
                <Ionicons name="chevron-down" size={16} color="#4B5563" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Enter your current weight</Text>
            {confirm ? (
              <View style={styles.confirmBox} accessibilityLiveRegion="polite">
                <Text style={styles.confirmText}>{confirm.message}</Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.confirmFix} onPress={() => setConfirm(null)} accessibilityRole="button">
                    <Text style={styles.confirmFixText}>Fix it</Text>
                  </TouchableOpacity>
                  {confirm.lbValue != null ? (
                    <TouchableOpacity style={styles.confirmYes} onPress={() => saveWeight(true, confirm.lbValue, 'lb')} accessibilityRole="button">
                      <Text style={styles.confirmYesText}>Yes, it's {confirm.value} lb</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={confirm.lbValue != null ? styles.confirmFix : styles.confirmYes} onPress={() => saveWeight(true, confirm.value)} accessibilityRole="button">
                    <Text style={confirm.lbValue != null ? styles.confirmFixText : styles.confirmYesText}>{confirm.lbValue != null ? 'Save as kg' : 'Yes, save it'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
            <TouchableOpacity style={[styles.saveBtn, !(parseFloat(newWeight) > 0) && { opacity: 0.6 }]} onPress={() => saveWeight()} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save Weight</Text>
            </TouchableOpacity>
            )}
          </View>

          {/* BMI */}
          <View style={styles.section}>
            <View style={styles.titleRow}><Text style={styles.sectionTitle}>Current BMI</Text><InfoTip id="bmi" /></View>
            <View style={styles.bmiCard}>
              <View style={styles.bmiTop}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={styles.bmiValue}>{bmi ? bmi.toFixed(1) : '--'}</Text>
                  {band && <View style={[styles.bmiBadge, { backgroundColor: `${band.color}1A` }]}><Text style={[styles.bmiBadgeText, { color: band.color }]}>{band.label}</Text></View>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bmiSmall}>Current weight</Text>
                  <Text style={styles.bmiWeight}>{latest ? `${round1(convert(latest.weight, latest.unit, unit))} ${unit}` : '--'}</Text>
                </View>
              </View>
              <View style={styles.bmiBar}>
                <View style={{ width: '17.5%', backgroundColor: '#3B82F6' }} />
                <View style={{ width: '32.5%', backgroundColor: '#10B981' }} />
                <View style={{ width: '25%', backgroundColor: '#F59E0B' }} />
                <View style={{ width: '25%', backgroundColor: '#EF4444' }} />
              </View>
              {bmi && <View style={{ height: 0 }}><View style={[styles.bmiMarker, { left: `${bmiPos}%` }]} /></View>}
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                {BMI_BANDS.map((b) => <Text key={b.label} style={styles.bmiLabel}>{b.label}</Text>)}
              </View>
              {!heightM && <Text style={[styles.hint, { marginTop: 8, textAlign: 'left' }]}>Add your height in Your Details to see your BMI.</Text>}
            </View>
          </View>

          {/* Trends */}
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Your weight trends</Text>
              <TouchableOpacity style={styles.rangePill} onPress={() => setRangeIdx((i) => (i + 1) % RANGES.length)} accessibilityLabel={`Showing ${rangeDays} days, tap to change`}>
                <Text style={styles.rangePillText}>{rangeDays} days</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                ['Total change', change == null ? '--' : `${change < 0 ? '↓' : change > 0 ? '↑' : ''} ${Math.abs(round1(change))} ${unit}`.trim()],
                ['Average weight', avg == null ? '--' : `${round1(avg)} ${unit}`],
                ['Lowest', lowest == null ? '--' : `${round1(lowest)} ${unit}`],
              ].map(([label, value]) => (
                <View key={label} style={styles.trendTile}>
                  <Text style={styles.trendLabel}>{label}</Text>
                  <Text style={styles.trendValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Past logs */}
          <View style={[styles.section, { paddingHorizontal: 20 }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { fontSize: 14 }]}>Past Logs</Text>
              <TouchableOpacity style={styles.exportBtn} onPress={exportLogs} accessibilityLabel="Export your weight log">
                <Text style={styles.exportBtnText}>↓ Export</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logsCard}>
              {sorted.length === 0 && <Text style={styles.empty}>No weigh-ins yet. Save your first one above.</Text>}
              {sorted.slice(0, 20).map((log, i, list) => {
                const d = new Date(log.timestamp || log.date);
                const w = convert(log.weight, log.unit, unit);
                const prev = sorted[i + 1];
                const diff = prev ? round1(w - convert(prev.weight, prev.unit, unit)) : null;
                return (
                  <React.Fragment key={`${log.timestamp}-${i}`}>
                  <View style={[styles.logRow, i < list.length - 1 && pendingDelete !== log && styles.logDivider]}>
                    <View style={styles.logDate}>
                      <Text style={styles.logDay}>{isNaN(d.getTime()) ? '--' : d.getDate()}</Text>
                      <Text style={styles.logMonth}>{isNaN(d.getTime()) ? '' : MONTHS[d.getMonth()]}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                      <Text style={styles.logWeight}>{round1(w)} {unit}</Text>
                      <Text style={styles.logWeekday}>{isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'long' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.logDiff}>{diff == null ? '—' : `${diff < 0 ? '↓' : diff > 0 ? '↑' : ''} ${Math.abs(diff).toFixed(1)} ${unit}`.trim()}</Text>
                      <Text style={styles.logDiffNote}>{diff == null ? 'First log' : 'vs. previous log'}</Text>
                    </View>
                    <TouchableOpacity style={styles.moreBtn} onPress={() => askDelete(log)} accessibilityLabel={`Remove the ${round1(w)} ${unit} weigh-in`}>
                      <Ionicons name="trash-outline" size={16} color="#1F1F1F" />
                    </TouchableOpacity>
                  </View>
                  {pendingDelete === log && (
                    <View style={[styles.deleteRow, i < list.length - 1 && styles.logDivider]}>
                      <Text style={styles.deleteText}>Remove this weigh-in?</Text>
                      <TouchableOpacity style={styles.deleteCancel} onPress={() => setPendingDelete(null)} accessibilityRole="button">
                        <Text style={styles.deleteCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteYes} onPress={() => confirmDelete(log)} accessibilityRole="button">
                        <Text style={styles.deleteYesText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  deleteText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#1F1F1F' },
  deleteCancel: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center' },
  deleteCancelText: { fontSize: 13.5, fontWeight: '700', color: '#1F1F1F' },
  deleteYes: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center' },
  deleteYesText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  confirmBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FCE3CB' },
  confirmText: { fontSize: 14, lineHeight: 20, color: '#7C2D12', fontWeight: '600' },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  confirmYes: { flexGrow: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  confirmYesText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  confirmFix: { flexGrow: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  confirmFixText: { color: '#1F1F1F', fontSize: 14, fontWeight: '700' },
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', height: SCREEN_HEIGHT, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },

  calendarBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 },
  calendarCard: {
    position: 'absolute', top: 60, left: 16, right: 16, zIndex: 200,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  calMonthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  calDayLabels: { flexDirection: 'row', marginBottom: 4 },
  calDayLabelText: { fontSize: 11, fontWeight: '600', color: '#aaa', textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellSelected: { backgroundColor: '#059669' },
  calCellToday: { borderWidth: 1, borderColor: '#059669' },
  calCellText: { fontSize: 13, color: '#333' },
  calCellTextSelected: { color: '#fff', fontWeight: '700' },
  calCellTextToday: { color: '#059669', fontWeight: '700' },

  inputCard: { marginTop: 6, marginHorizontal: 16, marginBottom: 14, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  kicker: { fontSize: 12, color: '#4B5563', letterSpacing: 0.3, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, paddingTop: 20, paddingBottom: 14, paddingLeft: 40 },
  bigInput: { minWidth: 120, fontSize: 56, fontWeight: '700', letterSpacing: -1.5, color: '#1F1F1F', textAlign: 'center', padding: 0 },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  unitText: { fontSize: 24, color: '#4B5563' },
  hint: { marginTop: 10, fontSize: 13, color: '#6B7280', textAlign: 'center' },
  saveBtn: { marginTop: 20, paddingVertical: 15, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  section: { paddingHorizontal: 16, paddingBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bmiCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(5,150,105,0.08)' },
  bmiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bmiValue: { fontSize: 32, fontWeight: '700', color: '#1F1F1F' },
  bmiBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  bmiBadgeText: { fontSize: 14, fontWeight: '600' },
  bmiSmall: { fontSize: 10, color: '#6B7280' },
  bmiWeight: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  bmiBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  bmiMarker: { position: 'absolute', top: -13, width: 4, height: 16, marginLeft: -2, borderRadius: 2, backgroundColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  bmiLabel: { flex: 1, textAlign: 'center', fontSize: 8, color: '#9CA3AF' },

  rangePill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.07)' },
  rangePillText: { fontSize: 12, fontWeight: '600', color: '#1F1F1F' },
  trendTile: { flex: 1, gap: 8, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 12, borderRadius: 10, backgroundColor: '#FCFCFC' },
  trendLabel: { fontSize: 11, color: '#4B5563' },
  trendValue: { fontSize: 18, fontWeight: '600', color: '#1F1F1F' },

  exportBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(5,150,105,0.08)' },
  exportBtnText: { color: '#059669', fontSize: 12, fontWeight: '600' },
  logsCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  logDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  logDate: { width: 30, alignItems: 'center', gap: 6 },
  logDay: { fontSize: 17, fontWeight: '600', color: '#1F1F1F', lineHeight: 18 },
  logMonth: { fontSize: 10, color: '#4B5563', textTransform: 'uppercase' },
  logWeight: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  logWeekday: { fontSize: 12, color: '#4B5563' },
  logDiff: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  logDiffNote: { fontSize: 10, color: '#6B7280' },
  moreBtn: { width: 32, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
});

export default WeightLogPage;
