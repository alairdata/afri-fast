import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const CalorieDetailsPage = ({ show, onClose, recentMeals }) => {
  const [calorieRange, setCalorieRange] = useState('7 days');

  if (!show) return null;

  const meals = recentMeals || [];
  const days = calorieRange === '7 days' ? 7 : calorieRange === '30 days' ? 30 : calorieRange === '90 days' ? 90 : 99999;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const rangeMeals = meals.filter(m => m.date && new Date(m.date).getTime() >= cutoff);
  const byDate = {};
  rangeMeals.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    byDate[m.date].calories += m.calories || 0;
    byDate[m.date].protein += m.protein || 0;
    byDate[m.date].carbs += m.carbs || 0;
    byDate[m.date].fats += m.fats || 0;
  });
  const daysCount = Object.keys(byDate).length;
  const totals = rangeMeals.reduce((s, m) => ({
    calories: s.calories + (m.calories || 0),
    protein: s.protein + (m.protein || 0),
    carbs: s.carbs + (m.carbs || 0),
    fats: s.fats + (m.fats || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
  const hasData = daysCount > 0;
  const avg = (val) => hasData ? Math.round(val / daysCount) : 0;
  const dailyVals = Object.values(byDate).map(d => d.calories);
  const highest = dailyVals.length > 0 ? Math.max(...dailyVals) : 0;
  const lowest = dailyVals.length > 0 ? Math.min(...dailyVals) : 0;
  const totalMacro = totals.protein + totals.carbs + totals.fats;
  const pct = (val) => totalMacro > 0 ? Math.round((val / totalMacro) * 100) : 0;
  const dailyData = Object.entries(byDate).map(([date, d]) => ({ date, ...d })).reverse();
  const hasMultiple = dailyData.length >= 2;
  const chartLabels = dailyData.map(d => { const dt = new Date(d.date); return isNaN(dt.getTime()) ? '' : `${dt.getDate()}/${dt.getMonth() + 1}`; });

  const makeMacroChart = (dataPoints, color, suffix) => (
    <LineChart
      data={{ labels: chartLabels, datasets: [{ data: dataPoints.length > 0 ? dataPoints : [0] }] }}
      width={SCREEN_WIDTH - 72}
      height={160}
      yAxisSuffix={suffix}
      chartConfig={{
        backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
        decimalPlaces: 0,
        color: (opacity = 1) => color.replace('1)', `${opacity})`),
        labelColor: () => '#888',
        propsForDots: { r: '4', strokeWidth: '2', stroke: color.replace('1)', '1)'), fill: '#fff' },
        propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(0,0,0,0.04)' },
        fillShadowGradientFrom: color.replace('1)', '1)'),
        fillShadowGradientTo: '#fff',
        fillShadowGradientFromOpacity: 0.1,
        fillShadowGradientToOpacity: 0,
      }}
      bezier
      style={{ borderRadius: 12 }}
      withInnerLines={true}
      withOuterLines={false}
      fromZero={false}
    />
  );

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        {/* Header */}
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>Calorie Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Time Range Filter */}
        <View style={styles.detailsTimeRange}>
          {['7 days', '30 days', '90 days', 'All time'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.detailsTimeBtn,
                calorieRange === range ? styles.detailsTimeBtnActive : null,
              ]}
              onPress={() => setCalorieRange(range)}
            >
              <Text style={[
                styles.detailsTimeBtnText,
                calorieRange === range ? styles.detailsTimeBtnTextActive : null,
              ]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.weightPageContent} showsVerticalScrollIndicator={false}>
          {/* Calorie Statistics - Compact 4 in a row */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Calorie Statistics</Text>
            <View style={styles.calorieStatsGridCompact}>
              <View style={styles.calorieStatCardCompact}>
                <Text style={styles.calorieStatCardIconSmall}>{'\u{1F525}'}</Text>
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? avg(totals.calories).toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Avg daily</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Text style={styles.calorieStatCardIconSmall}>{'\u{1F4CA}'}</Text>
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? (totals.calories >= 1000 ? `${(totals.calories / 1000).toFixed(1)}k` : totals.calories) : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Total cal</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Text style={styles.calorieStatCardIconSmall}>{'\u{1F4C8}'}</Text>
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? highest.toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Highest</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Text style={styles.calorieStatCardIconSmall}>{'\u{1F4C9}'}</Text>
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? lowest.toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Lowest</Text>
              </View>
            </View>
          </View>

          {/* Protein Intake Trend */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>{'\u{1F969}'} Protein Intake</Text>
            <View style={styles.chartCardCompact}>
              <View style={{ height: 170, justifyContent: 'center', alignItems: 'center' }}>
                {hasMultiple ? makeMacroChart(dailyData.map(d => d.protein || 0), 'rgba(239, 68, 68, 1)', 'g')
                  : <Text style={styles.chartPlaceholderText}>{hasData ? `${avg(totals.protein)}g avg` : 'No data'}</Text>}
              </View>
              <View style={styles.macroStatsRowCompact}>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${avg(totals.protein)}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Avg daily</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${pct(totals.protein)}%` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Of total</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${totals.protein}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Total</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Carbs Intake Trend */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>{'\u{1F35E}'} Carbohydrate Intake</Text>
            <View style={styles.chartCardCompact}>
              <View style={{ height: 170, justifyContent: 'center', alignItems: 'center' }}>
                {hasMultiple ? makeMacroChart(dailyData.map(d => d.carbs || 0), 'rgba(245, 158, 11, 1)', 'g')
                  : <Text style={styles.chartPlaceholderText}>{hasData ? `${avg(totals.carbs)}g avg` : 'No data'}</Text>}
              </View>
              <View style={styles.macroStatsRowCompact}>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${avg(totals.carbs)}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Avg daily</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${pct(totals.carbs)}%` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Of total</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${totals.carbs}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Total</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Fats Intake Trend */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>{'\u{1F951}'} Fat Intake</Text>
            <View style={styles.chartCardCompact}>
              <View style={{ height: 170, justifyContent: 'center', alignItems: 'center' }}>
                {hasMultiple ? makeMacroChart(dailyData.map(d => d.fats || 0), 'rgba(139, 92, 246, 1)', 'g')
                  : <Text style={styles.chartPlaceholderText}>{hasData ? `${avg(totals.fats)}g avg` : 'No data'}</Text>}
              </View>
              <View style={styles.macroStatsRowCompact}>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${avg(totals.fats)}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Avg daily</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${pct(totals.fats)}%` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Of total</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>{hasData ? `${totals.fats}g` : '--'}</Text>
                  <Text style={styles.macroStatLabelSmall}>Total</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Fiber Intake Trend */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>{'\u{1F96C}'} Fiber Intake</Text>
            <View style={styles.chartCardCompact}>
              <View style={{ height: 170, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.chartPlaceholderText}>No fiber data</Text>
                <Text style={styles.chartPlaceholderSubtext}>Coming soon</Text>
              </View>
              <View style={styles.macroStatsRowCompact}>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>--</Text>
                  <Text style={styles.macroStatLabelSmall}>Avg daily</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>--</Text>
                  <Text style={styles.macroStatLabelSmall}>Of goal</Text>
                </View>
                <View style={styles.macroStatItemCompact}>
                  <Text style={styles.macroStatValueSmall}>--</Text>
                  <Text style={styles.macroStatLabelSmall}>Total</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Macro Distribution */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Macro Distribution</Text>
            <View style={styles.macroCardCompact}>
              <View style={styles.macroDistribution}>
                <View style={styles.macroDistBarCompact}>
                  <View style={{ width: hasData ? `${pct(totals.protein)}%` : '33%', height: '100%', backgroundColor: '#EF4444', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
                  <View style={{ width: hasData ? `${pct(totals.carbs)}%` : '34%', height: '100%', backgroundColor: '#F59E0B' }} />
                  <View style={{ width: hasData ? `${pct(totals.fats)}%` : '33%', height: '100%', backgroundColor: '#8B5CF6', borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
                </View>
                <View style={styles.macroDistLegendCompact}>
                  <View style={styles.macroDistItemCompact}>
                    <View style={[styles.macroDistDotSmall, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.macroDistLabelSmall}>Protein {hasData ? `${pct(totals.protein)}%` : '--'}</Text>
                  </View>
                  <View style={styles.macroDistItemCompact}>
                    <View style={[styles.macroDistDotSmall, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.macroDistLabelSmall}>Carbs {hasData ? `${pct(totals.carbs)}%` : '--'}</Text>
                  </View>
                  <View style={styles.macroDistItemCompact}>
                    <View style={[styles.macroDistDotSmall, { backgroundColor: '#8B5CF6' }]} />
                    <Text style={styles.macroDistLabelSmall}>Fats {hasData ? `${pct(totals.fats)}%` : '--'}</Text>
                  </View>
                </View>
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
  detailsTimeRange: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailsTimeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  detailsTimeBtnActive: {
    backgroundColor: '#059669',
  },
  detailsTimeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  detailsTimeBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  calorieStatsGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calorieStatCardCompact: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  calorieStatCardIconSmall: {
    fontSize: 16,
    marginBottom: 4,
  },
  calorieStatCardValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  calorieStatCardLabelSmall: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  macroCardCompact: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  macroChartPlaceholder: {
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginBottom: 6,
  },
  macroChartLine: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
  },
  macroStatsRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  macroStatItemCompact: {
    alignItems: 'center',
  },
  macroStatValueSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  macroStatLabelSmall: {
    fontSize: 9,
    color: '#888',
  },
  macroDistribution: {
    paddingVertical: 8,
  },
  macroDistBarCompact: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  macroDistLegendCompact: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroDistItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDistDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 4,
  },
  macroDistLabelSmall: {
    fontSize: 10,
    color: '#444',
    fontWeight: '500',
  },
  chartCardCompact: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  chartPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default CalorieDetailsPage;
