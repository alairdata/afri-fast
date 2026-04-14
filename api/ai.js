const CARD_COLORS = [
  { color: '#E8F5E9', accent: '#4CAF50' },
  { color: '#FFF3E0', accent: '#FF9800' },
  { color: '#E3F2FD', accent: '#2196F3' },
  { color: '#FCE4EC', accent: '#E91E63' },
  { color: '#EDE7F6', accent: '#7C3AED' },
  { color: '#E0F7FA', accent: '#0097A7' },
];

function buildDailyInsightsPrompt(data) {
  const { profile, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs } = data;

  const today = new Date().toDateString();
  const todayMeals = (recentMeals || []).filter(m => m.date === today);
  const todayWater = (waterLogs || []).filter(w => w.date === today).reduce((s, w) => s + (w.amount || 0), 0);
  const recentSessions = (fastingSessions || []).slice(0, 10);
  const recentWeight = (weightLogs || []).slice(0, 5);
  const recentCheckIns = (checkInHistory || []).slice(0, 7);

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

TODAY'S DATA:
- Meals logged today: ${JSON.stringify(todayMeals)}
- Water logged today: ${todayWater} ${profile.volumeUnit || 'sachets'}

RECENT HISTORY (last 10 sessions):
- Fasting sessions: ${JSON.stringify(recentSessions)}
- Check-ins: ${JSON.stringify(recentCheckIns)}
- Weight logs: ${JSON.stringify(recentWeight)}

Based ONLY on what you can actually see in this data, generate daily insight cards. Each card reflects something specific and meaningful you observe about this user's day or recent activity.

Rules:
- Be warm and coach-like, never clinical
- Only reference what is visible in the data — do not make things up
- Each card should feel personal, like their coach noticed something specific
- Short title (max 6 words), subtitle is 1-2 sentences max
- Generate between 2 and 5 cards — only as many as there are genuine observations

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "title": "...", "subtitle": "..." },
  ...
]`;
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_KEY = process.env.CLAUDE_KEY;
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });

  let prompt;
  if (type === 'daily_insights') prompt = buildDailyInsightsPrompt(data);
  else if (type === 'just_for_you') prompt = buildJustForYouPrompt(data);
  else return res.status(400).json({ error: 'Invalid type' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[/api/ai error]', result);
      return res.status(response.status).json({ error: result.error?.message || 'Claude API error' });
    }

    const text = result.content?.[0]?.text || '';
    const stripped = text.replace(/```json|```/g, '').trim();
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.error('[/api/ai] No JSON array in response:', text.slice(0, 300));
      return res.status(500).json({ error: 'Could not parse response' });
    }

    const cards = JSON.parse(jsonMatch[0]);

    // Attach colors (cycling through palette) for daily_insights
    const enriched = cards.map((card, i) => ({
      ...card,
      ...(type === 'daily_insights' ? CARD_COLORS[i % CARD_COLORS.length] : {}),
    }));

    return res.status(200).json({ cards: enriched });
  } catch (e) {
    console.error('[/api/ai exception]', e);
    return res.status(500).json({ error: e.message });
  }
}
