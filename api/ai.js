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
- Generate EXACTLY 2 cards total — no more, no less:
  CARD 1: One consolidated summary card. Pull together ALL the main patterns you observed — fasting consistency, nutrition, hydration, mood, engagement gaps — into a single rich card. The "feeling" is the single most important thing happening for this person right now. The "why" covers all the key evidence across every data type in one flowing narrative (use paragraphs with \n\n). The "action" is the single highest-leverage thing to do. Nothing is lost — it is all here, just not split across multiple cards.
  CARD 2: MANDATORY goal trajectory card. Always include this, even if weight data is sparse. If there is genuinely no weight data at all, use the trajectory card to talk about behavioural momentum toward their goal instead.
- Never give more than one thing to do per card
- Each card must include a "cta" field — a 2-word button label the user taps to read the full insight. The two cards must have DIFFERENT ctas. Draw from: "Find out", "Tell me", "See why", "Dig in", "Show me", "Worth knowing", "Unpack it", "Go deeper", "Makes sense", "Interesting", "Say more", "Explain it", "I'm listening", "Good to know", "Walk me through". Never use "Learn more".

The FINAL card must always be a goal trajectory card. Same 3-beat structure, but focused entirely on where they are headed toward their goal:
- feeling: a direct, honest one-liner about their current trajectory. Is it on track, slipping, or ahead of schedule? Make it feel personal and real. ALWAYS calculate the actual weeks from the data — never copy example numbers. E.g. "You're [X] weeks from your goal — but the last two weeks are quietly stretching that." where X is computed from the weight data.
- why: use the actual weight data. The target weight is explicitly labelled "CURRENT TARGET WEIGHT" in the profile — use that exact number, never a different one. Name specific dates, specific weights. Use the pre-computed weekly rate already given in the WEIGHT PROGRESS section (the "~X kg/week" figure) — do NOT recalculate it yourself. Remember: each week bucket in the data = exactly 7 calendar days, so two buckets = 14 days, not 14 weeks. Then show two projections:
  1. **At current pace** — how many weeks (and months in brackets) to reach the target at the current rate
  2. **At an improved pace** — only include this if the current rate is low or unsustainable (e.g. less than 0.3 kg/week for weight loss, or barely moving). Show what a realistic but better rate would look like in weeks (and months in brackets). Make the improved pace feel achievable, not punishing.
  Compare their peak rate vs their current rate and name the exact gap. Beyond weight, you have full discretion to reference any other data that is directly relevant to the trajectory — nutrition patterns, hydration, fasting consistency, mood — if it helps explain why the pace is what it is or what's quietly affecting progress toward the goal. Only include it if it genuinely connects to the trajectory, not just for the sake of it.
- action: one specific behaviour change that the data shows would most directly accelerate or protect their progress. Tie it directly to what the data reveals — not generic advice. Always end the action with this exact sentence: "These projections update daily — they shift as your behaviour changes, for better or for worse."

The goal trajectory card is ALWAYS card 2 — never skip it. If there is no weight data, use behavioural trajectory (fasting consistency, calorie adherence, engagement trend) to project whether they are moving toward or away from their goal.

