import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image, Modal, Platform, ActivityIndicator } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { getGeminiInsight } from '../lib/geminiInsights';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TodayTab = ({
  currentTime,
  fastingHours,
  fastingMinutes,
  fastingSeconds,
  isFasting,
  isRefining,
  checkedIn,
  hunger,
  energy,
  mood,
  selectedPlan,
  progress,
  circumference,
  strokeDashoffset,
  startDay,
  startHour,
  startMinute,
  endDay,
  endHour,
  endMinute,
  onShowPlanPage,
  onShowCheckInPage,
  onShowChat,
  onEditStartTime,
  onEditEndTime,
  canEditEndTime,
  onNavigateToProgress,
  onNavigateToHydration,
  onStartFast,
  onEndFast,
  fastingSessions,
  recentMeals,
  waterCount,
  waterLogs,
  volumeUnit,
  onShowCalendar,
  checkInHistory,
  weightLogs,
  targetWeight,
  startingWeight,
  dailyCalorieGoal,
  hydrationGoal,
  userName,
  userCountry,
  userId,
  proteinGoal,
  carbsGoal,
  fatsGoal,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  const [aiInsight, setAiInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setInsightLoading(true);
    getGeminiInsight({
      profile: {
        userId,
        userName,
        userCountry,
        selectedPlan,
        targetWeight,
        startingWeight,
        dailyCalorieGoal,
        hydrationGoal,
        volumeUnit,
        proteinGoal,
        carbsGoal,
        fatsGoal,
      },
      fastingSessions: fastingSessions || [],
      checkInHistory: checkInHistory || [],
      recentMeals: recentMeals || [],
      weightLogs: weightLogs || [],
      waterLogs: waterLogs || [],
    })
      .then(insight => { setAiInsight(insight); setInsightLoading(false); })
      .catch(() => setInsightLoading(false));
  }, [userId]);

  const formatDate = () => {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const meals = recentMeals || [];
  const todayCalories = meals
    .filter(m => m.date === new Date().toDateString())
    .reduce((sum, m) => sum + (m.calories || 0), 0);

  const formatTime = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const formatDisplayDate = (label) => {
    if (!label || label === '--') return '--';
    return label;
  };

  const getStageInfo = () => {
    const targetHours = parseInt((selectedPlan || '16:8').split(':')[0], 10) || 16;
    const elapsedHours = fastingHours + (fastingMinutes / 60);
    const progressRatio = targetHours > 0 ? elapsedHours / targetHours : 0;

    if (progressRatio < 0.25) return { stage: 'Fed State', desc: 'Your body is still processing recent meals.' };
    if (progressRatio < 0.5) return { stage: 'Settling In', desc: 'Your fast is underway and your body is easing into it.' };
    if (progressRatio < 0.75) return { stage: 'Fat-Burning Shift', desc: 'Your body may be leaning more on stored energy now.' };
    if (progressRatio < 1) return { stage: 'Almost There', desc: 'You are getting close to your fasting goal.' };
    return { stage: 'Goal Reached', desc: 'You have reached your fasting goal and are now fasting beyond it.' };
  };

  // === Dynamic Today's Insights ===
  const todayStr = new Date().toISOString().split('T')[0];

  const todayWater = (waterLogs || [])
    .filter(w => w.date === todayStr)
    .reduce((sum, w) => sum + (w.amount || 1), 0);

  const completedDates = new Set(
    (fastingSessions || []).filter(s => s.endTime).map(s => (s.date || s.startTime || '').split('T')[0])
  );
  let streak = 0;
  const streakDate = new Date();
  for (let i = 0; i < 30; i++) {
    if (completedDates.has(streakDate.toISOString().split('T')[0])) {
      streak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else break;
  }

  const sortedWeights = [...(weightLogs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentWeightVal = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : null;
  const weightUnitVal = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].unit : 'kg';
  const weightLostVal = startingWeight && currentWeightVal
    ? parseFloat((startingWeight - currentWeightVal).toFixed(1))
    : null;

  const stageInfo = getStageInfo();

  const insights = [];

  // Card 1: Fasting stage
  if (isFasting) {
    const stageMessages = {
      'Fed State':         { subtitle: 'Your body is still winding down from your last meal' },
      'Settling In':       { subtitle: 'Your fast is underway — the hard part is behind you' },
      'Fat-Burning Shift': { subtitle: 'This is where the magic starts to happen' },
      'Almost There':      { subtitle: "You're so close — don't quit now" },
      'Goal Reached':      { subtitle: "You've hit your goal — your body is thriving" },
    };
    const msg = stageMessages[stageInfo.stage] || { subtitle: 'Your body is working hard for you' };
    insights.push({ title: stageInfo.stage, subtitle: msg.subtitle, color: '#E8F5E9', accent: '#4CAF50' });
  } else {
    insights.push({ title: "Today's fasting stage", subtitle: "Understanding fat burning", color: '#E8F5E9', accent: '#4CAF50' });
  }

  // Card 2: Meal quality nudge
  if (todayCalories > 0 && dailyCalorieGoal) {
    const ratio = todayCalories / dailyCalorieGoal;
    const over = ratio > 1.1;
    const under = ratio < 0.5;
    insights.push({
      title: over ? 'Watch your next meal' : under ? 'Make sure you eat enough' : "You're eating well today",
      subtitle: over ? 'You may have gone a bit heavy — keep it light next time'
               : under ? 'Under-eating can slow your progress just like overeating'
               : 'Your body is getting what it needs',
      color: over ? '#FFF3E0' : '#E3F2FD', accent: over ? '#FF9800' : '#2196F3',
    });
  } else {
    insights.push({ title: "What to expect at hour 12", subtitle: "Your body at midpoint", color: '#FFF3E0', accent: '#FF9800' });
  }

  // Card 3: Hydration nudge
  if ((waterLogs || []).length > 0 && hydrationGoal) {
    const hitGoal = todayWater >= hydrationGoal;
    const low = todayWater === 0;
    insights.push({
      title: hitGoal ? 'Hydrated and thriving' : low ? 'Your body is thirsty' : 'Keep sipping',
      subtitle: hitGoal ? 'Great job — hydration makes fasting so much easier'
               : low ? "You haven't had any water yet today — that matters"
               : "You're on your way — don't stop now",
      color: '#E3F2FD', accent: '#2196F3',
    });
  } else {
    insights.push({ title: "Hydration tip", subtitle: "Stay energized today", color: '#E3F2FD', accent: '#2196F3' });
  }

  // Card 4: Motivation — streak or weight progress
  if (streak > 1) {
    insights.push({
      title: streak >= 7 ? 'You are unstoppable' : 'You are building a habit',
      subtitle: streak >= 7 ? 'A full week of consistency — that is rare and powerful'
               : 'Every day you show up makes the next one easier',
      color: '#FCE4EC', accent: '#E91E63',
    });
  } else if (weightLostVal != null && weightLostVal > 0) {
    insights.push({
      title: 'Your body is changing',
      subtitle: 'The scale is moving — what you are doing is working. Stay the course.',
      color: '#FCE4EC', accent: '#E91E63',
    });
  } else {
    insights.push({ title: "Electrolyte guide", subtitle: "3 min read", color: '#FCE4EC', accent: '#E91E63' });
  }

  // === Alert card — real observation from user data ===
  const recentCheckIns = (checkInHistory || []).filter(c => {
    const d = new Date(c.date);
    return Date.now() - d.getTime() < 14 * 24 * 60 * 60 * 1000;
  });
  const recentSessions14 = (fastingSessions || []).filter(s => {
    const d = new Date(s.date || s.startTime);
    return Date.now() - d.getTime() < 14 * 24 * 60 * 60 * 1000;
  });
  const completedRecent = recentSessions14.filter(s => s.endTime).length;
  const abandonedRecent = recentSessions14.length - completedRecent;

  const calorieRatio = dailyCalorieGoal > 0 ? todayCalories / dailyCalorieGoal : null;
  const significantlyOver = calorieRatio !== null && calorieRatio > 1.15;
  const significantlyUnder = calorieRatio !== null && calorieRatio < 0.5 && todayCalories > 0;

  // Use AI alert if available, otherwise fall back to computed logic
  let alertInsight = aiInsight?.alert || null;
  if (!alertInsight) {
    if (recentSessions14.length > 0 && recentCheckIns.length === 0) {
      alertInsight = "You haven't checked in during any of your recent fasts. Check-ins help us understand how your body is responding and give you better coaching.";
    } else if (abandonedRecent >= 2 && abandonedRecent > completedRecent) {
      alertInsight = "You've abandoned more fasts than you've completed lately. That's okay — your coach can help figure out what's getting in the way.";
    } else if (significantlyOver) {
      alertInsight = "You've gone over your calorie target today. That doesn't erase your fast — but your coach can help you understand how to balance it so your progress stays on track.";
    } else if (significantlyUnder) {
      alertInsight = "You've eaten well below your calorie target today. Under-eating can slow your metabolism and make fasting harder tomorrow — your coach can help you find the right balance.";
    } else if (todayWater === 0 && (waterLogs || []).length > 0) {
      alertInsight = "You haven't logged any water today. Dehydration makes fasting significantly harder — your coach can share some tips to stay on top of it.";
    } else if (weightLostVal != null && weightLostVal <= 0 && (weightLogs || []).length >= 3) {
      alertInsight = "Your weight hasn't moved recently despite fasting. This is common — your coach can help identify what might need adjusting.";
    } else if (streak === 0 && (fastingSessions || []).length > 0) {
      alertInsight = "You haven't completed a fast recently. Getting back on track starts with one good day — your coach is here to help.";
    } else if (streak >= 7) {
      alertInsight = "You've been incredibly consistent. Your coach wants to make sure you're not overdoing it — check in to talk about your progress.";
    } else {
      alertInsight = "Your coach is watching your patterns and has some thoughts on how you can get even better results. Tap to chat.";
    }
  }

  const patternCards = [
    {
      title: "Best foods to break your fast",
      time: "5 min read",
      image: { uri: 'https://estherafricanfoods.com/wp-content/uploads/2023/02/Healthy-foods-1080x675.webp' },
      body: "Breaking your fast with the right foods is just as important as the fast itself. After hours without eating, your digestive system is in a sensitive state, and what you eat first can either support or undo the benefits of your fast.\n\nStart with something gentle. Bone broth, a small portion of fruits like watermelon or bananas, or a handful of nuts are excellent choices. These foods are easy to digest and won't spike your blood sugar dramatically.\n\nAvoid diving straight into heavy, processed, or fried foods. Large meals right after fasting can cause bloating, nausea, and blood sugar crashes. Instead, eat a small snack first, wait 15-20 minutes, then have your main meal.\n\nProtein-rich foods like eggs, fish, or legumes are great for your main meal. Pair them with healthy fats like avocado or olive oil, and complex carbs like sweet potatoes or brown rice. This combination keeps you full longer and provides sustained energy.\n\nHydration matters too. Drink water slowly throughout your eating window. Adding a pinch of salt or electrolytes to your first glass can help with absorption after a long fast."
    },
    {
      title: "Common mistakes at your stage",
      time: "4 min read",
      image: { uri: 'https://www.manipalhospitals.com/uploads/blog/diet-mistakes-that-affect-overall-health.png' },
      body: "Starting a fasting routine is exciting, but many beginners fall into the same traps that can slow progress or make the experience unnecessarily difficult.\n\nMistake #1: Eating too much during your window. Fasting isn't a license to binge. If you consume more calories than your body needs during your eating window, you won't see the results you're hoping for. Focus on nutrient-dense meals, not just quantity.\n\nMistake #2: Not drinking enough water. Dehydration is one of the most common issues. Since you're not getting water from food during your fast, you need to be intentional about hydrating. Aim for at least 2-3 liters throughout the day.\n\nMistake #3: Going too hard too fast. If you're new to fasting, jumping straight into a 20:4 or OMAD schedule can be overwhelming. Start with 12:12 or 14:10 and gradually extend your fasting window as your body adapts.\n\nMistake #4: Ignoring sleep. Poor sleep raises cortisol and ghrelin (the hunger hormone), making fasting significantly harder. Prioritize 7-8 hours of quality sleep.\n\nMistake #5: Breaking your fast with sugar or processed food. This spikes insulin rapidly and can lead to energy crashes, cravings, and inflammation."
    },
    {
      title: "Why energy may feel low",
      time: "3 min read",
      image: { uri: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400' },
      body: "Feeling tired or sluggish during a fast is completely normal, especially in the first 1-2 weeks. Understanding why it happens can help you push through it.\n\nYour body is transitioning. When you fast, your body shifts from using glucose (from food) as its primary fuel source to burning stored fat. This metabolic switch takes time, and during the transition, energy dips are common.\n\nElectrolyte imbalance plays a big role. When you fast, your body excretes more sodium, potassium, and magnesium through urine. Low levels of these minerals cause fatigue, headaches, and brain fog. Consider adding a pinch of pink salt to your water or taking an electrolyte supplement.\n\nBlood sugar regulation is adjusting. If you previously ate frequently throughout the day, your body is used to constant glucose hits. Fasting forces it to stabilize blood sugar on its own, which initially can feel like low energy.\n\nThe good news? This gets better. Most people report significantly improved and more stable energy levels after 2-3 weeks of consistent fasting. Your body becomes more efficient at burning fat for fuel, and the energy crashes associated with blood sugar spikes disappear."
    },
    {
      title: "Optimize your eating window",
      time: "6 min read",
      image: { uri: 'https://food-ubc.b-cdn.net/wp-content/uploads/2026/02/AdobeStock_475418037-1024x683.jpeg' },
      body: "Your eating window is precious. How you use it determines whether fasting becomes a sustainable lifestyle or a frustrating cycle.\n\nPlan your meals in advance. Knowing what you'll eat removes decision fatigue and prevents impulsive, unhealthy choices. Meal prep on weekends can save you during busy weekdays.\n\nEat your largest meal first. After breaking your fast with a light snack, make your next meal the biggest and most nutrient-dense. This ensures you get essential nutrients when your body is most receptive to absorbing them.\n\nPrioritize protein. Aim for 1.6-2.2g of protein per kg of body weight daily. Protein preserves muscle mass during fasting, keeps you full, and has a high thermic effect, meaning your body burns more calories digesting it.\n\nDon't forget fiber. Vegetables, fruits, legumes, and whole grains support gut health and keep digestion smooth. Fiber also slows glucose absorption, preventing energy crashes.\n\nTime your eating window wisely. Research suggests earlier eating windows (e.g., 10am-6pm) align better with your circadian rhythm and may offer greater metabolic benefits than late-night eating. If possible, finish your last meal at least 3 hours before bed."
    },
    {
      title: "Sleep & fasting connection",
      time: "4 min read",
      image: { uri: 'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=400' },
      body: "Sleep and fasting are deeply connected. One affects the other more than most people realize, and optimizing both can dramatically improve your results.\n\nFasting improves sleep quality. Studies show that intermittent fasting can enhance deep sleep phases, improve sleep onset time, and regulate your circadian rhythm. Many fasters report falling asleep faster and waking up feeling more refreshed.\n\nBut poor sleep sabotages fasting. When you're sleep-deprived, your body produces more ghrelin (hunger hormone) and less leptin (satiety hormone). This makes fasting feel much harder and increases cravings for high-calorie, sugary foods.\n\nTiming matters. Eating too close to bedtime disrupts sleep quality. Your body has to focus on digestion instead of repair and recovery. Try to finish your last meal at least 2-3 hours before you plan to sleep.\n\nCreate a sleep routine that supports your fast. Dim lights an hour before bed, avoid screens, and keep your room cool (18-20°C). If you fast in the morning, the slight hunger can actually help you stay alert and focused during the day while promoting better sleep at night.\n\nMagnesium supplementation can help both sleep and fasting. It relaxes muscles, calms the nervous system, and helps prevent the muscle cramps that some people experience during longer fasts."
    },
  ];

  const [selectedArticle, setSelectedArticle] = useState(null);

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Calculate this week's fasting history from real sessions
  const sessions = fastingSessions || [];
  const getWeekHistory = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return weekDays.map((_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStr = day.toDateString();
      const todayStr = today.toDateString();

      if (dayStr === todayStr) {
        const fastedToday = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
        return isFasting || fastedToday ? true : null;
      } else if (day > today) {
        return null;
      } else {
        const fasted = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
        return fasted ? true : false;
      }
    });
  };
  const fastHistory = getWeekHistory();

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.headerCompact}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarTextSmall}>JK</Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.dateTextSmall}>{formatDate()}</Text>
        </View>
        <TouchableOpacity style={styles.calendarBtnSmall} onPress={onShowCalendar}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' && <View style={{ height: 58 }} />}

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Primary Status Card */}
        <View style={styles.heroCardCompact}>
          <View style={styles.heroContent}>
            {/* Fast type badge */}
            <TouchableOpacity style={styles.fastTypeBadge} onPress={onShowPlanPage}>
              <Text style={styles.fastTypeBadgeText}>{selectedPlan ? `${selectedPlan} Fast` : 'Choose a plan'}</Text>
              <Ionicons name="chevron-forward" size={14} color="#059669" />
            </TouchableOpacity>

            <View style={styles.progressRingSmall}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                <Defs>
                  <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#059669" />
                    <Stop offset="100%" stopColor="#34D399" />
                  </LinearGradient>
                </Defs>
                {/* Background track */}
                <Circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="#D1FAE5"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Progress arc */}
                <Circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="url(#ringGradient)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 100 100)"
                />
              </Svg>
              <View style={styles.progressInnerSmall}>
                {isRefining ? (
                  <>
                    <Text style={styles.refiningIconSmall}>{'\u2728'}</Text>
                    <Text style={styles.refiningTextSmall}>Refining...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.fastingLabelSmall}>{isFasting ? 'FASTING' : 'NOT FASTING'}</Text>
                    <Text style={styles.timeDisplayCompact}>
                      {isFasting ? `${fastingHours}h ${fastingMinutes}m\n${fastingSeconds}s` : '0h 0m\n0s'}
                    </Text>
                    {isFasting && <Text style={styles.stageTextSmall}>{getStageInfo().stage}</Text>}
                  </>
                )}
              </View>
            </View>

            {/* Check-in Button */}
            <TouchableOpacity style={styles.checkInBtnIntegrated} onPress={onShowCheckInPage}>
              <Text style={styles.checkInIcon}>+</Text>
              <Text style={styles.checkInText}>Check In</Text>
            </TouchableOpacity>

            <View style={styles.fastingControlsContainer}>
              {!isFasting ? (
                <TouchableOpacity style={styles.fastActionBtn} onPress={onStartFast}>
                  <Text style={styles.fastActionBtnText}>Start Fast</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.fastActionBtn} onPress={onEndFast}>
                  <Text style={styles.fastActionBtnText}>End Fast</Text>
                </TouchableOpacity>
              )}
              <View style={styles.fastTimesRow}>
                <TouchableOpacity style={styles.fastTimeBlock} onPress={isFasting ? onEditStartTime : undefined} disabled={!isFasting}>
                  <Text style={styles.fastTimeLabel}>STARTED</Text>
                  <Text style={[styles.fastTimeValue, !isFasting && styles.fastTimeDash]}>{isFasting ? formatTime(startHour, startMinute) : '--:--'}</Text>
                  <Text style={[styles.fastTimeDate, !isFasting && styles.fastTimeDash]}>{isFasting ? formatDisplayDate(startDay) : '--'}</Text>
                  {isFasting && (
                    <View style={styles.fastTimeEditBadge}>
                      <Text style={styles.fastTimeEditIcon}>{'\u270E'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.fastTimeDivider} />
                <TouchableOpacity style={styles.fastTimeBlock} onPress={canEditEndTime ? onEditEndTime : undefined} disabled={!canEditEndTime}>
                  <Text style={styles.fastTimeLabel}>ENDS</Text>
                  <Text style={[styles.fastTimeValue, !isFasting && styles.fastTimeDash]}>{isFasting ? formatTime(endHour, endMinute) : '--:--'}</Text>
                  <Text style={[styles.fastTimeDate, !isFasting && styles.fastTimeDash]}>{isFasting ? formatDisplayDate(endDay) : '--'}</Text>
                  {canEditEndTime && (
                    <View style={styles.fastTimeEditBadge}>
                      <Text style={styles.fastTimeEditIcon}>{'\u270E'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Today's Insights */}
        <View style={[styles.sectionTight, { marginTop: 28 }]}>
          <Text style={styles.sectionTitleTight}>Today's Insights</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScrollCompact}>
            {insights.map((insight, i) => (
              <TouchableOpacity key={i} style={[styles.insightCardCompact, { backgroundColor: isDark ? colors.card : insight.color }]}>
                <View style={[styles.insightAccentSmall, { backgroundColor: insight.accent }]} />
                <Text style={[styles.insightTitleSmall, isDark && { color: colors.text }]} numberOfLines={2}>{insight.title}</Text>
                <Text style={[styles.insightSubSmall, isDark && { color: colors.textSecondary }]} numberOfLines={2}>{insight.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Education Cards */}
        <View style={[styles.sectionTight, { marginTop: 28 }]}>
          <Text style={styles.sectionTitleTight}>{'\u{1F4A1}'} Just for You</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eduScrollCompact}>
            <View style={styles.educationCard}>
              <View style={styles.eduContent}>
                <Text style={styles.eduTitle}>Hunger spikes are normal around hour 16</Text>
                <Text style={styles.eduDesc}>Understanding ghrelin waves can help you push through the hardest moments.</Text>
                <TouchableOpacity style={styles.eduBtn} onPress={() => setSelectedArticle({ title: 'Hunger spikes are normal around hour 16', body: "Around hour 14-16 of fasting, many people experience a strong wave of hunger. This is caused by ghrelin — your hunger hormone — which spikes on a schedule based on when you usually eat.\n\nThe good news: ghrelin waves only last 20-30 minutes. If you push through without eating, the hunger actually fades on its own.\n\nStaying busy, drinking water or black coffee, and reminding yourself that the feeling is temporary are the most effective strategies. Over time, as your body adapts to your fasting schedule, these spikes become less intense and easier to manage." })}>
                  <Text style={styles.eduBtnText}>Learn more</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.educationCard, { backgroundColor: '#0F766E' }]}>
              <View style={styles.eduContent}>
                <Text style={styles.eduTitle}>What breaks a fast?</Text>
                <Text style={styles.eduDesc}>Learn which foods and drinks will kick you out of your fasted state.</Text>
                <TouchableOpacity style={styles.eduBtn} onPress={() => setSelectedArticle({ title: 'What breaks a fast?', body: "Not everything ends a fast — and knowing the difference can make your fasting experience much more flexible.\n\nWhat definitely breaks a fast: any food with calories, sugary drinks, milk or cream in coffee, fruit juices, and most supplements with calories or sugar.\n\nWhat does NOT break a fast: plain water, black coffee, plain tea (no milk or sugar), sparkling water, electrolytes with no calories, and most medications (always check with your doctor).\n\nThe grey area: Apple cider vinegar (small amounts), diet sodas, and flavoured water are debated. They technically have near-zero calories but may trigger an insulin response in some people.\n\nFor most fasting goals — weight loss, blood sugar control, mental clarity — the key is keeping insulin low. Stick to zero-calorie drinks and you'll be fine." })}>
                  <Text style={styles.eduBtnText}>Learn more</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.educationCard, { backgroundColor: '#9333EA' }]}>
              <View style={styles.eduContent}>
                <Text style={styles.eduTitle}>Electrolytes during fasting</Text>
                <Text style={styles.eduDesc}>Stay energized and avoid fatigue with proper mineral balance.</Text>
                <TouchableOpacity style={styles.eduBtn} onPress={() => setSelectedArticle({ title: 'Electrolytes during fasting', body: "One of the most overlooked aspects of fasting is electrolyte balance. When you fast, your kidneys excrete more sodium, which causes you to lose potassium and magnesium as well. This is why many people experience headaches, fatigue, and muscle cramps during fasts.\n\nThe three key electrolytes to focus on:\n\n• Sodium — Add a small pinch of pink Himalayan salt or sea salt to your water. This alone solves most fasting headaches.\n\n• Potassium — Found in avocados, leafy greens, and sweet potatoes during your eating window.\n\n• Magnesium — Helps with sleep, muscle cramps, and stress. A magnesium glycinate supplement before bed is a great addition.\n\nYou can buy electrolyte powders with no sugar or calories that are safe to take during a fast. Look for ones without sweeteners if you want to be strict.\n\nProper electrolyte intake can be the difference between a miserable fast and an energised, clear-headed one." })}>
                  <Text style={styles.eduBtnText}>Learn more</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Based on Your Pattern */}
        <View style={[styles.sectionTight, { marginTop: 28 }]}>
          <Text style={styles.sectionTitleTight}>Based on Your Pattern</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patternScrollCompact}>
            {patternCards.map((card, i) => (
              <TouchableOpacity key={i} style={styles.patternCardLarge} onPress={() => setSelectedArticle(card)}>
                <Image source={card.image} style={styles.patternImageArea} resizeMode="cover" />
                <Text style={styles.patternTitleLarge}>{card.title}</Text>
                <Text style={styles.patternTimeLarge}>{card.time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Alert Card */}
        <View style={styles.sectionTight}>
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Text style={{ fontSize: 18 }}>{'\u26A1'}</Text>
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>{alertInsight}</Text>
              <TouchableOpacity style={styles.alertBtn} onPress={() => onShowChat(alertInsight)}>
                <Text style={styles.alertBtnText}>Talk to coach</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* This Week */}
        <View style={styles.sectionTight}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>This Week</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyCard}>
            <View style={styles.historyDots}>
              {weekDays.map((day, i) => (
                <View key={i} style={styles.historyDay}>
                  <View style={[
                    styles.historyDot,
                    {
                      backgroundColor: fastHistory[i] === null ? colors.cardAlt : fastHistory[i] ? '#059669' : 'transparent',
                      borderWidth: fastHistory[i] === false ? 2 : 0,
                      borderColor: fastHistory[i] === false ? colors.border : 'transparent',
                    }
                  ]}>
                    {fastHistory[i] && fastHistory[i] !== null && <Text style={styles.dotCheck}>{'\u2713'}</Text>}
                  </View>
                  <Text style={[styles.dayLabel, { color: i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) ? '#059669' : colors.textMuted }]}>{day}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Your Stats */}
        <View style={styles.sectionTight}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>Your Stats</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekSessions = sessions.filter(s => s.startTime >= weekAgo.getTime());
            const hasData = weekSessions.length > 0;

            const avgHours = hasData
              ? Math.round(weekSessions.reduce((sum, s) => sum + s.durationHours + s.durationMinutes / 60, 0) / weekSessions.length)
              : 0;

            // Streak — start from yesterday if no fast today yet
            let streak = 0;
            const todayStr = now.toDateString();
            const hasFastToday = sessions.some(s => new Date(s.startTime).toDateString() === todayStr);
            const startOffset = hasFastToday ? 0 : 1;
            for (let i = startOffset; i < 365; i++) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              const dayStr = d.toDateString();
              const hasFast = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
              if (hasFast) streak++;
              else break;
            }

            return (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{hasData ? `${avgHours}h` : '--'}</Text>
                  <Text style={styles.statLabel}>Avg fast length</Text>
                  {hasData && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>{avgHours >= 16 ? 'Great' : avgHours >= 12 ? 'Good' : 'Building'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{hasData ? weekSessions.length : '--'}</Text>
                  <Text style={styles.statLabel}>Weekly fasts</Text>
                  {hasData && (
                    <View style={[styles.statBadge, { backgroundColor: weekSessions.length >= 5 ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.statBadgeText, { color: weekSessions.length >= 5 ? '#2E7D32' : '#E65100' }]}>{weekSessions.length >= 5 ? 'Great' : 'Normal'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{streak > 0 ? streak : '--'}</Text>
                  <Text style={styles.statLabel}>Day streak</Text>
                  {streak > 0 && (
                    <View style={[styles.statBadge, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.statBadgeText, { color: '#2E7D32' }]}>{'\u{1F525}'}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Calories & Hydration */}
        <View style={styles.sectionTight}>
          <View style={styles.wellnessCard}>
            <View style={styles.wellnessItem}>
              <Text style={styles.wellnessIcon}>{'\u{1F372}'}</Text>
              <View style={styles.wellnessInfo}>
                <Text style={styles.wellnessLabel}>Today's Calories</Text>
                <Text style={styles.wellnessValue}>{todayCalories > 0 ? `${todayCalories.toLocaleString()} cal` : '--'}</Text>
              </View>
            </View>
            <View style={styles.wellnessDivider} />
            <View style={styles.wellnessItem}>
              <Text style={styles.wellnessIcon}>{'\u{1F4A7}'}</Text>
              <View style={styles.wellnessInfo}>
                <Text style={styles.wellnessLabel}>Hydration</Text>
                <Text style={styles.wellnessValue}>{(() => {
                  const logs = waterLogs || [];
                  const today = new Date().toDateString();
                  const todayLogs = logs.filter(l => l.date === today);
                  if (todayLogs.length === 0) return '--';
                  const totalML = todayLogs.reduce((sum, l) => {
                    const ml = l.unit === 'mL' ? l.amount : l.unit === 'oz' ? l.amount * 29.574 : l.unit === 'sachet' ? l.amount * 500 : l.unit === 'bottle' ? l.amount * 750 : l.amount * 237;
                    return sum + ml;
                  }, 0);
                  return `${(totalML / 1000).toFixed(1)} L`;
                })()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Premium Upsell */}
        <View style={styles.sectionTight}>
          <View style={styles.premiumCard}>
            <View style={styles.premiumContent}>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>{'\u2728'} PREMIUM</Text>
              </View>
              <Text style={styles.premiumTitle}>Unlock personalized fasting insights</Text>
              <View style={styles.premiumList}>
                <Text style={styles.premiumItem}>{'\u2022'} AI-powered recommendations</Text>
                <Text style={styles.premiumItem}>{'\u2022'} Advanced analytics</Text>
                <Text style={styles.premiumItem}>{'\u2022'} Custom fasting plans</Text>
              </View>
              <TouchableOpacity style={styles.premiumBtn}>
                <Text style={styles.premiumBtnText}>Start free trial</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Article Modal */}
      <Modal
        visible={selectedArticle !== null}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setSelectedArticle(null)}
      >
        <View style={[styles.articleModal, Platform.OS !== 'ios' && { paddingTop: 44 }]}>
          <View style={styles.articleHeader}>
            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.articleCloseBtn}>
              <Text style={styles.articleCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.articleHeaderTitle}>Insights</Text>
            <View style={{ width: 40 }} />
          </View>
          {selectedArticle && (
            <ScrollView style={styles.articleScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.articleTitle}>{selectedArticle.title}</Text>
              {selectedArticle.image && (
                <Image source={selectedArticle.image} style={styles.articleImage} resizeMode="cover" />
              )}
              <Text style={styles.articleBody}>{selectedArticle.body}</Text>
              <View style={{ height: 60 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: c.appBg,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.08)',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0 } : {}),
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarTextSmall: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateTextSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
  },
  calendarBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  heroCardCompact: {
    marginTop: 28,
    marginHorizontal: 20,
    padding: 16,
    paddingBottom: 14,
    backgroundColor: c.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  fastTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    gap: 4,
  },
  fastTypeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  fastTypeBadgeArrow: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '700',
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  progressRingSmall: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingPlaceholder: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 2,
  },
  progressRingFill: {
    height: 4,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  progressInnerSmall: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastingLabelSmall: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#059669',
    marginBottom: 2,
  },
  timeDisplayCompact: {
    fontSize: 32,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -1,
    textAlign: 'center',
  },
  stageTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginTop: 6,
  },
  refiningIconSmall: {
    fontSize: 24,
    marginBottom: 4,
  },
  refiningTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  checkInBtnIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    marginTop: 8,
    marginBottom: 8,
  },
  checkInIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  checkInText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  fastingControlsContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    gap: 14,
    marginTop: 4,
    paddingHorizontal: 0,
  },
  fastActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
  },
  fastActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  fastTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '78%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderWidth: 0,
    marginLeft: -8,
  },
  fastTimeBlock: {
    width: '50%',
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'center',
    minHeight: 70,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  fastTimeLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: c.textMuted,
    marginBottom: 4,
  },
  fastTimeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  fastTimeDate: {
    fontSize: 9,
    color: c.textMuted,
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 12,
  },
  fastTimeDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(5, 150, 105, 0.10)',
    marginHorizontal: 0,
  },
  fastTimeDash: {
    color: '#ccc',
  },
  fastTimeEditBadge: {
    position: 'absolute',
    top: 2,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastTimeEditIcon: {
    fontSize: 8,
    color: '#059669',
  },
  sectionTight: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  sectionTitleTight: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sectionTitleTightInline: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
  },
  insightsScrollCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  insightCardCompact: {
    width: 130,
    height: 80,
    padding: 16,
    borderRadius: 14,
    marginRight: 10,
    overflow: 'hidden',
  },
  insightAccentSmall: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  insightTitleSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: c.text,
    marginLeft: 10,
    marginBottom: 2,
    lineHeight: 14,
  },
  insightSubSmall: {
    fontSize: 10,
    color: c.textSecondary,
    marginLeft: 10,
    lineHeight: 12,
  },
  eduScrollCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  educationCard: {
    width: 280,
    height: 220,
    backgroundColor: '#1D4ED8',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    marginRight: 12,
  },
  eduContent: {
    zIndex: 1,
    flex: 1,
    justifyContent: 'space-between',
  },
  eduTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  eduDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 21,
    marginBottom: 16,
  },
  eduBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  eduBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  patternScrollCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  patternCardLarge: {
    width: 180,
    marginRight: 12,
    marginRight: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  patternImageArea: {
    width: 180,
    height: 140,
    borderRadius: 16,
    marginBottom: 10,
  },
  patternTitleLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  patternTimeLarge: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '400',
  },
  alertCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FB923C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
    marginBottom: 8,
  },
  alertBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FB923C',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  alertBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seeAllBtn: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  historyDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  historyDot: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    color: c.textSecondary,
    textAlign: 'center',
  },
  statBadge: {
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
  },
  statBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  wellnessCard: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  wellnessItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wellnessIcon: {
    fontSize: 28,
  },
  wellnessInfo: {
    flexDirection: 'column',
    gap: 2,
  },
  wellnessLabel: {
    fontSize: 12,
    color: c.textSecondary,
  },
  wellnessValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  wellnessActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  wellnessActionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#059669',
    borderRadius: 10,
    alignItems: 'center',
  },
  wellnessActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  wellnessActionLink: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 10,
    alignItems: 'center',
  },
  wellnessActionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  wellnessDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 20,
  },
  premiumCard: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  premiumContent: {
    zIndex: 1,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    marginBottom: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  premiumList: {
    marginBottom: 14,
  },
  premiumItem: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  premiumBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: c.card,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  premiumBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  bottomSpacer: {
    height: 90,
  },
  articleModal: {
    flex: 1,
    backgroundColor: c.card,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  articleCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleCloseText: {
    fontSize: 20,
    color: c.text,
    fontWeight: '300',
  },
  articleHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  articleScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  articleTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    lineHeight: 34,
    marginTop: 20,
    marginBottom: 16,
  },
  articleImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
  },
  articleBody: {
    fontSize: 16,
    lineHeight: 26,
    color: c.text,
    letterSpacing: 0.2,
  },
});

export default TodayTab;
