import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const RING_R = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const ACCENT = '#F97316';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const StepsDetailsPage = ({ show, onClose, stepLogs, setStepLogs, stepGoal = 10000, onStepsSaved, onStepsDeleted }) => {
  const [newSteps, setNewSteps] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [stepsStatsRange, setStepsStatsRange] = useState('7 days');
  const [showStepsStatsDropdown, setShowStepsStatsDropdown] = useState(false);

  const saveSteps = () => {
    if (!newSteps) return;
    const newLog = {
      id: Date.now(),
      date: selectedDate.toDateString(),
      displayDate: `${WEEKDAYS[selectedDate.getDay()]}, ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}`,
      steps: parseInt(newSteps, 10),
    };
    setStepLogs([newLog, ...stepLogs]);
    onStepsSaved && onStepsSaved(newLog);
    setNewSteps('');
  };

  const deleteStepLog = (index) => {
    const log = stepLogs[index];
    setStepLogs(stepLogs.filter((_, i) => i !== index));
    onStepsDeleted && onStepsDeleted(log);
  };

  if (!show) return null;

  const today = new Date();
  const todayStr = today.toDateString();
  const selectedStr = selectedDate.toDateString();

  // Build a map of dateStr → total steps for calendar highlights
  const logsByDate = {};
  (stepLogs || []).forEach(l => {
    if (!logsByDate[l.date]) logsByDate[l.date] = 0;
    logsByDate[l.date] += l.steps;
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
            <Ionicons name="chevron-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.title}>Steps Log</Text>
          <TouchableOpacity
            style={[styles.calIconBtn, showCalendar && styles.calIconBtnActive]}
            onPress={() => setShowCalendar(v => !v)}
          >
            <Ionicons name="calendar-outline" size={20} color={showCalendar ? '#fff' : ACCENT} />
          </TouchableOpacity>
        </View>

        {/* Always-visible selected date strip */}
        <View style={styles.selectedStrip}>
          <Ionicons name="footsteps-outline" size={12} color={ACCENT} />
          <Text style={styles.selectedStripText}>Logging for: <Text style={styles.selectedStripDate}>{selectedLabel}</Text></Text>
        </View>

        {/* Calendar — floats as overlay below header */}
        {showCalendar && <>
          <TouchableOpacity style={styles.calBackdrop} activeOpacity={1} onPress={() => setShowCalendar(false)} />
          <View style={styles.calendarCard}>
          {/* Month nav */}
          <View style={styles.calMonthRow}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={18} color={ACCENT} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity style={[styles.calNavBtn, isNextDisabled && styles.calNavBtnDisabled]} onPress={nextMonth} disabled={isNextDisabled}>
              <Ionicons name="chevron-forward" size={18} color={isNextDisabled ? '#ccc' : ACCENT} />
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
              const steps = logsByDate[ds] || 0;
              const hasLog = steps > 0;
              const fillOpacity = hasLog ? Math.min(steps / stepGoal, 1) : 0;

              return (
                <TouchableOpacity
                  key={ds}
                  style={[
                    styles.calCell,
                    hasLog && { backgroundColor: `rgba(249,115,22,${0.12 + fillOpacity * 0.4})` },
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
          {/* Steps input */}
          <View style={styles.inputSection}>
            {(() => {
              const loggedSteps = logsByDate[selectedStr] || 0;
              const progress = Math.min(loggedSteps / stepGoal, 1);
              const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
              return (
                <View style={styles.inputCircleWrap}>
                  <Svg width={180} height={180} viewBox="0 0 180 180" style={{ position: 'absolute' }}>
                    <Defs>
                      <LinearGradient id="stepsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#F97316" />
                        <Stop offset="100%" stopColor="#FB923C" />
                      </LinearGradient>
                    </Defs>
                    <Circle cx="90" cy="90" r={RING_R} stroke="rgba(249,115,22,0.12)" strokeWidth="8" fill="none" />
                    <Circle
                      cx="90" cy="90" r={RING_R}
                      stroke="url(#stepsGrad)"
                      strokeWidth="10" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 90 90)"
                    />
                  </Svg>
                  <View style={styles.inputCircle}>
                    <TextInput
                      placeholder="8000"
                      placeholderTextColor="#ccc"
                      value={newSteps}
                      onChangeText={setNewSteps}
                      style={styles.inputValue}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.unitLabel}>steps</Text>
                    {loggedSteps > 0 && (
                      <Text style={styles.ringProgressLabel}>
                        {loggedSteps.toLocaleString()} / {stepGoal.toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity style={styles.logBtn} onPress={saveSteps}>
              <Text style={styles.logBtnText}>Log Steps</Text>
            </TouchableOpacity>
          </View>


          {/* Steps Statistics */}
          <View style={styles.statsSection}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsSectionTitle}>Steps Statistics</Text>
              <View style={styles.dropdownWrap}>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowStepsStatsDropdown(!showStepsStatsDropdown)}
                >
                  <Text style={styles.dropdownBtnText}>{stepsStatsRange}</Text>
                  <Text style={{ color: ACCENT, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                {showStepsStatsDropdown && (
                  <View style={styles.dropdownMenu}>
                    {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[styles.dropdownItem, stepsStatsRange === range && styles.dropdownItemActive]}
                        onPress={() => { setStepsStatsRange(range); setShowStepsStatsDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, stepsStatsRange === range && styles.dropdownItemTextActive]}>{range}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            {(() => {
              const days = stepsStatsRange === '7 days' ? 7 : stepsStatsRange === '30 days' ? 30 : stepsStatsRange === '90 days' ? 90 : 99999;
              const logs = stepLogs || [];
              const rangeLogs = days === 99999 ? logs : logs.slice(0, Math.min(days, logs.length));
              const hasData = rangeLogs.length > 0;
              const stepAmounts = rangeLogs.map(l => l.steps);
              const totalSteps = stepAmounts.reduce((s, a) => s + a, 0);
              const avgSteps = hasData ? Math.round(totalSteps / rangeLogs.length) : 0;
              const bestSteps = hasData ? Math.max(...stepAmounts) : 0;
              const lowestSteps = hasData ? Math.min(...stepAmounts) : 0;
              const goalMetCount = stepAmounts.filter(s => s >= stepGoal).length;
              return (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Ionicons name="footsteps-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? avgSteps.toLocaleString() : '--'}</Text>
                      <Text style={styles.statCardLabel}>Avg daily</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? `${goalMetCount}/${rangeLogs.length}` : '--'}</Text>
                      <Text style={styles.statCardLabel}>Goal met</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="trending-up-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? bestSteps.toLocaleString() : '--'}</Text>
                      <Text style={styles.statCardLabel}>Best day</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="bar-chart-outline" size={16} color="#1F1F1F" style={{ marginBottom: 4 }} />
                      <Text style={styles.statCardValue}>{hasData ? totalSteps.toLocaleString() : '--'}</Text>
                      <Text style={styles.statCardLabel}>Total</Text>
                    </View>
                  </View>
                  <View style={styles.statsMini}>
                    <View style={styles.statsMiniItem}>
                      <Text style={styles.statsMiniLabel}>Lowest</Text>
                      <Text style={styles.statsMiniValue}>{hasData ? lowestSteps.toLocaleString() : '--'}</Text>
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
              {stepLogs.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No step logs yet. Start tracking above!</Text>
                </View>
              )}
              {stepLogs.slice(0, 10).map((log, index) => {
                const goalMet = log.steps >= stepGoal;
                const logDate = new Date(log.date);
                const dayNum = !isNaN(logDate) ? logDate.getDate() : '--';
                const monthAbbr = !isNaN(logDate) ? MONTHS_SHORT[logDate.getMonth()] : '';
                const dayAbbr = !isNaN(logDate) ? WEEKDAYS[logDate.getDay()] : '';
                const accent = goalMet ? ACCENT : '#888';
                return (
                  <View key={`${log.date}-${index}`} style={styles.logItem}>
                    <View style={styles.logLeft}>
                      <View style={[styles.logDateBadge, { backgroundColor: goalMet ? 'rgba(249,115,22,0.1)' : 'rgba(0,0,0,0.04)' }]}>
                        <Text style={[styles.logDateDay, { color: accent }]}>{dayNum}</Text>
                        <Text style={[styles.logDateMonth, { color: accent }]}>{monthAbbr}</Text>
                      </View>
                      <Text style={[styles.logAmount, { color: goalMet ? ACCENT : '#1F1F1F' }]}>{log.steps.toLocaleString()} steps</Text>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logDayName}>{dayAbbr}</Text>
                      <View style={[styles.logBadge, { backgroundColor: goalMet ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                        <Text style={{ color: goalMet ? '#10B981' : '#F59E0B', fontSize: 10, fontWeight: '600' }}>
                          {goalMet ? '✓ Goal' : `${Math.round((log.steps / stepGoal) * 100)}%`}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteStepLog(index)}>
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
    backgroundColor: 'rgba(249,115,22,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  calIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  calIconBtnActive: {
    backgroundColor: ACCENT,
  },
  selectedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249,115,22,0.1)',
  },
  selectedStripText: { fontSize: 13, color: '#888' },
  selectedStripDate: { color: ACCENT, fontWeight: '700' },

  calBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 199,
  },
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
    backgroundColor: 'rgba(249,115,22,0.08)',
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
    backgroundColor: ACCENT,
  },
  calCellFuture: { opacity: 0.3 },
  calDayText: { fontSize: 13, fontWeight: '500', color: '#1F1F1F' },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
  calDayTextToday: { color: ACCENT, fontWeight: '700' },
  calDayTextFuture: { color: '#bbb' },
  calTodayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
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
    width: 130, fontSize: 34, fontWeight: '700',
    textAlign: 'center', color: ACCENT, padding: 0,
  },
  unitLabel: { fontSize: 12, fontWeight: '600', color: ACCENT, opacity: 0.7, marginTop: -2 },
  ringProgressLabel: {
    fontSize: 11, color: ACCENT, fontWeight: '600',
    marginTop: 4, opacity: 0.7,
  },
  logBtn: {
    width: '100%', maxWidth: 200,
    padding: 12, backgroundColor: ACCENT,
    borderRadius: 12, alignItems: 'center',
    shadowColor: ACCENT,
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
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)',
    borderRadius: 8,
  },
  dropdownBtnText: { fontSize: 12, fontWeight: '600', color: ACCENT, marginRight: 4 },
  dropdownMenu: {
    position: 'absolute', top: '100%', right: 0, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.1)',
    minWidth: 120, zIndex: 100,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemActive: { backgroundColor: 'rgba(249,115,22,0.08)' },
  dropdownItemText: { fontSize: 13, color: '#444' },
  dropdownItemTextActive: { color: ACCENT, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', marginBottom: 10,
  },
  statCard: {
    width: '23%', backgroundColor: '#fff',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.1)',
  },
  statCardValue: { fontSize: 13, fontWeight: '700', color: '#1F1F1F', textAlign: 'center' },
  statCardLabel: { fontSize: 8, color: '#888', marginTop: 2, textAlign: 'center' },
  statsMini: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.04)',
    borderRadius: 10, padding: 10,
  },
  statsMiniItem: { alignItems: 'center', flex: 1 },
  statsMiniLabel: { fontSize: 10, color: '#888' },
  statsMiniValue: { fontSize: 13, fontWeight: '600', color: '#1F1F1F' },
  statsMiniDivider: { width: 1, height: 24, backgroundColor: 'rgba(249,115,22,0.15)', marginHorizontal: 12 },

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
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.08)',
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

export default StepsDetailsPage;
