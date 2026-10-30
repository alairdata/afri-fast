import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Animated, PanResponder, Image, Modal } from 'react-native';
import { useTheme, dc, themedStyles } from '../lib/theme';
import { computeCurrentMealStreak } from '../lib/mealStreak';
import { getConsent, loadConsent, onConsentChange } from '../lib/consent';
import { LinearGradient } from 'expo-linear-gradient';
import HeaderFade, { useHeaderFadeScroll } from './HeaderFade';

// The Meals tab is gone: its pieces live here. The meal list sits on Today, and the
// Log your meal page, Meal history and the delete prompt open over any tab.

// "Log Meal": green gradient with a soft light sweep every few seconds, to draw the eye.
export const ShimmerLogButton = ({ onPress, label = 'Log Meal', compact = false }) => {
  const sweep = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(200);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(sweep, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, w + 90] });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[shimmerStyles.touch, compact && shimmerStyles.touchCompact]} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient
        colors={[dc('#34D399', 'bg'), dc('#059669', 'bg')]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[shimmerStyles.btn, compact && shimmerStyles.btnCompact]}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        <View style={[shimmerStyles.iconWrap, compact && shimmerStyles.iconWrapCompact]}><Ionicons name="add" size={compact ? 14 : 17} color={dc("#fff", 'text')} /></View>
        <Text style={[shimmerStyles.txt, compact && shimmerStyles.txtCompact]}>{label}</Text>
        <Animated.View pointerEvents="none" style={[shimmerStyles.sweep, { transform: [{ translateX }, { rotate: '18deg' }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const shimmerStyles = themedStyles({
  touch: {
    marginTop: 16, borderRadius: 16,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  touchCompact: { marginTop: 0, borderRadius: 14, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 16, overflow: 'hidden' },
  btnCompact: { gap: 6, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 14 },
  iconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  iconWrapCompact: { width: 20, height: 20, borderRadius: 10 },
  txt: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  txtCompact: { fontSize: 14 },
  sweep: { position: 'absolute', top: -20, bottom: -20, left: 0, width: 60 },
});

const SWIPE_DELETE_WIDTH = 76;

// Swipe-left-to-delete wrapper for a meal row. Reveals a red delete
// action underneath as the row is dragged left; snaps open/closed on release.
const SwipeableMealRow = ({ onDelete, itemStyle, baseBackground, children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const closeSwipe = () => {
    offset.current = 0;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, offset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const next = offset.current + gesture.dx;
        const open = next < -SWIPE_DELETE_WIDTH / 2;
        offset.current = open ? -SWIPE_DELETE_WIDTH : 0;
        Animated.spring(translateX, { toValue: offset.current, useNativeDriver: true, bounciness: 0 }).start();
      },
      onPanResponderTerminate: closeSwipe,
    })
  ).current;

  return (
    <View style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <View style={swipeStyles.deleteBackground}>
        <TouchableOpacity style={swipeStyles.deleteAction} onPress={() => { closeSwipe(); onDelete(); }}>
          <Ionicons name="trash-outline" size={18} color={dc("#fff", 'text')} />
          <Text style={swipeStyles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ width: '100%', backgroundColor: baseBackground, borderRadius: 12, transform: [{ translateX }] }}
      >
        <View style={itemStyle}>{children}</View>
      </Animated.View>
    </View>
  );
};

const swipeStyles = themedStyles({
  deleteBackground: { position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_DELETE_WIDTH, backgroundColor: '#EF4444', alignItems: 'stretch', justifyContent: 'center' },
  deleteAction: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deleteActionText: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
});

// What Logga users have said, shown one at a time on Log your meal.
const REVIEWS = [
  { name: 'Amina O.', text: 'It actually knew the calories in my jollof rice! I was shocked. Even got the portion right.', stars: 5 },
  { name: 'Chidi K.', text: 'I scanned my egusi soup and it broke down the macros perfectly. This app gets African food.', stars: 5 },
  { name: 'Fatima B.', text: 'Finally an app that doesn\'t just say "unknown food" when I log pounded yam and ogbono.', stars: 5 },
  { name: 'Kwame A.', text: 'The calorie count for my waakye was spot on. Even tracked the shito on the side!', stars: 4 },
  { name: 'Ngozi E.', text: 'I\'ve tried 5 calorie apps before. This is the first one that understands suya, chin chin, and puff puff.', stars: 5 },
  { name: 'Yemi D.', text: 'Tracked amala and ewedu for a week. The numbers matched what my nutritionist said. Impressive.', stars: 5 },
];

// Two names count as the same meal when they share the same words, whatever the case, punctuation, "&" or
// "and", little joining words, word order or plurals: "Jollof Rice & Chicken" = "chicken with jollof rice".
const MEAL_NAME_FILLER = new Set(['and', 'with', 'of', 'the', 'a', 'an', 'plus', 'in', 'on', 'some']);
const mealNameKey = (name) => [...new Set(
  String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !MEAL_NAME_FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
)].sort().join(' ');

// The meals someone logs most: the last 30 days, grouped by name (see mealNameKey), logged at least twice.
const usualMealsFrom = (recentMeals) => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const groups = {};
  (recentMeals || []).forEach((m) => {
    const t = m.timestamp || new Date(m.date).getTime();
    const key = mealNameKey(m.name);
    if (!key || isNaN(t) || t < cutoff) return;
    const g = groups[key] || (groups[key] = { count: 0, latest: m, latestAt: 0 });
    g.count += 1;
    if (t >= g.latestAt) { g.latest = m; g.latestAt = t; }
  });
  return Object.values(groups)
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt)
    .slice(0, 5);
};

