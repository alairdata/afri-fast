import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday-based (0=Mon)
};

const formatTime = (timestamp) => {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const FastingCalendarPage = ({ show, onClose, fastingSessions = [], isFasting, selectedPlan, checkInHistory = [], onShowCheckInPage, volumeUnit = 'oz' }) => {
  const today = new Date();
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'year'
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [yearViewYear, setYearViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showBackToToday, setShowBackToToday] = useState(false);
  const calendarScrollRef = useRef(null);
  const todayMonthY = useRef(0);

  // Build a lookup map of fasting sessions keyed by date string (YYYY-MM-DD)
  const fastingMap = useMemo(() => {
    const map = {};
    fastingSessions.forEach((session) => {
      if (session.startTime) {
        const d = new Date(session.startTime);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(session);
      }
    });
    return map;
  }, [fastingSessions]);

  // Build check-in lookup by date string (toDateString format)
  const checkInMap = useMemo(() => {
    const map = {};
    checkInHistory.forEach((ci) => {
      if (ci.date) {
        if (!map[ci.date]) map[ci.date] = [];
        map[ci.date].push(ci);
      }
    });
    return map;
  }, [checkInHistory]);

  const getDateKey = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getCheckIns = (year, month, day) => {
    const d = new Date(year, month, day);
    return checkInMap[d.toDateString()] || [];
  };

  const isToday = (year, month, day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const hasFast = (year, month, day) => {
    const key = getDateKey(year, month, day);
    return fastingMap[key] && fastingMap[key].length > 0;
  };

  const getFastSessions = (year, month, day) => {
    const key = getDateKey(year, month, day);
    return fastingMap[key] || [];
  };

  const navigateMonth = (direction) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(null);
  };

  const handleDayPress = (day) => {
    setSelectedDay(day);
  };

  const closeDetail = () => setSelectedDay(null);

  // ─── Month Grid Builder ───
  const renderMonthGrid = (year, month, options = {}) => {
    const { mini = false, onDayPress = null } = options;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const rows = [];
    let cells = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(
        <View key={`empty-${i}`} style={mini ? styles.miniDayCell : styles.dayCell} />
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const fasted = hasFast(year, month, day);
      const todayFlag = isToday(year, month, day);
      const selected = !mini && selectedDay === day && month === currentMonth && year === currentYear;

      cells.push(
        <Pressable
          key={day}
          onPress={mini ? undefined : () => onDayPress && onDayPress(day)}
          style={({ pressed }) => [
            mini ? styles.miniDayCell : styles.dayCell,
            fasted && (mini ? styles.miniDayFasted : styles.dayFasted),
            todayFlag && !fasted && (mini ? null : styles.dayToday),
            selected && styles.daySelected,
            !mini && pressed && { opacity: 0.6 },
          ]}
        >
          <Text
            style={[
              mini ? styles.miniDayText : styles.dayText,
              fasted && styles.dayTextFasted,
              todayFlag && !fasted && styles.dayTextToday,
              selected && styles.dayTextSelected,
            ]}
          >
            {day}
          </Text>
          {!mini && fasted && <View style={styles.dayDot} />}
        </Pressable>
      );

      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        // Fill trailing cells in last row
        if (day === daysInMonth) {
          const remaining = 7 - cells.length % 7;
          if (remaining < 7) {
            for (let i = 0; i < remaining; i++) {
              cells.push(
                <View key={`trail-${i}`} style={mini ? styles.miniDayCell : styles.dayCell} />
              );
            }
          }
        }
        rows.push(
          <View key={`row-${rows.length}`} style={mini ? styles.miniWeekRow : styles.weekRow}>
            {cells}
          </View>
        );
        cells = [];
      }
    }

    return rows;
  };

  // ─── Fasting insights based on day data ───
  const getInsightsForDay = (sessions, checkIns, isFuture) => {
    const hasSessions = sessions.length > 0;
    const hasCheckIns = checkIns.length > 0;
    const insights = [];

    if (isFuture) {
      // Predictive insights based on past patterns
      const totalSessions = fastingSessions.length;
      const avgDuration = totalSessions > 0
        ? Math.round(fastingSessions.reduce((sum, s) => sum + (s.durationHours || 0), 0) / totalSessions)
        : 0;

      if (totalSessions >= 3) {
        insights.push({ title: 'Expected fast duration', desc: `Based on your pattern, you typically fast ~${avgDuration}h`, color: '#ECFDF5', accent: '#059669' });
        insights.push({ title: 'Hunger prediction', desc: `Expect a hunger spike around hour ${Math.min(avgDuration - 2, 14)}. Stay prepared`, color: '#FFF7ED', accent: '#F59E0B' });
      }
      insights.push({ title: 'Plan ahead', desc: 'Pre-plan your break-fast meal for better results', color: '#F5F3FF', accent: '#8B5CF6' });
      insights.push({ title: 'Stay hydrated', desc: 'Start hydrating early — aim for 2-3L throughout the day', color: '#EFF6FF', accent: '#3B82F6' });
      insights.push({ title: 'Electrolyte prep', desc: 'Have salt, magnesium & potassium ready for longer fasts', color: '#ECFDF5', accent: '#10B981' });
      return insights;
    }

    // Past/today insights
    if (hasSessions) {
      const longest = sessions.reduce((best, s) => (s.durationHours || 0) > (best.durationHours || 0) ? s : best, sessions[0]);
      const dur = longest.durationHours || 0;
      if (dur >= 16) {
        insights.push({ title: 'Deep fat burning', desc: 'You hit 16+ hours — autophagy may have started', color: '#ECFDF5', accent: '#059669' });
      } else if (dur >= 12) {
        insights.push({ title: 'Fat burning zone', desc: 'Your body switched to burning fat for fuel', color: '#ECFDF5', accent: '#10B981' });
      } else {
        insights.push({ title: 'Light fast', desc: 'Even short fasts help with insulin sensitivity', color: '#FFF7ED', accent: '#F59E0B' });
      }
    }

    if (hasCheckIns) {
      const ci = checkIns[0];
      if (ci.hungerLevel === 'high' || ci.hungerLevel === 'extreme') {
        insights.push({ title: 'Hunger was high', desc: 'Try electrolytes or sparkling water next time', color: '#FEF2F2', accent: '#EF4444' });
      }
      if (ci.moods && ci.moods.includes('energetic')) {
        insights.push({ title: 'Energy boost noted', desc: 'Fasting is working well for your energy levels', color: '#ECFDF5', accent: '#059669' });
      }
    }

    insights.push({ title: 'Hydration reminder', desc: 'Aim for 2-3L of water on fasting days', color: '#EFF6FF', accent: '#3B82F6' });
    insights.push({ title: 'Best break-fast foods', desc: 'Protein + healthy fats for sustained energy', color: '#F5F3FF', accent: '#8B5CF6' });

    return insights;
  };

  // ─── Detail Panel Content ───
  const renderDayDetail = () => {
    if (selectedDay === null) return null;
    const sessions = getFastSessions(currentYear, currentMonth, selectedDay);
    const checkIns = getCheckIns(currentYear, currentMonth, selectedDay);
    const hasSessions = sessions.length > 0;
    const hasCheckIns = checkIns.length > 0;
    const monthShort = MONTH_NAMES_SHORT[currentMonth];
    const selectedDate = new Date(currentYear, currentMonth, selectedDay);
    const isFutureDate = selectedDate > new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const insights = getInsightsForDay(sessions, checkIns, isFutureDate);

    return (
      <ScrollView style={styles.detailPanel} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHandle} />
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>
            {monthShort} {selectedDay}
          </Text>
          <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {hasSessions && <Text style={styles.detailSectionTitle}>Longest fast</Text>}
        {hasSessions && (
          [sessions.reduce((best, s) => {
            const dur = (s.durationHours || 0) * 60 + (s.durationMinutes || 0);
            const bestDur = (best.durationHours || 0) * 60 + (best.durationMinutes || 0);
            return dur > bestDur ? s : best;
          }, sessions[0])].map((session, idx) => (
            <View key={session.id || idx} style={styles.detailCard}>
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="timer-outline" size={16} color="#059669" />
                  <Text style={styles.detailLabelText}>Plan</Text>
                </View>
                <Text style={styles.detailValue}>{session.plan || selectedPlan || '--'}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="time-outline" size={16} color="#059669" />
                  <Text style={styles.detailLabelText}>Duration</Text>
                </View>
                <Text style={styles.detailValue}>
                  {session.durationHours != null
                    ? `${session.durationHours}h ${session.durationMinutes || 0}m`
                    : '--'}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="play-circle-outline" size={16} color="#059669" />
                  <Text style={styles.detailLabelText}>Started</Text>
                </View>
                <Text style={styles.detailValue}>{formatTime(session.startTime)}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="stop-circle-outline" size={16} color="#059669" />
                  <Text style={styles.detailLabelText}>Ended</Text>
                </View>
                <Text style={styles.detailValue}>{formatTime(session.endTime)}</Text>
              </View>
            </View>
          ))
        )}

        {/* ─── Symptoms and Activities ─── */}
        {!isFutureDate && (
        <>
        <Text style={styles.detailSectionTitle}>Check-in time</Text>
        {hasCheckIns ? (
          <View style={styles.symptomsCard}>
            <View style={styles.emojiRowFixed}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScrollArea} contentContainerStyle={styles.emojiScrollContent}>
                {/* Extract emojis from all check-in selections */}
                {(() => {
                  const ci = checkIns[0];
                  const allItems = [
                    ...(ci.feelings || []),
                    ...(ci.hungerLevel ? [ci.hungerLevel] : []),
                    ...(ci.moods || []),
                    ...(ci.symptoms || []),
                    ...(ci.fastBreak || []),
                    ...(ci.fastingStatus ? [ci.fastingStatus] : []),
                  ];
                  const emojis = allItems
                    .map(item => {
                      const spaceIdx = item.indexOf(' ');
                      return spaceIdx > 0 ? item.slice(0, spaceIdx) : null;
                    })
                    .filter(Boolean);

                  return emojis.map((emoji, i) => (
                    <View key={i} style={[styles.emojiCircle, { backgroundColor: i % 2 === 0 ? '#ECFDF5' : '#FFF7ED' }]}>
                      <Text style={styles.emojiCircleText}>{emoji}</Text>
                    </View>
                  ));
                })()}
                {checkIns[0].waterCount > 0 && (
                  <View style={styles.waterBadge}>
                    <Ionicons name="water" size={16} color="#3B82F6" />
                    <Text style={styles.waterBadgeText}>{checkIns[0].waterCount}</Text>
                    <Text style={styles.waterBadgeLabel}>{volumeUnit}</Text>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity style={styles.emojiAddBtn} onPress={onShowCheckInPage}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.symptomsEmptyCard} onPress={onShowCheckInPage} activeOpacity={0.7}>
            <View style={styles.symptomsEmptyLeft}>
              <Ionicons name="clipboard-outline" size={24} color="#D1D5DB" />
              <Text style={styles.symptomsEmptyText}>No check-in recorded</Text>
            </View>
            <View style={styles.symptomsAddBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
        </>
        )}

        {/* ─── My Daily Insights ─── */}
        <Text style={styles.detailSectionTitle}>My daily insights</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll} contentContainerStyle={styles.insightsScrollContent}>
          {insights.map((insight, i) => (
            <View key={i} style={[styles.insightCard, { backgroundColor: insight.color }]}>
              <View style={[styles.insightAccent, { backgroundColor: insight.accent }]} />
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDesc}>{insight.desc}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ─── Year View ───
  const renderYearView = () => (
    <ScrollView
      style={styles.yearScroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.yearScrollContent}
    >
      {/* Year navigation */}
      <View style={styles.yearNav}>
        <TouchableOpacity onPress={() => setYearViewYear((y) => y - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.yearNavText}>{yearViewYear}</Text>
        <TouchableOpacity onPress={() => setYearViewYear((y) => y + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={styles.yearGrid}>
        {MONTH_NAMES.map((name, monthIdx) => {
          const isCurrent =
            monthIdx === today.getMonth() && yearViewYear === today.getFullYear();
          return (
            <TouchableOpacity
              key={monthIdx}
              style={styles.miniMonthCard}
              activeOpacity={0.7}
              onPress={() => {
                setCurrentMonth(monthIdx);
                setCurrentYear(yearViewYear);
                setViewMode('month');
                setSelectedDay(null);
              }}
            >
              <Text style={[styles.miniMonthName, isCurrent && styles.miniMonthNameCurrent]}>
                {MONTH_NAMES_SHORT[monthIdx]}
              </Text>
              {/* Mini day-of-week headers */}
              <View style={styles.miniWeekHeader}>
                {DAYS_OF_WEEK.map((d, i) => (
                  <Text key={i} style={styles.miniWeekHeaderText}>{d}</Text>
                ))}
              </View>
              {renderMonthGrid(yearViewYear, monthIdx, { mini: true })}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  if (!show) return null;

  return (
    <View style={styles.overlay}>
      {/* ─── Top Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>

        {/* Segmented control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'month' && styles.segmentBtnActive]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[styles.segmentText, viewMode === 'month' && styles.segmentTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'year' && styles.segmentBtnActive]}
            onPress={() => setViewMode('year')}
          >
            <Text style={[styles.segmentText, viewMode === 'year' && styles.segmentTextActive]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* ─── Month View ─── */}
      {viewMode === 'month' && (
        <View style={styles.monthContainer}>
          {/* Fixed day-of-week headers */}
          <View style={styles.weekHeaderRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={i} style={[styles.weekHeaderText, { flex: 1, textAlign: 'center' }]}>{d}</Text>
            ))}
          </View>

          {/* Scrollable calendar — continuous months */}
          <ScrollView
            ref={calendarScrollRef}
            style={styles.calendarScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.calendarScrollContent}
            onScroll={(e) => {
              const scrollY = e.nativeEvent.contentOffset.y;
              const viewHeight = e.nativeEvent.layoutMeasurement.height;
              const todayY = todayMonthY.current;
              const isNearToday = scrollY >= todayY - viewHeight * 0.5 && scrollY <= todayY + viewHeight * 0.5;
              setShowBackToToday(!isNearToday);
            }}
            scrollEventThrottle={100}
          >
            {(() => {
              // Render 12 months back + forward to end of next year
              const months = [];
              const monthsUntilNextYearEnd = (12 - today.getMonth()) + 12;
              for (let offset = -12; offset <= monthsUntilNextYearEnd; offset++) {
                let m = today.getMonth() + offset;
                let y = today.getFullYear();
                while (m < 0) { m += 12; y -= 1; }
                while (m > 11) { m -= 12; y += 1; }
                const isTodayMonth = m === today.getMonth() && y === today.getFullYear();
                months.push(
                  <View
                    key={`${y}-${m}`}
                    style={styles.calendarMonthBlock}
                    onLayout={isTodayMonth ? (e) => { todayMonthY.current = e.nativeEvent.layout.y; } : undefined}
                  >
                    <Text style={styles.monthNavText}>{MONTH_NAMES[m]} {y}</Text>
                    <View style={styles.calendarGrid}>
                      {renderMonthGrid(y, m, { onDayPress: (day) => {
                        setCurrentMonth(m);
                        setCurrentYear(y);
                        handleDayPress(day);
                      }})}
                    </View>
                  </View>
                );
              }
              return months;
            })()}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Back to Today pill */}
          {showBackToToday && (
            <TouchableOpacity
              style={styles.backToTodayPill}
              onPress={() => {
                calendarScrollRef.current?.scrollTo({ y: todayMonthY.current, animated: true });
              }}
            >
              <Ionicons name="arrow-down" size={14} color="#059669" />
              <Text style={styles.backToTodayText}>Back to Today</Text>
            </TouchableOpacity>
          )}

          {/* Fixed bottom detail panel */}
          {selectedDay !== null && (
            <View style={styles.bottomPanel}>
              {renderDayDetail()}
            </View>
          )}
        </View>
      )}

      {/* ─── Year View ─── */}
      {viewMode === 'year' && renderYearView()}
    </View>
  );
};

const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / 7);
const MINI_CELL_SIZE = Math.floor((SCREEN_WIDTH - 72) / 21); // 3 columns, 7 cells each

const styles = StyleSheet.create({
  // ─── Overlay ───
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFBFF',
    zIndex: 1000,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FAFBFF',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  segmentTextActive: {
    color: '#111827',
    fontWeight: '600',
  },

  // ─── Month View ───
  monthContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 8,
  },
  weekHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  calendarScroll: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingBottom: 20,
  },
  calendarMonthBlock: {
    marginTop: 16,
  },
  monthNavText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  backToTodayPill: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  backToTodayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  bottomPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  // ─── Calendar Grid ───
  calendarGrid: {
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
  },
  dayFasted: {
    backgroundColor: '#059669',
  },
  dayToday: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  daySelected: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  dayTextFasted: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dayTextToday: {
    color: '#059669',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  // ─── Status Badge ───
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  statusPlan: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },

  // ─── Legend ───
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ─── Day Detail Panel ───
  detailPanel: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  detailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.1,
  },
  detailCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabelText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  detailEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  detailEmptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 12,
  },

  // ─── Symptoms & Activities ───
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  symptomsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
  },
  emojiRowFixed: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiScrollArea: {
    flex: 1,
  },
  emojiScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircleText: {
    fontSize: 22,
  },
  waterBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  waterBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 1,
  },
  waterBadgeLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  symptomsEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  symptomsEmptyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symptomsEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  symptomsAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // ─── Daily Insights ───
  insightsScroll: {
    marginHorizontal: -4,
  },
  insightsScrollContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  insightCard: {
    width: 150,
    padding: 14,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  insightAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },

  // ─── Year View ───
  yearScroll: {
    flex: 1,
  },
  yearScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  yearNavText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  miniMonthCard: {
    width: (SCREEN_WIDTH - 56) / 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  miniMonthName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 6,
  },
  miniMonthNameCurrent: {
    color: '#059669',
    fontWeight: '700',
  },
  miniWeekHeader: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  miniWeekHeaderText: {
    flex: 1,
    fontSize: 7,
    fontWeight: '600',
    color: '#D1D5DB',
    textAlign: 'center',
  },
  miniWeekRow: {
    flexDirection: 'row',
  },
  miniDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: MINI_CELL_SIZE,
    borderRadius: MINI_CELL_SIZE / 2,
  },
  miniDayFasted: {
    backgroundColor: '#059669',
  },
  miniDayText: {
    fontSize: 8,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default FastingCalendarPage;
