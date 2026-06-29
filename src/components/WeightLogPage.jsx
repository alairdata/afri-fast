import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform, Keyboard } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 24) / 7);

const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const LOG_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const toDateStr = (d) =>
  `${LOG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

const WeightLogPage = ({ show, onClose, weightLogs, setWeightLogs, weightUnit, setWeightUnit, onWeightSaved, onWeightDeleted }) => {
  const [newWeight, setNewWeight] = useState('');
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showCalendar, setShowCalendar] = useState(false);
  const [weightStatsRange, setWeightStatsRange] = useState('7 days');
  const [showWeightStatsDropdown, setShowWeightStatsDropdown] = useState(false);

  const convertWeight = (weight, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return weight;
    if (fromUnit === 'kg' && toUnit === 'lb') return (weight * 2.20462).toFixed(1);
    if (fromUnit === 'lb' && toUnit === 'kg') return (weight / 2.20462).toFixed(1);
    return weight;
  };

  const saveWeight = () => {
    if (!newWeight) return;
    Keyboard.dismiss();
    const newLog = { date: toDateStr(selectedDate), timestamp: selectedDate.getTime(), weight: parseFloat(newWeight), unit: weightUnit };
    setWeightLogs([newLog, ...weightLogs]);
    onWeightSaved && onWeightSaved(newLog);
    setNewWeight('');
  };

  const deleteWeightLog = (index) => {
    const log = weightLogs[index];
    setWeightLogs(weightLogs.filter((_, i) => i !== index));
    onWeightDeleted && onWeightDeleted(log);
  };

  // Calendar grid
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const todayD = today.getDate();
  const todayM = today.getMonth();
  const todayY = today.getFullYear();

  const isToday = selectedDate.getDate() === todayD && selectedDate.getMonth() === todayM && selectedDate.getFullYear() === todayY;
  const yesterday = new Date(today); yesterday.setDate(todayD - 1);
  const isYesterday = selectedDate.toDateString() === yesterday.toDateString();
  const selectedLabel = isToday ? 'Today' : isYesterday ? 'Yesterday'
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (!show) return null;

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>

        {/* Header */}
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>Weight Log</Text>
          <TouchableOpacity
            style={[styles.calendarIconBtn, showCalendar && styles.calendarIconBtnActive]}
            onPress={() => setShowCalendar(v => !v)}
          >
            <Ionicons name={showCalendar ? 'calendar' : 'calendar-outline'} size={20} color={showCalendar ? '#fff' : '#059669'} />
          </TouchableOpacity>
        </View>

        {/* Always-visible date strip */}
        <View style={styles.selectedStrip}>
          <Ionicons name="scale-outline" size={12} color="#059669" />
          <Text style={styles.selectedStripText}>
            Logging for: <Text style={styles.selectedStripDate}>{selectedLabel}</Text>
          </Text>
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
                  const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                  const isTodayCell = day === todayD && month === todayM && year === todayY;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.calCell, { width: CELL_SIZE, height: CELL_SIZE }, isSelected && styles.calCellSelected, !isSelected && isTodayCell && styles.calCellToday]}
                      onPress={() => { setSelectedDate(new Date(year, month, day)); setShowCalendar(false); }}
                    >
                      <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, !isSelected && isTodayCell && styles.calCellTextToday]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <ScrollView style={styles.weightPageContent} showsVerticalScrollIndicator={false}>
          {/* Compact Weight Input Section */}
          <View style={styles.weightInputCompact}>
            {/* Dash Circle Placeholder - SVG not available in RN, using a simple circle */}
            <View style={styles.weightDashContainerSmall}>
              <View style={styles.weightCirclePlaceholder}>
                <TextInput
                  placeholder={weightUnit === 'kg' ? '72' : '160'}
                  placeholderTextColor="#ccc"
                  value={newWeight}
                  onChangeText={(text) => setNewWeight(text)}
                  onSubmitEditing={saveWeight}
                  returnKeyType="done"
                  style={styles.weightInputMedium}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.unitDropdownSmall} onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}>
                  <Text style={styles.unitDropdownTextSmall}>{weightUnit}</Text>
                  <Text style={{ color: '#059669', fontSize: 10 }}>{'▼'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.saveWeightBtnCompact} onPress={saveWeight}>
              <Text style={styles.saveWeightBtnTextSmall}>Save Weight</Text>
            </TouchableOpacity>
          </View>

          {/* Weight Statistics */}
          <View style={styles.weightStatsSection}>
            <View style={styles.weightStatsHeader}>
              <Text style={styles.weightStatsSectionTitle}>Weight Statistics</Text>
              <View style={styles.weightStatsDropdownContainer}>
                <TouchableOpacity
                  style={styles.weightStatsDropdownBtn}
                  onPress={() => setShowWeightStatsDropdown(!showWeightStatsDropdown)}
                >
                  <Text style={styles.weightStatsDropdownBtnText}>{weightStatsRange}</Text>
                  <Text style={{ color: '#059669', fontSize: 10 }}>{'▼'}</Text>
                </TouchableOpacity>
                {showWeightStatsDropdown && (
                  <View style={styles.weightStatsDropdownMenu}>
                    {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[
                          styles.weightStatsDropdownItem,
                          weightStatsRange === range ? styles.weightStatsDropdownItemActive : null,
                        ]}
                        onPress={() => {
                          setWeightStatsRange(range);
                          setShowWeightStatsDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.weightStatsDropdownItemText,
                          weightStatsRange === range ? styles.weightStatsDropdownItemTextActive : null,
                        ]}>{range}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            {(() => {
              const days = weightStatsRange === '7 days' ? 7 : weightStatsRange === '30 days' ? 30 : weightStatsRange === '90 days' ? 90 : weightStatsRange === '180 days' ? 180 : 99999;
              const logs = weightLogs || [];
              const rangeLogs = days === 99999 ? logs : logs.filter((_, i) => i < Math.min(days, logs.length));
              const hasData = rangeLogs.length >= 2;
              const unit = logs.length > 0 ? logs[0].unit : 'kg';

              const totalChange = hasData ? (rangeLogs[0].weight - rangeLogs[rangeLogs.length - 1].weight) : 0;
              const weeks = Math.max(days / 7, 1);
              const avgWeekly = hasData ? (totalChange / weeks) : 0;
              const avgWeight = rangeLogs.length > 0 ? (rangeLogs.reduce((s, l) => s + l.weight, 0) / rangeLogs.length) : 0;
              const highest = rangeLogs.length > 0 ? Math.max(...rangeLogs.map(l => l.weight)) : 0;
              const lowest = rangeLogs.length > 0 ? Math.min(...rangeLogs.map(l => l.weight)) : 0;

              return (
                <>
                  <View style={styles.weightStatsGrid}>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F4C9}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData && avgWeekly < 0 ? `${avgWeekly.toFixed(1)} ${unit}` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Avg weekly loss</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F4C8}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData && avgWeekly > 0 ? `+${avgWeekly.toFixed(1)} ${unit}` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Avg weekly gain</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F3AF}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData ? `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)} ${unit}` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Total change</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'⚖️'}</Text>
                      <Text style={styles.weightStatCardValue}>{rangeLogs.length > 0 ? `${avgWeight.toFixed(1)} ${unit}` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Avg weight</Text>
                    </View>
                  </View>
                  <View style={styles.weightStatsMini}>
                    <View style={styles.weightStatMiniItem}>
                      <Text style={styles.weightStatMiniLabel}>Highest</Text>
                      <Text style={styles.weightStatMiniValue}>{rangeLogs.length > 0 ? `${highest} ${unit}` : '--'}</Text>
                    </View>
                    <View style={styles.weightStatMiniDivider} />
                    <View style={styles.weightStatMiniItem}>
                      <Text style={styles.weightStatMiniLabel}>Lowest</Text>
                      <Text style={styles.weightStatMiniValue}>{rangeLogs.length > 0 ? `${lowest} ${unit}` : '--'}</Text>
                    </View>
                    <View style={styles.weightStatMiniDivider} />
                    <View style={styles.weightStatMiniItem}>
                      <Text style={styles.weightStatMiniLabel}>Entries</Text>
                      <Text style={styles.weightStatMiniValue}>{rangeLogs.length > 0 ? rangeLogs.length : '--'}</Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Past Logs Section - Compact */}
          <View style={styles.pastLogsCompact}>
            <View style={styles.pastLogsHeaderRow}>
              <Text style={styles.pastLogsTitleCompact}>Past Logs</Text>
              <TouchableOpacity style={styles.exportBtn}>
                <Text style={styles.exportBtnText}>{'↓'} Export</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logsListCompact}>
              {weightLogs.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No weight logs yet. Start tracking above!</Text>
                </View>
              )}
              {weightLogs.slice(0, 15).map((log, index) => {
                const displayWeight = weightUnit === log.unit
                  ? log.weight
                  : convertWeight(log.weight, log.unit, weightUnit);
                const prevWeight = index < weightLogs.length - 1
                  ? (weightUnit === weightLogs[index + 1].unit
                      ? weightLogs[index + 1].weight
                      : convertWeight(weightLogs[index + 1].weight, weightLogs[index + 1].unit, weightUnit))
                  : null;
                const diff = prevWeight ? (displayWeight - prevWeight).toFixed(1) : null;
                const isGain = diff > 0;

                const logDate = new Date(log.timestamp || log.date);
                const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const dayNum = logDate.getDate();
                const monthAbbr = MONTHS[logDate.getMonth()];
                const dayAbbr = DAYS[logDate.getDay()];

                return (
                  <View key={index} style={styles.logItemCompact}>
                    <View style={styles.logItemLeftCompact}>
                      <View style={styles.logDateBadgeSmall}>
                        <Text style={styles.logDateDayNum}>{dayNum}</Text>
                        <Text style={styles.logDateMonthAbbr}>{monthAbbr}</Text>
                      </View>
                      <Text style={styles.logWeightCompact}>{displayWeight} {weightUnit}</Text>
                    </View>
                    <View style={styles.logItemRightCompact}>
                      <Text style={styles.logDateCompact}>{dayAbbr}</Text>
                      {diff && (
                        <View style={[
                          styles.logDiffSmall,
                          { backgroundColor: isGain ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' },
                        ]}>
                          <Text style={{ color: isGain ? '#EF4444' : '#10B981', fontSize: 10, fontWeight: '600' }}>
                            {isGain ? '+' : ''}{diff}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.logDeleteBtnSmall} onPress={() => deleteWeightLog(index)}>
                        <Text style={{ color: '#EF4444', fontSize: 12 }}>{'🗑'}</Text>
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

const styles = StyleSheet.create({
  weightPageOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  weightPage: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flexDirection: 'column',
    flex: 1,
  },
  weightPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  weightBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  weightPageContent: {
    flex: 1,
    padding: 20,
  },
  weightInputCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  weightDashContainerSmall: {
    position: 'relative',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightCirclePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInputMedium: {
    width: 90,
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'transparent',
    color: '#1F1F1F',
    padding: 0,
  },
  unitDropdownSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    borderRadius: 14,
    marginTop: 4,
  },
  unitDropdownTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginRight: 2,
  },
  calendarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIconBtnActive: {
    backgroundColor: '#059669',
  },
  selectedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(5,150,105,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5,150,105,0.08)',
  },
  selectedStripText: {
    fontSize: 12,
    color: '#666',
  },
  selectedStripDate: {
    fontWeight: '700',
    color: '#059669',
  },
  calendarBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 199,
  },
  calendarCard: {
    position: 'absolute',
    top: 109,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 12,
  },
  calMonthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  calDayLabels: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDayLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    textAlign: 'center',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calCellSelected: {
    backgroundColor: '#059669',
  },
  calCellToday: {
    borderWidth: 1,
    borderColor: '#059669',
  },
  calCellText: {
    fontSize: 13,
    color: '#333',
  },
  calCellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calCellTextToday: {
    color: '#059669',
    fontWeight: '700',
  },
  saveWeightBtnCompact: {
    width: '100%',
    maxWidth: 200,
    padding: 12,
    backgroundColor: '#059669',
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: 'rgba(5, 150, 105, 1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 5,
  },
  saveWeightBtnTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  weightStatsSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  weightStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  weightStatsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  weightStatsDropdownContainer: {
    position: 'relative',
    zIndex: 100,
  },
  weightStatsDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    borderRadius: 8,
  },
  weightStatsDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginRight: 4,
  },
  weightStatsDropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    minWidth: 120,
    zIndex: 100,
  },
  weightStatsDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  weightStatsDropdownItemActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  weightStatsDropdownItemText: {
    fontSize: 13,
    color: '#444',
  },
  weightStatsDropdownItemTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  weightStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weightStatCard: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  weightStatIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  weightStatCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  weightStatCardLabel: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  weightStatsMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 10,
    padding: 10,
  },
  weightStatMiniItem: {
    alignItems: 'center',
    flex: 1,
  },
  weightStatMiniLabel: {
    fontSize: 10,
    color: '#888',
  },
  weightStatMiniValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  weightStatMiniDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    marginHorizontal: 12,
  },
  pastLogsCompact: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pastLogsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pastLogsTitleCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 8,
  },
  exportBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  logsListCompact: {
    flexDirection: 'column',
  },
  logItemCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.06)',
    marginBottom: 6,
  },
  logItemLeftCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logDateBadgeSmall: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logDateDayNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    lineHeight: 16,
  },
  logDateMonthAbbr: {
    fontSize: 9,
    fontWeight: '600',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 11,
  },
  logWeightCompact: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  logDateCompact: {
    fontSize: 11,
    color: '#bbb',
    marginRight: 6,
  },
  logItemRightCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logDiffSmall: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  logDeleteBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
  },
});

export default WeightLogPage;
