import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BMIDetailsPage = ({ show, onClose, onShowWeightModal, weightLogs = [], height = '', heightUnit = 'cm', weightUnit = 'kg' }) => {
  if (!show) return null;

  const latestWeight = weightLogs.length > 0
    ? [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;
  const heightNum = parseFloat(height);
  const heightM = heightNum ? (heightUnit === 'ft' ? heightNum * 0.3048 : heightNum / 100) : 0;
  const weightKg = latestWeight ? (latestWeight.unit === 'lbs' ? latestWeight.weight * 0.453592 : latestWeight.weight) : 0;
  const bmi = latestWeight && heightM > 0 ? parseFloat((weightKg / (heightM * heightM)).toFixed(1)) : null;
  const bmiCategory = bmi ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese') : null;
  const bmiCategoryColor = bmi ? (bmi < 18.5 ? '#3B82F6' : bmi < 25 ? '#10B981' : bmi < 30 ? '#F59E0B' : '#EF4444') : '#10B981';
  const bmiPosition = bmi ? Math.max(0, Math.min(96, ((bmi - 15) / (35 - 15)) * 100)) : 0;
  const heightDisplay = heightNum ? `${height} ${heightUnit}` : '--';
  const weightDisplay = latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : '--';

  const recentLogs = [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate = d => { const dt = new Date(d); return isNaN(dt) ? d : `${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        {/* Header */}
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>BMI & Weight</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.weightPageContent} showsVerticalScrollIndicator={false}>
          {/* Current BMI */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Current BMI</Text>
            <View style={styles.detailCardFull}>
              <View style={styles.bmiDisplayLarge}>
                <View style={styles.bmiValueContainerLarge}>
                  <Text style={styles.bmiValueLarge}>{bmi ?? '--'}</Text>
                  {bmiCategory && <Text style={[styles.bmiCategoryLarge, { color: bmiCategoryColor }]}>{bmiCategory}</Text>}
                </View>
                <View style={styles.bmiMetrics}>
                  <View style={styles.bmiMetricItem}>
                    <Text style={styles.bmiMetricValue}>{weightDisplay}</Text>
                    <Text style={styles.bmiMetricLabel}>Weight</Text>
                  </View>
                  <View style={styles.bmiMetricDivider} />
                  <View style={styles.bmiMetricItem}>
                    <Text style={styles.bmiMetricValue}>{heightDisplay}</Text>
                    <Text style={styles.bmiMetricLabel}>Height</Text>
                  </View>
                </View>
              </View>
              <View style={styles.bmiBarContainerLarge}>
                <View style={styles.bmiBarLarge}>
                  <View style={styles.bmiBarUnderweightLarge} />
                  <View style={styles.bmiBarNormalLarge} />
                  <View style={styles.bmiBarOverweightLarge} />
                  <View style={styles.bmiBarObeseLarge} />
                  {bmi && <View style={[styles.bmiIndicatorLarge, { left: `${bmiPosition}%` }]} />}
                </View>
                <View style={styles.bmiScaleNumbers}>
                  <Text style={styles.bmiScaleText}>15</Text>
                  <Text style={styles.bmiScaleText}>18.5</Text>
                  <Text style={styles.bmiScaleText}>25</Text>
                  <Text style={styles.bmiScaleText}>30</Text>
                  <Text style={styles.bmiScaleText}>35</Text>
                </View>
                <View style={styles.bmiLabelsLarge}>
                  <Text style={styles.bmiLabelLarge}>Underweight</Text>
                  <Text style={[styles.bmiLabelLarge, { color: '#10B981' }]}>Normal</Text>
                  <Text style={styles.bmiLabelLarge}>Overweight</Text>
                  <Text style={styles.bmiLabelLarge}>Obese</Text>
                </View>
              </View>
              {!bmi && (
                <Text style={{ marginTop: 12, fontSize: 13, color: '#888', textAlign: 'center' }}>
                  Log your weight and set your height in Settings to see your BMI.
                </Text>
              )}
            </View>
          </View>

          {/* Weight History */}
          {recentLogs.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Weight History</Text>
              <View style={styles.detailCardFull}>
                {recentLogs.map((log, i) => {
                  const prev = recentLogs[i + 1];
                  const diff = prev ? (log.weight - prev.weight).toFixed(1) : null;
                  const diffColor = diff === null ? '#888' : parseFloat(diff) < 0 ? '#10B981' : parseFloat(diff) > 0 ? '#EF4444' : '#888';
                  return (
                    <View key={i} style={[styles.bmiInfoRow, i === recentLogs.length - 1 && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
                      <Text style={[styles.bmiInfoLabel, { color: '#888', fontSize: 12 }]}>{fmtDate(log.date)}</Text>
                      <Text style={[styles.bmiInfoRange, { fontWeight: '700', fontSize: 15, color: '#1F1F1F' }]}>{log.weight} {log.unit}</Text>
                      {diff !== null && <Text style={{ fontSize: 12, fontWeight: '600', color: diffColor, marginLeft: 8 }}>{parseFloat(diff) > 0 ? '+' : ''}{diff}</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Weight Actions */}
          <View style={styles.detailSection}>
            <View style={styles.bmiActionsRow}>
              <TouchableOpacity style={styles.bmiActionBtn} onPress={onShowWeightModal}>
                <Text style={styles.bmiActionIcon}>{'\u2696\uFE0F'}</Text>
                <Text style={[styles.bmiActionText, { color: '#fff' }]}>Log weight</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bmiActionBtnOutline} onPress={onShowWeightModal}>
                <Text style={styles.bmiActionIcon}>{'\u{1F4CB}'}</Text>
                <Text style={[styles.bmiActionText, { color: '#059669' }]}>View all logs</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BMI Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>BMI Categories</Text>
            <View style={styles.detailCardFull}>
              <View style={styles.bmiInfoRow}>
                <View style={[styles.bmiInfoDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.bmiInfoLabel}>Underweight</Text>
                <Text style={styles.bmiInfoRange}>{'< 18.5'}</Text>
              </View>
              <View style={styles.bmiInfoRow}>
                <View style={[styles.bmiInfoDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.bmiInfoLabel}>Normal</Text>
                <Text style={styles.bmiInfoRange}>18.5 - 24.9</Text>
              </View>
              <View style={styles.bmiInfoRow}>
                <View style={[styles.bmiInfoDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.bmiInfoLabel}>Overweight</Text>
                <Text style={styles.bmiInfoRange}>25 - 29.9</Text>
              </View>
              <View style={[styles.bmiInfoRow, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
                <View style={[styles.bmiInfoDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.bmiInfoLabel}>Obese</Text>
                <Text style={styles.bmiInfoRange}>{'\u2265'} 30</Text>
              </View>
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
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  detailCardFull: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  bmiDisplayLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bmiValueContainerLarge: {
    flexDirection: 'column',
  },
  bmiValueLarge: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1F1F1F',
    lineHeight: 48,
  },
  bmiCategoryLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 4,
  },
  bmiMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bmiMetricItem: {
    alignItems: 'center',
  },
  bmiMetricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  bmiMetricLabel: {
    fontSize: 11,
    color: '#666',
  },
  bmiMetricDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 16,
  },
  bmiBarContainerLarge: {
    marginTop: 16,
  },
  bmiBarLarge: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  bmiBarUnderweightLarge: {
    width: '17.5%',
    backgroundColor: '#3B82F6',
  },
  bmiBarNormalLarge: {
    width: '32.5%',
    backgroundColor: '#10B981',
  },
  bmiBarOverweightLarge: {
    width: '25%',
    backgroundColor: '#F59E0B',
  },
  bmiBarObeseLarge: {
    width: '25%',
    backgroundColor: '#EF4444',
  },
  bmiIndicatorLarge: {
    position: 'absolute',
    top: -4,
    width: 6,
    height: 22,
    backgroundColor: '#1F1F1F',
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  bmiScaleNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bmiScaleText: {
    fontSize: 10,
    color: '#888',
  },
  bmiLabelsLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bmiLabelLarge: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  lineChartPlaceholder: {
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  lineChartPlaceholderLine: {
    height: 3,
    backgroundColor: '#10B981',
    borderRadius: 1.5,
    width: '80%',
    marginBottom: 8,
  },
  xAxisLabelsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  xAxisLabelSmall: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  weightStatsCompact: {
    flexDirection: 'row',
    marginTop: 8,
  },
  weightStatCompact: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  weightStatValueCompact: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  weightStatLabelCompact: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  chartLegendCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  legendDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendTextSmall: {
    fontSize: 9,
    color: '#666',
  },
  bmiActionsRow: {
    flexDirection: 'row',
  },
  bmiActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#059669',
    borderRadius: 12,
    marginRight: 10,
  },
  bmiActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 12,
  },
  bmiActionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  bmiActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bmiInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  bmiInfoDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  bmiInfoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1F1F1F',
  },
  bmiInfoRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});

export default BMIDetailsPage;
