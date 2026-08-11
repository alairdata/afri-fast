function buildUserContext(data) {
  const {
    userName, userCountry, selectedPlan, goal, conditions,
    targetWeight, startingWeight, weightUnit,
    dailyCalorieGoal, hydrationGoal, volumeUnit,
    proteinGoal, carbsGoal, fatsGoal,
    fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs,
    enrichedMealLogs, goalHistory,
  } = data;

  const sessions = fastingSessions || [];
  const checkIns = checkInHistory || [];
  const meals = recentMeals || [];
  const weights = [...(weightLogs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const waterLs = waterLogs || [];

  const completed = sessions.filter(s => s.endTime);
  const durations = completed.map(s => (s.durationHours || 0) + (s.durationMinutes || 0) / 60).filter(d => d > 0);
  const avgDuration = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : 0;
  const completionRate = sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0;

  const moodCount = {};
  checkIns.forEach(c => {
    (Array.isArray(c.moods) ? c.moods : c.moods ? [c.moods] : []).forEach(m => {
      moodCount[m] = (moodCount[m] || 0) + 1;
    });
  });
  const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

  const mealsByDate = {};
  meals.forEach(m => {
    const date = m.date || (m.loggedAt || '').split('T')[0];
    if (!date) return;
    if (!mealsByDate[date]) mealsByDate[date] = [];
    mealsByDate[date].push(m);
  });
  const dailyCals = Object.values(mealsByDate).map(ms => ms.reduce((a, m) => a + (m.calories || 0), 0));
  const avgCals = dailyCals.length ? Math.round(dailyCals.reduce((a, b) => a + b, 0) / dailyCals.length) : 0;

  const foodCount = {};
  meals.forEach(m => {
    const name = m.detectedName || m.name;
    if (name) foodCount[name] = (foodCount[name] || 0) + 1;
  });
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

  // How meals are being logged
  const methodCount = {};
  meals.forEach(m => { if (m.method) methodCount[m.method] = (methodCount[m.method] || 0) + 1; });
  const loggingMethods = Object.entries(methodCount).sort((a, b) => b[1] - a[1]).map(([method, count]) => `${method} (${count}x)`).join(', ');

  // Macro distributions from logged meals
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFats = meals.reduce((s, m) => s + (m.fats || 0), 0);
  const mealDays = Object.keys(mealsByDate).length || 1;
  const avgProtein = Math.round(totalProtein / mealDays);
  const avgCarbs = Math.round(totalCarbs / mealDays);
  const avgFats = Math.round(totalFats / mealDays);

  const currentWeight = weights.length ? weights[weights.length - 1].weight : null;
  const wu = weightUnit || (weights.length ? weights[weights.length - 1].unit : 'kg');
  const weightLost = currentWeight && startingWeight ? parseFloat((startingWeight - currentWeight).toFixed(1)) : null;

  const waterByDate = {};
  waterLs.forEach(w => { if (w.date) waterByDate[w.date] = (waterByDate[w.date] || 0) + (w.amount || 1); });
  const dailyWater = Object.values(waterByDate);
  const avgWater = dailyWater.length ? parseFloat((dailyWater.reduce((a, b) => a + b, 0) / dailyWater.length).toFixed(1)) : 0;

  return `USER PROFILE:
- Name: ${userName || 'User'}
- Country: ${userCountry || 'Not specified'}
- Fasting plan: ${selectedPlan || '16:8'}
- Goal: ${goal || 'Not specified'}
- Health conditions: ${(conditions || []).join(', ') || 'None'}
- Starting weight: ${startingWeight ? `${startingWeight} ${wu}` : 'not set'}
- Current weight: ${currentWeight ? `${currentWeight} ${wu}` : 'not logged'}
- Target weight: ${targetWeight ? `${targetWeight} ${wu}` : 'not set'}
- Weight lost so far: ${weightLost != null ? `${weightLost} ${wu}` : 'unknown'}
- Daily calorie goal (current): ${dailyCalorieGoal || 2000} kcal | Avg actual: ${avgCals} kcal
- Macro goals: ${proteinGoal || '?'}g protein, ${carbsGoal || '?'}g carbs, ${fatsGoal || '?'}g fats
${(goalHistory || []).length > 0 ? `- Goal history: ${[...goalHistory].sort((a, b) => new Date(a.from) - new Date(b.from)).map(s => `[${s.from}] ${s.dailyCalorieGoal ? s.dailyCalorieGoal + ' kcal' : ''}${s.selectedPlan ? ' plan:' + s.selectedPlan : ''}`).join(' → ')}` : ''}
- Hydration goal: ${hydrationGoal || 6} ${volumeUnit || 'sachets'}/day | Avg actual: ${avgWater}

FASTING HISTORY:
- Total sessions: ${sessions.length} | Completed: ${completed.length} (${completionRate}% rate)
- Average fast duration: ${avgDuration} hours
- Longest fast: ${durations.length ? Math.max(...durations).toFixed(1) : 0} hours

CHECK-INS:
- Total: ${checkIns.length} | Most common moods: ${topMoods.join(', ') || 'none recorded'}

NUTRITION:
- Meals logged: ${meals.length} | Most eaten: ${topFoods.join(', ') || 'none recorded'}
- Avg daily calories: ${avgCals} kcal (goal: ${dailyCalorieGoal || 2000} kcal)
- Avg daily macros: ${avgProtein}g protein (goal: ${proteinGoal || '?'}g) | ${avgCarbs}g carbs (goal: ${carbsGoal || '?'}g) | ${avgFats}g fats (goal: ${fatsGoal || '?'}g)
- How meals are logged: ${loggingMethods || 'not recorded'}

MEALS WITH EMOTIONAL CONTEXT (how they felt when eating):
${(enrichedMealLogs || []).slice(0, 15).map(m => {
  const parts = [`${m.date} — ${m.mealName} (${m.totalCalories} kcal)`];
  if (m.fastingStatus) parts.push(`fast: ${m.fastingStatus}`);
  if (m.hungerLevel) parts.push(`hunger: ${m.hungerLevel}`);
  if (m.feelings?.length) parts.push(`feelings: ${m.feelings.join(', ')}`);
  if (m.moods?.length) parts.push(`mood: ${m.moods.join(', ')}`);
  if (m.symptoms?.length) parts.push(`symptoms: ${m.symptoms.join(', ')}`);
  if (m.activities?.length) parts.push(`activity: ${m.activities.join(', ')}`);
  return `- ${parts.join(' | ')}`;
}).join('\n') || '- No enriched meal data yet'}`;
}

function buildChatSystemPrompt(personality, userContext) {
  return `You are a warm, knowledgeable personal health coach inside Afri Fast, an African fasting and nutrition app. You know this user — their habits, goals, patterns, and personality.

${personality
  ? `WHAT YOU KNOW ABOUT THIS USER:\n${personality}`
  : `This is a new user. Learn about them as you chat — their motivations, communication style, challenges, and goals.`
}

${userContext}

COACHING RULES:
- Always use their actual data — never give generic advice when you have real numbers
- Match your tone to what you know about their personality (encouraging, direct, gentle, etc.)
- Be concise (2-4 sentences), warm, and practical
- Speak like a coach who knows them well, not a stranger
- If they reveal something new about themselves, acknowledge it naturally and remember it`;
}

function buildMealsChatSystemPrompt(userContext) {
  return `You are a calorie-counting helper inside Afri Fast, an African fasting and nutrition app. Your only job in this chat is to help the user understand the calories and nutrition in the meal or food they describe — nothing else.

${userContext}

RULES:
- Do NOT give weight-loss coaching, motivational advice, or talk about their goals, streaks, or fasting plan unless they explicitly ask about food.
- Focus purely on estimating calories (and macros if useful) for whatever food or meal they mention, drawing on typical African food knowledge and their logged meals for reference.
- Be concise and practical — give a calorie estimate and a quick breakdown, not a lecture.
- If they name a dish, estimate realistically based on typical portion sizes; ask one quick clarifying question only if the portion size is genuinely ambiguous.
- If the user gives a precise weight or volume for a food (e.g. "150g rice", "200ml milk"), use that exact figure as the qty verbatim — do not convert it into an approximate description like "1 cup". Only use approximate descriptions when they haven't given a precise measurement.
- Keep replies to 2-4 sentences unless they ask for more detail.
- In "reply", wrap the final total calorie figure in **double asterisks** so it renders bold (e.g. "That's **550 kcal** total."). Only bold the total — not individual item calories or other numbers.
- The user often explores several portion sizes or food options before deciding (e.g. "what about 400g of fries instead?", "what if I add cheese?"). Always read the FULL conversation and treat the LATEST quantity or choice mentioned for each food as what they've settled on — ignore earlier options they've moved away from. Never mix an earlier discarded quantity into a later total.
- cal must always equal (protein × 4) + (carbs × 4) + (fats × 9) — never guess it independently.
- Set isLoggable to true only when the conversation has settled on specific food item(s) with clear quantities that could be logged as a real meal right now — not for vague, hypothetical, or off-topic messages. When true, "foods" must list every finalized food item under discussion (using each one's LATEST settled quantity) with accurate macros, and "title" is a short natural name for the whole meal — lead with the main item, then the most prominent other item, joined by "and", no commas (e.g. "Fries and Chicken", not "Fries, Chicken, Cheese").
- When isLoggable is false, "foods" must be an empty array and "title" can be empty.`;
}

function buildPersonalityUpdatePrompt(existingPersonality, conversation, userContext) {
  return `You are updating a personality profile for a user of Afri Fast, a health coaching app. This profile helps the AI coach understand and serve them better over time.

EXISTING PROFILE:
${existingPersonality || 'None yet — this is the first profile entry.'}

RECENT CONVERSATION:
${conversation}

USER DATA:
${userContext}

Based on the conversation and data, write an updated personality profile. Include:
- Motivation style (results-driven, needs encouragement, accountability-focused, competitive, etc.)
- Behavioral patterns visible in data (consistent weekdays, struggles on weekends, etc.)
- Communication preferences (likes detail, prefers short answers, responds to tough love, needs gentle nudging, etc.)
- Goals and concerns they have expressed
- Any personal context they have shared (lifestyle, schedule, challenges, wins)
- Predictions — what they likely need most from their coach right now

Write as a concise paragraph (5-8 sentences) in third person using their name. Be specific — use real observations, not generic filler. Merge new insights with the existing profile, do not repeat what has not changed.

Return ONLY the updated profile text. No labels, no explanation, no JSON.`;
}

function buildPersonalityRebuildPrompt(userContext, fastingSessions, checkInHistory, recentMeals, weightLogs) {
  return `You are building a personality profile for a user of Afri Fast, a health coaching app, based entirely on their data.

${userContext}

DETAILED DATA:
Fasting sessions (last 20): ${JSON.stringify((fastingSessions || []).slice(0, 20))}
Check-ins (last 20): ${JSON.stringify((checkInHistory || []).slice(0, 20))}
Recent meals (last 30): ${JSON.stringify((recentMeals || []).slice(0, 30))}
Weight logs (last 10): ${JSON.stringify((weightLogs || []).slice(0, 10))}

Analyse this data and write a personality profile that describes this user as a health coaching client. Include:
- Their consistency and commitment patterns
- Motivation style inferred from behaviour
- Strengths and areas they struggle with
- What kind of coaching they likely respond best to
- Progress trends and what they seem to care most about
- Predictions about their upcoming challenges

Write as a concise paragraph (5-8 sentences) in third person using their name. Be specific and data-driven.

Return ONLY the profile text. No labels, no explanation.`;
}

const MEALS_CHAT_FOOD_ITEM = {
  type: 'OBJECT',
  properties: {
    name:    { type: 'STRING', description: 'Specific name of the food item.' },
    qty:     { type: 'STRING', description: 'The LATEST settled portion size. If the user gave a precise weight/volume, use it verbatim (e.g. "400g"); otherwise use an approximate description (e.g. "1 medium wrap").' },
    protein: { type: 'NUMBER', description: 'Grams of protein.' },
    carbs:   { type: 'NUMBER', description: 'Grams of carbohydrates.' },
    fats:    { type: 'NUMBER', description: 'Grams of fat.' },
    fiber:   { type: 'NUMBER', description: 'Grams of fiber.' },
    cal:     { type: 'NUMBER', description: 'Calories: (protein*4)+(carbs*4)+(fats*9).' },
  },
  required: ['name', 'qty', 'protein', 'carbs', 'fats', 'fiber', 'cal'],
};

const MEALS_CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply:      { type: 'STRING',  description: "Your natural conversational reply to the user's message." },
    isLoggable: { type: 'BOOLEAN', description: 'True only if the conversation has settled on specific food item(s) and quantities that could be logged as a meal right now.' },
    title:      { type: 'STRING',  description: 'Meal title when isLoggable is true, empty string otherwise. Lead with the starchy base/carb, then the single most prominent accompaniment, joined by "and" or "with". No commas, brackets, or parentheses — e.g. "Fries and Chicken", not "Fries, Chicken, Cheese".' },
    foods:      { type: 'ARRAY', items: MEALS_CHAT_FOOD_ITEM, description: 'The FINAL food items and quantities the user has settled on across the whole conversation.' },
  },
  required: ['reply', 'isLoggable', 'title', 'foods'],
};

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    const match = text.match(/[{[][^]*[}\]]/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function normalizeFood(f, fallback = 'Unknown food') {
  const protein = Number(f.protein) || 0;
  const carbs   = Number(f.carbs)   || 0;
  const fats    = Number(f.fats)    || 0;
  const fiber   = Number(f.fiber)   || 0;
  const macroCal = Math.round(protein * 4 + carbs * 4 + fats * 9);
  const cal = macroCal > 0 ? macroCal : (Number(f.cal) || 0);
  return { name: f.name || fallback, qty: f.qty || '1 serving', cal, protein, carbs, fats, fiber };
}

async function logToSupabase(supabaseUrl, supabaseKey, rows) {
  if (!supabaseUrl || !supabaseKey || !rows.length) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch (_) { /* non-critical — don't break the response */ }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_KEY = process.env.CLAUDE_KEY;
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'API key not configured' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const { action, messages, data, personality, openingContext, userId, variant } = req.body || {};

  const callClaude = async (systemPrompt, userMessages, maxTokens = 1024) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: userMessages,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Claude API error');
    return result.content?.[0]?.text?.trim() || '';
  };

  const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
  const callGemini = async (systemPrompt, userMessages, schema) => {
    const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_KEY) throw new Error('Gemini API key not configured');
    const contents = userMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.1,
            ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
          },
        }),
      });
      if (response.status === 503) continue;
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Gemini API error');
      return result?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
    }
    throw new Error('All Gemini models unavailable');
  };

  try {
    const userContext = data ? buildUserContext(data) : '';

    // === Send a chat message ===
    if (action === 'message') {
      const systemPrompt = variant === 'meals'
        ? buildMealsChatSystemPrompt(userContext)
        : buildChatSystemPrompt(personality || '', userContext);

      let conversation;
      if (openingContext && (!messages || messages.length === 0)) {
        // Opened from alert card — open with specific observation
        conversation = [{
          role: 'user',
          content: `The user just tapped on this observation you flagged for them: "${openingContext}". Open the conversation by addressing it directly and personally. Ask one follow-up question. Keep it to 2-3 sentences. Rephrase naturally — don't repeat it word for word.`,
        }];
      } else {
        // Regular conversation — last 10 messages
        conversation = (messages || []).slice(-10).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
      }

      let reply;
      let loggableMeal = null;

      if (variant === 'meals') {
        const raw = await callGemini(systemPrompt, conversation, MEALS_CHAT_SCHEMA);
        const parsed = parseJson(raw);
        reply = parsed?.reply || "Sorry, I couldn't work that out — try describing the food again.";
        if (parsed?.isLoggable && parsed.foods?.length) {
          const foods = parsed.foods.map(f => normalizeFood(f));
          loggableMeal = { title: parsed.title || foods.map(f => f.name).join(', '), foods };
        }
      } else {
        reply = await callClaude(systemPrompt, conversation, 1024);
      }

      // Log this exchange to DB (fire-and-forget)
      if (userId) {
        const lastUserMsg = conversation[conversation.length - 1];
        const rows = [];
        if (lastUserMsg?.role === 'user') {
          rows.push({ user_id: userId, role: 'user', content: lastUserMsg.content, action: 'message' });
        }
        rows.push({ user_id: userId, role: 'assistant', content: reply, action: 'message' });
        logToSupabase(SUPABASE_URL, SUPABASE_SERVICE_KEY, rows);
      }

      return res.status(200).json({ reply, loggableMeal });
    }

    // === Update personality from chat session ===
    if (action === 'update_personality') {
      const { conversation } = req.body;
      const prompt = buildPersonalityUpdatePrompt(personality || '', conversation, userContext);
      const updated = await callClaude(
        'You are a user profiling system for a health coaching app. Your output is a personality profile used internally by the AI coach.',
        [{ role: 'user', content: prompt }],
        512
      );
      return res.status(200).json({ personality: updated });
    }

    // === Monthly full rebuild from data ===
    if (action === 'rebuild_personality') {
      const { fastingSessions, checkInHistory, recentMeals, weightLogs } = data || {};
      const prompt = buildPersonalityRebuildPrompt(userContext, fastingSessions, checkInHistory, recentMeals, weightLogs);
      const rebuilt = await callClaude(
        'You are a user profiling system for a health coaching app. Your output is a personality profile used internally by the AI coach.',
        [{ role: 'user', content: prompt }],
        512
      );
      return res.status(200).json({ personality: rebuilt });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('[/api/chat error]', e);
    return res.status(500).json({ error: e.message });
  }
}
