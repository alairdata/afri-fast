import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const buildDateOptions = () => {
  const opts = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    opts.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      date: d,
      dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }
  return opts;
};

const WeightLogPage = ({ show, onClose, weightLogs, setWeightLogs, weightUnit, setWeightUnit, onWeightSaved, onWeightDeleted }) => {
  const [newWeight, setNewWeight] = useState('');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [weightStatsRange, setWeightStatsRange] = useState('7 days');
  const [showWeightStatsDropdown, setShowWeightStatsDropdown] = useState(false);
  const dateOptions = buildDateOptions();

  const convertWeight = (weight, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return weight;
    if (fromUnit === 'kg' && toUnit === 'lb') return (weight * 2.20462).toFixed(1);
    if (fromUnit === 'lb' && toUnit === 'kg') return (weight / 2.20462).toFixed(1);
    return weight;
  };

  const saveWeight = () => {
    if (!newWeight) return;
    const chosen = dateOptions[selectedDateIdx];
    const newLog = { date: chosen.dateStr, timestamp: chosen.date.getTime(), weight: parseFloat(newWeight), unit: weightUnit };
    setWeightLogs([newLog, ...weightLogs]);
    onWeightSaved && onWeightSaved(newLog);
    setNewWeight('');
  };

  const deleteWeightLog = (index) => {
    const log = weightLogs[index];
    setWeightLogs(weightLogs.filter((_, i) => i !== index));
    onWeightDeleted && onWeightDeleted(log);
  };

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
          <View style={{ width: 40 }} />
        </View>

        {/* Date navigator right under header */}
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            style={[styles.dateNavArrow, selectedDateIdx >= dateOptions.length - 1 && styles.dateNavArrowDisabled]}
            onPress={() => setSelectedDateIdx(i => Math.min(i + 1, dateOptions.length - 1))}
            disabled={selectedDateIdx >= dateOptions.length - 1}
          >
            <Ionicons name="chevron-back" size={20} color={selectedDateIdx >= dateOptions.length - 1 ? '#ccc' : '#059669'} />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{dateOptions[selectedDateIdx].label}</Text>
          <TouchableOpacity
            style={[styles.dateNavArrow, selectedDateIdx === 0 && styles.dateNavArrowDisabled]}
            onPress={() => setSelectedDateIdx(i => Math.max(i - 1, 0))}
            disabled={selectedDateIdx === 0}
          >
            <Ionicons name="chevron-forward" size={20} color={selectedDateIdx === 0 ? '#ccc' : '#059669'} />
          </TouchableOpacity>
        </View>

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
                      <Text style={styles.weightStatIcon}>{'\u2696\uFE0F'}</Text>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 1100,
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
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  dateNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavArrowDisabled: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  dateNavLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
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
