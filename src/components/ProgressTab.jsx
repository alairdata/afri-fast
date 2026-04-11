import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../lib/theme';
import { LineChart } from 'react-native-chart-kit';
import { Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ProgressTab = ({
  onShowWeightModal, onShowFastingDetails, onShowBMIDetails, onShowCalorieDetails, onShowHydrationDetails,
  fastingSessions = [], recentMeals = [], weightLogs = [], waterLogs = [], checkInHistory = [],
  height = '', heightUnit = 'cm', volumeUnit = 'oz', targetWeight = null, startingWeight = null,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [progressRange, setProgressRange] = useState('7 days');
  const [weightTooltip, setWeightTooltip] = useState(null);
  const [calTooltip, setCalTooltip] = useState(null);
  const [waterTooltip, setWaterTooltip] = useState(null);

  const getProgressData = () => {
    const now = Date.now();
    const days = progressRange === '7 days' ? 7 : progressRange === '30 days' ? 30 : progressRange === '90 days' ? 90 : 99999;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const isLongRange = days >= 90; // 90 days or All time — use monthly grouping

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

    // Streak calculation — start from yesterday if no fast today yet
    let streak = 0;
    const today = new Date();
    const todayStr = today.toDateString();
    const hasFastToday = sessions.some(s => new Date(s.startTime).toDateString() === todayStr);
    const startOffset = hasFastToday ? 0 : 1;
    for (let i = startOffset; i < Math.min(days + startOffset, 365); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const hasFast = sessions.some(s => new Date(s.startTime).toDateString() === dateStr);
      if (hasFast) streak++;
      else break;
    }

    // Weight — filter by date range
    const rangeWeights = (weightLogs || []).filter(w => {
      if (days === 99999) return true;
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });
    const weightChange = rangeWeights.length >= 2 ? (rangeWeights[0].weight - rangeWeights[rangeWeights.length - 1].weight).toFixed(1) : '0';

    // Water — filter by date range
    const rangeWater = (waterLogs || []).filter(w => {
      if (days === 99999) return true;
      const t = w.timestamp || new Date(w.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    // Meals — filter by date range
    const rangeMeals = (recentMeals || []).filter(m => {
      if (days === 99999) return true;
      const t = m.timestamp || new Date(m.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

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

    // For long range, aggregate by month
    let uniqueWater;
    if (isLongRange && dailyWater.length > 0) {
      const monthlyWater = {};
      dailyWater.forEach(d => {
        const dt = new Date(d.date);
        const mKey = `${dt.getFullYear()}-${dt.getMonth()}`;
        if (!monthlyWater[mKey]) monthlyWater[mKey] = { date: d.date, totalL: 0, days: 0 };
        monthlyWater[mKey].totalL += d.totalL;
        monthlyWater[mKey].days += 1;
      });
      uniqueWater = Object.values(monthlyWater).map(m => ({ date: m.date, totalL: Math.round((m.totalL / m.days) * 10) / 10 }));
    } else {
      uniqueWater = dailyWater;
    }

    const waterChartData = uniqueWater.slice(0, isLongRange ? 12 : 7).reverse().map(l => Math.round(l.totalL * 10) / 10);
    const avgWaterL = uniqueWater.length > 0 ? (uniqueWater.reduce((s, l) => s + l.totalL, 0) / uniqueWater.length).toFixed(1) : '0';

    // Chart label formatter
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatLabel = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 6);
      if (isLongRange) return `${MONTHS[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`;
      return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
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
      currentStreak: `${streak} day${streak !== 1 ? 's' : ''}`,
      longestFast: longestSession > 0 ? `${Math.floor(longestSession)}h` : '0h',
      avgTrend: totalSessions > 2 ? '\u2191 Improving' : '\u2192 Getting started',
      rateTrend: totalSessions > 0 ? '\u2191 Active' : '\u2192 Start fasting!',
      streakTrend: streak >= 3 ? '\u{1F525} Great!' : streak > 0 ? '\u{1F4AA}\u{1F3FF} Keep going!' : 'Start today!',
      longestTrend: longestSession >= 16 ? '\u2191 Strong' : '\u2192 Building up',
      totalFastingHours: `${Math.round(totalHours)}h`,
      fastDaysCompleted: `${totalSessions}/${days <= 365 ? days : totalSessions}`,
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
        {/* Section 1: Fasting Streaks */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.progressSectionHeader}>
            <Text style={styles.progressSectionTitleCompact}>{'\u{1F525}'} Streaks</Text>
            <TouchableOpacity onPress={() => onShowFastingDetails && onShowFastingDetails()}>
              <Text style={styles.seeAllBtnSmall}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCardCompact}>
            <View style={styles.streaksGridFour}>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.currentStreak !== '0 days' ? progressData.currentStreak.split(' ')[0] : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Current streak</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{(fastingSessions || []).length > 0 ? (() => { let max = 0, cur = 0; const days = [...new Set((fastingSessions || []).map(s => new Date(s.startTime).toDateString()))].sort((a, b) => new Date(a) - new Date(b)); for (let i = 0; i < days.length; i++) { if (i === 0) { cur = 1; } else { const diff = (new Date(days[i]) - new Date(days[i-1])) / (1000*60*60*24); cur = diff === 1 ? cur + 1 : 1; } max = Math.max(max, cur); } return max; })() : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Longest streak</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{(fastingSessions || []).length > 0 ? [...new Set((fastingSessions || []).map(s => new Date(s.startTime).toDateString()))].length : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Total fast days</Text>
              </View>
              <View style={styles.streakItemCompact}>
                <Text style={styles.streakValueCompact}>{progressData.totalFastingHours !== '0h' ? progressData.totalFastingHours : '--'}</Text>
                <Text style={styles.streakLabelCompact}>Total fast hours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Two Overview Cards */}
        <View style={styles.progressSectionCompact}>
          <View style={styles.twoCardGridCompact}>
            <View style={styles.overviewTileCompact}>
              <Text style={styles.overviewValueCompact}>{progressData.avgFastLength !== '0h 0m' ? progressData.avgFastLength : '--'}</Text>
              <Text style={styles.overviewLabelCompact}>Avg fast length</Text>
              {progressData.avgFastLength !== '0h 0m' && <Text style={styles.overviewTrendCompact}>{progressData.avgTrend}</Text>}
            </View>
            <View style={styles.overviewTileCompact}>
              <Text style={styles.overviewValueCompact}>{progressData.completionRate !== '0%' ? progressData.completionRate : '--'}</Text>
              <Text style={styles.overviewLabelCompact}>Completion rate</Text>
              {progressData.completionRate !== '0%' && <Text style={styles.overviewTrendCompact}>{progressData.rateTrend}</Text>}
            </View>
          </View>
        </View>

        {/* Section 3: Current BMI */}
        <View style={styles.progressSectionCompact}>
          <Text style={styles.progressSectionTitleCompact}>Current BMI</Text>
          {(() => {
            const latestWeight = (weightLogs || []).length > 0 ? weightLogs[0] : null;
            const hasWeight = latestWeight !== null;
            const heightNum = parseFloat(height);
            const heightM = heightNum ? (heightUnit === 'ft' ? heightNum * 0.3048 : heightNum / 100) : 0;
            const hasHeight = heightM > 0;
            const bmi = hasWeight && hasHeight ? (latestWeight.weight / (heightM * heightM)).toFixed(1) : null;
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
              const yMax = startingWeight != null ? Math.ceil(startingWeight + 10) : undefined;
              const yMin = targetWeight != null ? Math.floor(targetWeight - 10) : undefined;
              return (
                <>
                  <View style={{ marginHorizontal: -12, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <LineChart
                        data={{
                          labels: displayLogs.map((l, i, arr) => {
                            if (arr.length <= 5 || i % Math.ceil(arr.length / 5) === 0 || i === arr.length - 1) {
                              return progressData.formatLabel(l.date);
                            }
                            return '';
                          }),
                          datasets: [
                            { data: allWeights },
                            ...(yMin != null || yMax != null ? [{
                              data: [
                                yMin != null ? yMin : Math.min(...allWeights),
                                yMax != null ? yMax : Math.max(...allWeights),
                              ],
                              color: () => 'rgba(0,0,0,0)',
                              strokeWidth: 0,
                              withDots: false,
                            }] : []),
                          ],
                        }}
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
                          fillShadowGradientFrom: '#059669',
                          fillShadowGradientTo: '#fff',
                          fillShadowGradientFromOpacity: 0.15,
                          fillShadowGradientToOpacity: 0,
                        }}
                        renderDotContent={({ x, y, index, indexData }) => (
                          <Rect key={index} x={x - 3} y={y - 3} width={6} height={6} fill="#059669" rx={1} />
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
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(weightTooltip.x - 30, SCREEN_WIDTH - 120)), top: Math.max(4, weightTooltip.y - 36) }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{weightTooltip.value} kg</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.chartPlaceholderText}>{hasData ? `${latest.weight} ${unit}` : 'No weight data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more to see trends' : 'Log your weight to start'}</Text>
                      </>
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
            <Text style={styles.progressSectionTitleCompact}>{'\u{1F525}'} Calorie Intake</Text>
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
                  <View style={{ marginHorizontal: -12, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <LineChart
                        data={{
                          labels: dailyData.map((d, i, arr) => {
                            if (arr.length <= 5 || i % Math.ceil(arr.length / 5) === 0 || i === arr.length - 1) {
                              return progressData.formatLabel(d.date);
                            }
                            return '';
                          }),
                          datasets: [{ data: dailyData.map(d => d.calories) }],
                        }}
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
                          fillShadowGradientFrom: '#EF4444',
                          fillShadowGradientTo: '#fff',
                          fillShadowGradientFromOpacity: 0.1,
                          fillShadowGradientToOpacity: 0,
                        }}
                        renderDotContent={({ x, y, index }) => (
                          <Rect key={index} x={x - 3} y={y - 3} width={6} height={6} fill="#EF4444" rx={1} />
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
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(calTooltip.x - 30, SCREEN_WIDTH - 120)), top: Math.max(4, calTooltip.y - 36) }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{calTooltip.value} cal</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.chartPlaceholderText}>{hasData ? `${dailyData[0].calories} cal` : 'No calorie data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasData ? 'Log more meals to see trends' : 'Log a meal to start'}</Text>
                      </>
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
            <Text style={styles.progressSectionTitleCompact}>{'\u{1F4A7}'} Hydration</Text>
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

              return (
                <>
                  <View style={{ marginHorizontal: -12, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultipleWater ? (
                      <>
                      <LineChart
                        data={{
                          labels: uniqueLogs.slice(0, progressData.isLongRange ? 12 : 7).reverse().map((l, i, arr) => {
                            if (arr.length <= 5 || i % Math.ceil(arr.length / 5) === 0 || i === arr.length - 1) {
                              return progressData.formatLabel(l.date);
                            }
                            return '';
                          }),
                          datasets: [
                            { data: chartData },
                            { data: [2, 12], color: () => 'rgba(0,0,0,0)', strokeWidth: 0, withDots: false },
                          ],
                        }}
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
                          fillShadowGradientFrom: '#0EA5E9',
                          fillShadowGradientTo: '#fff',
                          fillShadowGradientFromOpacity: 0.15,
                          fillShadowGradientToOpacity: 0,
                        }}
                        renderDotContent={({ x, y, index }) => (
                          <Rect key={index} x={x - 3} y={y - 3} width={6} height={6} fill="#0EA5E9" rx={1} />
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
                        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(waterTooltip.x - 30, SCREEN_WIDTH - 120)), top: Math.max(4, waterTooltip.y - 36) }]} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{waterTooltip.value} L</Text>
                        </View>
                      )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.chartPlaceholderText}>{hasWaterData ? `${progressData.avgWaterL} L` : 'No hydration data'}</Text>
                        <Text style={styles.chartPlaceholderSubtext}>{hasWaterData ? 'Log more to see trends' : 'Log water to start'}</Text>
                      </>
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

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
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
    backgroundColor: c.cardAlt,
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
