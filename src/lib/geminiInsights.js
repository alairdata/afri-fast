import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
console.log('[Gemini] Key loaded?', GEMINI_API_KEY ? `yes (${GEMINI_API_KEY.length} chars)` : 'NO — undefined');
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const geminiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const CACHE_KEY = 'gemini_insight_cache_v7';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getDayName(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  } catch (_) { return null; }
}

function aggregateData({ profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs }) {
  // === Profile ===
  const profileSummary = {
    name: profile.userName || 'User',
    country: profile.userCountry || null,
    plan: profile.selectedPlan || '16:8',
    targetWeight: profile.targetWeight || null,
    startingWeight: profile.startingWeight || null,
    dailyCalorieGoal: profile.dailyCalorieGoal || 2000,
    hydrationGoal: profile.hydrationGoal || 6,
    proteinGoal: profile.proteinGoal || null,
    carbsGoal: profile.carbsGoal || null,
    fatsGoal: profile.fatsGoal || null,
    volumeUnit: profile.volumeUnit || 'sachet',
  };

  // === Fasting Sessions ===
  const sessions = fastingSessions || [];
  const planTargetHours = parseFloat((profileSummary.plan || '16:8').split(':')[0]) || 16;

  // A session is "goal-complete" only if it reached the plan's target hours
  const goalCompletedFasts = sessions.filter(s => {
    const hours = (s.durationHours || 0) + (s.durationMinutes || 0) / 60;
    return s.endTime && hours >= planTargetHours * 0.9; // 90% of target counts
  });
  const endedEarlyFasts = sessions.filter(s => {
    const hours = (s.durationHours || 0) + (s.durationMinutes || 0) / 60;
    return s.endTime && hours < planTargetHours * 0.9;
  });

  const completedFasts = goalCompletedFasts; // for backwards compat below
  const durations = sessions
    .filter(s => s.endTime)
    .map(s => (s.durationHours || 0) + (s.durationMinutes || 0) / 60)
    .filter(d => d > 0);
  const avgDuration = durations.length
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
    : 0;
  const longestFast = durations.length ? Math.max(...durations).toFixed(1) : 0;

  const dayCount = {};
  sessions.forEach(s => {
    const day = getDayName(s.startTime || s.date);
    if (day) dayCount[day] = (dayCount[day] || 0) + 1;
  });
  const topFastingDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  // Recent trend: last 14 days vs prior 14
  const now = Date.now();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const recentFasts = sessions.filter(s => {
    const t = new Date(s.startTime || s.date).getTime();
    return t > now - twoWeeksMs;
  }).length;
  const priorFasts = sessions.filter(s => {
    const t = new Date(s.startTime || s.date).getTime();
    return t > now - 2 * twoWeeksMs && t <= now - twoWeeksMs;
  }).length;

  const fastingSummary = {
    totalSessionsLogged: sessions.length,
    goalCompletedFasts: goalCompletedFasts.length,
    endedEarlyFasts: endedEarlyFasts.length,
    goalCompletionRate: sessions.length
      ? Math.round((goalCompletedFasts.length / sessions.length) * 100)
      : 0,
    planTargetHours,
    averageDurationHours: parseFloat(avgDuration),
    longestFastHours: parseFloat(longestFast),
    topFastingDays,
    fastsLast14Days: recentFasts,
    fastsPrior14Days: priorFasts,
    trend: recentFasts > priorFasts ? 'improving' : recentFasts < priorFasts ? 'declining' : 'stable',
    note: sessions.length === 0 ? 'User has not logged any fasting sessions yet.' : null,
  };

  // === Check-ins ===
  const checkIns = checkInHistory || [];
  const twoWeeksAgoStr = new Date(now - twoWeeksMs).toISOString().split('T')[0];
  const recentCheckInCount = checkIns.filter(c => c.date >= twoWeeksAgoStr).length;
  const olderCheckInCount = checkIns.filter(c => c.date < twoWeeksAgoStr).length;

  const moodCount = {};
  checkIns.forEach(c => {
    const moods = Array.isArray(c.moods) ? c.moods : c.moods ? [c.moods] : [];
    moods.forEach(m => { moodCount[m] = (moodCount[m] || 0) + 1; });
  });
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);

  const hungerValues = checkIns.map(c => c.hungerLevel).filter(h => h != null && h > 0);
  const avgHunger = hungerValues.length
    ? (hungerValues.reduce((a, b) => a + b, 0) / hungerValues.length).toFixed(1)
    : null;

  const checkInSummary = {
    totalCheckIns: checkIns.length,
    checkInRate: sessions.length
      ? Math.round((checkIns.length / sessions.length) * 100)
      : 0,
    checkInsLast14Days: recentCheckInCount,
    checkInsPrior14Days: olderCheckInCount,
    checkInTrend: recentCheckInCount < olderCheckInCount * 0.5 ? 'declining' : 'stable',
    topMoods,
    averageHungerLevel: avgHunger ? parseFloat(avgHunger) : null,
  };

  // === Meals ===
  const meals = recentMeals || [];
  const mealsByDate = {};
  meals.forEach(m => {
    const date = m.date || (m.loggedAt || '').split('T')[0];
    if (!date) return;
    if (!mealsByDate[date]) mealsByDate[date] = [];
    mealsByDate[date].push(m);
  });
  const dailyCalories = Object.values(mealsByDate).map(ms =>
    ms.reduce((a, m) => a + (m.calories || 0), 0)
  );
  const avgDailyCalories = dailyCalories.length
    ? Math.round(dailyCalories.reduce((a, b) => a + b, 0) / dailyCalories.length)
    : 0;

  const foodCount = {};
  meals.forEach(m => {
    const name = m.detectedName || m.name;
    if (name) foodCount[name] = (foodCount[name] || 0) + 1;
  });
  const topFoods = Object.entries(foodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f]) => f);

  const mealSummary = {
    totalMealsLogged: meals.length,
    averageDailyCalories: avgDailyCalories,
    calorieGoal: profileSummary.dailyCalorieGoal,
    calorieGap: avgDailyCalories > 0
      ? avgDailyCalories - profileSummary.dailyCalorieGoal
      : null,
    topFoods,
    loggedDaysCount: Object.keys(mealsByDate).length,
  };

  // === Weight ===
  const weights = [...(weightLogs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentWeight = weights.length ? weights[weights.length - 1].weight : null;
  const weightUnit = weights.length ? weights[weights.length - 1].unit : 'kg';
  const weightLost = currentWeight && profileSummary.startingWeight
    ? parseFloat((profileSummary.startingWeight - currentWeight).toFixed(1))
    : null;
  const weightToGoal = currentWeight && profileSummary.targetWeight
    ? parseFloat((currentWeight - profileSummary.targetWeight).toFixed(1))
    : null;

  const weightSummary = {
    startingWeight: profileSummary.startingWeight,
    currentWeight,
    targetWeight: profileSummary.targetWeight,
    unit: weightUnit,
    weightLost,
    weightToGoal,
    totalWeighIns: weights.length,
  };

  // === Hydration ===
  const waterByDate = {};
  (waterLogs || []).forEach(w => {
    if (!w.date) return;
    waterByDate[w.date] = (waterByDate[w.date] || 0) + (w.amount || 1);
  });
  const dailyWaterAmounts = Object.values(waterByDate);
  const avgDailyWater = dailyWaterAmounts.length
    ? parseFloat((dailyWaterAmounts.reduce((a, b) => a + b, 0) / dailyWaterAmounts.length).toFixed(1))
    : 0;

  const hydrationSummary = {
    averageDailyWater: avgDailyWater,
    waterGoal: profileSummary.hydrationGoal,
    unit: profileSummary.volumeUnit,
    hittingWaterGoal: avgDailyWater >= profileSummary.hydrationGoal,
    waterGap: parseFloat((profileSummary.hydrationGoal - avgDailyWater).toFixed(1)),
  };

  return {
    profile: profileSummary,
    fasting: fastingSummary,
    checkIns: checkInSummary,
    meals: mealSummary,
    weight: weightSummary,
    hydration: hydrationSummary,
  };
}

export async function getGeminiInsight(data, forceRefresh = false) {
  const userId = data?.profile?.userId;

  // Check cache
  if (!forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const isRecent = Date.now() - parsed.timestamp < CACHE_TTL;
        const isSameUser = parsed.userId === userId;
        if (isRecent && isSameUser && parsed.insight) return parsed.insight;
      }
    } catch (_) {}
  }

  const context = aggregateData(data);

  // Include raw logs alongside summaries so Gemini has exact facts
  const rawLogs = {
    fastingSessions: (data.fastingSessions || []).map(s => ({
      date: s.date,
      durationHours: s.durationHours,
      durationMinutes: s.durationMinutes,
      completed: !!s.endTime,
    })),
    checkIns: (data.checkInHistory || []).map(c => ({
      date: c.date,
      feelings: c.feelings,
      moods: c.moods,
      hungerLevel: c.hungerLevel,
      fastingStatus: c.fastingStatus,
    })),
    meals: (data.recentMeals || []).map(m => ({
      date: m.date,
      name: m.detectedName || m.name,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fats: m.fats,
    })),
    weightLogs: (data.weightLogs || []).map(w => ({ date: w.date, weight: w.weight, unit: w.unit })),
    waterLogs: (data.waterLogs || []).map(w => ({ date: w.date, amount: w.amount, unit: w.unit })),
  };

  const prompt = `You are a personal health coach inside Afri Fast, an African fasting and nutrition app. Below is the user's complete real data — both a summary and the actual raw logs.

Read the raw logs carefully. They are the ground truth. Only make statements about things that are directly visible in the data.

SUMMARY:
${JSON.stringify(context, null, 2)}

RAW LOGS:
${JSON.stringify(rawLogs, null, 2)}

Generate TWO things:

1. CARD — the single most important insight for this user today, based on what you can actually see in their data. Warm, coach-like, no raw numbers.

2. ALERT — 1-2 sentences connecting patterns you can see across their logs (fasting + weight, meals + hydration, etc). Should feel like something their coach noticed, not a generic tip.

Return ONLY valid JSON, no markdown:
{
  "card": {
    "title": "max 7 words",
    "body": "2-3 sentences, coach tone, no raw numbers",
    "cta": "max 4 words"
  },
  "alert": "1-2 sentences, specific to what you see in their data"
}`;

  const callGemini = async () => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    });
    for (const model of GEMINI_MODELS) {
      const response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await response.json();
      if (response.status !== 503) return data;
      console.log('[GeminiInsight] Model overloaded, trying next...');
    }
  };

  try {
    let raw = await callGemini();

    // Retry up to 3 times on 503 overload
    let attempts = 1;
    while (raw?.error?.code === 503 && attempts < 3) {
      console.log(`[GeminiInsight] Model overloaded, retrying (${attempts})...`);
      await new Promise(r => setTimeout(r, 3000 * attempts));
      raw = await callGemini();
      attempts++;
    }

    console.log('[GeminiInsight raw]', JSON.stringify(raw).slice(0, 500));

    if (raw?.error) throw new Error(raw.error.message || 'Gemini API error');

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[GeminiInsight text]', text);

    // Strip markdown fences if present, then extract JSON object
    const stripped = text.replace(/```json|```/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);

    const parsed = JSON.parse(jsonMatch[0]);

    // Support both old shape {title,body,cta} and new shape {card,alert}
    const result = parsed.card
      ? { ...parsed.card, alert: parsed.alert }
      : { ...parsed, alert: null };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      userId,
      insight: result,
    }));

    return result;
  } catch (e) {
    console.error('[GeminiInsight error]', e);
    return null;
  }
}
