import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { SourcesLink } from './HealthSourcesPage';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform, Alert, Keyboard } from 'react-native';
import Svg, { Path, Rect, Ellipse, Defs, LinearGradient, Stop, ClipPath, G } from 'react-native-svg';
import { showAlert } from '../lib/alert';
import HeaderFade from './HeaderFade';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Used only when no hydration goal is set.
const DEFAULT_GOAL_LITRES = 2.0;
const UNIT_TO_ML = { oz: 29.574, mL: 1, ml: 1, sachet: 500, bottle: 750, glasses: 237 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANGES = [7, 30, 90];

const toMl = (amount, unit) => (Number(amount) || 0) * (UNIT_TO_ML[unit] ?? 237);
const fmtL = (ml) => `${(Math.round(ml / 100) / 10).toFixed(1)} L`;

// How an entry reads in the list: "1 sachet", "2 glasses", "1.5 L".
const entryName = (log) => {
  const n = Number(log.amount) || 0;
  if (log.unit === 'sachet') return `${n} sachet${n === 1 ? '' : 's'}`;
  if (log.unit === 'bottle') return `${n} bottle${n === 1 ? '' : 's'}`;
  if (log.unit === 'glasses') return `${n} glass${n === 1 ? '' : 'es'}`;
  if (log.unit === 'oz') return `${n} oz`;
  if (n === 250) return '1 glass';
  return n >= 1000 ? fmtL(n) : `${Math.round(n)} mL`;
};

// The glass on the Hydration screen: water rises with the share of the day's goal (full at 100%).
const WaterGlass = ({ fill }) => {
  const f = Math.max(0, Math.min(fill, 1));
  const waterY = 78 - f * 64;
  const rx = (30 - (6 * (waterY - 8)) / 70).toFixed(1);
  return (
    <Svg width={52} height={58} viewBox="0 0 80 90">
      <Defs>
        <ClipPath id="glassInside"><Path d="M11 8 A29 5 0 0 0 69 8 L63.5 76 Q62.8 80 58 80 L22 80 Q17.2 80 16.5 76 Z" /></ClipPath>
        <LinearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#38BDF8" /><Stop offset="1" stopColor="#0284C7" /></LinearGradient>
        <LinearGradient id="glassTint" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#E0F2FE" stopOpacity="0.9" /><Stop offset="0.5" stopColor="#F0F9FF" stopOpacity="0.5" /><Stop offset="1" stopColor="#E0F2FE" stopOpacity="0.9" /></LinearGradient>
      </Defs>
      <Path d="M10 8 L16 78 Q17 85 24 85 L56 85 Q63 85 64 78 L70 8 A30 5 0 0 0 10 8 Z" fill="url(#glassTint)" />
      {f > 0 && (
        <G clipPath="url(#glassInside)">
          <Rect x="0" y={waterY} width="80" height="90" fill="url(#waterFill)" />
          <Ellipse cx="40" cy={waterY} rx={rx} ry="3.2" fill="#7DD3FC" />
        </G>
      )}
      <Path d="M10 8 L16 78 Q17 85 24 85 L56 85 Q63 85 64 78 L70 8" fill="none" stroke="#7FB8D9" strokeWidth="2" strokeLinejoin="round" />
      <Ellipse cx="40" cy="8" rx="30" ry="5" fill="none" stroke="#7FB8D9" strokeWidth="2" />
      <Path d="M18.5 16 L23 70" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      <Path d="M61 18 L59.5 36" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </Svg>
  );
};

const HydrationDetailsPage = ({ show, onClose, waterLogs, setWaterLogs, waterUnit, setWaterUnit, onWaterSaved, onWaterDeleted, hydrationGoal = 0, volumeUnit }) => {
  // The person's own daily goal (stored in their volume unit), in mL.
  const goalMl = hydrationGoal > 0 ? Math.max(100, hydrationGoal * (UNIT_TO_ML[volumeUnit] ?? 1)) : DEFAULT_GOAL_LITRES * 1000;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [choice, setChoice] = useState(volumeUnit === 'sachet' ? 'sachet' : 'glass');
  const [bottleMl, setBottleMl] = useState('750');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (!show) return null;

  const today = new Date();
  const todayStr = today.toDateString();
  const selectedStr = selectedDate.toDateString();
  const isToday = selectedStr === todayStr;

  const mlByDate = {};
  (waterLogs || []).forEach((l) => { mlByDate[l.date] = (mlByDate[l.date] || 0) + toMl(l.amount, l.unit); });
  const dayMl = mlByDate[selectedStr] || 0;
  const pct = Math.round((dayMl / goalMl) * 100);

  const logWater = () => {
    const entry = choice === 'glass' ? { amount: 250, unit: 'mL' }
      : choice === 'sachet' ? { amount: 1, unit: 'sachet' }
      : { amount: parseFloat(bottleMl) || 0, unit: 'mL' };
    if (!(entry.amount > 0)) { showAlert('How big was the bottle?', 'Type the bottle size in mL, e.g. 750.'); return; }
    Keyboard.dismiss();
    const newLog = {
      id: Date.now(),
      date: selectedStr,
      displayDate: `${WEEKDAYS[selectedDate.getDay()]}, ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}`,
      ...entry,
    };
    setWaterLogs([newLog, ...(waterLogs || [])]);
    onWaterSaved && onWaterSaved(newLog);
  };

  const askDelete = (log) => {
    showAlert(entryName(log), 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setWaterLogs((waterLogs || []).filter((l) => l !== log));
          onWaterDeleted && onWaterDeleted(log);
        },
      },
    ]);
  };

  // Trends over the last N days (each day's entries added up).
  const rangeDays = RANGES[rangeIdx];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (rangeDays - 1));
  const dayTotals = Object.entries(mlByDate).filter(([ds]) => new Date(ds) >= start).map(([, ml]) => ml);
  const totalMl = dayTotals.reduce((s, v) => s + v, 0);
  const avgMl = dayTotals.length ? totalMl / dayTotals.length : 0;
  const goalDays = dayTotals.filter((v) => v >= goalMl).length;

  const entries = [...(waterLogs || [])].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const shown = showAll ? entries.slice(0, 50) : entries.slice(0, 3);
  const whenText = (log) => {
    const t = Number(log.id);
    const d = new Date(log.date);
    const dayLabel = log.date === todayStr ? 'Today' : isNaN(d.getTime()) ? log.displayDate || '' : `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
    const time = t > 1e12 ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
    return time ? `${dayLabel}, ${time}` : dayLabel;
  };

  // Calendar grid for picking another day
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstWeekday; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(new Date(year, month, d));
  const isNextDisabled = new Date(year, month + 1, 1) > today;

  const banner = dayMl === 0
    ? (isToday ? 'No water logged yet today.' : 'No water logged on this day.')
    : dayMl >= goalMl
      ? (isToday ? "You've reached your daily hydration goal." : 'You reached your hydration goal that day.')
      : `${fmtL(goalMl - dayMl)} to go to reach your goal.`;

  const tiles = [
    { id: 'glass', name: 'Glass', sub: '250 mL' },
    { id: 'sachet', name: 'Sachet', sub: '500 mL' },
    { id: 'bottle', name: 'Bottle', sub: 'Custom' },
  ];

  return (
    <View style={styles.overlay}>
      <HeaderFade bg="#F2F2F2" />
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color="#1F1F1F" />
          </TouchableOpacity>
          <Text style={styles.title}>Hydration</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCalendar((v) => !v)} accessibilityLabel="Pick a day">
            <Ionicons name={showCalendar ? 'calendar' : 'calendar-outline'} size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Calendar to log or look back on another day */}
        {showCalendar && <>
          <TouchableOpacity style={styles.calBackdrop} activeOpacity={1} onPress={() => setShowCalendar(false)} />
          <View style={styles.calendarCard}>
            <View style={styles.calMonthRow}>
              <TouchableOpacity style={styles.calNavBtn} onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
                <Ionicons name="chevron-back" size={18} color="#2563EB" />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity style={[styles.calNavBtn, isNextDisabled && styles.calNavBtnDisabled]} onPress={() => !isNextDisabled && setCalendarMonth(new Date(year, month + 1, 1))} disabled={isNextDisabled}>
                <Ionicons name="chevron-forward" size={18} color={isNextDisabled ? '#ccc' : '#2563EB'} />
              </TouchableOpacity>
            </View>
            <View style={styles.calWeekRow}>
              {WEEKDAYS.map((d) => <Text key={d} style={styles.calWeekLabel}>{d[0]}</Text>)}
            </View>
            <View style={styles.calGrid}>
              {calCells.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.calCell} />;
                const ds = day.toDateString();
                const isSelected = ds === selectedStr;
                const isFuture = day > today;
                const hasLog = (mlByDate[ds] || 0) > 0;
                return (
                  <TouchableOpacity
                    key={ds}
                    style={[styles.calCell, hasLog && { backgroundColor: 'rgba(37,99,235,0.12)' }, isSelected && styles.calCellSelected, isFuture && { opacity: 0.3 }]}
                    onPress={() => { if (!isFuture) { setSelectedDate(day); setShowCalendar(false); } }}
                    disabled={isFuture}
                  >
                    <Text style={[styles.calDayText, isSelected && { color: '#fff', fontWeight: '700' }, ds === todayStr && !isSelected && { color: '#2563EB', fontWeight: '700' }]}>{day.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>}

        <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* The day's water */}
          <View style={styles.dayRow}>
            <View>
              <Text style={styles.kicker}>{isToday ? "TODAY'S WATER" : `WATER ON ${MONTHS_SHORT[selectedDate.getMonth()].toUpperCase()} ${selectedDate.getDate()}`}</Text>
              <Text style={styles.dayTotal}>{fmtL(dayMl)}</Text>
              <Text style={styles.dayGoal}>of {fmtL(goalMl)} daily goal</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 6, marginRight: 8 }} accessible accessibilityLabel={`${pct}% of your daily goal`}>
              <WaterGlass fill={dayMl / goalMl} />
              <Text style={styles.dayGoal}><Text style={{ fontWeight: '700', color: '#0284C7' }}>{pct}%</Text> of goal</Text>
            </View>
          </View>
          <View style={styles.banner}><Text style={styles.bannerText}>{banner}</Text></View>

          {/* Quick add */}
          <Text style={styles.sectionTitle}>Quick add</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tiles.map((t) => {
              const on = choice === t.id;
              return (
                <TouchableOpacity key={t.id} style={[styles.tile, on && styles.tileOn]} onPress={() => setChoice(t.id)} accessibilityState={{ selected: on }} accessibilityLabel={`${t.name}, ${t.sub}`}>
                  <Ionicons name="water-outline" size={16} color="#2563EB" />
                  <Text style={styles.tileName}>{t.name}</Text>
                  <Text style={styles.tileSub}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {choice === 'bottle' && (
            <View style={styles.bottleRow}>
              <Text style={styles.bottleLabel}>Bottle size</Text>
              <TextInput
                value={bottleMl}
                onChangeText={setBottleMl}
                keyboardType="number-pad"
                style={styles.bottleInput}
                accessibilityLabel="Bottle size in millilitres"
                placeholder="750"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.bottleLabel}>mL</Text>
            </View>
          )}
          <TouchableOpacity style={styles.logBtn} onPress={logWater} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.logBtnText}>Log water</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Trends */}
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitleBig}>Your hydration trends</Text>
            <TouchableOpacity style={styles.rangePill} onPress={() => setRangeIdx((i) => (i + 1) % RANGES.length)} accessibilityLabel={`Showing ${rangeDays} days, tap to change`}>
              <Text style={styles.rangePillText}>{rangeDays} days</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['Daily average', dayTotals.length ? fmtL(avgMl) : '--'],
              ['Goals reached', `${goalDays} of ${rangeDays}`],
              ['Total intake', dayTotals.length ? fmtL(totalMl) : '--'],
            ].map(([label, value]) => (
              <View key={label} style={styles.trendTile}>
                <Text style={styles.trendLabel}>{label}</Text>
                <Text style={styles.trendValue}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Recent entries */}
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitleBig}>Recent entries</Text>
            {entries.length > 3 && (
              <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
                <Text style={styles.seeAll}>{showAll ? 'Show less' : 'See all'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.entriesCard}>
            {shown.length === 0 && <Text style={styles.empty}>No water logged yet.</Text>}
            {shown.map((log, i) => (
              <View key={`${log.id}-${i}`} style={[styles.entryRow, i < shown.length - 1 && styles.entryDivider]}>
                <Ionicons name="water-outline" size={16} color="#2563EB" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.entryName}>{entryName(log)}</Text>
                  <Text style={styles.entrySub}>{fmtL(toMl(log.amount, log.unit))} · {whenText(log)}</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => askDelete(log)} accessibilityLabel={`More options for ${entryName(log)}`}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#1F1F1F" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <SourcesLink topic="water" label="Health info & sources" style={{ alignSelf: 'center', marginTop: 16 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const CELL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 24) / 7);

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F2F2F2',
    zIndex: 10000,
  },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', height: SCREEN_HEIGHT, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },

  calBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 },
  calendarCard: {
    position: 'absolute', top: 60, left: 0, right: 0, zIndex: 200,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  calMonthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.08)', alignItems: 'center', justifyContent: 'center' },
  calNavBtnDisabled: { backgroundColor: 'rgba(0,0,0,0.04)' },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekLabel: { width: CELL_SIZE, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#bbb' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginVertical: 1 },
  calCellSelected: { backgroundColor: '#2563EB' },
  calDayText: { fontSize: 13, fontWeight: '500', color: '#1F1F1F' },

  dayRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 },
  kicker: { fontSize: 12, color: '#4B5563', letterSpacing: 0.3 },
  dayTotal: { fontSize: 28, fontWeight: '600', color: '#1F1F1F', marginTop: 6 },
  dayGoal: { fontSize: 12, color: '#4B5563', marginTop: 6 },
  banner: { backgroundColor: '#E0ECF3', borderRadius: 10, padding: 14 },
  bannerText: { fontSize: 14, color: '#1F1F1F' },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1F1F1F', marginTop: 18, marginBottom: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#FCFCFC', borderWidth: 1.5, borderColor: 'transparent' },
  tileOn: { borderColor: '#2563EB' },
  tileName: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  tileSub: { fontSize: 11, color: '#4B5563', marginTop: -2 },
  bottleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FCFCFC' },
  bottleLabel: { fontSize: 14, color: '#4B5563' },
  bottleInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1F1F1F', paddingVertical: 6, textAlign: 'right' },
  logBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 999, backgroundColor: '#111' },
  logBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleBig: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  rangePill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.07)' },
  rangePillText: { fontSize: 12, fontWeight: '600', color: '#1F1F1F' },
  trendTile: { flex: 1, gap: 8, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 12, borderRadius: 10, backgroundColor: '#FCFCFC' },
  trendLabel: { fontSize: 11, color: '#4B5563' },
  trendValue: { fontSize: 18, fontWeight: '600', color: '#1F1F1F' },

  seeAll: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  entriesCard: { backgroundColor: '#FCFCFC', borderRadius: 12 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  entryDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  entryName: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  entrySub: { fontSize: 12, color: '#4B5563' },
  moreBtn: { width: 44, height: 44, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
});

export default HydrationDetailsPage;
