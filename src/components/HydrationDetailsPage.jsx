import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const RING_R = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const GOAL_LITRES = 2.0;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HydrationDetailsPage = ({ show, onClose, waterLogs, setWaterLogs, waterUnit, setWaterUnit, onWaterSaved, onWaterDeleted }) => {
  const [newWaterIntake, setNewWaterIntake] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [hydrationStatsRange, setHydrationStatsRange] = useState('7 days');
  const [showHydrationStatsDropdown, setShowHydrationStatsDropdown] = useState(false);

  const saveWaterIntake = () => {
    if (!newWaterIntake) return;
    const newLog = {
      id: Date.now(),
      date: selectedDate.toDateString(),
      displayDate: `${WEEKDAYS[selectedDate.getDay()]}, ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}`,
      amount: parseFloat(newWaterIntake),
      unit: waterUnit,
    };
    setWaterLogs([newLog, ...waterLogs]);
    onWaterSaved && onWaterSaved(newLog);
    setNewWaterIntake('');
  };

  const deleteWaterLog = (index) => {
    const log = waterLogs[index];
    setWaterLogs(waterLogs.filter((_, i) => i !== index));
    onWaterDeleted && onWaterDeleted(log);
  };

  const toML = (amount, unit) => {
    if (unit === 'mL') return amount;
    if (unit === 'oz') return amount * 29.574;
    if (unit === 'sachet') return amount * 500;
    if (unit === 'bottle') return amount * 750;
    return amount;
  };
  const fromML = (ml, unit) => {
    if (unit === 'mL') return Math.round(ml);
    if (unit === 'oz') return Math.round(ml / 29.574);
    if (unit === 'sachet') return Math.round(ml / 500 * 10) / 10;
    if (unit === 'bottle') return Math.round(ml / 750 * 10) / 10;
    return Math.round(ml);
  };
  const convertWaterUnit = (amount, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return amount;
    return fromML(toML(amount, fromUnit), toUnit);
  };
  const toLitres = (amount, u) => {
    const ml = u === 'mL' ? amount : u === 'oz' ? amount * 29.574 : u === 'sachet' ? amount * 500 : u === 'bottle' ? amount * 750 : amount * 237;
    return Math.round(ml / 100) / 10;
  };

  if (!show) return null;

  const today = new Date();
  const todayStr = today.toDateString();
  const selectedStr = selectedDate.toDateString();

  // Build a map of dateStr → total litres for calendar highlights
  const logsByDate = {};
  (waterLogs || []).forEach(l => {
    if (!logsByDate[l.date]) logsByDate[l.date] = 0;
    logsByDate[l.date] += toLitres(l.amount, l.unit);
  });

  // Build calendar grid for calendarMonth
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstWeekday; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(new Date(year, month, d));

  const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= today) setCalendarMonth(next);
  };
  const isNextDisabled = new Date(year, month + 1, 1) > today;

  const selectedLabel = selectedStr === todayStr
    ? 'Today'
    : selectedStr === new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString()
    ? 'Yesterday'
    : `${WEEKDAYS[selectedDate.getDay()]}, ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#0EA5E9" />
          </TouchableOpacity>
          <Text style={styles.title}>Hydration Log</Text>
          <TouchableOpacity
            style={[styles.calIconBtn, showCalendar && styles.calIconBtnActive]}
            onPress={() => setShowCalendar(v => !v)}
          >
            <Ionicons name="calendar-outline" size={20} color={showCalendar ? '#fff' : '#0EA5E9'} />
          </TouchableOpacity>
        </View>

        {/* Always-visible selected date strip */}
        <View style={styles.selectedStrip}>
          <Ionicons name="water-outline" size={12} color="#0EA5E9" />
          <Text style={styles.selectedStripText}>Logging for: <Text style={styles.selectedStripDate}>{selectedLabel}</Text></Text>
        </View>

        {/* Calendar — floats as overlay below header */}
        {showCalendar && <>
          <TouchableOpacity style={styles.calBackdrop} activeOpacity={1} onPress={() => setShowCalendar(false)} />
          <View style={styles.calendarCard}>
          {/* Month nav */}
          <View style={styles.calMonthRow}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={18} color="#0EA5E9" />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity style={[styles.calNavBtn, isNextDisabled && styles.calNavBtnDisabled]} onPress={nextMonth} disabled={isNextDisabled}>
              <Ionicons name="chevron-forward" size={18} color={isNextDisabled ? '#ccc' : '#0EA5E9'} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.calWeekRow}>
            {WEEKDAYS.map(d => (
              <Text key={d} style={styles.calWeekLabel}>{d[0]}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.calGrid}>
            {calCells.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.calCell} />;
              const ds = day.toDateString();
              const isToday = ds === todayStr;
              const isSelected = ds === selectedStr;
              const isFuture = day > today;
              const litres = logsByDate[ds] || 0;
              const hasLog = litres > 0;
              const fillOpacity = hasLog ? Math.min(litres / 3, 1) : 0;

              return (
                <TouchableOpacity
                  key={ds}
                  style={[
                    styles.calCell,
                    hasLog && { backgroundColor: `rgba(14,165,233,${0.12 + fillOpacity * 0.4})` },
                    isSelected && styles.calCellSelected,
                    isFuture && styles.calCellFuture,
                  ]}
                  onPress={() => { if (!isFuture) { setSelectedDate(day); setShowCalendar(false); } }}
                  disabled={isFuture}
                >
                  <Text style={[
                    styles.calDayText,
                    isSelected && styles.calDayTextSelected,
                    isToday && !isSelected && styles.calDayTextToday,
                    isFuture && styles.calDayTextFuture,
                  ]}>{day.getDate()}</Text>
                  {isToday && !isSelected && <View style={styles.calTodayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
        </>}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Water input */}
          <View style={styles.inputSection}>
            {(() => {
              const loggedLitres = logsByDate[selectedStr] || 0;
              const progress = Math.min(loggedLitres / GOAL_LITRES, 1);
              const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
              const isGoalMet = loggedLitres >= GOAL_LITRES;
              return (
                <View style={styles.inputCircleWrap}>
                  <Svg width={180} height={180} viewBox="0 0 180 180" style={{ position: 'absolute' }}>
                    <Defs>
                      <LinearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#0EA5E9" />
                        <Stop offset="100%" stopColor="#38BDF8" />
                      </LinearGradient>
                    </Defs>
                    <Circle cx="90" cy="90" r={RING_R} stroke="rgba(14,165,233,0.12)" strokeWidth="8" fill="none" />
                    <Circle
                      cx="90" cy="90" r={RING_R}
                      stroke="url(#waterGrad)"
                      strokeWidth="10" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 90 90)"
                    />
                  </Svg>
                  <View style={styles.inputCircle}>
                    <TextInput
                      placeholder={waterUnit === 'oz' ? '64' : waterUnit === 'mL' ? '500' : waterUnit === 'sachet' ? '6' : '1'}
                      placeholderTextColor="#ccc"
                      value={newWaterIntake}
                      onChangeText={setNewWaterIntake}
                      style={styles.inputValue}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.unitPill}
                      onPress={() => {
                        const units = ['oz', 'mL', 'sachet', 'bottle'];
                        setWaterUnit(units[(units.indexOf(waterUnit) + 1) % units.length]);
                      }}
                    >
                      <Text style={styles.unitPillText}>{waterUnit}</Text>
                      <Text style={{ color: '#0EA5E9', fontSize: 10 }}>▼</Text>
                    </TouchableOpacity>
                    {loggedLitres > 0 && (
                      <Text style={styles.ringProgressLabel}>
                        {loggedLitres.toFixed(1)}L / {GOAL_LITRES}L
                      </Text>
                    )}
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity style={styles.logBtn} onPress={saveWaterIntake}>
              <Text style={styles.logBtnText}>Log Water</Text>
            </TouchableOpacity>
          </View>


          {/* Hydration Statistics */}
          <View style={styles.statsSection}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsSectionTitle}>Hydration Statistics</Text>
              <View style={styles.dropdownWrap}>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowHydrationStatsDropdown(!showHydrationStatsDropdown)}
                >
                  <Text style={styles.dropdownBtnText}>{hydrationStatsRange}</Text>
                  <Text style={{ color: '#0EA5E9', fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showHydrationStatsDropdown && (
                  <View style={styles.dropdownMenu}>
                    {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[styles.dropdownItem, hydrationStatsRange === range && styles.dropdownItemActive]}
                        onPress={() => { setHydrationStatsRange(range); setShowHydrationStatsDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, hydrationStatsRange === range && styles.dropdownItemTextActive]}>{range}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            {(() => {
              const days = hydrationStatsRange === '7 days' ? 7 : hydrationStatsRange === '30 days' ? 30 : hydrationStatsRange === '90 days' ? 90 : 99999;
              const logs = waterLogs || [];
              const rangeLogs = days === 99999 ? logs : logs.slice(0, Math.min(days, logs.length));
              const hasData = rangeLogs.length > 0;
              const litreAmounts = rangeLogs.map(l => toLitres(l.amount, l.unit));
              const totalL = litreAmounts.reduce((s, a) => s + a, 0);
              const avgL = hasData ? (totalL / rangeLogs.length).toFixed(1) : '0';
              const bestL = hasData ? Math.max(...litreAmounts).toFixed(1) : '0';
              const lowestL = hasData ? Math.min(...litreAmounts).toFixed(1) : '0';
              const goalMetL = litreAmounts.filter(l => l >= 2.0).length;
              return (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Ionicons name="water-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? `${avgL} L` : '--'}</Text>
                      <Text style={styles.statCardLabel}>Avg daily</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? `${goalMetL}/${rangeLogs.length}` : '--'}</Text>
                      <Text style={styles.statCardLabel}>Goal met</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="trending-up-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? `${bestL} L` : '--'}</Text>
                      <Text style={styles.statCardLabel}>Best day</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="bar-chart-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? `${totalL.toFixed(1)} L` : '--'}</Text>
                      <Text style={styles.statCardLabel}>Total</Text>
                    </View>
                  </View>
                  <View style={styles.statsMini}>
                    <View style={styles.statsMiniItem}>
                      <Text style={styles.statsMiniLabel}>Lowest</Text>
                      <Text style={styles.statsMiniValue}>{hasData ? `${lowestL} L` : '--'}</Text>
                    </View>
                    <View style={styles.statsMiniDivider} />
                    <View style={styles.statsMiniItem}>
                      <Text style={styles.statsMiniLabel}>Entries</Text>
                      <Text style={styles.statsMiniValue}>{hasData ? rangeLogs.length : '--'}</Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Past Logs */}
          <View style={styles.pastLogs}>
            <View style={styles.pastLogsHeader}>
              <Text style={styles.pastLogsTitle}>Past Logs</Text>
            </View>
            <View style={styles.logsList}>
              {waterLogs.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No water logs yet. Start tracking above!</Text>
                </View>
              )}
              {waterLogs.slice(0, 10).map((log, index) => {
                const displayAmount = waterUnit === log.unit ? log.amount : convertWaterUnit(log.amount, log.unit, waterUnit);
                const goalMet = toLitres(log.amount, log.unit) >= 2.0;
                const logDate = new Date(log.date);
                const dayNum = !isNaN(logDate) ? logDate.getDate() : '--';
                const monthAbbr = !isNaN(logDate) ? MONTHS_SHORT[logDate.getMonth()] : '';
                const dayAbbr = !isNaN(logDate) ? WEEKDAYS[logDate.getDay()] : '';
                const accent = goalMet ? '#0EA5E9' : '#888';
                return (
                  <View key={`${log.date}-${index}`} style={styles.logItem}>
                    <View style={styles.logLeft}>
                      <View style={[styles.logDateBadge, { backgroundColor: goalMet ? 'rgba(14,165,233,0.1)' : 'rgba(0,0,0,0.04)' }]}>
                        <Text style={[styles.logDateDay, { color: accent }]}>{dayNum}</Text>
                        <Text style={[styles.logDateMonth, { color: accent }]}>{monthAbbr}</Text>
                      </View>
                      <Text style={[styles.logAmount, { color: goalMet ? '#0EA5E9' : '#1F1F1F' }]}>{displayAmount} {waterUnit}</Text>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logDayName}>{dayAbbr}</Text>
                      <View style={[styles.logBadge, { backgroundColor: goalMet ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                        <Text style={{ color: goalMet ? '#10B981' : '#F59E0B', fontSize: 10, fontWeight: '600' }}>
                          {goalMet ? '✓ Goal' : `${Math.round((toLitres(log.amount, log.unit) / 2) * 100)}%`}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteWaterLog(index)}>
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
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
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  page: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flexDirection: 'column',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  calIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  calIconBtnActive: {
    backgroundColor: '#0EA5E9',
  },
  selectedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(14,165,233,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(14,165,233,0.1)',
  },
  selectedStripText: { fontSize: 13, color: '#888' },
  selectedStripDate: { color: '#0EA5E9', fontWeight: '700' },

  calBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 199,
  },
  // Calendar overlay
  calendarCard: {
    position: 'absolute',
    top: 109,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 200,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calNavBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(14,165,233,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  calNavBtnDisabled: { backgroundColor: 'rgba(0,0,0,0.04)' },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#bbb',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 1,
    position: 'relative',
  },
  calCellSelected: {
    backgroundColor: '#0EA5E9',
  },
  calCellFuture: { opacity: 0.3 },
  calDayText: { fontSize: 13, fontWeight: '500', color: '#1F1F1F' },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
  calDayTextToday: { color: '#0EA5E9', fontWeight: '700' },
  calDayTextFuture: { color: '#bbb' },
  calTodayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: '#0EA5E9',
  },

  // Input
  content: { flex: 1, padding: 20 },
  inputSection: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  inputCircleWrap: {
    position: 'relative',
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  inputCircle: {
    position: 'absolute',
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center',
  },
  inputValue: {
    width: 100, fontSize: 40, fontWeight: '700',
    textAlign: 'center', color: '#0EA5E9', padding: 0,
  },
  ringProgressLabel: {
    fontSize: 11, color: '#0EA5E9', fontWeight: '600',
    marginTop: 4, opacity: 0.7,
  },
  unitPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.15)',
    borderRadius: 14, marginTop: 4,
  },
  unitPillText: { fontSize: 12, fontWeight: '600', color: '#0EA5E9', marginRight: 2 },
  logBtn: {
    width: '100%', maxWidth: 200,
    padding: 12, backgroundColor: '#0EA5E9',
    borderRadius: 12, alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 5,
  },
  logBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Stats
  statsSection: { paddingBottom: 16 },
  statsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  statsSectionTitle: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  dropdownWrap: { position: 'relative', zIndex: 100 },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.15)',
    borderRadius: 8,
  },
  dropdownBtnText: { fontSize: 12, fontWeight: '600', color: '#0EA5E9', marginRight: 4 },
  dropdownMenu: {
    position: 'absolute', top: '100%', right: 0, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.1)',
    minWidth: 120, zIndex: 100,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemActive: { backgroundColor: 'rgba(14,165,233,0.08)' },
  dropdownItemText: { fontSize: 13, color: '#444' },
  dropdownItemTextActive: { color: '#0EA5E9', fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', marginBottom: 10,
  },
  statCard: {
    width: '23%', backgroundColor: '#fff',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.1)',
  },
  statCardValue: { fontSize: 13, fontWeight: '700', color: '#1F1F1F', textAlign: 'center' },
  statCardLabel: { fontSize: 8, color: '#888', marginTop: 2, textAlign: 'center' },
  statsMini: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.04)',
    borderRadius: 10, padding: 10,
  },
  statsMiniItem: { alignItems: 'center', flex: 1 },
  statsMiniLabel: { fontSize: 10, color: '#888' },
  statsMiniValue: { fontSize: 13, fontWeight: '600', color: '#1F1F1F' },
  statsMiniDivider: { width: 1, height: 24, backgroundColor: 'rgba(14,165,233,0.15)', marginHorizontal: 12 },

  // Past logs
  pastLogs: { paddingBottom: 20 },
  pastLogsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  pastLogsTitle: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  logsList: { flexDirection: 'column' },
  logItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.08)',
    marginBottom: 6,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center' },
  logDateBadge: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  logDateDay: { fontSize: 14, fontWeight: '700', lineHeight: 16 },
  logDateMonth: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 11 },
  logAmount: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  logRight: { flexDirection: 'row', alignItems: 'center' },
  logDayName: { fontSize: 11, color: '#bbb', marginRight: 6 },
  logBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, marginRight: 8 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});

export default HydrationDetailsPage;
