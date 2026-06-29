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
  Platform,
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
  return day === 0 ? 6 : day - 1;
};

const FastingCalendarPage = ({ show, onClose, recentMeals = [], dailyCalorieGoal = 1600, checkInHistory = [], onShowCheckInPage, volumeUnit = 'oz' }) => {
  const today = new Date();
  const [viewMode, setViewMode] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [yearViewYear, setYearViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showBackToToday, setShowBackToToday] = useState(false);
  const calendarScrollRef = useRef(null);
  const todayMonthY = useRef(0);

  // Build lookup map of meals keyed by date YYYY-MM-DD
  const mealMap = useMemo(() => {
    const map = {};
    recentMeals.forEach((meal) => {
      const dateStr = meal.dateStr || (meal.date ? meal.date.slice(0, 10) : null);
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = { meals: [], totalCal: 0 };
      map[dateStr].meals.push(meal);
      map[dateStr].totalCal += meal.cal || 0;
    });
    return map;
  }, [recentMeals]);

  // Build check-in lookup by date string
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

  const getDayData = (year, month, day) => {
    const key = getDateKey(year, month, day);
    return mealMap[key] || null;
  };

  const hasMeals = (year, month, day) => !!getDayData(year, month, day);

  const isOnGoal = (year, month, day) => {
    const data = getDayData(year, month, day);
    return data && data.totalCal > 0 && data.totalCal <= dailyCalorieGoal;
  };

  const isOverGoal = (year, month, day) => {
    const data = getDayData(year, month, day);
    return data && data.totalCal > dailyCalorieGoal;
  };

  const navigateMonth = (direction) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    else if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(null);
  };

  const handleDayPress = (day) => setSelectedDay(day);
  const closeDetail = () => setSelectedDay(null);

  // ─── Month Grid Builder ───
  const renderMonthGrid = (year, month, options = {}) => {
    const { mini = false, onDayPress = null } = options;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const rows = [];
    let cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={mini ? styles.miniDayCell : styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const logged = hasMeals(year, month, day);
      const onGoal = isOnGoal(year, month, day);
      const overGoal = isOverGoal(year, month, day);
      const todayFlag = isToday(year, month, day);
      const selected = !mini && selectedDay === day && month === currentMonth && year === currentYear;

      cells.push(
        <Pressable
          key={day}
          onPress={mini ? undefined : () => onDayPress && onDayPress(day)}
          style={({ pressed }) => [
            mini ? styles.miniDayCell : styles.dayCell,
            onGoal && (mini ? styles.miniDayOnGoal : styles.dayOnGoal),
            overGoal && (mini ? styles.miniDayOverGoal : styles.dayOverGoal),
            todayFlag && !logged && (mini ? null : styles.dayToday),
            selected && styles.daySelected,
            !mini && pressed && { opacity: 0.6 },
          ]}
        >
          <Text
            style={[
              mini ? styles.miniDayText : styles.dayText,
              logged && styles.dayTextLogged,
              todayFlag && !logged && styles.dayTextToday,
              selected && styles.dayTextSelected,
            ]}
          >
            {day}
          </Text>
          {!mini && logged && <View style={[styles.dayDot, overGoal && styles.dayDotOver]} />}
        </Pressable>
      );

      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        if (day === daysInMonth) {
          const remaining = 7 - cells.length % 7;
          if (remaining < 7) {
            for (let i = 0; i < remaining; i++) {
              cells.push(<View key={`trail-${i}`} style={mini ? styles.miniDayCell : styles.dayCell} />);
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

  // ─── Weight loss insights for each day ───
  const getInsightsForDay = (dayData, checkIns, isFuture) => {
    const insights = [];

    if (isFuture) {
      insights.push({ title: 'Plan your meals', desc: 'Pre-logging meals helps you stay within your calorie goal', color: '#ECFDF5', accent: '#059669' });
      insights.push({ title: 'Protein first', desc: 'Start with protein-rich foods — they keep you fuller longer', color: '#FFF7ED', accent: '#F59E0B' });
      insights.push({ title: 'Stay hydrated', desc: 'Aim for 2-3L of water — thirst is often mistaken for hunger', color: '#EFF6FF', accent: '#3B82F6' });
      insights.push({ title: 'Fibre focus', desc: 'High-fibre foods like beans and vegetables slow digestion and reduce cravings', color: '#F5F3FF', accent: '#8B5CF6' });
      return insights;
    }

    if (dayData) {
      const { totalCal, meals } = dayData;
      const diff = totalCal - dailyCalorieGoal;
      if (diff > 300) {
        insights.push({ title: `${diff} cal over goal`, desc: 'Tomorrow, aim for a slightly lighter day to balance it out', color: '#FEF2F2', accent: '#EF4444' });
      } else if (diff > 0) {
        insights.push({ title: `${diff} cal over goal`, desc: 'Just slightly over — a short walk can close the gap', color: '#FFF7ED', accent: '#F59E0B' });
      } else if (totalCal > 0) {
        insights.push({ title: 'Goal reached!', desc: `You stayed within ${dailyCalorieGoal} cal — great consistency`, color: '#ECFDF5', accent: '#059669' });
      }
      const topMeal = meals.reduce((best, m) => (m.cal || 0) > (best.cal || 0) ? m : best, meals[0]);
      if (topMeal) {
        insights.push({ title: 'Biggest meal', desc: `${topMeal.name || 'Meal'} — ${topMeal.cal || 0} cal`, color: '#F5F3FF', accent: '#8B5CF6' });
      }
    }

    if (checkIns.length > 0) {
      const ci = checkIns[0];
      if (ci.moods && ci.moods.includes('energetic')) {
        insights.push({ title: 'Energy noted', desc: 'Good nutrition is clearly fuelling your energy — keep it up', color: '#ECFDF5', accent: '#059669' });
      }
    }

    insights.push({ title: 'Hydration check', desc: 'Staying hydrated supports metabolism and reduces cravings', color: '#EFF6FF', accent: '#3B82F6' });
    insights.push({ title: 'Protein tip', desc: 'High-protein meals (eggs, fish, beans) help preserve muscle during weight loss', color: '#FFF7ED', accent: '#F59E0B' });

    return insights;
  };

  // ─── Detail Panel Content ───
  const renderDayDetail = () => {
    if (selectedDay === null) return null;
    const dayData = getDayData(currentYear, currentMonth, selectedDay);
    const checkIns = getCheckIns(currentYear, currentMonth, selectedDay);
    const hasCheckIns = checkIns.length > 0;
    const monthShort = MONTH_NAMES_SHORT[currentMonth];
    const selectedDate = new Date(currentYear, currentMonth, selectedDay);
    const isFutureDate = selectedDate > new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const insights = getInsightsForDay(dayData, checkIns, isFutureDate);

    return (
      <ScrollView style={styles.detailPanel} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHandle} />
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{monthShort} {selectedDay}</Text>
          <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {dayData && (
          <>
            <Text style={styles.detailSectionTitle}>Meals logged</Text>
            <View style={styles.detailCard}>
              {dayData.meals.map((meal, idx) => (
                <View key={meal.id || idx}>
                  {idx > 0 && <View style={styles.detailDivider} />}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLabel}>
                      <Ionicons name="restaurant-outline" size={16} color="#059669" />
                      <Text style={styles.detailLabelText} numberOfLines={1}>{meal.name || 'Meal'}</Text>
                    </View>
                    <Text style={styles.detailValue}>{meal.cal || 0} cal</Text>
                  </View>
                </View>
              ))}
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="flame-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.detailLabelText, { fontWeight: '700' }]}>Total</Text>
                </View>
                <Text style={[styles.detailValue, dayData.totalCal > dailyCalorieGoal ? { color: '#EF4444' } : { color: '#059669' }]}>
                  {dayData.totalCal} / {dailyCalorieGoal} cal
                </Text>
              </View>
            </View>
          </>
        )}

        {!isFutureDate && (
          <>
            <Text style={styles.detailSectionTitle}>Check-in</Text>
            {hasCheckIns ? (
              <View style={styles.symptomsCard}>
                <View style={styles.emojiRowFixed}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScrollArea} contentContainerStyle={styles.emojiScrollContent}>
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
                      return allItems
                        .map((item, i) => {
                          const spaceIdx = item.indexOf(' ');
                          const emoji = spaceIdx > 0 ? item.slice(0, spaceIdx) : null;
                          if (!emoji) return null;
                          return (
                            <View key={i} style={[styles.emojiCircle, { backgroundColor: i % 2 === 0 ? '#ECFDF5' : '#FFF7ED' }]}>
                              <Text style={styles.emojiCircleText}>{emoji}</Text>
                            </View>
                          );
                        })
                        .filter(Boolean);
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

        <Text style={styles.detailSectionTitle}>Daily insights</Text>
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
    <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.yearScrollContent}>
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
          const isCurrent = monthIdx === today.getMonth() && yearViewYear === today.getFullYear();
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'month' && styles.segmentBtnActive]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[styles.segmentText, viewMode === 'month' && styles.segmentTextActive]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'year' && styles.segmentBtnActive]}
            onPress={() => setViewMode('year')}
          >
            <Text style={[styles.segmentText, viewMode === 'year' && styles.segmentTextActive]}>Year</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerBtn} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#059669' }]} />
          <Text style={styles.legendText}>On goal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Over goal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { borderWidth: 2, borderColor: '#059669' }]} />
          <Text style={styles.legendText}>Today</Text>
        </View>
      </View>

      {viewMode === 'month' && (
        <View style={styles.monthContainer}>
          <View style={styles.weekHeaderRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={i} style={[styles.weekHeaderText, { flex: 1, textAlign: 'center' }]}>{d}</Text>
            ))}
          </View>

          <ScrollView
            ref={calendarScrollRef}
            style={styles.calendarScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.calendarScrollContent}
            onScroll={(e) => {
              const scrollY = e.nativeEvent.contentOffset.y;
              const viewHeight = e.nativeEvent.layoutMeasurement.height;
              const todayY = todayMonthY.current;
              setShowBackToToday(!(scrollY >= todayY - viewHeight * 0.5 && scrollY <= todayY + viewHeight * 0.5));
            }}
            scrollEventThrottle={100}
          >
            {(() => {
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

          {showBackToToday && (
            <TouchableOpacity
              style={styles.backToTodayPill}
              onPress={() => { calendarScrollRef.current?.scrollTo({ y: todayMonthY.current, animated: true }); }}
            >
              <Ionicons name="arrow-down" size={14} color="#059669" />
              <Text style={styles.backToTodayText}>Back to Today</Text>
            </TouchableOpacity>
          )}

          {selectedDay !== null && (
            <View style={styles.bottomPanel}>
              {renderDayDetail()}
            </View>
          )}
        </View>
      )}

      {viewMode === 'year' && renderYearView()}
    </View>
  );
};

