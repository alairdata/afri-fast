import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, TextInput, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RANGE_DAYS = {
  '7 days': 7,
  '30 days': 30,
  '90 days': 90,
  'All time': null,
};

const clampPct = (value) => Math.max(0, Math.min(100, value));

const labelForScore = (value, positiveHigh = 'Great') => {
  if (value <= 0) return '--';
  if (value >= 80) return positiveHigh;
  if (value >= 60) return 'Good';
  return 'Needs support';
};

// Groups recentMeals by date string → { date: { cal, count, timestamp } }
function buildMealsByDate(recentMeals, cutoff) {
  const map = {};
  (recentMeals || []).forEach((meal) => {
    const d = new Date(meal.date);
    if (Number.isNaN(d.getTime())) return;
    if (cutoff && d.getTime() < cutoff) return;
    const key = meal.date;
    if (!map[key]) map[key] = { cal: 0, count: 0, timestamp: d.getTime() };
    map[key].cal += meal.calories || 0;
    map[key].count += 1;
  });
  return map;
}

// ─── Log History sub-page ────────────────────────────────────────────────────
function LogHistoryPage({ show, onClose, recentMeals = [], dailyCalorieGoal = 2000 }) {
  const [range, setRange] = useState('30 days');
  const [searchQuery, setSearchQuery] = useState('');

  const data = useMemo(() => {
    const days = RANGE_DAYS[range];
    const now = Date.now();
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const mealsByDate = buildMealsByDate(recentMeals, cutoff);

    const allDays = Object.entries(mealsByDate).map(([date, info]) => ({ date, ...info }));

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? allDays.filter(({ date }) => date.toLowerCase().includes(normalizedQuery))
      : allDays;

    const onGoal = filtered.filter((d) => d.cal <= dailyCalorieGoal).length;
    const overGoal = filtered.filter((d) => d.cal > dailyCalorieGoal).length;

    const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);

    return { hasDays: filtered.length > 0, onGoal, overGoal, totalMatches: filtered.length, days: sorted };
  }, [recentMeals, range, searchQuery, dailyCalorieGoal]);

  if (!show) return null;

  return (
    <View style={styles.pageOverlay}>
      <View style={styles.page}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Log History</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.rangeRow}>
          {['7 days', '30 days', '90 days', 'All time'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.rangeBtn, range === item && styles.rangeBtnActive]}
              onPress={() => setRange(item)}
            >
              <Text style={[styles.rangeBtnText, range === item && styles.rangeBtnTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by date e.g. Mon Jun 30"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.sectionHelperLeft}>
              {searchQuery.trim() ? `${data.totalMatches} matching day${data.totalMatches === 1 ? '' : 's'}` : 'Showing all logged days in this range'}
            </Text>
            <View style={styles.grid}>
              <View style={[styles.card, styles.summaryCardGreen]}>
                <Text style={styles.cardValue}>{data.hasDays ? data.onGoal : '--'}</Text>
                <Text style={styles.cardLabel}>Days on goal</Text>
                <Text style={styles.cardMeta}>At or under your calorie target</Text>
              </View>
              <View style={[styles.card, styles.summaryCardWarm, styles.gridLastItem]}>
                <Text style={styles.cardValue}>{data.hasDays ? data.overGoal : '--'}</Text>
                <Text style={styles.cardLabel}>Days over goal</Text>
                <Text style={styles.cardMeta}>Exceeded your calorie target</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day by Day</Text>
            <View style={styles.fullCard}>
              {data.days.length === 0 ? (
                <Text style={styles.emptyText}>Your meal history for this range will appear here.</Text>
              ) : (
                data.days.map((day, index) => {
                  const onGoal = day.cal <= dailyCalorieGoal;
                  return (
                    <View
                      key={day.date}
                      style={[styles.dayRow, index === data.days.length - 1 && styles.dayRowLast]}
                    >
                      <View style={styles.dayHeader}>
                        <View style={styles.dayInfo}>
                          <Text style={styles.dayTitle}>{day.date}</Text>
                          <Text style={styles.daySubtext}>{day.count} meal{day.count === 1 ? '' : 's'} logged</Text>
                        </View>
                        <View style={styles.dayCounts}>
                          <View style={[styles.dayCountChip, onGoal ? styles.dayCountChipGreen : styles.dayCountChipWarm]}>
                            <Text style={styles.dayCountValue}>{day.cal.toLocaleString()}</Text>
                            <Text style={styles.dayCountLabel}>{onGoal ? 'On goal ✓' : 'Over goal'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Main Progress Details page ───────────────────────────────────────────────
export default function FastingDetailsPage({ show, onClose, recentMeals = [], checkInHistory = [], dailyCalorieGoal = 2000, onDeleteFastSession }) {
  const [progressRange, setProgressRange] = useState('7 days');
  const [showLogHistory, setShowLogHistory] = useState(false);

  useEffect(() => {
    if (!show) setShowLogHistory(false);
  }, [show]);

  const progressData = useMemo(() => {
    const days = RANGE_DAYS[progressRange];
    const now = Date.now();
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const previousCutoff = days ? cutoff - days * 24 * 60 * 60 * 1000 : null;

    const mealsByDate = buildMealsByDate(recentMeals, cutoff);
    const prevMealsByDate = {};
    (recentMeals || []).forEach((meal) => {
      const t = new Date(meal.date).getTime();
      if (!previousCutoff || t < previousCutoff || (cutoff && t >= cutoff)) return;
      if (!prevMealsByDate[meal.date]) prevMealsByDate[meal.date] = { cal: 0 };
      prevMealsByDate[meal.date].cal += meal.calories || 0;
    });

    const dayArr = Object.values(mealsByDate);
    const daysLogged = dayArr.length;
    const totalCal = dayArr.reduce((s, d) => s + d.cal, 0);
    const avgDailyCalories = daysLogged > 0 ? Math.round(totalCal / daysLogged) : 0;
    const goalHitDays = dayArr.filter((d) => d.cal <= dailyCalorieGoal).length;
    const goalHitRate = daysLogged > 0 ? `${Math.round((goalHitDays / daysLogged) * 100)}%` : '--';

    // Longest consecutive streak of days with meals logged
    let longestStreak = 0;
    let currentStreak = 0;
    const today = new Date();
    const totalDaysToCheck = days || 365;
    for (let offset = 0; offset < totalDaysToCheck; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      if (mealsByDate[d.toDateString()]) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Trend vs previous period
    const prevArr = Object.values(prevMealsByDate);
    const prevAvgCal = prevArr.length > 0 ? prevArr.reduce((s, d) => s + d.cal, 0) / prevArr.length : 0;
    const trendDelta = prevAvgCal > 0 ? ((avgDailyCalories - prevAvgCal) / prevAvgCal) * 100 : 0;
    const periodTrend = daysLogged === 0 ? 'Getting started' : Math.abs(trendDelta) <= 5 ? 'Steady' : trendDelta < -5 ? 'Improving' : 'Needs attention';

    // Best/worst day for tracking
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayStats = weekdayNames.map((weekday, idx) => ({
      weekday,
      count: dayArr.filter((d) => new Date(d.timestamp).getDay() === idx).length,
    }));
    const bestDay = weekdayStats.reduce((best, item) => (item.count > best.count ? item : best), { weekday: '--', count: 0 });
    const worstDay = weekdayStats.reduce((worst, item) => (item.count < worst.count ? item : worst), { weekday: '--', count: Infinity });

    // Bar chart — calories per day/period
    const maxCal = Math.max(dailyCalorieGoal * 1.5, ...dayArr.map((d) => d.cal), 1);

    const createBars = () => {
      if (progressRange === '7 days') {
        const values = [];
        const colors = [];
        const labels = [];
        for (let offset = 6; offset >= 0; offset--) {
          const d = new Date(today);
          d.setDate(d.getDate() - offset);
          const dayData = mealsByDate[d.toDateString()];
          const cal = dayData ? dayData.cal : 0;
          values.push(cal);
          colors.push(cal === 0 ? '#E5E7EB' : cal <= dailyCalorieGoal ? '#10B981' : '#F59E0B');
          labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' }));
        }
        return { values, colors, labels };
      }
      const bucketCount = progressRange === '30 days' ? 5 : 6;
      const emptyValues = Array.from({ length: bucketCount }, () => 0);
      const emptyLabels = Array.from({ length: bucketCount }, (_, i) => progressRange === '30 days' ? `W${i + 1}` : `P${i + 1}`);
      if (!dayArr.length) return { values: emptyValues, colors: emptyValues.map(() => '#E5E7EB'), labels: emptyLabels };
      const minTime = Math.min(...dayArr.map((d) => d.timestamp));
      const maxTime = Math.max(...dayArr.map((d) => d.timestamp));
      const span = Math.max(maxTime - minTime, 1);
      const buckets = emptyValues.map(() => []);
      dayArr.forEach((d) => {
        const ratio = (d.timestamp - minTime) / span;
        const bi = Math.min(bucketCount - 1, Math.floor(ratio * bucketCount));
        buckets[bi].push(d.cal);
      });
      const values = buckets.map((b) => (b.length ? Math.round(b.reduce((s, v) => s + v, 0) / b.length) : 0));
      return {
        values,
        colors: values.map((v) => v === 0 ? '#E5E7EB' : v <= dailyCalorieGoal ? '#10B981' : '#F59E0B'),
        labels: emptyLabels,
      };
    };

    const bars = createBars();

    // Wellness from check-ins
    const checkIns = (checkInHistory || []).filter((entry) => {
      const d = new Date(entry.timestamp || entry.date);
      return !Number.isNaN(d.getTime()) && (!cutoff || d.getTime() >= cutoff);
    });

    const symptomTallies = { lowEnergy: 0, brainFog: 0, cravings: 0, noSymptoms: 0 };
    const negativeMoodCount = checkIns.filter((e) =>
      (e.moods || []).some((m) => m.includes('Irritable') || m.includes('Anxious') || m.includes('Low mood') || m.includes('Stressed'))
    ).length;

    checkIns.forEach((entry) => {
      const s = entry.symptoms || [];
      if (s.some((x) => x.includes('Low energy'))) symptomTallies.lowEnergy++;
      if (s.some((x) => x.includes('Brain fog') || x.includes('Trouble concentrating'))) symptomTallies.brainFog++;
      if (s.some((x) => x.includes('Cravings'))) symptomTallies.cravings++;
      if (s.some((x) => x.includes('Everything feels fine'))) symptomTallies.noSymptoms++;
    });

    const symptomTotal = Object.values(symptomTallies).reduce((s, v) => s + v, 0);
    const energyScore = checkIns.length ? clampPct(100 - Math.round((symptomTallies.lowEnergy / checkIns.length) * 100)) : 0;
    const focusScore = checkIns.length ? clampPct(100 - Math.round((symptomTallies.brainFog / checkIns.length) * 100)) : 0;
    const moodScore = checkIns.length ? clampPct(100 - Math.round((negativeMoodCount / checkIns.length) * 100)) : 0;

    const hungerCounts = {};
    checkIns.forEach((e) => {
      if (!e.hungerLevel) return;
      hungerCounts[e.hungerLevel] = (hungerCounts[e.hungerLevel] || 0) + 1;
    });
    const avgHungerLevel = Object.keys(hungerCounts).length
      ? Object.entries(hungerCounts).sort((a, b) => b[1] - a[1])[0][0].replace(/^[^\s]+\s/, '')
      : '--';

    const topSymptom = Object.entries({
      'Low energy': symptomTallies.lowEnergy,
      'Brain fog': symptomTallies.brainFog,
      Cravings: symptomTallies.cravings,
      'No symptoms': symptomTallies.noSymptoms,
    }).sort((a, b) => b[1] - a[1])[0];

    const commonSymptom = topSymptom && topSymptom[1] > 0 ? topSymptom[0] : '--';
    const symptomInsight = checkIns.length === 0
      ? 'Check-ins will unlock wellbeing patterns here.'
      : commonSymptom === 'No symptoms'
        ? 'Most of your check-ins report feeling good on your tracked days.'
        : `${commonSymptom} is the pattern showing up most often in your check-ins right now.`;

    return {
      avgDailyCalories: avgDailyCalories > 0 ? `${avgDailyCalories.toLocaleString()} cal` : '--',
      goalHitRate,
      longestStreak: longestStreak > 0 ? `${longestStreak}d` : '--',
      daysLogged,
      calorieBars: bars.values,
      barColors: bars.colors,
      calorieAvg: avgDailyCalories,
      calorieMaxCal: maxCal,
      barLabels: bars.labels,
      weekVsLastWeek: prevArr.length ? `${trendDelta >= 0 ? '+' : ''}${Math.round(trendDelta)}%` : '--',
      periodTrend,
      bestDayForTracking: bestDay.count > 0 ? bestDay.weekday : '--',
      mostMissedDay: worstDay.count !== Infinity ? worstDay.weekday : '--',
      energyScore,
      focusScore,
      moodScore,
      energyLabel: labelForScore(energyScore),
      focusLabel: labelForScore(focusScore),
      moodLabel: labelForScore(moodScore, 'Steady'),
      avgHungerLevel,
      commonSymptom,
      lowEnergyPct: symptomTotal ? Math.round((symptomTallies.lowEnergy / symptomTotal) * 100) : 0,
      brainFogPct: symptomTotal ? Math.round((symptomTallies.brainFog / symptomTotal) * 100) : 0,
      cravingsPct: symptomTotal ? Math.round((symptomTallies.cravings / symptomTotal) * 100) : 0,
      noSymptomsPct: symptomTotal ? Math.round((symptomTallies.noSymptoms / symptomTotal) * 100) : 0,
      symptomInsight,
      hasDays: daysLogged > 0,
      hasCheckIns: checkIns.length > 0,
    };
  }, [progressRange, recentMeals, dailyCalorieGoal, checkInHistory]);

  if (!show) return null;

  if (showLogHistory) {
    return (
      <LogHistoryPage
        show={showLogHistory}
        onClose={() => setShowLogHistory(false)}
        recentMeals={recentMeals}
        dailyCalorieGoal={dailyCalorieGoal}
      />
    );
  }

  return (
    <View style={styles.pageOverlay}>
      <View style={styles.page}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Progress Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.rangeRow}>
          {['7 days', '30 days', '90 days', 'All time'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.rangeBtn, progressRange === range && styles.rangeBtnActive]}
              onPress={() => setProgressRange(range)}
            >
              <Text style={[styles.rangeBtnText, progressRange === range && styles.rangeBtnTextActive]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calorie Overview</Text>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardValue}>{progressData.hasDays ? progressData.avgDailyCalories : '--'}</Text>
                <Text style={styles.cardLabel}>Avg daily calories</Text>
              </View>
              <View style={[styles.card, styles.gridLastItem]}>
                <Text style={styles.cardValue}>{progressData.hasDays ? progressData.goalHitRate : '--'}</Text>
                <Text style={styles.cardLabel}>Days on goal</Text>
              </View>
            </View>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardValue}>{progressData.hasDays ? progressData.longestStreak : '--'}</Text>
                <Text style={styles.cardLabel}>Best streak</Text>
              </View>
              <TouchableOpacity
                style={[styles.card, styles.pressableCard, styles.gridLastItem]}
                onPress={() => setShowLogHistory(true)}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardValue}>{progressData.hasDays ? progressData.daysLogged : '--'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#059669" />
                </View>
                <Text style={styles.cardLabel}>Days logged</Text>
                <Text style={styles.cardMeta}>See on goal vs over goal</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calorie Consistency</Text>
            <View style={styles.fullCard}>
              <View style={styles.chartWrap}>
                <View style={styles.barChart}>
                  {progressData.calorieBars.map((value, index) => (
                    <View key={`${progressData.barLabels[index]}-${index}`} style={styles.barGroup}>
                      <View style={styles.barContainer}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${progressData.calorieMaxCal > 0 ? (value / progressData.calorieMaxCal) * 100 : 0}%`,
                              backgroundColor: progressData.barColors[index],
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{progressData.barLabels[index]}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.avgLine, { bottom: `${progressData.calorieMaxCal > 0 ? (progressData.calorieAvg / progressData.calorieMaxCal) * 100 : 0}%` }]} />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>On goal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Over goal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendLine} />
                  <Text style={styles.legendText}>Avg ({progressData.calorieAvg > 0 ? `${progressData.calorieAvg.toLocaleString()}` : '0'} cal)</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>This period vs previous</Text>
                <Text style={styles.metricValuePositive}>{progressData.weekVsLastWeek}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Period trend</Text>
                <Text style={styles.metricValue}>{progressData.periodTrend}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Best day for tracking</Text>
                <Text style={styles.metricValue}>{progressData.bestDayForTracking}</Text>
              </View>
              <View style={[styles.metricRow, styles.metricRowLast]}>
                <Text style={styles.metricLabel}>Most missed day</Text>
                <Text style={styles.metricValueMuted}>{progressData.mostMissedDay}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How Your Body Responds</Text>
            <View style={styles.fullCard}>
              <View style={styles.responseItem}>
                <Text style={styles.responseLabel}>Energy levels</Text>
                <View style={styles.responseBar}>
                  <View style={[styles.responseFill, { width: `${progressData.energyScore}%`, backgroundColor: '#10B981' }]} />
                </View>
                <Text style={styles.responseValue}>{progressData.hasCheckIns ? progressData.energyLabel : '--'}</Text>
              </View>
              <View style={styles.responseItem}>
                <Text style={styles.responseLabel}>Focus & clarity</Text>
                <View style={styles.responseBar}>
                  <View style={[styles.responseFill, { width: `${progressData.focusScore}%`, backgroundColor: '#8B5CF6' }]} />
                </View>
                <Text style={styles.responseValue}>{progressData.hasCheckIns ? progressData.focusLabel : '--'}</Text>
              </View>
              <View style={[styles.responseItem, { marginBottom: 0 }]}>
                <Text style={styles.responseLabel}>Mood stability</Text>
                <View style={styles.responseBar}>
                  <View style={[styles.responseFill, { width: `${progressData.moodScore}%`, backgroundColor: '#F59E0B' }]} />
                </View>
                <Text style={styles.responseValue}>{progressData.hasCheckIns ? progressData.moodLabel : '--'}</Text>
              </View>
              <Text style={styles.insightNote}>Check in regularly to make these insights more accurate.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>At a Glance</Text>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardEmoji}>😋</Text>
                <Text style={styles.cardValueSmall}>{progressData.hasCheckIns ? progressData.avgHungerLevel : '--'}</Text>
                <Text style={styles.cardLabel}>Avg hunger level</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardEmoji}>⚡</Text>
                <Text style={styles.cardValueSmall}>{progressData.hasCheckIns ? progressData.commonSymptom : '--'}</Text>
                <Text style={styles.cardLabel}>Common symptom</Text>
              </View>
            </View>
            <Text style={styles.sectionHelper}>Check in regularly to make these insights more accurate.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Common Symptoms</Text>
            <View style={styles.fullCard}>
              <View style={styles.donutWrap}>
                <View style={styles.donut}>
                  <View style={styles.donutInner}>
                    <Text style={styles.donutValue}>{progressData.hasCheckIns ? `${progressData.lowEnergyPct}%` : '--'}</Text>
                    <Text style={styles.donutLabel}>Low energy</Text>
                  </View>
                </View>
                <View style={styles.donutLegend}>
                  {[
                    { label: 'Low energy', pct: progressData.lowEnergyPct, color: '#EF4444' },
                    { label: 'Brain fog',  pct: progressData.brainFogPct,  color: '#F59E0B' },
                    { label: 'Cravings',   pct: progressData.cravingsPct,  color: '#8B5CF6' },
                    { label: 'No symptoms',pct: progressData.noSymptomsPct,color: '#10B981' },
                  ].map(({ label, pct, color }) => (
                    <View key={label} style={styles.donutLegendItem}>
                      <View style={[styles.donutLegendDot, { backgroundColor: color }]} />
                      <Text style={styles.donutLegendText}>{label}</Text>
                      <Text style={styles.donutLegendPct}>{progressData.hasCheckIns ? `${pct}%` : '--'}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.insightBox}>
                <Text style={styles.insightText}>💡 {progressData.symptomInsight}</Text>
              </View>
              <Text style={styles.insightNote}>Check in regularly to make these insights more accurate.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', height: SCREEN_HEIGHT, flex: 1 },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.08)', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  rangeRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rangeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', marginHorizontal: 3 },
  rangeBtnActive: { backgroundColor: '#059669' },
  rangeBtnText: { fontSize: 12, fontWeight: '500', color: '#666666' },
  rangeBtnTextActive: { color: '#FFFFFF', fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(5,150,105,0.08)', gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F', paddingVertical: 0 },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1F1F1F', marginBottom: 10 },
  sectionHelperLeft: { marginTop: -2, marginBottom: 10, fontSize: 11, lineHeight: 16, color: '#6B7280' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  gridLastItem: { marginRight: 0 },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(5,150,105,0.08)', alignItems: 'center', marginRight: 10 },
  pressableCard: { alignItems: 'stretch' },
  summaryCardGreen: { backgroundColor: '#F0FDF4', borderColor: 'rgba(5,150,105,0.16)' },
  summaryCardWarm: { backgroundColor: '#FFF7ED', borderColor: 'rgba(245,158,11,0.18)' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#1F1F1F' },
  cardValueSmall: { fontSize: 18, fontWeight: '700', color: '#1F1F1F', textAlign: 'center' },
  cardLabel: { fontSize: 11, color: '#666666', marginTop: 4, textAlign: 'center' },
  cardMeta: { marginTop: 6, fontSize: 11, lineHeight: 16, color: '#6B7280', textAlign: 'center' },
  cardEmoji: { fontSize: 24, marginBottom: 6 },
  fullCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(5,150,105,0.08)' },
  chartWrap: { position: 'relative' },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingHorizontal: 4 },
  barGroup: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 120, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', maxWidth: 30, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  barLabel: { fontSize: 9, color: '#999999', marginTop: 8 },
  avgLine: { position: 'absolute', left: 0, right: 0, height: 2, borderTopWidth: 2, borderTopColor: '#F59E0B', borderStyle: 'dashed' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLine: { width: 12, height: 2, borderRadius: 1, backgroundColor: '#F59E0B' },
  legendText: { fontSize: 11, color: '#666666' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 14 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  metricRowLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  metricLabel: { fontSize: 13, color: '#4B5563' },
  metricValue: { fontSize: 13, fontWeight: '600', color: '#1F1F1F' },
  metricValuePositive: { fontSize: 13, fontWeight: '700', color: '#059669' },
  metricValueMuted: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  responseItem: { marginBottom: 16 },
  responseLabel: { fontSize: 13, color: '#374151', marginBottom: 6 },
  responseBar: { height: 10, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 6 },
  responseFill: { height: '100%', borderRadius: 999 },
  responseValue: { fontSize: 12, fontWeight: '600', color: '#1F1F1F' },
  donutWrap: { flexDirection: 'row', gap: 20 },
  donut: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  donutInner: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  donutLabel: { fontSize: 10, color: '#6B7280' },
  donutLegend: { flex: 1, justifyContent: 'center', gap: 10 },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutLegendDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { flex: 1, fontSize: 12, color: '#4B5563' },
  donutLegendPct: { fontSize: 12, fontWeight: '600', color: '#1F1F1F' },
  insightBox: { marginTop: 16, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.06)', padding: 12 },
  insightText: { fontSize: 12, lineHeight: 18, color: '#065F46' },
  insightNote: { marginTop: 12, fontSize: 11, lineHeight: 17, color: '#6B7280', textAlign: 'center' },
  sectionHelper: { marginTop: 8, fontSize: 11, lineHeight: 17, color: '#6B7280', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, color: '#6B7280', textAlign: 'center' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dayRow: { flexDirection: 'column', paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  dayRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  dayInfo: { flex: 1, minWidth: 0, paddingRight: 10 },
  dayTitle: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  daySubtext: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  dayCounts: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  dayCountChip: { minWidth: 90, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center', marginLeft: 6 },
  dayCountChipGreen: { backgroundColor: '#ECFDF5' },
  dayCountChipWarm: { backgroundColor: '#FFF7ED' },
  dayCountValue: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  dayCountLabel: { marginTop: 2, fontSize: 11, color: '#6B7280' },
});
