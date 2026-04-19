const CARD_COLORS = [
  { color: '#E8F5E9', accent: '#4CAF50' },
  { color: '#FFF3E0', accent: '#FF9800' },
  { color: '#E3F2FD', accent: '#2196F3' },
  { color: '#FCE4EC', accent: '#E91E63' },
  { color: '#EDE7F6', accent: '#7C3AED' },
  { color: '#E0F7FA', accent: '#0097A7' },
];

const GOAL_LABELS = {
  lose: 'Lose weight',
  gain: 'Gain weight',
  maintain: 'Maintain weight',
  gutHealth: 'Improve gut health',
  moreEnergy: 'More energy',
  mentalClarity: 'Mental clarity',
  liveLonger: 'Live longer',
};

const ANALYST_PROMPT = `You are a rigorous health data analyst. When given user health data (fasting logs, meal logs, weight logs, water intake, mood/check-ins), do NOT produce surface-level observations. Instead:

1. FIND THE REAL STORY
   - What is the data actually saying beneath the obvious trend?
   - What is improving on paper but quietly degrading underneath?
   - What correlations exist across multiple data types that wouldn't be visible looking at any one metric alone?

2. DIAGNOSE ROOT CAUSES, NOT SYMPTOMS
   - Don't say "calories are increasing." Say WHY — what pattern in the surrounding data (mood, hydration, day of week, stress markers) explains it?
   - Is the trigger physiological, environmental, or emotional?

3. CHALLENGE THE OBVIOUS INTERPRETATION
   - If results look good, ask: is this momentum from past behavior or current behavior?
   - If the person seems to be struggling, ask: is it the plan failing or the environment failing the plan?

4. QUANTIFY THE STAKES
   - Translate patterns into concrete projections. What happens if this trend continues vs. reverses?
   - Name the exact gap between current trajectory and goal.

5. SPECIFICITY OVER GENERALITY
   - Name exact dates, exact meals, exact numbers.
   - Never say "some days." Say specific dates with specific context.
   - Never say "eat healthier." Say which specific food swaps, why they matter, and what the data shows about when the drift started.

6. MOOD AND BEHAVIOR AS DATA
   - Treat check-in moods and notes as leading indicators, not commentary. They predict the day's outcomes — analyze them that way.

Format: Lead with the most non-obvious insight first. Save the predictable observations for last or skip them entirely.`;

