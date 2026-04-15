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
      dateStr: d.toDateString(),
      displayDate: `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    });
  }
  return opts;
};

const HydrationDetailsPage = ({ show, onClose, waterLogs, setWaterLogs, waterUnit, setWaterUnit, onWaterSaved, onWaterDeleted }) => {
  const [newWaterIntake, setNewWaterIntake] = useState('');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [hydrationStatsRange, setHydrationStatsRange] = useState('7 days');
  const [showHydrationStatsDropdown, setShowHydrationStatsDropdown] = useState(false);
  const dateOptions = buildDateOptions();

  const saveWaterIntake = () => {
    if (!newWaterIntake) return;
    const chosen = dateOptions[selectedDateIdx];
    const newLog = {
      id: Date.now(),
      date: chosen.dateStr,
      displayDate: chosen.displayDate,
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

  // Convert everything to mL first, then to target unit
  const toML = (amount, unit) => {
    if (unit === 'mL') return amount;
    if (unit === 'oz') return amount * 29.574;
    if (unit === 'sachet') return amount * 500;   // 1 sachet = 500mL
    if (unit === 'bottle') return amount * 750;   // 1 bottle = 750mL
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

  if (!show) return null;

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        {/* Header */}
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#0EA5E9" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>Hydration Log</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Date navigator right under header */}
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            style={[styles.dateNavArrow, selectedDateIdx >= dateOptions.length - 1 && styles.dateNavArrowDisabled]}
            onPress={() => setSelectedDateIdx(i => Math.min(i + 1, dateOptions.length - 1))}
            disabled={selectedDateIdx >= dateOptions.length - 1}
          >
            <Ionicons name="chevron-back" size={20} color={selectedDateIdx >= dateOptions.length - 1 ? '#ccc' : '#0EA5E9'} />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{dateOptions[selectedDateIdx].label}</Text>
          <TouchableOpacity
            style={[styles.dateNavArrow, selectedDateIdx === 0 && styles.dateNavArrowDisabled]}
            onPress={() => setSelectedDateIdx(i => Math.max(i - 1, 0))}
            disabled={selectedDateIdx === 0}
          >
            <Ionicons name="chevron-forward" size={20} color={selectedDateIdx === 0 ? '#ccc' : '#0EA5E9'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.weightPageContent} showsVerticalScrollIndicator={false}>
          {/* Compact Water Input Section */}
          <View style={styles.weightInputCompact}>
            {/* Dash Circle Placeholder - Water themed */}
            <View style={styles.weightDashContainerSmall}>
              <View style={[styles.weightCirclePlaceholder, { borderColor: 'rgba(14, 165, 233, 0.15)' }]}>
                <TextInput
                  placeholder={waterUnit === 'oz' ? '64' : '1900'}
                  placeholderTextColor="#ccc"
                  value={newWaterIntake}
                  onChangeText={(text) => setNewWaterIntake(text)}
                  style={[styles.weightInputMedium, { color: '#0EA5E9' }]}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.unitDropdownSmall, { backgroundColor: 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.15)' }]}
                  onPress={() => {
                    const units = ['oz', 'mL', 'sachet', 'bottle'];
                    const idx = units.indexOf(waterUnit);
                    setWaterUnit(units[(idx + 1) % units.length]);
                  }}
                >
                  <Text style={[styles.unitDropdownTextSmall, { color: '#0EA5E9' }]}>{waterUnit}</Text>
                  <Text style={{ color: '#0EA5E9', fontSize: 10 }}>{'▼'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveWeightBtnCompact, { backgroundColor: '#0EA5E9', shadowColor: 'rgba(14, 165, 233, 1)' }]}
              onPress={saveWaterIntake}
            >
              <Text style={styles.saveWeightBtnTextSmall}>Log Water</Text>
            </TouchableOpacity>
          </View>

          {/* Hydration Statistics */}
          <View style={styles.weightStatsSection}>
            <View style={styles.weightStatsHeader}>
              <Text style={styles.weightStatsSectionTitle}>Hydration Statistics</Text>
              <View style={styles.weightStatsDropdownContainer}>
                <TouchableOpacity
                  style={[styles.weightStatsDropdownBtn, { backgroundColor: 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.15)' }]}
                  onPress={() => setShowHydrationStatsDropdown(!showHydrationStatsDropdown)}
                >
                  <Text style={[styles.weightStatsDropdownBtnText, { color: '#0EA5E9' }]}>{hydrationStatsRange}</Text>
                  <Text style={{ color: '#0EA5E9', fontSize: 10 }}>{'▼'}</Text>
                </TouchableOpacity>
                {showHydrationStatsDropdown && (
                  <View style={styles.weightStatsDropdownMenu}>
                    {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[
                          styles.weightStatsDropdownItem,
                          hydrationStatsRange === range ? { backgroundColor: 'rgba(14, 165, 233, 0.08)' } : null,
                        ]}
                        onPress={() => {
                          setHydrationStatsRange(range);
                          setShowHydrationStatsDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.weightStatsDropdownItemText,
                          hydrationStatsRange === range ? { color: '#0EA5E9', fontWeight: '600' } : null,
                        ]}>{range}</Text>
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

              // Convert each log to litres
              const toLitres = (amount, u) => {
                const ml = u === 'mL' ? amount : u === 'oz' ? amount * 29.574 : u === 'sachet' ? amount * 500 : u === 'bottle' ? amount * 750 : amount * 237;
                return Math.round(ml / 100) / 10;
              };
              const litreAmounts = rangeLogs.map(l => toLitres(l.amount, l.unit));
              const totalL = litreAmounts.reduce((s, a) => s + a, 0);
              const avgL = hasData ? (totalL / rangeLogs.length).toFixed(1) : '0';
              const bestL = hasData ? Math.max(...litreAmounts).toFixed(1) : '0';
              const lowestL = hasData ? Math.min(...litreAmounts).toFixed(1) : '0';
              const goalMetL = litreAmounts.filter(l => l >= 2.0).length; // 2L daily goal

              return (
                <>
                  <View style={styles.weightStatsGrid}>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F4A7}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData ? `${avgL} L` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Avg daily</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F3AF}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData ? `${goalMetL}/${rangeLogs.length}` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Goal met</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F4C8}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData ? `${bestL} L` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Best day</Text>
                    </View>
                    <View style={styles.weightStatCard}>
                      <Text style={styles.weightStatIcon}>{'\u{1F4CA}'}</Text>
                      <Text style={styles.weightStatCardValue}>{hasData ? `${totalL.toFixed(1)} L` : '--'}</Text>
                      <Text style={styles.weightStatCardLabel}>Total</Text>
                    </View>
                  </View>
                  <View style={styles.weightStatsMini}>
                    <View style={styles.weightStatMiniItem}>
                      <Text style={styles.weightStatMiniLabel}>Lowest</Text>
                      <Text style={styles.weightStatMiniValue}>{hasData ? `${lowestL} L` : '--'}</Text>
                    </View>
                    <View style={styles.weightStatMiniDivider} />
                    <View style={styles.weightStatMiniItem}>
                      <Text style={styles.weightStatMiniLabel}>Entries</Text>
                      <Text style={styles.weightStatMiniValue}>{hasData ? rangeLogs.length : '--'}</Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Past Water Logs - Last 10 */}
          <View style={styles.pastLogsCompact}>
            <View style={styles.pastLogsHeaderRow}>
              <Text style={styles.pastLogsTitleCompact}>Past Logs</Text>
              <TouchableOpacity style={[styles.exportBtn, { backgroundColor: 'rgba(14, 165, 233, 0.08)' }]}>
                <Text style={[styles.exportBtnText, { color: '#0EA5E9' }]}>{'↓'} Export</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logsListCompact}>
              {waterLogs.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No water logs yet. Start tracking above!</Text>
                </View>
              )}
              {waterLogs.slice(0, 10).map((log, index) => {
                const displayAmount = waterUnit === log.unit
                  ? log.amount
                  : convertWaterUnit(log.amount, log.unit, waterUnit);
                const goalMet = log.amount >= 72;

                const logDate = new Date(log.date);
                const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const dayNum = !isNaN(logDate) ? logDate.getDate() : '--';
                const monthAbbr = !isNaN(logDate) ? MONTHS[logDate.getMonth()] : '';
                const dayAbbr = !isNaN(logDate) ? DAYS[logDate.getDay()] : '';
                const accent = goalMet ? '#0EA5E9' : '#888';

                return (
                  <View key={index} style={styles.logItemCompact}>
                    <View style={styles.logItemLeftCompact}>
                      <View style={[styles.logDateBadgeSmall, { backgroundColor: goalMet ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.04)' }]}>
                        <Text style={[styles.logDateDayNum, { color: accent }]}>{dayNum}</Text>
                        <Text style={[styles.logDateMonthAbbr, { color: accent }]}>{monthAbbr}</Text>
                      </View>
                      <Text style={[styles.logWeightCompact, { color: goalMet ? '#0EA5E9' : '#1F1F1F' }]}>{displayAmount} {waterUnit}</Text>
                    </View>
                    <View style={styles.logItemRightCompact}>
                      <Text style={styles.logDateCompact}>{dayAbbr}</Text>
                      <View style={[styles.logDiffSmall, { backgroundColor: goalMet ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                        <Text style={{ color: goalMet ? '#10B981' : '#F59E0B', fontSize: 10, fontWeight: '600' }}>
                          {goalMet ? '✓ Goal' : `${Math.round((log.amount / 72) * 100)}%`}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.logDeleteBtnSmall} onPress={() => deleteWaterLog(index)}>
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
    backgroundColor: 'rgba(14,165,233,0.08)',
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
  weightStatsDropdownItemText: {
    fontSize: 13,
    color: '#444',
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
    textAlign: 'center',
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
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logDateDayNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0EA5E9',
    lineHeight: 16,
  },
  logDateMonthAbbr: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0EA5E9',
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

export default HydrationDetailsPage;