const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / 7);
const MINI_CELL_SIZE = Math.floor((SCREEN_WIDTH - 72) / 21);

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAFBFF',
    zIndex: 10000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
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
  segmentBtn: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20 },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  segmentTextActive: { color: '#111827', fontWeight: '600' },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCircle: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  monthContainer: { flex: 1, paddingHorizontal: 20 },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 8,
  },
  weekHeaderText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, paddingVertical: 4 },
  calendarScroll: { flex: 1 },
  calendarScrollContent: { paddingBottom: 20 },
  calendarMonthBlock: { marginTop: 16 },
  monthNavText: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  calendarGrid: { marginBottom: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },

  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
  },
  dayOnGoal: { backgroundColor: '#059669' },
  dayOverGoal: { backgroundColor: '#F59E0B' },
  dayToday: { borderWidth: 2, borderColor: '#059669' },
  daySelected: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dayText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  dayTextLogged: { color: '#FFFFFF', fontWeight: '600' },
  dayTextToday: { color: '#059669', fontWeight: '700' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  dayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dayDotOver: { backgroundColor: 'rgba(255,255,255,0.9)' },

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
  backToTodayText: { fontSize: 13, fontWeight: '600', color: '#059669' },

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

  detailPanel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  detailHandle: {
    width: 36, height: 4, borderRadius: 2,
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
  detailTitle: { fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: 0.1 },
  detailCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailLabelText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  detailDivider: { height: 1, backgroundColor: '#F3F4F6' },
  detailSectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    marginTop: 20, marginBottom: 10, paddingHorizontal: 4,
  },

  symptomsCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14 },
  emojiRowFixed: { flexDirection: 'row', alignItems: 'center' },
  emojiScrollArea: { flex: 1 },
  emojiScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  emojiCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emojiCircleText: { fontSize: 22 },
  waterBadge: { alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  waterBadgeText: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 1 },
  waterBadgeLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '500' },
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
  symptomsEmptyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  symptomsEmptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  symptomsAddBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  emojiAddBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },

  insightsScroll: { marginHorizontal: -4 },
  insightsScrollContent: { paddingHorizontal: 4, gap: 10 },
  insightCard: { width: 150, padding: 14, borderRadius: 14, position: 'relative', overflow: 'hidden' },
  insightAccent: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  insightTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  insightDesc: { fontSize: 11, color: '#6B7280', lineHeight: 15 },

  yearScroll: { flex: 1 },
  yearScrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 4 },
  yearNavText: { fontSize: 22, fontWeight: '700', color: '#111827' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
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
  miniMonthName: { fontSize: 13, fontWeight: '600', color: '#6B7280', textAlign: 'center', marginBottom: 6 },
  miniMonthNameCurrent: { color: '#059669', fontWeight: '700' },
  miniWeekHeader: { flexDirection: 'row', marginBottom: 2 },
  miniWeekHeaderText: { flex: 1, fontSize: 7, fontWeight: '600', color: '#D1D5DB', textAlign: 'center' },
  miniWeekRow: { flexDirection: 'row' },
  miniDayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: MINI_CELL_SIZE, borderRadius: MINI_CELL_SIZE / 2 },
  miniDayOnGoal: { backgroundColor: '#059669' },
  miniDayOverGoal: { backgroundColor: '#F59E0B' },
  miniDayText: { fontSize: 8, color: '#9CA3AF', fontWeight: '500' },
});

export default FastingCalendarPage;