const CARD_GENERATOR_PROMPT = `You are a close friend who has quietly been watching this person's health journey. You have just read a detailed analysis of everything they have logged. Now you are writing them a note — warm, direct, honest, and personal.

Each card has three parts:

1. FEELING — one short, bold sentence. A statement, never a question. This is the thing they are probably experiencing right now that they haven't said out loud yet. Write it the way a friend would say it, not a coach. Warm and direct. No question marks. No hedging words like "maybe" or "perhaps" or "might be". Just say it. Examples of the right tone: "You're running on empty right now." / "Something quietly stopped working these past two weeks." / "You're trying so hard and the scale isn't moving — that's exhausting."

2. WHY — this is where you show them the proof. Not a lecture. But they need to see the evidence so they know you're not making this up. Name specific dates, specific meals, specific numbers from the analysis. Weave it into natural sentences — not bullet points, not a list. It should feel like: "I noticed that from [date] to [date], your water dropped from X to Y — and on the exact same days, your hunger spiked." Make them feel seen. Make them go "how did it know that?"

3. ACTION — one small, specific thing they can do right now or in the next hour. Not a plan. Not a lecture. One thing. Make it feel easy and doable, not like homework.

Before writing any card, silently work through:
- Yesterday: what happened that is directly affecting how they feel today?
- Last 7 days: what pattern is quietly building that they haven't noticed?
- Last 4 weeks: is the momentum going toward their goal or away from it?
- Full history: have they been here before and recovered? Say so — it's the most powerful thing you can tell someone who feels stuck.

Rules:
- You are a warm, honest friend — not a coach, not a report, not a robot
- Never say "based on your data" or "your logs show" — you just know them
- Never make them feel judged or like they failed — frame everything as "here's what's happening" not "here's what you did wrong"
- The feeling line has NO question marks and NO hedging — it is a statement
- The why section MUST include specific evidence: exact dates, exact numbers, exact meal names where relevant — this is what makes the insight feel real, not generic
- If they recovered from a similar pattern before, mention it — give them that anchor
- Vary the emotional tone across cards — one card can be matter-of-fact, another soft, another a little playful
- Format the "why" and "action" fields for readability: use \n\n to separate distinct thoughts into paragraphs. Use **bold** to highlight key numbers, dates, or the single most important phrase in a sentence. Keep it natural — do not over-bold. Think of it like how a thoughtful person would write a personal note, not a report.
- Generate 3-4 insight cards based on real observations, then always add one final GOAL TRAJECTORY card as the last card
- Never give more than one thing to do per card

The FINAL card must always be a goal trajectory card. Same 3-beat structure, but focused entirely on where they are headed toward their goal:
- feeling: a direct, honest one-liner about their current trajectory. Is it on track, slipping, or ahead of schedule? Make it feel personal and real. E.g. "You're about 20 weeks from your goal — but the last two weeks are quietly stretching that."
- why: use the actual weight data. Name specific dates, specific weights. Compute the weekly rate of change. Compare their peak rate vs their current rate. Tell them what the difference means in concrete weeks to goal. This is the one card where numbers are the point — show the proof.
- action: one specific behaviour change that the data shows would most directly accelerate or protect their progress. Tie it directly to what the data reveals — not generic advice.

If they have no weight logs or no target weight set, skip this card entirely and just generate 3-4 regular cards.

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "feeling": "...", "why": "...", "action": "..." },
  ...
]`;

