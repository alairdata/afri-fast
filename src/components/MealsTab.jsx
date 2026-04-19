import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform, Animated, Image, Modal } from 'react-native';
import { useTheme } from '../lib/theme';
import { TAB_BAR_HEIGHT } from '../lib/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2; // 40 = page padding, 12 = gap

const REVIEWS = [
  { name: 'Amina O.', text: 'It actually knew the calories in my jollof rice! I was shocked. Even got the portion right.', stars: 5 },
  { name: 'Chidi K.', text: 'I scanned my egusi soup and it broke down the macros perfectly. This app gets African food.', stars: 5 },
  { name: 'Fatima B.', text: 'Finally an app that doesn\'t just say "unknown food" when I log pounded yam and ogbono.', stars: 5 },
  { name: 'Kwame A.', text: 'The calorie count for my waakye was spot on. Even tracked the shito on the side!', stars: 4 },
  { name: 'Ngozi E.', text: 'I\'ve tried 5 calorie apps before. This is the first one that understands suya, chin chin, and puff puff.', stars: 5 },
  { name: 'Yemi D.', text: 'Tracked amala and ewedu for a week. The numbers matched what my nutritionist said. Impressive.', stars: 5 },
];

const MealsTab = ({ selectedMealDate, setSelectedMealDate, recentMeals, onLogMeal, onMakeRecipe, onFindRecipe, onViewMeal, onDeleteMeal, isFasting = false, onMealLogBlocked }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const mealLogStreak = useMemo(() => {
    let s = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      if (recentMeals.some(m => m.date === dayStr)) s++;
      else break;
    }
    return s;
  }, [recentMeals]);

  const [mealsActiveSection, setMealsActiveSection] = useState('meals');
  const [showLogMealOptions, setShowLogMealOptions] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState(null);
  const [deletingMealId, setDeletingMealId] = useState(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const reviewFade = useRef(new Animated.Value(1)).current;

  const handleLogButtonPress = () => {
    if (isFasting) {
      onMealLogBlocked?.();
      return;
    }
    setShowLogMealOptions(true);
  };

  const handleLogMethod = (method) => {
    if (isFasting) {
      onMealLogBlocked?.();
      return;
    }
    onLogMeal && onLogMeal(method);
    setShowLogMealOptions(false);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(reviewFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setReviewIndex(prev => (prev + 1) % (REVIEWS.length - 1));
        Animated.timing(reviewFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.mealsContainerClean}>
      {/* Sticky Date Header */}
      <View style={styles.mealsDateHeader}>
        <TouchableOpacity
          style={styles.mealsDateArrow}
          onPress={() => {
            const newDate = new Date(selectedMealDate);
            newDate.setDate(newDate.getDate() - 1);
            setSelectedMealDate(newDate);
          }}
        >
          <Ionicons name="chevron-back" size={18} color="#059669" />
        </TouchableOpacity>
        <View style={styles.mealsDateDisplay}>
          <Text style={styles.mealsDateText}>
            {selectedMealDate.toDateString() === new Date().toDateString()
              ? 'Today'
              : selectedMealDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </Text>
          <Text style={styles.mealsDateFull}>
            {selectedMealDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.mealsDateArrow,
            { opacity: selectedMealDate.toDateString() === new Date().toDateString() ? 0.3 : 1 }
          ]}
          disabled={selectedMealDate.toDateString() === new Date().toDateString()}
          onPress={() => {
            const today = new Date();
            const newDate = new Date(selectedMealDate);
            newDate.setDate(newDate.getDate() + 1);
            if (newDate <= today) {
              setSelectedMealDate(newDate);
            }
          }}
        >
          <Ionicons name="chevron-forward" size={18} color="#059669" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mealsScrollContent}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Large Cutlery Display */}
      <View style={styles.cutlerySection}>
        <View style={styles.cutleryContainer}>
          <View style={styles.cutleryCircle}>
            <Text style={styles.cutleryIcon}>{'\u{1F37D}\uFE0F'}</Text>
          </View>
        </View>

        {/* Log Meal Button */}
        <TouchableOpacity
          style={[styles.logMealBtnIntegrated, isFasting && styles.logMealBtnDisabled]}
          onPress={handleLogButtonPress}
          activeOpacity={isFasting ? 1 : 0.8}
        >
          {!isFasting && (
            <View style={styles.logMealBtnIconWrapper}>
              <Text style={styles.logMealBtnIcon}>+</Text>
            </View>
          )}
          <Text style={styles.logMealBtnText}>{isFasting ? 'End fast to log meals' : 'Log Meal'}</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Day's Nutrition */}
      {(() => {
        const selectedDateStr = selectedMealDate.toDateString();
        const isToday = selectedDateStr === new Date().toDateString();
        const dayMeals = recentMeals.filter(m => m.date === selectedDateStr);
        return (
          <View style={styles.nutritionCardClean}>
            <Text style={styles.nutritionTitleClean}>{isToday ? "Today's Nutrition" : `${selectedMealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}'s Nutrition`}</Text>
            <View style={styles.nutritionStatsClean}>
              <View style={styles.nutritionStatClean}>
                <Text style={styles.nutritionValueClean}>{dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0).toLocaleString()}</Text>
                <Text style={styles.nutritionLabelClean}>Calories</Text>
              </View>
              <View style={styles.nutritionDividerClean} />
              <View style={styles.nutritionStatClean}>
                <Text style={styles.nutritionValueClean}>{dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0)}g</Text>
                <Text style={styles.nutritionLabelClean}>Protein</Text>
              </View>
              <View style={styles.nutritionDividerClean} />
              <View style={styles.nutritionStatClean}>
                <Text style={styles.nutritionValueClean}>{dayMeals.reduce((sum, m) => sum + (m.carbs || 0), 0)}g</Text>
                <Text style={styles.nutritionLabelClean}>Carbs</Text>
              </View>
              <View style={styles.nutritionDividerClean} />
              <View style={styles.nutritionStatClean}>
                <Text style={styles.nutritionValueClean}>{dayMeals.reduce((sum, m) => sum + (m.fats || 0), 0)}g</Text>
                <Text style={styles.nutritionLabelClean}>Fats</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Meals for selected day */}
      <View style={styles.recentMealsSectionClean}>
        <Text style={styles.recentMealsTitleClean}>{selectedMealDate.toDateString() === new Date().toDateString() ? 'Recent Meals' : `Meals on ${selectedMealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</Text>
        <View style={styles.recentMealsListClean}>
          {recentMeals.filter(m => m.date === selectedMealDate.toDateString()).length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 36 }}>🍽️</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 10 }}>No meals logged</Text>
              <Text style={{ fontSize: 13, color: colors.subtext, marginTop: 4, textAlign: 'center' }}>
                Tap "Log Meal" to add a meal for this day
              </Text>
            </View>
          )}
          {recentMeals.filter(m => m.date === selectedMealDate.toDateString()).map((meal) => {
            return (
              <TouchableOpacity
                key={meal.id}
                style={styles.recentMealItemClean}
                onPress={() => onViewMeal && onViewMeal(meal)}
              >
                <View style={styles.recentMealLeftClean}>
                  <View style={styles.recentMealIconClean}>
                    {(meal.localPhoto || meal.photo)
                      ? <Image source={{ uri: meal.localPhoto || meal.photo }} style={styles.recentMealPhoto} />
                      : <Text style={{ fontSize: 16 }}>{'\u{1F37D}\uFE0F'}</Text>
                    }
                  </View>
                  <View style={styles.recentMealInfoClean}>
                    <Text style={styles.recentMealNameClean} numberOfLines={1} ellipsizeMode="tail">
                      {meal.name.split(',')[0].trim()}
                    </Text>
                    <View style={styles.recentMealMetaRow}>
                      <Text style={styles.recentMealTimeClean}>{meal.time}</Text>
                      {meal.name.split(',').length > 1 && (
                        <View style={styles.recentMealMoreTag}>
                          <Text style={styles.recentMealMoreText}>+{meal.name.split(',').length - 1} more</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.recentMealRightClean}>
                  <Text style={styles.recentMealCaloriesClean}>{meal.calories} cal</Text>
                  <TouchableOpacity
                    style={styles.mealDeleteBtn}
                    onPress={() => setDeletingMealId(meal.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      </ScrollView>

      {/* Log Meal Options - Full Screen overlay (outside ScrollView) */}
      {showLogMealOptions && (
        <View style={[styles.logMealPage, Platform.OS === 'web' && { position: 'fixed', bottom: 0, overflowY: 'auto' }]}>
          <View style={styles.logMealPageHeader}>
            <TouchableOpacity onPress={() => setShowLogMealOptions(false)}>
              <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
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

          <View style={styles.logMealRow}>
            <TouchableOpacity
              style={styles.logMealCard}
              onPress={() => handleLogMethod('scan')}
            >
              <View style={[styles.logMealCardIcon, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="camera-outline" size={26} color={colors.accent} />
              </View>
              <Text style={styles.logMealCardTitle}>Scan</Text>
              <Text style={styles.logMealCardDesc}>Take a photo of your food</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logMealCard}
              onPress={() => handleLogMethod('say')}
            >
              <View style={[styles.logMealCardIcon, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="mic-outline" size={26} color="#3B82F6" />
              </View>
              <Text style={styles.logMealCardTitle}>Say it</Text>
              <Text style={styles.logMealCardDesc}>Tell us what you ate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logMealRow}>
            <TouchableOpacity
              style={styles.logMealCard}
              onPress={() => handleLogMethod('write')}
            >
              <View style={[styles.logMealCardIcon, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="create-outline" size={26} color="#F97316" />
              </View>
              <Text style={styles.logMealCardTitle}>Write it</Text>
              <Text style={styles.logMealCardDesc}>Type in your meal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logMealCard}
              onPress={() => { setShowLogMealOptions(false); onMakeRecipe && onMakeRecipe(); }}
            >
              <View style={[styles.logMealCardIcon, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="restaurant-outline" size={26} color="#8B5CF6" />
              </View>
              <Text style={styles.logMealCardTitle}>Make it</Text>
              <Text style={styles.logMealCardDesc}>Build a healthy meal</Text>
            </TouchableOpacity>
          </View>

          {/* Reviews — one at a time */}
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsSectionTitle}>What people are saying</Text>
            <Animated.View style={[styles.reviewsContainer, { opacity: reviewFade }]}>
              {[REVIEWS[reviewIndex]].map((review, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewStars}>
                    {[...Array(review.stars)].map((_, s) => (
                      <Ionicons key={s} name="star" size={12} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.reviewText}>"{review.text}"</Text>
                  <Text style={styles.reviewName}>— {review.name}</Text>
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      )}

      {/* Delete confirmation modal */}
      <Modal visible={deletingMealId !== null} transparent animationType="fade">
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash" size={28} color="#EF4444" />
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
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
  mealsContainerClean: {
    flex: 1,
    backgroundColor: c.bg,
    ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
  },
  mealsScrollContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
  },
  mealsDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: c.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10 } : {}),
  },
  mealsDateArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mealsDateDisplay: {
    alignItems: 'center',
  },
  mealsDateText: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
  },
  mealsDateFull: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
  },
  cutlerySection: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  cutleryContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutleryCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutleryIcon: {
    fontSize: 120,
  },
  logMealBtnIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#059669',
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  logMealBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowColor: 'transparent',
  },
  logMealBtnIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logMealBtnIcon: {
    fontSize: 18,
    fontWeight: '300',
    color: '#fff',
  },
  logMealBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  logMealPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -120,
    backgroundColor: c.card,
    zIndex: 9999,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  logMealPageHeader: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  logMealPageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    marginBottom: 4,
  },
  logMealPageSub: {
    fontSize: 14,
    color: c.textMuted,
    marginBottom: 16,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakFire: {
    fontSize: 28,
  },
  streakNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EA580C',
  },
  streakLabel: {
    fontSize: 11,
    color: '#9A3412',
    fontWeight: '500',
    marginTop: 1,
  },
  streakMotivation: {
    fontSize: 11,
    color: '#EA580C',
    fontWeight: '600',
    maxWidth: 90,
    textAlign: 'right',
  },
  logMealRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  logMealCard: {
    flex: 1,
    backgroundColor: c.bg,
    borderRadius: 16,
    padding: 18,
    paddingBottom: 20,
  },
  logMealBlockedText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
  },
  logMealCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logMealCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  logMealCardDesc: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
  },
  reviewsSection: {
    marginTop: 20,
  },
  reviewsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BDBDBD',
    marginBottom: 12,
  },
  reviewsContainer: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: c.bg,
    borderRadius: 14,
    padding: 16,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: c.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  reviewName: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '600',
    marginTop: 8,
  },
  nutritionCardClean: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  nutritionTitleClean: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 14,
  },
  nutritionStatsClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionStatClean: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValueClean: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  nutritionLabelClean: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutritionDividerClean: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  recentMealsSectionClean: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  recentMealsTitleClean: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    marginBottom: 12,
  },
  recentMealsListClean: {
    gap: 8,
  },
  recentMealItemClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 12,
  },
  recentMealLeftClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  recentMealIconClean: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  recentMealPhoto: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  recentMealInfoClean: {
    gap: 3,
    flex: 1,
  },
  recentMealNameClean: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
  },
  recentMealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentMealTimeClean: {
    fontSize: 10,
    color: c.textMuted,
  },
  recentMealMoreTag: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  recentMealMoreText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#059669',
  },
  recentMealRightClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealDeleteBtn: {
    padding: 6,
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deleteModal: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  deleteIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8,
  },
  deleteSubtitle: {
    fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  deleteConfirmBtn: {
    width: '100%', backgroundColor: '#EF4444',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  deleteConfirmText: {
    color: '#fff', fontSize: 15, fontWeight: '700',
  },
  deleteCancelBtn: {
    width: '100%', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  deleteCancelText: {
    color: c.text, fontSize: 15, fontWeight: '600',
  },
  recentMealCaloriesClean: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  macroExpandedCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  macroBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  macroBarSegment: {
    height: '100%',
  },
  macroDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  macroDetailLabel: {
    fontSize: 11,
    color: c.textMuted,
    marginBottom: 2,
  },
  macroDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  macroDetailPct: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 1,
  },
  macroItemsList: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  macroItemText: {
    fontSize: 12,
    color: c.textSecondary,
    paddingVertical: 2,
  },
});

export default MealsTab;
