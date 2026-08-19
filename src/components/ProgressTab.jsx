import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../lib/theme';
import { LineChart } from 'react-native-chart-kit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const days = progressRange === '7 days' ? 7 : progressRange === '14 days' ? 14 : progressRange === '30 days' ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    // Every range always shows one point per individual day -- charts never aggregate into
    // weekly/monthly averages. rangeMode controls the axis label FORMAT: "18-Aug" (dd-Mmm) for
    // 7 days only, "18/08" (dd/mm) for 14/30/90 days. No more "All time" bucket/format.
    const rangeMode = days === 7 ? 'daily' : 'weekly';
    const isLongRange = days >= 90; // 90 days = "monthly avg" pills; 7/14/30 = "weekly avg"

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
      // id is a client-generated primary key (Date.now() for manual logs, but a large synthetic
      // number like 9000000000000+n for backfilled/webhook-synced rows) -- never a real
      // timestamp. date is the only reliable field the client actually fetches for step_logs.
      const t = new Date(s.date).getTime();
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

    // Fills gaps so the chosen range always shows every calendar day in it -- a day with no log
    // becomes a real 0 entry instead of being skipped, so "7 days" always means 7 bars/points,
    // not "however many of the last 7 days happened to have data".
    const fillDays = (byDate, field, dayCount) => {
      const out = [];
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(now - i * DAY_MS);
        const ds = d.toDateString();
        out.push(byDate[ds] || { date: ds, [field]: 0 });
      }
      return out; // already newest-first, matching the sort order of the non-filled path
    };

    // Water stats
    // Aggregate water totals per day (sum all entries for same date)
    const waterByDate = {};
    rangeWater.forEach(l => {
      const key = l.date;
      if (!waterByDate[key]) waterByDate[key] = { date: key, totalL: 0 };
      waterByDate[key].totalL += toL(l.amount, l.unit);
    });
    const dailyWater = fillDays(waterByDate, 'totalL', days);

    // Every day always gets its own point/bar -- never aggregated into weekly/monthly averages,
    // regardless of range. Only the axis LABELS get sparse (see pickLabelIndices below); the
    // underlying data stays daily so a 90-day or All-time view still shows every real day.
    const uniqueWater = dailyWater;
    const waterChartData = uniqueWater.slice().reverse().map(l => Math.round(l.totalL * 10) / 10);
    const loggedWaterDays = dailyWater.filter(l => l.totalL > 0);
    const avgWaterL = loggedWaterDays.length > 0 ? (loggedWaterDays.reduce((s, l) => s + l.totalL, 0) / loggedWaterDays.length).toFixed(1) : '0';

    // Steps stats
    const stepsByDate = {};
    rangeSteps.forEach(l => {
      const key = l.date;
      if (!stepsByDate[key]) stepsByDate[key] = { date: key, totalSteps: 0 };
      stepsByDate[key].totalSteps += l.steps;
    });
    const dailySteps = fillDays(stepsByDate, 'totalSteps', days);
    const uniqueSteps = dailySteps;
    const stepsChartData = uniqueSteps.slice().reverse().map(l => l.totalSteps);
    const loggedStepsDays = dailySteps.filter(l => l.totalSteps > 0);
    const avgSteps = loggedStepsDays.length > 0 ? Math.round(loggedStepsDays.reduce((s, l) => s + l.totalSteps, 0) / loggedStepsDays.length) : 0;

    // Chart label formatter: "18-Aug" (dd-Mmm) for 7 days, "18/08" (dd/mm) for 14/30/90 days.
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatLabel = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 6);
      if (rangeMode === 'weekly') return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
    };

    // Picks up to `count` evenly-spaced indices (always including first and last) from a dense
    // day-by-day array, so a chart with 90+ points still only labels ~4 of them -- every bar/point
    // stays, only the text underneath thins out.
    const pickLabelIndices = (n, count = 4) => {
      const idxs = new Set();
      if (n <= count) { for (let i = 0; i < n; i++) idxs.add(i); return idxs; }
      for (let k = 0; k < count; k++) idxs.add(Math.round((k * (n - 1)) / (count - 1)));
      return idxs;
    };
    const buildLabels = (items) => {
      const idxs = pickLabelIndices(items.length);
      return items.map((item, i) => (idxs.has(i) ? formatLabel(item.date) : ''));
    };

    // Fills gaps by carrying the last real value forward instead of zeroing it out -- for a
    // level metric like weight, "no log today" means "assume unchanged", not "assume 0kg". Days
    // before the very first real log stay genuinely blank (nothing to carry forward yet).
    const fillDaysCarryForward = (byDate, field, dayCount) => {
      const out = [];
      let lastEntry = null;
      for (let i = dayCount - 1; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        const ds = d.toDateString();
        const entry = byDate[ds];
        if (entry) { lastEntry = entry; out.push(entry); }
        else if (lastEntry) { out.push({ ...lastEntry, date: ds, carried: true }); }
        // else: no real value yet to carry forward -- leave this day out entirely (a true gap,
        // not a fabricated one)
      }
      return out.reverse(); // newest-first, matching the rest of this file's convention
    };

    const mealsByDate = {};
    rangeMeals.forEach(m => {
      if (!m.date) return;
      if (!mealsByDate[m.date]) mealsByDate[m.date] = { calories: 0, date: m.date };
      mealsByDate[m.date].calories += m.calories || 0;
    });
    const dailyCalData = fillDays(mealsByDate, 'calories', days);
    const loggedCalDays = dailyCalData.filter(d => d.calories > 0);

    // Weight -- group multiple same-day logs by averaging, then carry-forward fill gaps.
    const weightsByDate = {};
    rangeWeights.forEach(w => {
      if (!weightsByDate[w.date]) weightsByDate[w.date] = { ...w, weights: [] };
      weightsByDate[w.date].weights.push(w.weight);
    });
    Object.values(weightsByDate).forEach(g => {
      g.weight = parseFloat((g.weights.reduce((a, b) => a + b, 0) / g.weights.length).toFixed(1));
    });
    const uniqueWeights = fillDaysCarryForward(weightsByDate, 'weight', days);
    const weightChartData = uniqueWeights.slice().reverse().map(w => w.weight);
    const hasLoggedWeight = uniqueWeights.some(w => !w.carried);
    const totalCal = rangeMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const calDaysCount = loggedCalDays.length; // real logged days only, not the zero-filled gaps
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
      uniqueWeights,
      weightChartData,
      hasLoggedWeight,
      weightChange: `${parseFloat(weightChange) >= 0 ? '+' : ''}${weightChange} kg`,
      weeklyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(days / 7, 1)).toFixed(1)} kg/wk` : '--',
      monthlyChange: rangeWeights.length >= 2 ? `${(parseFloat(weightChange) / Math.max(monthsCount, 1)).toFixed(1)} kg/mo` : '--',
      // Calories
      rangeMeals,
      dailyCalData,
      hasLoggedCal: loggedCalDays.length > 0,
      avgDailyCal: calDaysCount > 0 ? Math.round(totalCal / calDaysCount) : 0,
      avgMonthlyCal: calDaysCount > 0 ? Math.round(totalCal / Math.max(monthsCount, 1)) : 0,
      // Water
      uniqueWater,
      waterChartData,
      avgWaterL,
      hasLoggedWater: loggedWaterDays.length > 0,
      waterGoalMet: `${uniqueWater.filter(w => w.totalL >= 2).length}/${uniqueWater.length}`,
      // Steps
      uniqueSteps,
      stepsChartData,
      avgSteps,
      hasLoggedSteps: loggedStepsDays.length > 0,
      stepsGoalMet: `${uniqueSteps.filter(s => s.totalSteps >= stepGoal).length}/${uniqueSteps.length}`,
      recentActivities: [...(activities || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5),
      // Labels
      formatLabel,
      buildLabels,
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
        {['7 days', '14 days', '30 days', '90 days'].map((range) => (
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
              const uniqueLogs = progressData.uniqueWeights;
              const hasData = progressData.hasLoggedWeight;
              const hasMultiple = hasData && uniqueLogs.length >= 2;
              const latest = uniqueLogs.length > 0 ? uniqueLogs[0] : null;
              const unit = latest ? latest.unit : 'kg';
              const displayLogs = uniqueLogs.slice().reverse();
              const allWeights = progressData.weightChartData;
              const currentWeight = latest ? latest.weight : null;
              const yMax = currentWeight != null ? Math.ceil(currentWeight + 5) : undefined;
              const yMin = targetWeight != null ? Math.floor(targetWeight - 10) : undefined;
              return (
                <>
                  <View style={{ marginLeft: 0, marginRight: -22, height: 200, overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <LineChart
                        data={{
                          labels: progressData.buildLabels(displayLogs),
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
              const uniqueLogs = progressData.dailyCalData;
              const hasData = progressData.hasLoggedCal;
              const hasMultiple = hasData && uniqueLogs.length >= 2;
              const lastMeal = progressData.rangeMeals.length > 0 ? progressData.rangeMeals[0] : null;
              const orderedLogs = uniqueLogs.slice().reverse();
              const chartData = orderedLogs.map(d => d.calories);
              const chartLabels = progressData.buildLabels(orderedLogs);
              const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
              const CHART_H = 140;
              const dataMax = chartData.length ? Math.max(...chartData) : 0;
              const axisMax = Math.max(dataMax, dailyCalorieGoal > 0 ? dailyCalorieGoal : 0, 1) * 1.1;

              return (
                <>
                  <View style={{ overflow: 'hidden', position: 'relative' }}>
                    {hasMultiple ? (
                      <>
                      <View style={{ height: CHART_H, marginTop: 10 }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                          {chartData.map((value, i) => {
                            const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                            return (
                              <TouchableOpacity
                                key={i}
                                style={{ flex: 1 }}
                                activeOpacity={0.7}
                                onPress={() => setCalTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                              >
                                <View style={{
                                  width: '100%', height: barH, borderRadius: 2,
                                  backgroundColor: '#EF4444',
                                }} />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        {chartLabels.map((label, i) => (
                          <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                        ))}
                      </View>
                      {calTooltip && (
                        <View style={styles.stepsTooltipCentered} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{calTooltip.value.toLocaleString()} cal</Text>
                          {calTooltip.date && (
                            <Text style={styles.chartTooltipSub}>{progressData.formatLabel(calTooltip.date)}</Text>
                          )}
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={styles.chartPlaceholderText}>{hasData ? `${orderedLogs[orderedLogs.length - 1].calories} cal` : 'No calorie data'}</Text>
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
              const hasWaterData = progressData.hasLoggedWater;
              const hasMultipleWater = hasWaterData && uniqueLogs.length >= 2;
              const chartData = progressData.waterChartData;
              const orderedLogs = uniqueLogs.slice().reverse();
              const chartLabels = progressData.buildLabels(orderedLogs);
              const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
              const CHART_H = 140;
              const dataMax = chartData.length ? Math.max(...chartData) : 0;
              const axisMax = Math.ceil(dataMax) || 1;

              return (
                <>
                  <View style={{ overflow: 'hidden', position: 'relative' }}>
                    {hasMultipleWater ? (
                      <>
                      <View style={{ height: CHART_H, marginTop: 10 }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                          {chartData.map((value, i) => {
                            const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                            return (
                              <TouchableOpacity
                                key={i}
                                style={{ flex: 1 }}
                                activeOpacity={0.7}
                                onPress={() => setWaterTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                              >
                                <View style={{
                                  width: '100%', height: barH, borderRadius: 2,
                                  backgroundColor: '#0EA5E9',
                                }} />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        {chartLabels.map((label, i) => (
                          <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                        ))}
                      </View>
                      {waterTooltip && (
                        <View style={styles.stepsTooltipCentered} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{waterTooltip.value} L</Text>
                          {waterTooltip.date && (
                            <Text style={styles.chartTooltipSub}>{progressData.formatLabel(waterTooltip.date)}</Text>
                          )}
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
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
              const hasStepsData = progressData.hasLoggedSteps;
              const hasMultipleSteps = hasStepsData && uniqueLogs.length >= 2;
              const chartData = progressData.stepsChartData;
              const orderedLogs = uniqueLogs.slice().reverse();
              const chartLabels = progressData.buildLabels(orderedLogs);
              // Gap tiers matching the design spec exactly: n>40 -> thin, n>12 -> medium, else wide.
              const barGap = chartData.length > 40 ? 1 : chartData.length > 12 ? 2 : 6;
              // No goal line, no goal-based ceiling, no numeric axis labels, single fill color for
              // every bar -- the design spec has none of those; ceiling is just the actual peak
              // rounded up to the nearest 1000, matching the reference's niceMax exactly.
              const CHART_H = 140;
              const dataMax = chartData.length ? Math.max(...chartData) : 0;
              const axisMax = Math.ceil(dataMax / 1000) * 1000 || 1000;

              return (
                <>
                  <View style={{ overflow: 'hidden', position: 'relative' }}>
                    {hasMultipleSteps ? (
                      <>
                      <View style={{ height: CHART_H, marginTop: 10 }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
                          {chartData.map((value, i) => {
                            const barH = Math.max(value > 0 ? 3 : 0, (value / axisMax) * CHART_H);
                            return (
                              <TouchableOpacity
                                key={i}
                                style={{ flex: 1 }}
                                activeOpacity={0.7}
                                onPress={() => setStepsTooltip(t => t?.i === i ? null : { i, value, date: orderedLogs[i]?.date })}
                              >
                                <View style={{
                                  width: '100%', height: barH, borderRadius: 2,
                                  backgroundColor: '#fb923c',
                                }} />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        {chartLabels.map((label, i) => (
                          <Text key={i} style={[styles.stepsAxisLabel, { flex: 1, textAlign: 'center' }]}>{label}</Text>
                        ))}
                      </View>
                      {stepsTooltip && (
                        <View style={styles.stepsTooltipCentered} pointerEvents="none">
                          <Text style={styles.chartTooltipText}>{stepsTooltip.value.toLocaleString()} steps</Text>
                          {stepsTooltip.date && (
                            <Text style={styles.chartTooltipSub}>{progressData.formatLabel(stepsTooltip.date)}</Text>
                          )}
                        </View>
                      )}
                      </>
                    ) : (
                      <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
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
    fontWeight: '700',
  },
  chartTooltipSub: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 1,
  },
  stepsAxisLabel: {
    fontSize: 9,
    color: '#b3b9c4',
    fontWeight: '400',
  },
  stepsTooltipCentered: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
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