function preprocessData(data) {
  const { profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs } = data;
  const now = new Date();

  const daysBetween = (d1, d2) => Math.floor(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));

  // Today's date string — used to exclude incomplete today data
  const todayStr = now.toDateString();

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    return d.toDateString() === todayStr;
  };

  const getWeekIndex = (dateStr) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    if (isNaN(d)) return -1;
    const idx = Math.floor(daysBetween(now, d) / 7);
    // Week 0 would include today — shift so week 0 = yesterday's week
    return idx;
  };

  // Infer goal label
  const goalLabel = GOAL_LABELS[profile.goal] ||
    (profile.startingWeight && profile.targetWeight
      ? profile.startingWeight > profile.targetWeight ? 'Lose weight'
        : profile.startingWeight < profile.targetWeight ? 'Gain weight'
        : 'Maintain weight'
      : 'Not specified');

  const lines = [];

  // Profile
  lines.push(`NAME: ${profile.userName || 'User'} | COUNTRY: ${profile.userCountry || 'Not specified'}`);
  lines.push(`GOAL: ${goalLabel}`);
  lines.push(`PLAN: ${profile.selectedPlan || '16:8'} fasting`);
  lines.push(`DAILY CALORIE GOAL: ${profile.dailyCalorieGoal || 2000} kcal | PROTEIN: ${profile.proteinGoal || '?'}g | CARBS: ${profile.carbsGoal || '?'}g | FATS: ${profile.fatsGoal || '?'}g`);
  lines.push(`WATER GOAL: ${profile.hydrationGoal || 8} ${profile.volumeUnit || 'glasses'}/day`);
  if (profile.startingWeight) {
    lines.push(`STARTING WEIGHT: ${profile.startingWeight} ${profile.weightUnit || 'kg'} → TARGET: ${profile.targetWeight || '?'} ${profile.weightUnit || 'kg'}`);
  }
  lines.push('');

  // Exclude today's incomplete data from all sources
  const completedFastingSessions = (fastingSessions || []).filter(s => !isToday(s.date || s.startTime));
  const completedMeals = (recentMeals || []).filter(m => !isToday(m.date));
  const completedWaterLogs = (waterLogs || []).filter(w => !isToday(w.date));
  const completedCheckIns = (checkInHistory || []).filter(c => !isToday(c.date));
  // Weight logs are point-in-time snapshots — include today's if logged
  const allWeightLogs = weightLogs || [];

  // Fasting by week
  const fastingByWeek = {};
  completedFastingSessions.forEach(s => {
    const w = getWeekIndex(s.date || s.startTime);
    if (w < 0 || w > 11) return;
    if (!fastingByWeek[w]) fastingByWeek[w] = [];
    fastingByWeek[w].push(s);
  });

  const maxFastWeek = Object.keys(fastingByWeek).length ? Math.max(...Object.keys(fastingByWeek).map(Number)) : -1;
  if (maxFastWeek >= 0) {
    lines.push('FASTING SESSIONS BY WEEK (week 0 = this week, 1 = last week, etc.):');
    for (let w = 0; w <= Math.min(maxFastWeek, 11); w++) {
      const sessions = fastingByWeek[w] || [];
      const completed = sessions.filter(s => s.durationHours >= 0 || s.endTime);
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (completed.length > 0) {
        const targetH = parseInt((profile.selectedPlan || '16:8').split(':')[0]) || 16;
        const cutShort = completed.filter(s => s.durationHours < targetH).length;
        const avgDur = (completed.reduce((sum, s) => sum + (s.durationHours || 0) + (s.durationMinutes || 0) / 60, 0) / completed.length).toFixed(1);
        lines.push(`  ${label}: ${completed.length} fasts | avg ${avgDur}h${cutShort > 0 ? ` | ${cutShort} ended early` : ''}`);
      } else {
        lines.push(`  ${label}: 0 fasts`);
      }
    }
    lines.push('');
  }

  // Meals by week
  const mealsByWeek = {};
  completedMeals.forEach(m => {
    const w = getWeekIndex(m.date);
    if (w < 0 || w > 11) return;
    if (!mealsByWeek[w]) mealsByWeek[w] = [];
    mealsByWeek[w].push(m);
  });

  const maxMealWeek = Object.keys(mealsByWeek).length ? Math.max(...Object.keys(mealsByWeek).map(Number)) : -1;
  if (maxMealWeek >= 0) {
    lines.push('MEAL LOGS BY WEEK:');
    for (let w = 0; w <= Math.min(maxMealWeek, 11); w++) {
      const meals = mealsByWeek[w] || [];
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (meals.length > 0) {
        // Group by day to get daily totals, then average across days
        const byDay = {};
        meals.forEach(m => {
          if (!byDay[m.date]) byDay[m.date] = { cal: 0, prot: 0, carb: 0 };
          byDay[m.date].cal += (m.calories || 0);
          byDay[m.date].prot += (m.protein || 0);
          byDay[m.date].carb += (m.carbs || 0);
        });
        const days = Object.values(byDay);
        const avgDailyCal = Math.round(days.reduce((s, d) => s + d.cal, 0) / days.length);
        const avgDailyProt = Math.round(days.reduce((s, d) => s + d.prot, 0) / days.length);
        const avgDailyCarb = Math.round(days.reduce((s, d) => s + d.carb, 0) / days.length);
        const mealList = meals.map(m => `${m.name}(${m.calories}cal,${m.protein || 0}g prot)`).join('; ');
        lines.push(`  ${label}: ${meals.length} meals across ${days.length} days | avg daily intake: ${avgDailyCal} kcal | avg ${avgDailyProt}g protein | avg ${avgDailyCarb}g carbs`);
        lines.push(`    Meals: ${mealList}`);
      } else {
        lines.push(`  ${label}: no meals logged`);
      }
    }
    lines.push('');
  }

  // Water by week
  const waterByWeek = {};
  completedWaterLogs.forEach(wl => {
    const w = getWeekIndex(wl.date);
    if (w < 0 || w > 11) return;
    if (!waterByWeek[w]) waterByWeek[w] = {};
    if (!waterByWeek[w][wl.date]) waterByWeek[w][wl.date] = 0;
    waterByWeek[w][wl.date] += (wl.amount || 1);
  });

  const maxWaterWeek = Object.keys(waterByWeek).length ? Math.max(...Object.keys(waterByWeek).map(Number)) : -1;
  if (maxWaterWeek >= 0) {
    const waterGoal = profile.hydrationGoal || 8;
    const unit = profile.volumeUnit || 'glasses';
    lines.push(`WATER INTAKE BY WEEK (goal: ${waterGoal} ${unit}/day):`);
    for (let w = 0; w <= Math.min(maxWaterWeek, 11); w++) {
      const byDay = waterByWeek[w];
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (byDay) {
        const days = Object.keys(byDay);
        const avgDaily = (days.reduce((s, d) => s + byDay[d], 0) / days.length).toFixed(1);
        const status = avgDaily >= waterGoal ? '✓ on track' : avgDaily >= waterGoal * 0.75 ? '~ close' : '↓ below goal';
        lines.push(`  ${label}: avg ${avgDaily} ${unit}/day (${status})`);
      } else {
        lines.push(`  ${label}: no water logged`);
      }
    }
    lines.push('');
  }

  // Weight progress
  const sortedWeights = [...allWeightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedWeights.length > 0) {
    lines.push('WEIGHT PROGRESS:');
    sortedWeights.forEach(wl => lines.push(`  ${wl.date}: ${wl.weight} ${wl.unit}`));
    if (sortedWeights.length >= 2) {
      const first = sortedWeights[0];
      const last = sortedWeights[sortedWeights.length - 1];
      const change = (last.weight - first.weight).toFixed(1);
      const diffDays = daysBetween(new Date(first.date), new Date(last.date)) || 1;
      const ratePerWeek = (Math.abs(parseFloat(change)) / (diffDays / 7)).toFixed(2);
      lines.push(`  Net change: ${parseFloat(change) > 0 ? '+' : ''}${change} ${last.unit} over ${diffDays} days (~${ratePerWeek} ${last.unit}/week)`);
      if (profile.targetWeight && ratePerWeek > 0) {
        const remaining = Math.abs(last.weight - profile.targetWeight).toFixed(1);
        if (remaining > 0.5) {
          const weeksToGoal = Math.ceil(remaining / ratePerWeek);
          lines.push(`  Remaining to target: ${remaining} ${last.unit} (~${weeksToGoal} weeks at current rate)`);
        }
      }
    }
    lines.push('');
  }

  // Check-ins (most recent 30, today excluded)
  const sortedCheckIns = [...completedCheckIns]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);
  if (sortedCheckIns.length > 0) {
    lines.push('CHECK-IN HISTORY (most recent first):');
    sortedCheckIns.forEach(c => {
      const parts = [`[${c.date}]`];
      if (c.fastingStatus) parts.push(`fast:${c.fastingStatus}`);
      if (c.hungerLevel != null) parts.push(`hunger:${c.hungerLevel}/10`);
      if (c.feelings?.length) parts.push(`feelings:${c.feelings.join(',')}`);
      if (c.moods?.length) parts.push(`mood:${c.moods.join(',')}`);
      if (c.symptoms?.length) parts.push(`symptoms:${c.symptoms.join(',')}`);
      if (c.activities?.length) parts.push(`activities:${c.activities.join(',')}`);
      if (c.notes) parts.push(`note:"${c.notes}"`);
      lines.push(`  ${parts.join(' | ')}`);
    });
  }

  return lines.join('\n');
}