Each card has an optional fourth field: "takeaway". Use it only when the data supports a specific, concrete forward-looking action worth calling out separately — skip it if there is nothing genuinely useful to add. If you include it:
- Reference a specific date or date range using the "Tomorrow's date" provided (e.g. "By April 25th..." or "April 23rd–April 27th..."). Never say "tomorrow", "next week", "the coming days", or any other relative time phrase.
- Keep it to one concrete action tied directly to what the data shows.

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "feeling": "...", "why": "...", "action": "...", "takeaway": "...", "cta": "..." },
  ...
]`;

function getGoalAtDate(goalHistory, dateStr, profile) {
  if (!goalHistory?.length || !dateStr) return profile;
  const date = new Date(dateStr);
  if (isNaN(date)) return profile;
  // Find the most recent snapshot that was set on or before this date
  const sorted = [...goalHistory].sort((a, b) => new Date(a.from) - new Date(b.from));
  let applicable = null;
  for (const snap of sorted) {
    if (new Date(snap.from) <= date) applicable = snap;
    else break;
  }
  return applicable ? { ...profile, ...applicable } : profile;
}

function preprocessData(data) {
  const { profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs, enrichedMealLogs, goalHistory } = data;
  const now = new Date();

  const daysBetween = (d1, d2) => Math.floor(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));

  const getWeekIndex = (dateStr) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    if (isNaN(d)) return -1;
    return Math.floor(daysBetween(now, d) / 7);
  };

  const fmt12h = (ts) => {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    if (isNaN(d)) return '';
    const h = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
    return `${h % 12 || 12}:${m}${h >= 12 ? 'PM' : 'AM'}`;
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
  const joinDateStr = profile.userJoinDate
    ? (() => {
        const d = new Date(profile.userJoinDate);
        const days = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${days} days ago)`;
      })()
    : 'Unknown';
  lines.push(`NAME: ${profile.userName || 'User'} | COUNTRY: ${profile.userCountry || 'Not specified'}`);
  lines.push(`MEMBER SINCE: ${joinDateStr}`);
  lines.push(`GOAL: ${goalLabel}`);
  lines.push(`PLAN: ${profile.selectedPlan || '16:8'} fasting`);
  lines.push(`DAILY CALORIE GOAL (current): ${profile.dailyCalorieGoal || 2000} kcal | PROTEIN: ${profile.proteinGoal || '?'}g | CARBS: ${profile.carbsGoal || '?'}g | FATS: ${profile.fatsGoal || '?'}g`);
  lines.push(`WATER GOAL: ${profile.hydrationGoal || 8} ${profile.volumeUnit || 'glasses'}/day`);
  if (profile.startingWeight) {
    lines.push(`STARTING WEIGHT: ${profile.startingWeight} ${profile.weightUnit || 'kg'} → CURRENT TARGET WEIGHT (use this exact value, do not change it): ${profile.targetWeight || '?'} ${profile.weightUnit || 'kg'}`);
  }

  // Goal history — shows what the targets were at different points in time
  const sortedGoalHistory = [...(goalHistory || [])].sort((a, b) => new Date(a.from) - new Date(b.from));
  if (sortedGoalHistory.length > 0) {
    lines.push('');
    lines.push('GOAL HISTORY (important: evaluate each meal against the goal that was active on that date, NOT the current goal):');
    sortedGoalHistory.forEach(snap => {
      const parts = [`  From ${snap.from}:`];
      if (snap.dailyCalorieGoal) parts.push(`${snap.dailyCalorieGoal} kcal/day`);
      if (snap.proteinGoal || snap.carbsGoal || snap.fatsGoal) parts.push(`macros ${snap.proteinGoal || '?'}g P / ${snap.carbsGoal || '?'}g C / ${snap.fatsGoal || '?'}g F`);
      if (snap.hydrationGoal) parts.push(`hydration ${snap.hydrationGoal} ${profile.volumeUnit || 'glasses'}/day`);
      if (snap.selectedPlan) parts.push(`plan ${snap.selectedPlan}`);
      lines.push(parts.join(' | '));
    });
  }
  lines.push('');

  const completedFastingSessions = fastingSessions || [];
  const completedMeals = recentMeals || [];
  const completedWaterLogs = waterLogs || [];
  const completedCheckIns = checkInHistory || [];
  const allWeightLogs = weightLogs || [];

  // Overall date range across all data types — drives zero-fill so gaps are visible to the AI
  const overallMaxWeek = Math.min(11, Math.max(
    -1,
    ...[
      ...completedFastingSessions.map(s => getWeekIndex(s.date || s.startTime)),
      ...completedMeals.map(m => getWeekIndex(m.date)),
      ...completedWaterLogs.map(wl => getWeekIndex(wl.date)),
      ...allWeightLogs.map(wl => getWeekIndex(wl.date)),
    ].filter(w => w >= 0 && w <= 11)
  ));

  // Fasting by week
  const fastingByWeek = {};
  completedFastingSessions.forEach(s => {
    const w = getWeekIndex(s.date || s.startTime);
    if (w < 0 || w > 11) return;
    if (!fastingByWeek[w]) fastingByWeek[w] = [];
    fastingByWeek[w].push(s);
  });

  if (overallMaxWeek >= 0) {
    lines.push('FASTING SESSIONS BY WEEK (each bucket = exactly 7 calendar days; week 0 = past 0–6 days, week 1 = past 7–13 days, etc.; weeks with 0 fasts = app not used or fasting skipped that week):');
    for (let w = 0; w <= overallMaxWeek; w++) {
      const sessions = fastingByWeek[w] || [];
      const completed = sessions.filter(s => s.durationHours >= 0 || s.endTime);
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (completed.length > 0) {
        const targetH = parseInt((profile.selectedPlan || '16:8').split(':')[0]) || 16;
        const cutShort = completed.filter(s => s.durationHours < targetH).length;
        const avgDur = (completed.reduce((sum, s) => sum + (s.durationHours || 0) + (s.durationMinutes || 0) / 60, 0) / completed.length).toFixed(1);
        lines.push(`  ${label}: ${completed.length} fasts | avg ${avgDur}h${cutShort > 0 ? ` | ${cutShort} ended early` : ''}`);
        completed.forEach(s => {
          const startStr = s.startTime ? fmt12h(s.startTime) : '';
          const endStr = s.endTime ? fmt12h(s.endTime) : '';
          const dur = ((s.durationHours || 0) + (s.durationMinutes || 0) / 60).toFixed(1);
          const dateLabel = s.date || new Date(s.startTime).toDateString();
          lines.push(`    ${dateLabel}${startStr ? ` | started ${startStr}` : ''}${endStr ? ` → ended ${endStr}` : ''} | ${dur}h`);
        });
      } else {
        lines.push(`  ${label}: 0 fasts (app not used or fasting skipped)`);
      }
    }
    lines.push('');
  }

  // Eating windows — gap between breaking one fast and starting the next
  const sortedByTime = [...completedFastingSessions]
    .filter(s => s.startTime && s.endTime)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (sortedByTime.length >= 2) {
    const targetFastH = parseInt((profile.selectedPlan || '16:8').split(':')[0]) || 16;
    const targetEatingH = 24 - targetFastH;
    const windows = [];
    for (let i = 1; i < sortedByTime.length; i++) {
      const prevEnd = new Date(sortedByTime[i - 1].endTime);
      const currStart = new Date(sortedByTime[i].startTime);
      const gapH = (currStart - prevEnd) / (1000 * 60 * 60);
      if (gapH >= 0 && gapH <= 24) {
        windows.push({ gapH, breakFastTime: fmt12h(prevEnd), nextFastTime: fmt12h(currStart), date: sortedByTime[i - 1].date || new Date(prevEnd).toDateString() });
      }
    }
    if (windows.length > 0) {
      const avgWindow = (windows.reduce((s, w) => s + w.gapH, 0) / windows.length).toFixed(1);
      lines.push(`EATING WINDOWS (time between breaking a fast and starting the next; target for ${profile.selectedPlan || '16:8'} plan: ${targetEatingH}h):`);
      lines.push(`  Average eating window: ${avgWindow}h (target: ${targetEatingH}h) | ${parseFloat(avgWindow) > targetEatingH ? `⚠ ${(parseFloat(avgWindow) - targetEatingH).toFixed(1)}h over target` : '✓ within target'}`);
      windows.slice(-14).forEach(w => {
        lines.push(`  ${w.date}: ate for ${w.gapH.toFixed(1)}h (broke fast ${w.breakFastTime} → next fast ${w.nextFastTime})`);
      });
      lines.push('');
    }
  }

  // Meals by week — divide by 7 so zero-logged days drag the average down (honest engagement signal)
  const mealsByWeek = {};
  completedMeals.forEach(m => {
    const w = getWeekIndex(m.date);
    if (w < 0 || w > 11) return;
    if (!mealsByWeek[w]) mealsByWeek[w] = [];
    mealsByWeek[w].push(m);
  });

  if (overallMaxWeek >= 0) {
    lines.push('MEAL LOGS BY WEEK (each bucket = exactly 7 calendar days; week 0 = past 0–6 days, week 1 = past 7–13 days, etc.; avg daily intake divides by 7 so zero-log days are counted as 0 kcal):');
    for (let w = 0; w <= overallMaxWeek; w++) {
      const meals = mealsByWeek[w] || [];
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (meals.length > 0) {
        const byDay = {};
        meals.forEach(m => {
          if (!byDay[m.date]) byDay[m.date] = { cal: 0, prot: 0, carb: 0, date: m.date };
          byDay[m.date].cal += (m.calories || 0);
          byDay[m.date].prot += (m.protein || 0);
          byDay[m.date].carb += (m.carbs || 0);
        });
        const days = Object.values(byDay);
        const totalCal = days.reduce((s, d) => s + d.cal, 0);
        const totalProt = days.reduce((s, d) => s + d.prot, 0);
        const totalCarb = days.reduce((s, d) => s + d.carb, 0);
        const avgDailyCal = Math.round(totalCal / 7);
        const avgDailyProt = Math.round(totalProt / 7);
        const avgDailyCarb = Math.round(totalCarb / 7);
        const repDate = days[0]?.date;
        const goalAtTime = getGoalAtDate(goalHistory, repDate, profile);
        const calGoalAtTime = goalAtTime?.dailyCalorieGoal || profile.dailyCalorieGoal || 2000;
        const mealList = meals.map(m => `${m.name}(${m.calories}cal,${m.protein || 0}g prot${m.logged_at ? ` @${fmt12h(m.logged_at)}` : ''})`).join('; ');
        lines.push(`  ${label}: ${meals.length} meals across ${days.length}/7 days | avg daily intake: ${avgDailyCal} kcal (goal: ${calGoalAtTime} kcal) | avg ${avgDailyProt}g protein | avg ${avgDailyCarb}g carbs`);
        lines.push(`    Meals: ${mealList}`);
      } else {
        lines.push(`  ${label}: 0 meals logged, 0 kcal (app not used or all meals skipped)`);
      }
    }
    lines.push('');
  }

  // Water by week — divide by 7 so zero-log days count as 0 (honest engagement signal)
  const waterByWeek = {};
  completedWaterLogs.forEach(wl => {
    const w = getWeekIndex(wl.date);
    if (w < 0 || w > 11) return;
    if (!waterByWeek[w]) waterByWeek[w] = {};
    if (!waterByWeek[w][wl.date]) waterByWeek[w][wl.date] = 0;
    waterByWeek[w][wl.date] += (wl.amount || 1);
  });

  if (overallMaxWeek >= 0) {
    const waterGoal = profile.hydrationGoal || 8;
    const unit = profile.volumeUnit || 'glasses';
    lines.push(`WATER INTAKE BY WEEK (each bucket = exactly 7 calendar days; week 0 = past 0–6 days; goal: ${waterGoal} ${unit}/day; avg divides by 7 so zero-log days count as 0):`);
    for (let w = 0; w <= overallMaxWeek; w++) {
      const byDay = waterByWeek[w];
      const label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
      if (byDay) {
        const days = Object.keys(byDay);
        const avgDaily = (days.reduce((s, d) => s + byDay[d], 0) / 7).toFixed(1);
        const status = avgDaily >= waterGoal ? '✓ on track' : avgDaily >= waterGoal * 0.75 ? '~ close' : '↓ below goal';
        lines.push(`  ${label}: avg ${avgDaily} ${unit}/day across ${days.length}/7 days (${status})`);
      } else {
        lines.push(`  ${label}: 0 ${unit} logged (app not used or water tracking skipped)`);
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
      const timeStr = c.loggedAt ? ` ${fmt12h(c.loggedAt)}` : '';
      const parts = [`[${c.date}${timeStr}]`];
      if (c.fastingStatus) parts.push(`fast:${c.fastingStatus}`);
      if (c.hungerLevel != null) parts.push(`hunger:${c.hungerLevel}/10`);
      if (c.feelings?.length) parts.push(`feelings:${c.feelings.join(',')}`);
      if (c.moods?.length) parts.push(`mood:${c.moods.join(',')}`);
      if (c.symptoms?.length) parts.push(`symptoms:${c.symptoms.join(',')}`);
      if (c.activities?.length) parts.push(`activities:${c.activities.join(',')}`);
      if (c.notes) parts.push(`note:"${c.notes}"`);
      lines.push(`  ${parts.join(' | ')}`);
    });
    lines.push('');
  }

  // Enriched meal logs — each meal paired with how the user felt that day
  const recentEnriched = (enrichedMealLogs || []).slice(0, 30);
  if (recentEnriched.length > 0) {
    lines.push('MEALS WITH EMOTIONAL & PHYSICAL CONTEXT (most recent first):');
    recentEnriched.forEach(m => {
      const parts = [`[${m.date}] ${m.mealName} (${m.totalCalories} kcal)`];
      if (m.fastingStatus) parts.push(`fast:${m.fastingStatus}`);
      if (m.hungerLevel) parts.push(`hunger:${m.hungerLevel}`);
      if (m.feelings?.length) parts.push(`feelings:${m.feelings.join(',')}`);
      if (m.moods?.length) parts.push(`mood:${m.moods.join(',')}`);
      if (m.symptoms?.length) parts.push(`symptoms:${m.symptoms.join(',')}`);
      if (m.activities?.length) parts.push(`activity:${m.activities.join(',')}`);
      if (m.ingredients?.length) parts.push(`foods:${m.ingredients.map(f => f.name).join(',')}`);
      lines.push(`  ${parts.join(' | ')}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

async function callClaude(prompt, apiKey, maxTokens = 2048) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Claude API error');
  return result.content?.[0]?.text || '';
}

function buildJustForYouPrompt(data) {
  const { profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs, enrichedMealLogs } = data;

  const recentSessions = (fastingSessions || []).slice(0, 14);
  const recentWeight = (weightLogs || []).slice(0, 10);
  const recentCheckIns = (checkInHistory || []).slice(0, 10);
  const recentMealsSlice = (recentMeals || []).slice(0, 20);
  const recentWater = (waterLogs || []).slice(0, 14);
  const recentEnriched = (enrichedMealLogs || []).slice(0, 20);

  // Compute eating windows from consecutive fast sessions
  const sortedByTime = [...(fastingSessions || [])]
    .filter(s => s.startTime && s.endTime)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const fmt12h = (ts) => {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    if (isNaN(d)) return '';
    const h = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
    return `${h % 12 || 12}:${m}${h >= 12 ? 'PM' : 'AM'}`;
  };
  const eatingWindows = [];
  for (let i = 1; i < sortedByTime.length; i++) {
    const prevEnd = new Date(sortedByTime[i - 1].endTime);
    const currStart = new Date(sortedByTime[i].startTime);
    const gapH = (currStart - prevEnd) / (1000 * 60 * 60);
    if (gapH >= 0 && gapH <= 24) {
      eatingWindows.push({ date: sortedByTime[i - 1].date, windowHours: parseFloat(gapH.toFixed(1)), breakFastTime: fmt12h(prevEnd), nextFastTime: fmt12h(currStart) });
    }
  }

  return `You are a warm, supportive personal health coach inside Afri Fast, an African fasting and nutrition app.

USER PROFILE:
- Name: ${profile.userName || 'User'}
- Country: ${profile.userCountry || 'Not specified'}
- Member since: ${profile.userJoinDate ? new Date(profile.userJoinDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}
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
- Eating windows (gap between breaking a fast and starting the next; target for ${profile.selectedPlan || '16:8'}: ${24 - (parseInt((profile.selectedPlan || '16:8').split(':')[0]) || 16)}h): ${JSON.stringify(eatingWindows.slice(-14))}
- Weight logs: ${JSON.stringify(recentWeight)}
- Check-ins: ${JSON.stringify(recentCheckIns)}
- Recent meals: ${JSON.stringify(recentMealsSlice)}
- Water logs: ${JSON.stringify(recentWater)}
- Meals with emotional/physical context: ${JSON.stringify(recentEnriched)}

Look at this person's goals vs their actual progress across all areas — fasting consistency, weight progress, nutrition, hydration, energy, mood. Generate actionable insight cards — things they can specifically learn from or act on. These refresh weekly so they must reflect genuine patterns across the past 7 days, not just surface observations.

Rules:
- Each card must tie directly to a real pattern or gap you see between their goals and their data
- Be encouraging, never judgmental
- The "desc" is a short teaser shown on the card (1-2 sentences)
- The "body" is the full insight shown when they tap the CTA button (3-5 sentences, specific and actionable)
- The "cta" is a 2-word button label you choose — make it feel curious or personal, never generic. Examples: "Find out", "Dig in", "See why", "Tell me", "Show me", "Read on", "Unpack it", "Worth knowing". Never use "Learn more".
- Generate between 3 and 5 cards — only where there are genuine goal-vs-progress observations

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "title": "...", "desc": "...", "body": "...", "cta": "..." },
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
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const cardPrompt = `${CARD_GENERATOR_PROMPT}\n\nHEALTH ANALYSIS:\n${analysis}\n\nUser's name: ${data.profile?.userName || 'them'}\nTomorrow's date: ${tomorrowStr}`;
      const cardText = await callClaude(cardPrompt, CLAUDE_KEY, 2048);

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

      // Stage 3: Prediction — one notification-ready sentence for tomorrow, or null
      const predictionPrompt = `You have just analysed a person's health data and written ${cards.length} insight cards for them. Based on the analysis and cards, decide whether there is ONE meaningful prediction worth sending as a push notification tomorrow.

The prediction should feel like the Flow app — personal, surprising, data-backed. Something the person hasn't noticed but the data clearly shows is coming.

Rules:
- Text: 10-15 words max. Confident, direct. No "you might" — say it like you know. No relative day words ("today", "tomorrow", "tonight"). Write it so it reads naturally at the moment it fires.
- Timing: pick hour (0-23) and minute (0 or 30 only) based on the user's ACTUAL behavioral patterns from the data — meal timestamps, fast break times, check-in times. Not a generic time.
- cardIndex: 0-based index of the card this prediction relates to most.
- Only return a prediction if it is genuinely data-backed. If nothing stands out, return null.

CARDS GENERATED:
${cards.map((c, i) => `[${i}] ${c.feeling}`).join('\n')}

HEALTH ANALYSIS SUMMARY:
${analysis.slice(0, 1500)}

Return ONLY one of:
{"text":"...","cardIndex":0,"hour":12,"minute":0}
or the word: null`;

      let prediction = null;
      try {
        const predText = (await callClaude(predictionPrompt, CLAUDE_KEY, 150)).trim();
        if (predText && predText !== 'null') {
          const predMatch = predText.match(/\{[\s\S]*\}/);
          if (predMatch) {
            const p = JSON.parse(predMatch[0]);
            if (p.text && p.hour != null) prediction = p;
          }
        }
      } catch (_) {}

      return res.status(200).json({ cards, alertCard: '', prediction });
    }

    if (type === 'just_for_you') {
      const processedData = preprocessData(data);
      const analystPrompt = `${ANALYST_PROMPT}\n\nHEALTH DATA FOR ANALYSIS:\n\n${processedData}`;
      const analysis = await callClaude(analystPrompt, CLAUDE_KEY);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const tw = data.profile?.targetWeight;
      const wu = data.profile?.weightUnit || 'kg';
      const groundTruth = tw != null
        ? `\n\nGROUND TRUTH (do NOT override these with any other value):\n- User's target weight: ${tw} ${wu}\n- User's starting weight: ${data.profile?.startingWeight ?? 'not set'} ${wu}`
        : '';
      const cardPrompt = `${CARD_GENERATOR_PROMPT}\n\nHEALTH ANALYSIS:\n${analysis}\n\nUser's name: ${data.profile?.userName || 'them'}\nTomorrow's date: ${tomorrowStr}${groundTruth}`;
      const cardText = await callClaude(cardPrompt, CLAUDE_KEY, 2048);

      const stripped = cardText.replace(/```json|```/g, '').trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[/api/ai just_for_you] No JSON array in response:', cardText.slice(0, 300));
        return res.status(500).json({ error: 'Could not parse response' });
      }
      const rawCards = JSON.parse(jsonMatch[0]);
      const cards = rawCards.map((card, i) => ({ ...card, ...CARD_COLORS[i % CARD_COLORS.length] }));
      return res.status(200).json({ cards });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (e) {
    console.error('[/api/ai exception]', e);
    return res.status(500).json({ error: e.message });
  }
}
