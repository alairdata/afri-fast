import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../lib/theme';
import { LineChart } from 'react-native-chart-kit';
import { Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ProgressTab = ({
  onShowWeightModal, onShowFastingDetails, onShowBMIDetails, onShowCalorieDetails, onShowHydrationDetails,
  onShowStepsDetails, onShowAddActivity,
  fastingSessions = [], recentMeals = [], weightLogs = [], waterLogs = [], stepLogs = [], activities = [], checkInHistory = [],
  height = '', heightUnit = 'cm', weightUnit = 'kg', volumeUnit = 'oz', targetWeight = null, startingWeight = null,
  dailyCalorieGoal = 2000, hydrationGoal = 0, stepGoal = 10000,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [progressRange, setProgressRange] = useState('7 days');
  const [weightTooltip, setWeightTooltip] = useState(null);
  const [stepsTooltip, setStepsTooltip] = useState(null);
  const [calTooltip, setCalTooltip] = useState(null);
  const [waterTooltip, setWaterTooltip] = useState(null);

  useEffect(() => { if (!weightTooltip) return; const t = setTimeout(() => setWeightTooltip(null), 2000); return () => clearTimeout(t); }, [weightTooltip]);
  useEffect(() => { if (!calTooltip) return; const t = setTimeout(() => setCalTooltip(null), 2000); return () => clearTimeout(t); }, [calTooltip]);
  useEffect(() => { if (!waterTooltip) return; const t = setTimeout(() => setWaterTooltip(null), 2000); return () => clearTimeout(t); }, [waterTooltip]);
  useEffect(() => { if (!stepsTooltip) return; const t = setTimeout(() => setStepsTooltip(null), 2000); return () => clearTimeout(t); }, [stepsTooltip]);

  const getProgressData = () => {
    const now = Date.now();
    const days = progressRange === '7 days' ? 7 : progressRange === '30 days' ? 30 : progressRange === '90 days' ? 90 : 99999;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    // 7/30 days -> one point per day. 90 days -> one point per calendar week (Sun-Sat), labeled
    // by the week's last day. All time -> one point per month. isLongRange just means "grouped
    // into buckets, show up to ~12" -- the grouping key itself is rangeMode.
    const rangeMode = days === 90 ? 'weekly' : days === 99999 ? 'monthly' : 'daily';
    const isLongRange = rangeMode !== 'daily';

    // Filter sessions within range
    const sessions = fastingSessions.filter(s => s.startTime >= cutoff);
    const totalSessions = sessions.length;
    const totalHours = sessions.reduce((sum, s) => sum + s.durationHours + s.durationMinutes / 60, 0);
    const avgHours = totalSessions > 0 ? totalHours / totalSessions : 0;
    const avgH = Math.floor(avgHours);
    const avgM = Math.round((avgHours - avgH) * 60);
    const longestSession = sessions.reduce((max, s) => {
      const dur = s.durationHours + s.durationMinutes / 60;
      return dur > max ? dur : max;
    }, 0);

    // Filter all data sources by date range first
    const rangeMeals = (recentMeals || []).filter(m => {
      if (days === 99999) return true;
      const t = m.timestamp || new Date(m.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const rangeWeights = (weightLogs || []).filter(w => {
      if (days === 99999) return true;
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });
    const weightChange = rangeWeights.length >= 2 ? (rangeWeights[0].weight - rangeWeights[rangeWeights.length - 1].weight).toFixed(1) : '0';

    const rangeWater = (waterLogs || []).filter(w => {
      if (days === 99999) return true;
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const rangeSteps = (stepLogs || []).filter(s => {
      if (days === 99999) return true;
      const t = s.id || new Date(s.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const rangeActivities = (activities || []).filter(a => {
      if (days === 99999) return true;
      const t = a.timestamp || new Date(a.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    // Calorie tracking streak — within selected range
    const allLoggedDates = new Set(rangeMeals.map(m => new Date(m.date).toDateString()).filter(Boolean));
    const today = new Date();
    const todayStr = today.toDateString();
    const hasLoggedToday = allLoggedDates.has(todayStr);
    const streakStart = hasLoggedToday ? 0 : 1;
    let streak = 0;
    for (let i = streakStart; i < days + 1; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (allLoggedDates.has(d.toDateString())) streak++;
      else break;
    }

    // Best logging streak within range
    const sortedDates = [...allLoggedDates].map(s => new Date(s)).sort((a, b) => a - b);
    let bestStreak = 0, runStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { runStreak = 1; }
      else {
        const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
        runStreak = diff === 1 ? runStreak + 1 : 1;
      }
      if (runStreak > bestStreak) bestStreak = runStreak;
    }

    // Days on target in range — calories within 70–115% of daily goal
    const daysOnTarget = [...new Set(rangeMeals.map(m => m.date))].filter(date => {
      const total = rangeMeals.filter(m => m.date === date).reduce((s, m) => s + (m.calories || 0), 0);
      const ratio = total / dailyCalorieGoal;
      return ratio >= 0.7 && ratio <= 1.15;
    }).length;

    // Total unique days logged in range
    const totalDaysLogged = new Set(rangeMeals.map(m => m.date)).size;

    // Convert water to litres
    const toL = (amount, u) => {
      const ml = u === 'mL' ? amount : u === 'oz' ? amount * 29.574 : u === 'sachet' ? amount * 500 : u === 'bottle' ? amount * 750 : amount * 237;
      return Math.round(ml / 100) / 10;
    };

    // Water stats
    // Aggregate water totals per day (sum all entries for same date)
    const waterByDate = {};
    rangeWater.forEach(l => {
      const key = l.date;
      if (!waterByDate[key]) waterByDate[key] = { date: key, totalL: 0 };
      waterByDate[key].totalL += toL(l.amount, l.unit);
    });
    const dailyWater = Object.values(waterByDate).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Groups pre-sorted-descending daily entries into weekly (Sun-Sat) or monthly buckets,
    // averaging the given field. Since entries are scanned newest-first, the first one seen per
    // bucket is the most recent day in that period -- i.e. the bucket's date ends up being its
    // own last day, which is exactly the label each bucket should show.
    const groupByPeriod = (dailyEntries, field) => {
      if (rangeMode === 'daily' || !dailyEntries.length) return dailyEntries;
      const buckets = {};
      dailyEntries.forEach((d) => {
        const dt = new Date(d.date);
        let key;
        if (rangeMode === 'monthly') {
          key = `${dt.getFullYear()}-${dt.getMonth()}`;
        } else {
          const weekStart = new Date(dt);
          weekStart.setDate(dt.getDate() - dt.getDay());
          key = weekStart.toDateString();
        }
        if (!buckets[key]) buckets[key] = { date: d.date, total: 0, days: 0 };
        buckets[key].total += d[field];
        buckets[key].days += 1;
      });
      return Object.values(buckets).map((b) => ({ date: b.date, [field]: b.total / b.days }));
    };

    // For long range, aggregate by week (90 days) or month (all time)
    let uniqueWater;
    if (isLongRange && dailyWater.length > 0) {
      uniqueWater = groupByPeriod(dailyWater, 'totalL').map((w) => ({ ...w, totalL: Math.round(w.totalL * 10) / 10 }));
    } else {
      uniqueWater = dailyWater;
    }

    const waterChartData = uniqueWater.slice(0, isLongRange ? 12 : 7).reverse().map(l => Math.round(l.totalL * 10) / 10);
    const avgWaterL = uniqueWater.length > 0 ? (uniqueWater.reduce((s, l) => s + l.totalL, 0) / uniqueWater.length).toFixed(1) : '0';

    // Steps stats
    const stepsByDate = {};
    rangeSteps.forEach(l => {
      const key = l.date;
      if (!stepsByDate[key]) stepsByDate[key] = { date: key, totalSteps: 0 };
      stepsByDate[key].totalSteps += l.steps;
    });
    const dailySteps = Object.values(stepsByDate).sort((a, b) => new Date(b.date) - new Date(a.date));
    let uniqueSteps;
    if (isLongRange && dailySteps.length > 0) {
      uniqueSteps = groupByPeriod(dailySteps, 'totalSteps').map((s) => ({ ...s, totalSteps: Math.round(s.totalSteps) }));
    } else {
      uniqueSteps = dailySteps;
    }
    const stepsChartData = uniqueSteps.slice(0, isLongRange ? 12 : 7).reverse().map(l => l.totalSteps);
    const avgSteps = uniqueSteps.length > 0 ? Math.round(uniqueSteps.reduce((s, l) => s + l.totalSteps, 0) / uniqueSteps.length) : 0;

    // Chart label formatter
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatLabel = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 6);
      if (rangeMode === 'monthly') return `${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
      if (rangeMode === 'weekly') return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      return pad2(d.getDate());
    };

    // Monthly grouping for calories (long range)
    const mealsByDate = {};
    rangeMeals.forEach(m => {
      if (!m.date) return;
      if (!mealsByDate[m.date]) mealsByDate[m.date] = { calories: 0, date: m.date };
      mealsByDate[m.date].calories += m.calories || 0;
    });
    const dailyCalData = Object.values(mealsByDate);
    const totalCal = rangeMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const calDaysCount = dailyCalData.length;
    const monthsCount = Math.max(Math.ceil(days / 30), 1);

    return {
      days,
      isLongRange,
      // Fasting
      avgFastLength: totalSessions > 0 ? `${avgH}h ${avgM}m` : '0h 0m',
      completionRate: totalSessions > 0 ? `${Math.round(sessions.reduce((sum, s) => {
        const targetHours = parseInt((s.plan || '16:8').split(':')[0]) || 16;
        const actualHours = s.durationHours + (s.durationMinutes || 0) / 60;
        return sum + Math.min((actualHours / targetHours) * 100, 100);
      }, 0) / totalSessions)}%` : '0%',
      currentStreak: streak,
      bestStreak,
      daysOnTarget,
      totalDaysLogged,
      streakTrend: streak >= 7 ? '\ud83d\udd25 On fire!' : streak >= 3 ? '\ud83d\udcaa\ud83c\udfff Keep going!' : streak > 0 ? '\u2197 Building' : 'Start today!',
      // Weight
      rangeWeights,
      weightChange: `${parseFloat(weightChange) >= 0 ? '+' : ''}${weightChange} kg`,
      weeklyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(days / 7, 1)).toFixed(1)} kg/wk` : '--',
      monthlyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(monthsCount, 1)).toFixed(1)} kg/mo` : '--',
      // Calories
      rangeMeals,
      dailyCalData,
      avgDailyCal: calDaysCount > 0 ? Math.round(totalCal / calDaysCount) : 0,
      avgMonthlyCal: calDaysCount > 0 ? Math.round(totalCal / Math.max(monthsCount, 1)) : 0,
      // Water
      uniqueWater,
      waterChartData,
      avgWaterL,
      waterGoalMet: `${uniqueWater.filter(w => w.totalL >= 2).length}/${uniqueWater.length}`,
      // Steps
      uniqueSteps,
      stepsChartData,
      avgSteps,
      stepsGoalMet: `${uniqueSteps.filter(s => s.totalSteps >= stepGoal).length}/${uniqueSteps.length}`,
      recentActivities: [...(activities || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5),
      // Labels
      formatLabel,
    };
  };

  const progressData = getProgressData();

  return (
    <View style={styles.progressTab}>
      {/* Header */}
      <View style={styles.progressHeaderCompact}>
        <Text style={styles.progressTitleCompact}>Progress</Text>
        <TouchableOpacity style={styles.filterBtnSmall}>
          <Text style={{ color: '#059669', fontSize: 16 }}>{'\u2630'}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeSelectorCompact}>
        {['7 days', '30 days', '90 days', 'All time'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeBtnCompact,
              progressRange === range && styles.timeRangeBtnActiveCompact,
            ]}
            onPress={() => setProgressRange(range)}
          >
            <Text style={[
              styles.timeRangeBtnText,
              progressRange === range && styles.timeRangeBtnTextActive,
            ]}>{range}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {Platform.OS === 'web' && <View style={{ height: 117 }} />}

      <ScrollView style={styles.progressContentCompact} showsVerticalScrollIndicator={false}>
        {/* Section 1: Calorie Tracking Streaks */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flame-outline" size={14} color="#1F1F1F" />
              <Text style={styles.progressSectionTitleCompact}>Streaks</Text>
            </View>
          </View>
          <View style={styles.chartCardCompact}>
            <View style={styles.streaksGridFour}>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.currentStreak > 0 ? progressData.currentStreak : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Current streak</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.bestStreak > 0 ? progressData.bestStreak : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Best streak</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.daysOnTarget > 0 ? progressData.daysOnTarget : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Days on target</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.totalDaysLogged > 0 ? progressData.totalDaysLogged : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Days logged</Text>
              </View>
            </View>
          </View>
        </View>


        {/* Section 3: Current BMI */}
        <View style={styles.progressSectionCompact}>
          <Text style={styles.progressSectionTitleCompact}>Current BMI</Text>
          {(() => {
            const latestWeight = progressData.rangeWeights.length > 0
              ? [...progressData.rangeWeights].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
              : null;
            const hasWeight = latestWeight !== null;
            const heightNum = parseFloat(height);
            const heightM = heightNum ? (heightUnit === 'ft' ? heightNum * 0.3048 : heightNum / 100) : 0;
            const hasHeight = heightM > 0;
            const weightKg = hasWeight ? (latestWeight.unit === 'lbs' ? latestWeight.weight * 0.453592 : latestWeight.weight) : 0;
            const bmi = hasWeight && hasHeight ? (weightKg / (heightM * heightM)).toFixed(1) : null;
            const bmiCategory = bmi ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese') : null;
            const bmiPosition = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / (35 - 15)) * 100)) : 0;

            return (
              <View style={styles.chartCardCompact}>
                <View style={styles.bmiDisplay}>
                  <View style={styles.bmiValueContainer}>
                    <Text style={styles.bmiValue}>{bmi || '--'}</Text>
                    {bmiCategory && (
                      <View style={styles.bmiCategoryBadge}>
                        <Text style={styles.bmiCategory}>{bmiCategory}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.bmiWeightInfo}>
                    <Text style={styles.bmiWeightLabel}>Current weight</Text>
                    <Text style={styles.bmiWeightValue}>{hasWeight ? `${latestWeight.weight} ${latestWeight.unit}` : '--'}</Text>
                  </View>
                </View>
                <View style={styles.bmiBarContainer}>
                  <View style={styles.bmiBar}>
                    <View style={[styles.bmiBarSegment, { width: '17.5%', backgroundColor: '#3B82F6' }]} />
                    <View style={[styles.bmiBarSegment, { width: '32.5%', backgroundColor: '#10B981' }]} />
                    <View style={[styles.bmiBarSegment, { width: '25%', backgroundColor: '#F59E0B' }]} />
                    <View style={[styles.bmiBarSegment, { width: '25%', backgroundColor: '#EF4444' }]} />
                    {bmi && <View style={[styles.bmiIndicator, { left: `${bmiPosition}%` }]} />}
                  </View>
                  <View style={styles.bmiLabels}>
                    <Text style={styles.bmiLabel}>Underweight</Text>
                    <Text style={styles.bmiLabel}>Normal</Text>
                    <Text style={styles.bmiLabel}>Overweight</Text>
                    <Text style={styles.bmiLabel}>Obese</Text>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Section 4: Weight Trends */}
        <View style={styles.progressSectionCompact}>
          <Text style={styles.progressSectionTitleCompact}>Weight trend</Text>
          <View style={styles.chartCardCompact}>
            {(() => {
              const logs = progressData.rangeWeights;
              // Group by date and average weights logged on the same day
              const byDate = {};
              logs.forEach(l => {
                if (!byDate[l.date]) byDate[l.date] = { ...l, weights: [] };
                byDate[l.date].weights.push(l.weight);
              });
              const uniqueLogs = Object.values(byDate)
                .map(g => ({ ...g, weight: parseFloat((g.weights.reduce((a, b) => a + b, 0) / g.weights.length).toFixed(1)) }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
              const hasData = uniqueLogs.length > 0;
              const hasMultiple = uniqueLogs.length >= 2;
              const latest = hasData ? uniqueLogs[0] : null;
              const unit = latest ? latest.unit : 'kg';
              const displayCount = progressData.isLongRange ? 12 : 7;
              const displayLogs = uniqueLogs.slice(0, displayCount).reverse();
              const allWeights = displayLogs.map(l => l.weight);
              const currentWeight = hasData ? latest.weight : null;
              const yMax = currentWeight != null ? Math.ceil(currentWeight + 5) : undefined;
              const yMin = targetWeight != null ? Math.floor(targetWeight - 10) : undefined;
              return (
                <>
                  <View style={{ marginLeft: 0, marginRight: -22, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <LineChart
                        data={{
                          labels: displayLogs.map((l, i, arr) => {
                            if (arr.length <= 7 || i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1) {
                              return progressData.formatLabel(l.date);
                            }
                            return '';
                          }),
                          datasets: [
                            { data: allWeights },
                            ...(yMin != null ? [{ data: [yMin] }] : []),
                          ],
                        }}
                        fromNumber={yMax}
                        width={SCREEN_WIDTH + 22}
                        height={190}
                        chartConfig={{
                          backgroundColor: colors.card,
                          backgroundGradientFrom: colors.card,
                          backgroundGradientTo: colors.card,
                          decimalPlaces: 1,
                          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
                          labelColor: () => '#888',
                          propsForDots: { r: '0' },
                          propsForBackgroundLines: { stroke: 'transparent' },
                          fillShadowGradient: '#059669',
                          fillShadowGradientFrom: '#059669',
                          fillShadowGradientTo: '#059669',
                          fillShadowGradientFromOpacity: 0.3,
                          fillShadowGradientToOpacity: 0.05,
                          propsForLabels: { fontSize: 9 },
                          paddingRight: 48,
                        }}
                        renderDotContent={({ x, y, index, indexData }) => (
                          <Rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} fill="#059669" rx={1} />
                        )}
                        onDataPointClick={({ value, x, y }) => setWeightTooltip(t => t?.x === x && t?.y === y ? null : { value, x, y })}
                        bezier
                        style={{ borderRadius: 12, marginLeft: -54 }}
                        withInnerLines={false}
                        withOuterLines={false}
                        fromZero={false}
                        withHorizontalLabels={false}
                        segments={5}
                      />
                      {weightTooltip && (
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(weightTooltip.x - 30, SCREEN_WIDTH - 120)), top: weightTooltip.y - 12 }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{weightTooltip.value} kg</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={styles.chartPlaceholderText}>{hasData ? `${latest.weight} ${unit}` : 'No weight data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more to see trends' : 'Log your weight to start'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.weightStatsCompact}>
                    <View style={styles.weightStatCompact}>
                      <Text style={styles.weightStatValueCompact}>{hasMultiple ? progressData.weightChange : '--'}</Text>
                      <Text style={styles.weightStatLabelCompact}>This period</Text>
                    </View>
                    <View style={[styles.weightStatCompact, { backgroundColor: 'rgba(5, 150, 105, 0.08)' }]}>
                      <Text style={[styles.weightStatValueCompact, { color: '#059669' }]}>{hasMultiple ? (progressData.isLongRange ? progressData.monthlyChange : progressData.weeklyChange) : '--'}</Text>
                      <Text style={styles.weightStatLabelCompact}>{progressData.isLongRange ? 'Monthly avg' : 'Weekly avg'}</Text>
                    </View>
                  </View>
                </>
              );
            })()}
            <View style={styles.weightActionsCompact}>
              <TouchableOpacity style={styles.weightActionBtnCompact} onPress={() => onShowWeightModal && onShowWeightModal()}>
                <Text style={styles.weightActionBtnText}>Log weight</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowWeightModal && onShowWeightModal()}>
                <Text style={styles.weightActionLinkText}>View all logs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 5: Calorie Intake */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flame-outline" size={14} color="#1F1F1F" />
              <Text style={styles.progressSectionTitleCompact}>Calorie Intake</Text>
            </View>
            <TouchableOpacity onPress={() => onShowCalorieDetails && onShowCalorieDetails()}>
              <Text style={styles.seeAllBtnSmall}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCardCompact}>
            {(() => {
              const dailyData = progressData.dailyCalData.slice(0, progressData.isLongRange ? 12 : 7).reverse();
              const hasData = dailyData.length > 0;
              const hasMultiple = dailyData.length >= 2;
              const lastMeal = progressData.rangeMeals.length > 0 ? progressData.rangeMeals[0] : null;

              return (
                <>
                  <View style={{ marginLeft: 0, marginRight: -22, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <LineChart
                        data={{
                          labels: dailyData.map((d) => {
                            if (progressData.days > 7) return '';
                            return progressData.formatLabel(d.date);
                          }),
                          datasets: [
                            { data: dailyData.map(d => d.calories) },
                            ...(dailyCalorieGoal > 0 ? [{ data: [Math.round(dailyCalorieGoal * 0.5)] }] : []),
                          ],
                        }}
                        fromNumber={dailyCalorieGoal > 0 ? dailyCalorieGoal + 500 : undefined}
                        width={SCREEN_WIDTH + 22}
                        height={190}
                        chartConfig={{
                          backgroundColor: colors.card,
                          backgroundGradientFrom: colors.card,
                          backgroundGradientTo: colors.card,
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                          labelColor: () => '#888',
                          propsForDots: { r: '0' },
                          propsForBackgroundLines: { stroke: 'transparent' },
                          fillShadowGradient: '#EF4444',
                          fillShadowGradientFrom: '#EF4444',
                          fillShadowGradientTo: '#EF4444',
                          fillShadowGradientFromOpacity: 0.3,
                          fillShadowGradientToOpacity: 0.05,
                          propsForLabels: { fontSize: 9 },
                          paddingRight: 48,
                        }}
                        renderDotContent={({ x, y, index }) => (
                          <Rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} fill="#EF4444" rx={1} />
                        )}
                        onDataPointClick={({ value, x, y }) => setCalTooltip(t => t?.x === x && t?.y === y ? null : { value, x, y })}
                        bezier
                        style={{ borderRadius: 12, marginLeft: -54 }}
                        withInnerLines={false}
                        withOuterLines={false}
                        fromZero={false}
                        withHorizontalLabels={false}
                      />
                      {calTooltip && (
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(calTooltip.x - 30, SCREEN_WIDTH - 120)), top: calTooltip.y - 12 }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{calTooltip.value} cal</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={styles.chartPlaceholderText}>{hasData ? `${dailyData[0].calories} cal` : 'No calorie data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more meals to see trends' : 'Log a meal to start'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.calorieStatsRow}>
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{progressData.isLongRange ? (progressData.avgMonthlyCal > 0 ? progressData.avgMonthlyCal.toLocaleString() : '--') : (progressData.avgDailyCal > 0 ? progressData.avgDailyCal.toLocaleString() : '--')}</Text>
                      <Text style={styles.calorieStatLabel}>{progressData.isLongRange ? 'Avg monthly cal' : 'Avg daily cal'}</Text>
                    </View>
                    <View style={styles.calorieStatDivider} />
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{lastMeal ? lastMeal.calories.toLocaleString() : '--'}</Text>
                      <Text style={styles.calorieStatLabel}>Last log</Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
        </View>

        {/* Section 6: Water Intake Trends */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="water-outline" size={14} color="#1F1F1F" />
              <Text style={styles.progressSectionTitleCompact}>Hydration</Text>
            </View>
            <TouchableOpacity onPress={() => onShowHydrationDetails && onShowHydrationDetails()}>
              <Text style={styles.seeAllBtnSmall}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCardCompact}>
            {(() => {
              const uniqueLogs = progressData.uniqueWater;
              const hasWaterData = uniqueLogs.length > 0;
              const hasMultipleWater = uniqueLogs.length >= 2;
              const chartData = progressData.waterChartData;
              const goalL = hydrationGoal > 0
                ? volumeUnit === 'mL' ? hydrationGoal / 1000
                : volumeUnit === 'oz' ? (hydrationGoal * 29.574) / 1000
                : volumeUnit === 'sachet' ? hydrationGoal * 0.5
                : volumeUnit === 'bottle' ? hydrationGoal * 0.75
                : hydrationGoal
                : 0;
              const waterYMax = goalL > 0 ? Math.round((goalL + 2) * 10) / 10 : undefined;

              return (
                <>
                  <View style={{ marginLeft: 0, marginRight: -22, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultipleWater ? (
                      <>
                      <LineChart
                        data={{
                          labels: uniqueLogs.slice(0, progressData.isLongRange ? 12 : 7).reverse().map((l, i, arr) => {
                            if (arr.length <= 7 || i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1) {
                              return progressData.formatLabel(l.date);
                            }
                            return '';
                          }),
                          datasets: [
                            { data: chartData },
                            { data: [0] },
                          ],
                        }}
                        fromNumber={waterYMax}
                        width={SCREEN_WIDTH + 22}
                        height={190}
                        chartConfig={{
                          backgroundColor: colors.card,
                          backgroundGradientFrom: colors.card,
                          backgroundGradientTo: colors.card,
                          decimalPlaces: 1,
                          color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
                          labelColor: () => '#888',
                          propsForDots: { r: '0' },
                          propsForBackgroundLines: { stroke: 'transparent' },
                          fillShadowGradient: '#0EA5E9',
                          fillShadowGradientFrom: '#0EA5E9',
                          fillShadowGradientTo: '#0EA5E9',
                          fillShadowGradientFromOpacity: 0.3,
                          fillShadowGradientToOpacity: 0.05,
                          propsForLabels: { fontSize: 9 },
                          paddingRight: 48,
                        }}
                        renderDotContent={({ x, y, index }) => (
                          <Rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} fill="#0EA5E9" rx={1} />
                        )}
                        onDataPointClick={({ value, x, y }) => setWaterTooltip(t => t?.x === x && t?.y === y ? null : { value, x, y })}
                        bezier
                        style={{ borderRadius: 12, marginLeft: -54 }}
                        withInnerLines={false}
                        withOuterLines={false}
                        fromZero={false}
                        withHorizontalLabels={false}
                      />
                      {waterTooltip && (
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(waterTooltip.x - 30, SCREEN_WIDTH - 120)), top: waterTooltip.y - 12 }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{waterTooltip.value} L</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={styles.chartPlaceholderText}>{hasWaterData ? `${progressData.avgWaterL} L` : 'No hydration data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasWaterData ? 'Log more to see trends' : 'Log water to start'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.calorieStatsRow}>
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{hasWaterData ? `${progressData.avgWaterL} L` : '--'}</Text>
                      <Text style={styles.calorieStatLabel}>{progressData.isLongRange ? 'Avg monthly' : 'Avg daily'}</Text>
                    </View>
                    <View style={styles.calorieStatDivider} />
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{hasWaterData ? progressData.waterGoalMet : '--'}</Text>
                      <Text style={styles.calorieStatLabel}>Goal met</Text>
                    </View>
                  </View>
                </>
              );
            })()}
            <View style={styles.weightActionsCompact}>
              <TouchableOpacity style={[styles.weightActionBtnCompact, { backgroundColor: '#0EA5E9', shadowColor: 'rgba(14, 165, 233, 1)' }]} onPress={() => onShowHydrationDetails && onShowHydrationDetails()}>
                <Text style={styles.weightActionBtnText}>Log water</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowHydrationDetails && onShowHydrationDetails()}>
                <Text style={styles.weightActionLinkText}>View all logs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 7: Steps Trends */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="footsteps-outline" size={14} color="#1F1F1F" />
              <Text style={styles.progressSectionTitleCompact}>Steps</Text>
            </View>
            <TouchableOpacity onPress={() => onShowStepsDetails && onShowStepsDetails()}>
              <Text style={styles.seeAllBtnSmall}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCardCompact}>
            {(() => {
              const uniqueLogs = progressData.uniqueSteps;
              const hasStepsData = uniqueLogs.length > 0;
              const hasMultipleSteps = uniqueLogs.length >= 2;
              const chartData = progressData.stepsChartData;
              const chartLabels = uniqueLogs.slice(0, progressData.isLongRange ? 12 : 7).reverse().map((l, i, arr) => {
                if (arr.length <= 7 || i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1) {
                  return progressData.formatLabel(l.date);
                }
                return '';
              });
              // Hand-rolled instead of react-native-chart-kit's BarChart: that library has no real
              // y-axis max/min prop (its "fromNumber"-style options are no-ops in this version —
              // the axis is silently auto-scaled from whatever's in the visible window), so the
              // ceiling couldn't actually be pinned to the step goal, and there's no way to render
              // real axis labels. This version sets both explicitly.
              const CHART_H = 140;
              const dataMax = chartData.length ? Math.max(...chartData) : 0;
              const axisMax = Math.max(stepGoal > 0 ? stepGoal : 0, dataMax, 1) * 1.15;
              const goalY = stepGoal > 0 && stepGoal <= axisMax ? CHART_H - (stepGoal / axisMax) * CHART_H : null;

              return (
                <>
                  <View style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultipleSteps ? (
                      <>
                      <View style={{ flexDirection: 'row', height: CHART_H, marginTop: 10 }}>
                        <View style={{ width: 34, height: CHART_H, justifyContent: 'space-between', paddingRight: 4 }}>
                          <Text style={styles.stepsAxisLabel}>{Math.round(axisMax).toLocaleString()}</Text>
                          <Text style={styles.stepsAxisLabel}>0</Text>
                        </View>
                        <View style={{ flex: 1, position: 'relative' }}>
                          {goalY != null && (
                            <View style={[styles.stepsGoalLine, { top: goalY }]} />
                          )}
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                            {chartData.map((value, i) => {
                              const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                              const metGoal = stepGoal > 0 && value >= stepGoal;
                              return (
                                <TouchableOpacity
                                  key={i}
                                  style={{ flex: 1, alignItems: 'center' }}
                                  activeOpacity={0.7}
                                  onPress={() => setStepsTooltip(t => t?.i === i ? null : { i, value })}
                                >
                                  <View style={{
                                    width: '70%', height: barH, borderRadius: 4,
                                    backgroundColor: metGoal ? '#F97316' : 'rgba(249,115,22,0.35)',
                                  }} />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', marginLeft: 34 }}>
                        {chartLabels.map((label, i) => (
                          <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                        ))}
                      </View>
                      {stepsTooltip && (
                        <View style={styles.stepsTooltipCentered} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{stepsTooltip.value.toLocaleString()} steps</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={styles.chartPlaceholderText}>{hasStepsData ? `${progressData.avgSteps.toLocaleString()} steps` : 'No steps data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasStepsData ? 'Log more to see trends' : 'Log steps to start'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.calorieStatsRow}>
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{hasStepsData ? progressData.avgSteps.toLocaleString() : '--'}</Text>
                      <Text style={styles.calorieStatLabel}>{progressData.isLongRange ? 'Avg monthly' : 'Avg daily'}</Text>
                    </View>
                    <View style={styles.calorieStatDivider} />
                    <View style={styles.calorieStatItem}>
                      <Text style={styles.calorieStatValue}>{hasStepsData ? progressData.stepsGoalMet : '--'}</Text>
                      <Text style={styles.calorieStatLabel}>Goal met</Text>
                    </View>
                  </View>
                </>
              );
            })()}
            <View style={styles.weightActionsCompact}>
              <TouchableOpacity style={[styles.weightActionBtnCompact, { backgroundColor: '#F97316', shadowColor: 'rgba(249, 115, 22, 1)' }]} onPress={() => onShowStepsDetails && onShowStepsDetails()}>
                <Text style={styles.weightActionBtnText}>Log steps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.weightActionLinkCompact} onPress={() => onShowStepsDetails && onShowStepsDetails()}>
                <Text style={styles.weightActionLinkText}>View all logs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 8: Activities */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="barbell-outline" size={14} color="#1F1F1F" />
              <Text style={styles.progressSectionTitleCompact}>Activities</Text>
            </View>
            <TouchableOpacity onPress={() => onShowAddActivity && onShowAddActivity()}>
              <Text style={styles.seeAllBtnSmall}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCardCompact}>
            {progressData.recentActivities.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={styles.chartPlaceholderText}>No activities logged</Text>
                <Text style={styles.chartPlaceholderSubtext}>Log a walk, run, or workout to start</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {progressData.recentActivities.map((a) => {
                  const icon = a.type === 'walking' ? 'walk-outline' : a.type === 'running' ? 'body-outline'
                    : a.type === 'cycling' ? 'bicycle-outline' : a.type === 'swimming' ? 'water-outline'
                    : a.type === 'strength' ? 'barbell-outline' : a.type === 'sports' ? 'football-outline' : 'ellipsis-horizontal-circle-outline';
                  const parts = [`${a.durationMin} min`];
                  if (a.distance) parts.push(`${a.distance} ${a.distanceUnit || 'km'}`);
                  if (a.estimatedCalories) parts.push(`~${a.estimatedCalories} kcal`);
                  return (
                    <View key={a.id} style={styles.activityRow}>
                      <View style={styles.activityIconWrap}>
                        <Ionicons name={icon} size={16} color="#F97316" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityName}>{a.name}{a.sessionType ? ` · ${a.sessionType}` : ''}</Text>
                        <Text style={styles.activityMeta}>{parts.join(' · ')}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.weightActionsCompact}>
              <TouchableOpacity style={[styles.weightActionBtnCompact, { backgroundColor: '#F97316', shadowColor: 'rgba(249, 115, 22, 1)' }]} onPress={() => onShowAddActivity && onShowAddActivity()}>
                <Text style={styles.weightActionBtnText}>Add activity</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: c.cardAlt, borderRadius: 12,
  },
  activityIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  activityName: { fontSize: 13, fontWeight: '700', color: c.text },
  activityMeta: { fontSize: 11.5, color: c.textMuted, marginTop: 1 },
  progressTab: {
    flex: 1,
    backgroundColor: c.appBg,
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
  },
  progressHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10 } : {}),
  },
  progressTitleCompact: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
  },
  filterBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRangeSelectorCompact: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 69, left: 0, right: 0, zIndex: 9 } : {}),
  },
  timeRangeBtnCompact: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
  },
  timeRangeBtnActiveCompact: {
    backgroundColor: '#059669',
  },
  timeRangeBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: c.textSecondary,
  },
  timeRangeBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  progressContentCompact: {
    flex: 1,
    paddingHorizontal: 16,
  },
  progressSectionCompact: {
    marginTop: 12,
  },
  progressSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressSectionTitleCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
    marginBottom: 8,
  },
  seeAllBtnSmall: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  chartCardCompact: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  chartTooltip: {
    position: 'absolute',
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
    zIndex: 20,
  },
  chartTooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  stepsAxisLabel: {
    fontSize: 9,
    color: '#888',
  },
  stepsGoalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(249,115,22,0.5)',
    zIndex: 1,
  },
  stepsTooltipCentered: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 20,
  },
  streaksGridFour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakItemCompact: {
    flex: 1,
    alignItems: 'center',
  },
  streakValueCompact: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
  },
  streakLabelCompact: {
    fontSize: 9,
    color: c.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  twoCardGridCompact: {
    flexDirection: 'row',
    gap: 8,
  },
  overviewTileCompact: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    gap: 2,
  },
  overviewValueCompact: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
  },
  overviewLabelCompact: {
    fontSize: 11,
    color: c.textSecondary,
  },
  overviewTrendCompact: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '500',
  },
  bmiDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bmiValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bmiValue: {
    fontSize: 32,
    fontWeight: '700',
    color: c.text,
  },
  bmiCategoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
  },
  bmiCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  bmiWeightInfo: {
    alignItems: 'flex-end',
  },
  bmiWeightLabel: {
    fontSize: 10,
    color: c.textSecondary,
  },
  bmiWeightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  bmiBarContainer: {
    marginTop: 8,
  },
  bmiBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  bmiBarSegment: {
    height: 10,
  },
  bmiIndicator: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    backgroundColor: c.cardAlt,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bmiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bmiLabel: {
    fontSize: 8,
    color: c.textMuted,
    textAlign: 'center',
    flex: 1,
  },
  chartPlaceholder: {
    height: 100,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  chartPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  chartPlaceholderSubtext: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 4,
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
    color: c.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
  weightStatsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  weightStatCompact: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  weightStatValueCompact: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  weightStatLabelCompact: {
    fontSize: 9,
    color: c.textSecondary,
    marginTop: 2,
  },
  chartLegendCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  legendItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    color: c.textSecondary,
  },
  weightActionsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  weightActionBtnCompact: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
    alignItems: 'center',
  },
  weightActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  weightActionLinkCompact: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 8,
    alignItems: 'center',
  },
  weightActionLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  calorieStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 20,
  },
  calorieStatItem: {
    alignItems: 'center',
  },
  calorieStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  calorieStatLabel: {
    fontSize: 10,
    color: c.textMuted,
  },
  calorieStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
  },
});

export default ProgressTab;