// Meals card on the Today tab. "Today's Meals": the meals of the day picked in the week strip
// (swipe a row left to delete it, tap it to open it). "Usual Meals": the ones logged most, with ⊕ to log one again.
export const DayMealsCard = ({ date, recentMeals, onViewMeal, onRequestDelete, onOpenHistory, onLogAgain }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [tab, setTab] = useState('day');
  const isToday = date.toDateString() === new Date().toDateString();
  const meals = (recentMeals || []).filter(m => m.date === date.toDateString());
  const usual = useMemo(() => usualMealsFrom(recentMeals), [recentMeals]);
  const dayLabel = isToday ? "Today's Meals" : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Meals`;
  return (
    <View style={styles.recentMealsSectionClean}>
      <View style={styles.mealTabsWrap}>
        <View style={styles.mealTabs} accessibilityRole="tablist">
          {[['day', dayLabel], ['usual', 'Usual Meals']].map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.mealTab, tab === id && styles.mealTabOn]}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
            >
              <Text style={[styles.mealTabTxt, tab === id && styles.mealTabTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === 'usual' ? (
        <View>
          {usual.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="repeat-outline" size={28} color={colors.textMuted} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 8 }}>No usual meals yet</Text>
              <Text style={{ fontSize: 13, color: colors.subtext, marginTop: 4, textAlign: 'center' }}>
                Meals you log a few times will show up here, ready to log again
              </Text>
            </View>
          ) : usual.map((g, i) => {
            const m = g.latest;
            const photo = m.photo || m.localPhoto || m.image_url;
            const name = (m.name || '').split(',')[0].trim();
            return (
              <View key={`${m.id ?? i}-usual`} style={[styles.usualRow, i < usual.length - 1 && styles.usualRowDivider]}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.recentMealPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.recentMealIconClean, styles.recentMealIconPlain]}>
                    <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={colors.text} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                  <Text style={styles.usualName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.usualSub}>Logged {g.count} times this month</Text>
                </View>
                <TouchableOpacity
                  style={styles.usualAddBtn}
                  onPress={() => onLogAgain && onLogAgain(m)}
                  accessibilityLabel={`Log ${name} again`}
                >
                  <Ionicons name="add-circle-outline" size={24} color={dc("#16A34A", 'text')} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
      <View style={styles.recentMealsListClean}>
        {meals.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={{ fontSize: 32 }}>🍽️</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 8 }}>No meals logged</Text>
            <Text style={{ fontSize: 13, color: colors.subtext, marginTop: 4, textAlign: 'center' }}>
              Tap "Log Meal" to add a meal for this day
            </Text>
          </View>
        )}
        {meals.map((meal, mi) => {
          const photo = meal.photo || meal.localPhoto || meal.image_url;
          const parts = (meal.name || '').split(',');
          return (
            <SwipeableMealRow
              key={meal.id ?? `meal-${mi}`}
              itemStyle={styles.recentMealItemClean}
              baseBackground={colors.card}
              onDelete={() => onRequestDelete(meal.id)}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => onViewMeal && onViewMeal(meal)}
              >
                <View style={styles.recentMealLeftClean}>
                  {photo ? (
                    <View style={styles.recentMealIconClean}>
                      <Image source={{ uri: photo }} style={styles.recentMealPhoto} resizeMode="cover" />
                    </View>
                  ) : (
                    <View style={[styles.recentMealIconClean, styles.recentMealIconPlain]}>
                      <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={colors.text} />
                    </View>
                  )}
                  <View style={styles.recentMealInfoClean}>
                    <Text style={styles.recentMealNameClean} numberOfLines={2} ellipsizeMode="tail">{parts[0].trim()}</Text>
                    <View style={styles.recentMealMetaRow}>
                      <Text style={styles.recentMealTimeClean}>{meal.time}</Text>
                      {parts.length > 1 && (
                        <View style={styles.recentMealMoreTag}>
                          <Text style={styles.recentMealMoreText}>+{parts.length - 1} more</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <Text style={styles.recentMealCaloriesClean}>{meal.calories} cal</Text>
              </TouchableOpacity>
            </SwipeableMealRow>
          );
        })}
      </View>
      )}
      <TouchableOpacity onPress={onOpenHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.mealHistoryLink}>
        <Text style={styles.mealHistoryLinkTxt}>Meal history</Text>
        <Ionicons name="chevron-forward" size={14} color={dc("#059669", 'text')} />
      </TouchableOpacity>
    </View>
  );
};

// Log your meal, Meal history and the delete prompt. Rendered once in FastingApp so they open over any tab.
const MealPages = ({
  recentMeals,
  showLogMealOptions,
  setShowLogMealOptions,
  showHistory,
  setShowHistory,
  deletingMealId,
  setDeletingMealId,
  onLogMeal,
  onShowChat,
  onViewMeal,
  onDeleteMeal,
}) => {
  // 'Enter it yourself' is only for people who turned AI off; everyone else logs with AI.
  const [aiOff, setAiOff] = useState(getConsent().ai === false);
  const logFade = useHeaderFadeScroll();
  useEffect(() => { if (showLogMealOptions) logFade.scrollY.setValue(0); }, [showLogMealOptions]);
  useEffect(() => {
    loadConsent().then((c) => setAiOff(c.ai === false));
    return onConsentChange((c) => setAiOff(c.ai === false));
  }, []);
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const mealLogStreak = useMemo(() => computeCurrentMealStreak(recentMeals), [recentMeals]);

  // Rotate through the reviews, one at a time, while the page is open.
  const [reviewIndex, setReviewIndex] = useState(0);
  const reviewFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!showLogMealOptions) return undefined;
    const interval = setInterval(() => {
      Animated.timing(reviewFade, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => {
        setReviewIndex((prev) => (prev + 1) % REVIEWS.length);
        Animated.timing(reviewFade, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [showLogMealOptions]);

  // The app closes this page itself once logging actually starts, so if it can't (daily limit, AI off)
  // the person stays here on the options.
  const handleLogMethod = (method) => {
    onLogMeal && onLogMeal(method);
  };

  return (
    <>
      {/* Log your meal */}
      {showLogMealOptions && (
        <View style={[styles.logMealPage, Platform.OS === 'web' && { position: 'fixed', bottom: 0, overflowY: 'auto' }]}>
          <HeaderFade bg="#F2F2F2" scrollY={logFade.scrollY} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} {...logFade.scrollProps}>
            <View style={styles.logMealPageHeader}>
              <TouchableOpacity onPress={() => setShowLogMealOptions(false)} accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={24} color={dc("#1F1F1F", 'text')} />
              </TouchableOpacity>
            </View>

            <Text style={styles.logMealPageTitle}>Log your meal</Text>
            <Text style={styles.logMealPageSub}>Pick how you want to log it</Text>

            {/* Food Log Streak */}
            <View style={styles.streakBanner}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakFire}>🔥</Text>
                <View>
                  <Text style={styles.streakNum}>{mealLogStreak} day{mealLogStreak !== 1 ? 's' : ''}</Text>
                  <Text style={styles.streakLabel}>Food log streak</Text>
                </View>
              </View>
              <Text style={styles.streakMotivation}>
                {mealLogStreak === 0 ? 'Start your streak today!' : mealLogStreak < 3 ? 'Keep it going!' : mealLogStreak < 7 ? 'You\'re on fire!' : 'Unstoppable!'}
              </Text>
            </View>

            {/* Scan across the top; Fit it in (portions of food you have that fit your calories) and Ask Logga (talk a
                meal through) side by side under it */}
            <TouchableOpacity style={styles.scanCard} onPress={() => handleLogMethod('scan')} activeOpacity={0.85} accessibilityLabel="Scan your food">
              <View style={styles.scanCardTop}>
                <Ionicons name="camera-outline" size={24} color={dc("#16A34A", 'text')} />
                <Ionicons name="arrow-forward" size={15} color={dc("#16A34A", 'text')} style={{ transform: [{ rotate: '-45deg' }] }} />
              </View>
              <Text style={styles.scanCardTitle}>Scan your food</Text>
              <Text style={styles.scanCardDesc}>Take a photo and let Logga estimate your meal.</Text>
            </TouchableOpacity>

            <View style={[styles.optionRow, { alignItems: 'stretch' }]}>
              <TouchableOpacity style={styles.optionCard} onPress={() => handleLogMethod('fit')} activeOpacity={0.85} accessibilityLabel="Fit it in, portions that fit your calories">
                <Ionicons name="pie-chart-outline" size={22} color={dc("#059669", 'text')} />
                <Text style={styles.optionTitle}>Fit it in</Text>
                <Text style={styles.optionDesc}>Portions that fit your calories</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionCard} onPress={() => { onShowChat && onShowChat(); }} activeOpacity={0.85} accessibilityLabel="Ask Logga">
                <Ionicons name="chatbubble-outline" size={22} color={dc("#9333EA", 'text')} />
                <Text style={styles.optionTitle}>Ask Logga</Text>
                <Text style={styles.optionDesc}>Chat to log or clarify a meal</Text>
              </TouchableOpacity>
            </View>

            {/* No AI: type the meal in */}
            <TouchableOpacity style={styles.manualRow} onPress={() => handleLogMethod('manual')} activeOpacity={0.7} accessibilityLabel="Enter it yourself, type a food and its calories, no AI">
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualTitle, { color: colors.text }]}>Enter it yourself</Text>
                <Text style={styles.manualSub}>Type a food and its calories, no AI</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dc("#ccc", 'text')} />
            </TouchableOpacity>

            {/* What people are saying: real reviews from Logga users, one at a time */}
            <Text style={styles.reviewKicker}>What people are saying</Text>
            <Animated.View style={[styles.reviewCard, { opacity: reviewFade }]}>
              <View style={{ flexDirection: 'row', gap: 2, marginBottom: 6 }}>
                {[...Array(REVIEWS[reviewIndex].stars)].map((_, i) => <Ionicons key={i} name="star" size={12} color={dc("#F59E0B", 'text')} />)}
              </View>
              <Text style={styles.reviewText}>"{REVIEWS[reviewIndex].text}"</Text>
              <Text style={styles.reviewName}>— {REVIEWS[reviewIndex].name}</Text>
            </Animated.View>

          </ScrollView>
        </View>
      )}

      {/* Meal history */}
      {showHistory && (
        <View style={[styles.historyPage, Platform.OS === 'web' && { position: 'fixed', bottom: 0, overflowY: 'auto' }]}>
          <View style={styles.historyTopBar}>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.historyBack} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>Meal history</Text>
              <Text style={styles.historySub}>{recentMeals.length === 1 ? '1 meal logged' : `${recentMeals.length} meals logged`}</Text>
            </View>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {(() => {
              const grouped = recentMeals.reduce((acc, meal) => {
                const d = meal.date || new Date().toDateString();
                if (!acc[d]) acc[d] = [];
                acc[d].push(meal);
                return acc;
              }, {});
              const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
              if (sortedDates.length === 0) return (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="restaurant-outline" size={30} color={colors.textMuted} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 12 }}>No meals logged yet</Text>
                </View>
              );
              return sortedDates.map(dateStr => {
                const meals = grouped[dateStr];
                const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
                const label = (() => {
                  const d = new Date(dateStr);
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === today.toDateString()) return 'Today';
                  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
                  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                })();
                return (
                  <View key={dateStr} style={styles.historyDay}>
                    <View style={styles.historyDayHeader}>
                      <Text style={styles.historyDayLabel}>{label}</Text>
                      <Text style={styles.historyDayTotal}>{totalCal.toLocaleString()} cal</Text>
                    </View>
                    <View style={styles.historyCard}>
                      {meals.map((meal, mi) => {
                        const photo = meal.localPhoto || meal.photo || meal.image_url;
                        return (
                          <TouchableOpacity
                            key={`${dateStr}-${meal.id ?? mi}`}
                            style={[styles.historyRow, mi < meals.length - 1 && styles.historyRowDivider]}
                            activeOpacity={0.7}
                            onPress={() => { setShowHistory(false); onViewMeal && onViewMeal(meal); }}
                          >
                            {photo ? (
                              <Image source={{ uri: photo }} style={styles.historyThumb} />
                            ) : (
                              <View style={[styles.historyThumb, styles.historyThumbPlain]}>
                                <MaterialCommunityIcons name="silverware-fork-knife" size={17} color={colors.text} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.historyName} numberOfLines={2}>{meal.name}</Text>
                              {meal.time ? <Text style={styles.historyTime}>{meal.time}</Text> : null}
                            </View>
                            <Text style={styles.historyCal}>{meal.calories} cal</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              });
            })()}
          </ScrollView>
        </View>
      )}

      {/* Delete confirmation */}
      <Modal visible={deletingMealId !== null} transparent animationType="fade" onRequestClose={() => setDeletingMealId(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash" size={28} color={dc("#EF4444", 'text')} />
            </View>
            <Text style={styles.deleteTitle}>Delete this meal?</Text>
            <Text style={styles.deleteSubtitle}>This can't be undone. The meal will be removed from your log permanently.</Text>
            <TouchableOpacity
              style={styles.deleteConfirmBtn}
              onPress={() => {
                onDeleteMeal && onDeleteMeal(deletingMealId);
                setDeletingMealId(null);
              }}
            >
              <Text style={styles.deleteConfirmText}>Yes, delete it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeletingMealId(null)}>
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (c) => StyleSheet.create({
  logMealPage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dc('#F2F2F2', 'bg'), zIndex: 9999 },
  logMealPageHeader: { paddingTop: 20, paddingBottom: 16 },
  logMealPageTitle: { fontSize: 26, fontWeight: '800', color: dc('#1F1F1F', 'text'), marginBottom: 4 },
  logMealPageSub: { fontSize: 14, color: dc('#9CA3AF', 'text'), marginBottom: 16 },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: dc('#FFF7ED', 'bg'), borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 24, borderWidth: 1, borderColor: dc('#FED7AA', 'border'),
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakFire: { fontSize: 28 },
  streakNum: { fontSize: 16, fontWeight: '800', color: dc('#EA580C', 'text') },
  streakLabel: { fontSize: 11, color: dc('#9A3412', 'text'), fontWeight: '500', marginTop: 1 },
  streakMotivation: { fontSize: 11, color: dc('#EA580C', 'text'), fontWeight: '600', maxWidth: 90, textAlign: 'right' },
  scanCard: { borderRadius: 16, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 28, backgroundColor: dc('#E2E9E4', 'bg') },
  scanCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  scanCardTitle: { fontSize: 18, fontWeight: '600', color: dc('#1F1F1F', 'text'), marginTop: 36 },
  scanCardDesc: { fontSize: 13, color: dc('#4B5563', 'text'), marginTop: 12 },
  optionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  heroTile: { flex: 1, borderRadius: 20, padding: 16, gap: 10 },
  heroTileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroTileTitle: { fontSize: 15, fontWeight: '700', color: dc('#fff', 'text') },
  heroTileDesc: { fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.92)' },
  optionCard: { flex: 1, borderRadius: 14, paddingTop: 18, paddingHorizontal: 14, paddingBottom: 22, backgroundColor: dc('#FCFCFC', 'bg') },
  optionTitle: { fontSize: 16, fontWeight: '600', color: dc('#1F1F1F', 'text'), marginTop: 24 },
  optionDesc: { fontSize: 12, lineHeight: 17, color: dc('#4B5563', 'text'), marginTop: 6 },
  // Scan across the top, as on the canvas: soft green, camera and ↗ arrow, title and line below
  scanCard: { borderRadius: 16, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 22, backgroundColor: dc('#E2E9E4', 'bg') },
  scanCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  scanCardTitle: { fontSize: 18, fontWeight: '600', color: dc('#1F1F1F', 'text'), marginTop: 28 },
  scanCardDesc: { fontSize: 13, color: dc('#4B5563', 'text'), marginTop: 8 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: dc('#FCFCFC', 'bg') },
  manualTitle: { fontSize: 15, fontWeight: '700' },
  manualSub: { fontSize: 12.5, color: c.textMuted, marginTop: 2 },
  reviewKicker: { fontSize: 13, fontWeight: '600', color: dc('#BDBDBD', 'text'), marginTop: 22, marginBottom: 10 },
  reviewCard: { backgroundColor: dc('#FCFCFC', 'bg'), borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  reviewText: { fontSize: 13.5, lineHeight: 19, fontStyle: 'italic', color: dc('#1F1F1F', 'text') },
  reviewName: { fontSize: 12, fontWeight: '600', color: dc('#9CA3AF', 'text'), marginTop: 6 },

  recentMealsSectionClean: {
    backgroundColor: c.card, borderRadius: 20, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  mealTabsWrap: { alignItems: 'center', marginBottom: 14 },
  mealTabs: { flexDirection: 'row', gap: 2, padding: 4, borderRadius: 999, backgroundColor: c.cardAlt === '#F3F4F6' ? dc('#F1F5F3', 'bg') : c.cardAlt },
  mealTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  mealTabOn: { backgroundColor: c.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  mealTabTxt: { fontSize: 13, fontWeight: '600', color: dc('#6B7280', 'text') },
  mealTabTxtOn: { color: dc('#047857', 'text') },
  usualRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  usualRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  usualName: { fontSize: 15, fontWeight: '600', color: c.text },
  usualSub: { fontSize: 12, color: dc('#6B7280', 'text') },
  usualAddBtn: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  mealHistoryLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 2, marginTop: 10, paddingVertical: 6, paddingHorizontal: 8 },
  mealHistoryLinkTxt: { fontSize: 13, fontWeight: '600', color: dc('#059669', 'text') },
  recentMealsListClean: { gap: 8 },
  recentMealItemClean: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(5, 150, 105, 0.04)', borderRadius: 12 },
  recentMealLeftClean: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  recentMealIconClean: { width: 44, height: 44, borderRadius: 10, backgroundColor: dc('#059669', 'bg'), alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  recentMealIconPlain: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
  recentMealPhoto: { width: 44, height: 44, borderRadius: 10 },
  recentMealInfoClean: { gap: 3, flex: 1, minHeight: 44, justifyContent: 'center' },
  recentMealNameClean: { fontSize: 13, fontWeight: '600', color: c.text },
  recentMealMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentMealTimeClean: { fontSize: 10, color: c.textMuted },
  recentMealMoreTag: { backgroundColor: dc('#ECFDF5', 'bg'), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  recentMealMoreText: { fontSize: 9, fontWeight: '600', color: dc('#059669', 'text') },
  recentMealCaloriesClean: { fontSize: 13, fontWeight: '600', color: dc('#059669', 'text') },

  historyPage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, zIndex: 9999 },
  historyTopBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  historyBack: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 20, fontWeight: '800', color: c.text, letterSpacing: -0.3 },
  historySub: { fontSize: 13, color: c.textMuted, marginTop: 1 },
  historyDay: { marginBottom: 22 },
  historyDayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  historyDayLabel: { fontSize: 15, fontWeight: '700', color: c.text },
  historyDayTotal: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  historyCard: { backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  historyRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  historyThumb: { width: 40, height: 40, borderRadius: 10 },
  historyThumbPlain: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  historyName: { fontSize: 14.5, fontWeight: '600', color: c.text, lineHeight: 19 },
  historyTime: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  historyCal: { fontSize: 14, fontWeight: '700', color: c.text },

  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  deleteModal: { backgroundColor: c.card, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center' },
  deleteIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: dc('#FEF2F2', 'bg'), alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
  deleteSubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  deleteConfirmBtn: { width: '100%', backgroundColor: dc('#EF4444', 'bg'), borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  deleteConfirmText: { color: dc('#fff', 'text'), fontSize: 15, fontWeight: '700' },
  deleteCancelBtn: { width: '100%', borderWidth: 1.5, borderColor: dc('#E5E7EB', 'border'), borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  deleteCancelText: { color: c.text, fontSize: 15, fontWeight: '600' },
});

export default MealPages;
