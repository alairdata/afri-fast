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

const HUNGER_LABELS = [
  '😊 Not hungry',
  '🤔 Slightly hungry',
  '😋 Hungry',
  '🥴 Very hungry',
  '😫 Extreme hunger',
];

const formatHoursMinutes = (value) => {
  if (!value || value <= 0) return '0h 0m';
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours}h ${minutes}m`;
};

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clampPct = (value) => Math.max(0, Math.min(100, value));

const getTargetHours = (session) => parseInt((session.plan || '16:8').split(':')[0], 10) || 16;

const getActualHours = (session) => (session.durationHours || 0) + ((session.durationMinutes || 0) / 60);

const isCompletedSession = (session) => getActualHours(session) >= getTargetHours(session);

const formatDetailDate = (value) => {
  const date = toDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

const getRangeSessions = (sessions, range) => {
  const days = RANGE_DAYS[range];
  const now = Date.now();
  const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null;

  return (sessions || []).filter((session) => !cutoff || session.startTime >= cutoff);
};

const labelForScore = (value, positiveHigh = 'Great') => {
  if (value <= 0) return '--';
  if (value >= 80) return positiveHigh;
  if (value >= 60) return 'Good';
  return 'Needs support';
};

function FastTotalsPage({ show, onClose, fastingSessions = [], onDeleteFastSession }) {
  const [range, setRange] = useState('30 days');
  const [searchQuery, setSearchQuery] = useState('');

  const data = useMemo(() => {
    const sessions = getRangeSessions(fastingSessions, range);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredSessions = normalizedQuery
      ? sessions.filter((session) => {
          const date = toDate(session.startTime);
          if (!date) return false;

          const searchParts = [
            date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
            date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            date.toLocaleDateString('en-CA'),
            session.date || '',
          ].join(' ').toLowerCase();

          return searchParts.includes(normalizedQuery);
        })
      : sessions;
    const completed = filteredSessions.filter(isCompletedSession);
    const started = filteredSessions.filter((session) => !isCompletedSession(session));

    const grouped = filteredSessions.reduce((acc, session) => {
      const date = toDate(session.startTime);
      if (!date) return acc;

      const key = date.toDateString();
      if (!acc[key]) {
        acc[key] = {
          key,
          timestamp: date.getTime(),
          label: formatDetailDate(session.startTime),
          completed: 0,
          started: 0,
          sessions: [],
        };
      }

      if (isCompletedSession(session)) acc[key].completed += 1;
      else acc[key].started += 1;

      acc[key].sessions.push({
        ...session,
        actualHours: getActualHours(session),
        completed: isCompletedSession(session),
      });

      return acc;
    }, {});

    return {
      hasSessions: filteredSessions.length > 0,
      completedCount: completed.length,
      startedCount: started.length,
      startedAvgLength: started.length
        ? formatHoursMinutes(started.reduce((sum, session) => sum + getActualHours(session), 0) / started.length)
        : '--',
      totalMatches: filteredSessions.length,
      dayBreakdown: Object.values(grouped)
        .map((day) => ({
          ...day,
          sessions: day.sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)),
        }))
        .sort((a, b) => b.timestamp - a.timestamp),
    };
  }, [fastingSessions, range, searchQuery]);

  if (!show) return null;

  return (
    <View style={styles.pageOverlay}>
      <View style={styles.page}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Fast Totals</Text>
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
            placeholder="Search by date e.g. Apr 3"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fast Summary</Text>
            <Text style={styles.sectionHelperLeft}>
              {searchQuery.trim() ? `${data.totalMatches} matching fast${data.totalMatches === 1 ? '' : 's'}` : 'Showing all fasts in this range'}
            </Text>
            <View style={styles.grid}>
              <View style={[styles.card, styles.summaryCardGreen]}>
                <Text style={styles.cardValue}>{data.hasSessions ? data.completedCount : '--'}</Text>
                <Text style={styles.cardLabel}>Completed fasts</Text>
                <Text style={styles.cardMeta}>Reached or beat your target</Text>
              </View>
              <View style={[styles.card, styles.summaryCardWarm, styles.gridLastItem]}>
                <Text style={styles.cardValue}>{data.hasSessions ? data.startedCount : '--'}</Text>
                <Text style={styles.cardLabel}>Started fasts</Text>
                <Text style={styles.cardMeta}>Ended before your target</Text>
                <Text style={styles.cardSubMeta}>Avg length: {data.hasSessions ? data.startedAvgLength : '--'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day by Day</Text>
            <View style={styles.fullCard}>
              {data.dayBreakdown.length === 0 ? (
                <Text style={styles.emptyText}>Your fast activity for this range will appear here.</Text>
              ) : (
                data.dayBreakdown.map((day, index) => (
                  <View
                    key={day.key}
                    style={[styles.dayRow, index === data.dayBreakdown.length - 1 && styles.dayRowLast]}
                  >
                    <View style={styles.dayHeader}>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayTitle}>{day.label}</Text>
                        <Text style={styles.daySubtext}>
                          {day.completed + day.started} fast{day.completed + day.started === 1 ? '' : 's'} logged
                        </Text>
                      </View>

                      <View style={styles.dayCounts}>
                        <View style={[styles.dayCountChip, styles.dayCountChipGreen]}>
                          <Text style={styles.dayCountValue}>{day.completed}</Text>
                          <Text style={styles.dayCountLabel}>Completed</Text>
                        </View>
                        <View style={[styles.dayCountChip, styles.dayCountChipWarm]}>
                          <Text style={styles.dayCountValue}>{day.started}</Text>
                          <Text style={styles.dayCountLabel}>Started</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.sessionList}>
                      {day.sessions.map((session) => (
                        <View key={session.id} style={styles.sessionRow}>
                          <View style={styles.sessionInfo}>
                            <View style={styles.sessionTopLine}>
                              <Text style={styles.sessionTime}>
                                {toDate(session.startTime)?.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                }) || '--'}
                              </Text>
                              <View style={styles.sessionActions}>
                                <View style={[styles.sessionStatusChip, session.completed ? styles.sessionStatusChipGreen : styles.sessionStatusChipWarm]}>
                                  <Text style={styles.sessionStatusText}>{session.completed ? 'Completed' : 'Started'}</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.deleteBtn}
                                  onPress={() => onDeleteFastSession?.(session)}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                  <Text style={styles.deleteBtnText}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            <Text style={styles.sessionMeta}>
                              {formatHoursMinutes(session.actualHours)} • {session.plan || '16:8'} plan
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export default function FastingDetailsPage({ show, onClose, fastingSessions = [], checkInHistory = [], onDeleteFastSession }) {
  const [progressRange, setProgressRange] = useState('7 days');
  const [showFastTotalsPage, setShowFastTotalsPage] = useState(false);

  useEffect(() => {
    if (!show) {
      setShowFastTotalsPage(false);
    }
  }, [show]);

  const progressData = useMemo(() => {
    const days = RANGE_DAYS[progressRange];
    const now = Date.now();
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const previousCutoff = days ? cutoff - days * 24 * 60 * 60 * 1000 : null;

    const sessions = (fastingSessions || []).filter((session) => !cutoff || session.startTime >= cutoff);
    const previousSessions = (fastingSessions || []).filter((session) => previousCutoff && session.startTime >= previousCutoff && session.startTime < cutoff);

    const sessionHours = sessions.map(getActualHours);
    const totalHours = sessionHours.reduce((sum, value) => sum + value, 0);
    const avgHours = sessions.length ? totalHours / sessions.length : 0;
    const longestHours = sessionHours.length ? Math.max(...sessionHours) : 0;
    const completionRate = sessions.length
      ? sessions.reduce((sum, session) => {
          const targetHours = getTargetHours(session);
          const actualHours = getActualHours(session);
          return sum + Math.min((actualHours / targetHours) * 100, 100);
        }, 0) / sessions.length
      : 0;

    const previousAvgHours = previousSessions.length
      ? previousSessions.reduce((sum, session) => sum + getActualHours(session), 0) / previousSessions.length
      : 0;
    const trendDelta = previousAvgHours > 0 ? ((avgHours - previousAvgHours) / previousAvgHours) * 100 : 0;
    const periodTrend = sessions.length === 0 ? 'Getting started' : trendDelta > 5 ? 'Improving' : trendDelta < -5 ? 'Needs attention' : 'Steady';

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayStats = weekdayNames.map((weekday, index) => ({
      weekday,
      count: sessions.filter((session) => new Date(session.startTime).getDay() === index).length,
    }));
    const bestDay = weekdayStats.reduce((best, item) => (item.count > best.count ? item : best), { weekday: '--', count: 0 });
    const skippedDay = weekdayStats.reduce((worst, item) => (item.count < worst.count ? item : worst), { weekday: '--', count: Number.POSITIVE_INFINITY });

    const createBars = () => {
      if (progressRange === '7 days') {
        const values = [];
        const labels = [];
        for (let offset = days - 1; offset >= 0; offset -= 1) {
          const date = new Date();
          date.setDate(date.getDate() - offset);
          const matching = sessions.filter((session) => new Date(session.startTime).toDateString() === date.toDateString());
          const max = matching.reduce((best, session) => Math.max(best, getActualHours(session)), 0);
          values.push(Math.round(max * 10) / 10);
          labels.push(date.toLocaleDateString('en-US', { weekday: 'narrow' }));
        }
        return { values, labels };
      }

      const bucketCount = progressRange === '30 days' ? 5 : 6;
      const empty = {
        values: Array.from({ length: bucketCount }).map(() => 0),
        labels: Array.from({ length: bucketCount }).map((_, index) => (progressRange === '30 days' ? `W${index + 1}` : `P${index + 1}`)),
      };

      if (!sessions.length) return empty;

      const minTime = Math.min(...sessions.map((session) => session.startTime));
      const maxTime = Math.max(...sessions.map((session) => session.startTime));
      const span = Math.max(maxTime - minTime, 1);
      const buckets = empty.values.map(() => []);

      sessions.forEach((session) => {
        const ratio = (session.startTime - minTime) / span;
        const bucketIndex = Math.min(bucketCount - 1, Math.floor(ratio * bucketCount));
        buckets[bucketIndex].push(getActualHours(session));
      });

      return {
        values: buckets.map((bucket) => (bucket.length ? Math.round((bucket.reduce((sum, value) => sum + value, 0) / bucket.length) * 10) / 10 : 0)),
        labels: empty.labels,
      };
    };

    const bars = createBars();

    const checkIns = (checkInHistory || []).filter((entry) => {
      const date = toDate(entry.timestamp || entry.date);
      return date && (!cutoff || date.getTime() >= cutoff);
    });

    const symptomTallies = {
      lowEnergy: 0,
      brainFog: 0,
      cravings: 0,
      noSymptoms: 0,
    };

    const negativeMoodCount = checkIns.filter((entry) =>
      (entry.moods || []).some((mood) =>
        mood.includes('Irritable') || mood.includes('Anxious') || mood.includes('Low mood') || mood.includes('Stressed')
      )
    ).length;

    checkIns.forEach((entry) => {
      const symptoms = entry.symptoms || [];
      if (symptoms.some((symptom) => symptom.includes('Low energy'))) symptomTallies.lowEnergy += 1;
      if (symptoms.some((symptom) => symptom.includes('Brain fog') || symptom.includes('Trouble concentrating'))) symptomTallies.brainFog += 1;
      if (symptoms.some((symptom) => symptom.includes('Cravings'))) symptomTallies.cravings += 1;
      if (symptoms.some((symptom) => symptom.includes('Everything feels fine'))) symptomTallies.noSymptoms += 1;
    });

    const symptomTotal = Object.values(symptomTallies).reduce((sum, value) => sum + value, 0);
    const lowEnergyPct = symptomTotal ? Math.round((symptomTallies.lowEnergy / symptomTotal) * 100) : 0;
    const brainFogPct = symptomTotal ? Math.round((symptomTallies.brainFog / symptomTotal) * 100) : 0;
    const cravingsPct = symptomTotal ? Math.round((symptomTallies.cravings / symptomTotal) * 100) : 0;
    const noSymptomsPct = symptomTotal ? Math.round((symptomTallies.noSymptoms / symptomTotal) * 100) : 0;

    const energyScore = checkIns.length ? clampPct(100 - Math.round((symptomTallies.lowEnergy / checkIns.length) * 100)) : 0;
    const focusScore = checkIns.length ? clampPct(100 - Math.round((symptomTallies.brainFog / checkIns.length) * 100)) : 0;
    const moodScore = checkIns.length ? clampPct(100 - Math.round((negativeMoodCount / checkIns.length) * 100)) : 0;

    const hungerCounts = {};
    checkIns.forEach((entry) => {
      if (!entry.hungerLevel) return;
      hungerCounts[entry.hungerLevel] = (hungerCounts[entry.hungerLevel] || 0) + 1;
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
      ? 'Check-ins will unlock symptom patterns here.'
      : commonSymptom === 'No symptoms'
        ? 'Most of your check-ins report feeling fine during your fasts.'
        : `${commonSymptom} is the pattern showing up most often in your check-ins right now.`;

    return {
      avgFastLength: formatHoursMinutes(avgHours),
      completionRate: `${Math.round(completionRate)}%`,
      longestFast: longestHours > 0 ? `${Math.floor(longestHours)}h` : '--',
      totalFasts: sessions.length,
      fastingBars: bars.values,
      fastingAvg: Math.round(avgHours * 10) / 10,
      barLabels: bars.labels,
      weekVsLastWeek: previousSessions.length ? `${trendDelta >= 0 ? '+' : ''}${Math.round(trendDelta)}%` : '--',
      periodTrend,
      bestDayForFasting: bestDay.count > 0 ? bestDay.weekday : '--',
      mostSkippedDay: skippedDay.count !== Number.POSITIVE_INFINITY ? skippedDay.weekday : '--',
      energyScore,
      focusScore,
      moodScore,
      energyLabel: labelForScore(energyScore),
      focusLabel: labelForScore(focusScore),
      moodLabel: labelForScore(moodScore, 'Steady'),
      avgHungerLevel,
      commonSymptom,
      lowEnergyPct,
      brainFogPct,
      cravingsPct,
      noSymptomsPct,
      symptomInsight,
      hasSessions: sessions.length > 0,
      hasCheckIns: checkIns.length > 0,
    };
  }, [progressRange, fastingSessions, checkInHistory]);

  if (!show) return null;

  if (showFastTotalsPage) {
    return (
      <FastTotalsPage
        show={showFastTotalsPage}
        onClose={() => setShowFastTotalsPage(false)}
        fastingSessions={fastingSessions}
        onDeleteFastSession={onDeleteFastSession}
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
          <Text style={styles.pageTitle}>Fasting Details</Text>
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
            <Text style={styles.sectionTitle}>Fasting Overview</Text>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardValue}>{progressData.hasSessions ? progressData.avgFastLength : '--'}</Text>
                <Text style={styles.cardLabel}>Avg fasting length</Text>
              </View>
              <View style={[styles.card, styles.gridLastItem]}>
                <Text style={styles.cardValue}>{progressData.hasSessions ? progressData.completionRate : '--'}</Text>
                <Text style={styles.cardLabel}>Avg fast completion</Text>
              </View>
            </View>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardValue}>{progressData.hasSessions ? progressData.longestFast : '--'}</Text>
                <Text style={styles.cardLabel}>Longest fast</Text>
              </View>
              <TouchableOpacity
                style={[styles.card, styles.pressableCard, styles.gridLastItem]}
                onPress={() => setShowFastTotalsPage(true)}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardValue}>{progressData.hasSessions ? progressData.totalFasts : '--'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#059669" />
                </View>
                <Text style={styles.cardLabel}>Total fasts</Text>
                <Text style={styles.cardMeta}>See completed vs started</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fasting Consistency</Text>
            <View style={styles.fullCard}>
              <View style={styles.chartWrap}>
                <View style={styles.barChart}>
                  {progressData.fastingBars.map((value, index) => (
                    <View key={`${progressData.barLabels[index]}-${index}`} style={styles.barGroup}>
                      <View style={styles.barContainer}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${(value / 24) * 100}%`,
                              backgroundColor: value === 0 ? '#E5E7EB' : '#8B5CF6',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{progressData.barLabels[index]}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.avgLine, { bottom: `${(progressData.fastingAvg / 24) * 100}%` }]} />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.legendText}>Completed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#E5E7EB' }]} />
                  <Text style={styles.legendText}>Missed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendLine} />
                  <Text style={styles.legendText}>Avg ({progressData.fastingAvg || 0}h)</Text>
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
                <Text style={styles.metricLabel}>Best day for fasting</Text>
                <Text style={styles.metricValue}>{progressData.bestDayForFasting}</Text>
              </View>
              <View style={[styles.metricRow, styles.metricRowLast]}>
                <Text style={styles.metricLabel}>Most skipped day</Text>
                <Text style={styles.metricValueMuted}>{progressData.mostSkippedDay}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How Your Body Responds</Text>
            <View style={styles.fullCard}>
              <View style={styles.responseItem}>
                <Text style={styles.responseLabel}>Energy during fasts</Text>
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
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.donutLegendDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.donutLegendText}>Low energy</Text>
                    <Text style={styles.donutLegendPct}>{progressData.hasCheckIns ? `${progressData.lowEnergyPct}%` : '--'}</Text>
                  </View>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.donutLegendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.donutLegendText}>Brain fog</Text>
                    <Text style={styles.donutLegendPct}>{progressData.hasCheckIns ? `${progressData.brainFogPct}%` : '--'}</Text>
                  </View>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.donutLegendDot, { backgroundColor: '#8B5CF6' }]} />
                    <Text style={styles.donutLegendText}>Cravings</Text>
                    <Text style={styles.donutLegendPct}>{progressData.hasCheckIns ? `${progressData.cravingsPct}%` : '--'}</Text>
                  </View>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.donutLegendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.donutLegendText}>No symptoms</Text>
                    <Text style={styles.donutLegendPct}>{progressData.hasCheckIns ? `${progressData.noSymptomsPct}%` : '--'}</Text>
                  </View>
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  page: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  rangeRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  rangeBtnActive: {
    backgroundColor: '#059669',
  },
  rangeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  rangeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.08)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F1F1F',
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  sectionHelperLeft: {
    marginTop: -2,
    marginBottom: 10,
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridLastItem: {
    marginRight: 0,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center',
    marginRight: 10,
  },
  pressableCard: {
    alignItems: 'stretch',
  },
  summaryCardGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: 'rgba(5,150,105,0.16)',
  },
  summaryCardWarm: {
    backgroundColor: '#FFF7ED',
    borderColor: 'rgba(245,158,11,0.18)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cardValueSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  fullCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.08)',
  },
  chartWrap: {
    position: 'relative',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: 4,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    maxWidth: 30,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  barLabel: {
    fontSize: 9,
    color: '#999999',
    marginTop: 8,
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderTopWidth: 2,
    borderTopColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F59E0B',
  },
  legendText: {
    fontSize: 11,
    color: '#666666',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  metricRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  metricLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  metricValuePositive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  metricValueMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  responseItem: {
    marginBottom: 16,
  },
  responseLabel: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  responseBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 6,
  },
  responseFill: {
    height: '100%',
    borderRadius: 999,
  },
  responseValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  donutWrap: {
    flexDirection: 'row',
    gap: 20,
  },
  donut: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  donutLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  donutLegend: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donutLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  donutLegendText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
  },
  donutLegendPct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  insightBox: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.06)',
    padding: 12,
  },
  insightText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#065F46',
  },
  insightNote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionHelper: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayRow: {
    flexDirection: 'column',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  dayRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  dayInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  daySubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  dayCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 0,
  },
  dayCountChip: {
    minWidth: 72,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginLeft: 6,
  },
  dayCountChipGreen: {
    backgroundColor: '#ECFDF5',
  },
  dayCountChipWarm: {
    backgroundColor: '#FFF7ED',
  },
  dayCountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  dayCountLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  sessionList: {
    marginTop: 16,
    gap: 10,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  sessionInfo: {
    flex: 1,
    paddingRight: 12,
  },
  sessionTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  sessionTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  sessionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  sessionStatusChip: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  sessionStatusChipGreen: {
    backgroundColor: '#DCFCE7',
  },
  sessionStatusChipWarm: {
    backgroundColor: '#FFEDD5',
  },
  sessionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.10)',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  cardSubMeta: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#7C2D12',
    textAlign: 'center',
  },
});