async function callClaude(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Claude API error');
  return result.content?.[0]?.text || '';
}

function buildJustForYouPrompt(data) {
  const { profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs } = data;

  const recentSessions = (fastingSessions || []).slice(0, 14);
  const recentWeight = (weightLogs || []).slice(0, 10);
  const recentCheckIns = (checkInHistory || []).slice(0, 10);
  const recentMealsSlice = (recentMeals || []).slice(0, 20);
  const recentWater = (waterLogs || []).slice(0, 14);

  return `You are a warm, supportive personal health coach inside Afri Fast, an African fasting and nutrition app.

USER PROFILE:
- Name: ${profile.userName || 'User'}
- Country: ${profile.userCountry || 'Not specified'}
- Fasting plan: ${profile.selectedPlan || '16:8'}
- Goal: ${profile.goal || 'Not specified'}
- Health conditions: ${(profile.conditions || []).join(', ') || 'None'}
- Starting weight: ${profile.startingWeight || 'Not set'} ${profile.weightUnit || 'kg'}
- Target weight: ${profile.targetWeight || 'Not set'} ${profile.weightUnit || 'kg'}
- Daily calorie goal: ${profile.dailyCalorieGoal || 2000} kcal
- Protein goal: ${profile.proteinGoal || 'Not set'}g | Carbs: ${profile.carbsGoal || 'Not set'}g | Fats: ${profile.fatsGoal || 'Not set'}g
- Hydration goal: ${profile.hydrationGoal || 6} ${profile.volumeUnit || 'sachets'}/day

USER DATA:
- Fasting sessions: ${JSON.stringify(recentSessions)}
- Weight logs: ${JSON.stringify(recentWeight)}
- Check-ins: ${JSON.stringify(recentCheckIns)}
- Recent meals: ${JSON.stringify(recentMealsSlice)}
- Water logs: ${JSON.stringify(recentWater)}

Look at this person's goals vs their actual progress across all areas — fasting consistency, weight progress, nutrition, hydration, energy, mood. Generate actionable insight cards — things they can specifically learn from or act on.

Rules:
- Each card must tie directly to a real pattern or gap you see between their goals and their data
- Be encouraging, never judgmental
- The "desc" is a short teaser shown on the card (1-2 sentences)
- The "body" is the full insight shown when they tap "Learn more" (3-5 sentences, specific and actionable)
- Generate between 2 and 5 cards — only where there are genuine goal-vs-progress observations

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "title": "...", "desc": "...", "body": "..." },
  ...
]`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_KEY = process.env.CLAUDE_KEY;
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });

  try {
    if (type === 'daily_insights') {
      // Stage 1: Analyst — find the real patterns
      const processedData = preprocessData(data);
      const analystPrompt = `${ANALYST_PROMPT}\n\nHEALTH DATA FOR ANALYSIS:\n\n${processedData}`;
      const analysis = await callClaude(analystPrompt, CLAUDE_KEY);

      // Stage 2: Card generator — turn analysis into human insight cards
      const cardPrompt = `${CARD_GENERATOR_PROMPT}\n\nHEALTH ANALYSIS:\n${analysis}\n\nUser's name: ${data.profile?.userName || 'them'}`;
      const cardText = await callClaude(cardPrompt, CLAUDE_KEY);

      const stripped = cardText.replace(/```json|```/g, '').trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[/api/ai daily_insights] No JSON array in card response:', cardText.slice(0, 300));
        return res.status(500).json({ error: 'Could not parse insight cards' });
      }

      const rawCards = JSON.parse(jsonMatch[0]);
      const cards = rawCards.map((card, i) => ({
        ...card,
        ...CARD_COLORS[i % CARD_COLORS.length],
      }));

      return res.status(200).json({ cards, alertCard: '' });
    }

    if (type === 'just_for_you') {
      const prompt = buildJustForYouPrompt(data);
      const text = await callClaude(prompt, CLAUDE_KEY);
      const stripped = text.replace(/```json|```/g, '').trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[/api/ai just_for_you] No JSON array in response:', text.slice(0, 300));
        return res.status(500).json({ error: 'Could not parse response' });
      }
      const cards = JSON.parse(jsonMatch[0]);
      return res.status(200).json({ cards });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (e) {
    console.error('[/api/ai exception]', e);
    return res.status(500).json({ error: e.message });
  }
}
