const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];

async function callGemini(apiKey, parts) {
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (response.status === 503) continue;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API error');
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
  }
  throw new Error('All Gemini models unavailable');
}

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/[{[][^]*[}\]]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeFood(f, fallback = 'Unknown food') {
  return {
    name: f.name || fallback,
    qty: f.qty || '1 serving',
    cal: Number(f.cal) || 0,
    protein: Number(f.protein) || 0,
    carbs: Number(f.carbs) || 0,
    fats: Number(f.fats) || 0,
    fiber: Number(f.fiber) || 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });

  try {
    // ── Photo scan ──────────────────────────────────────────────────────────
    if (type === 'scan_photo') {
      const { base64, userCountry } = data;
      const text = await callGemini(GEMINI_KEY, [
        {
          text: `You are a food recognition expert for an African health and nutrition app.

Your job is to identify food accurately. Do not over-assume or oversimplify — look carefully at the actual contents of the plate before naming anything. Use the most specific and accurate name for what you see.

IMPORTANT: First check if this image actually contains food. If it does NOT contain food, respond with exactly:
NOT_FOOD: [what you see in the image]

If it IS food, return a JSON object with three fields:
1. "fromScreen": true if the image appears to be from a screen or digital device (screen glare, pixel patterns, flat lighting, UI elements, watermarks) — otherwise false.
2. "title": Name the meal as it is most commonly called. Lead with the starchy base or carb if present, then the single most prominent accompaniment. Exactly two components joined by "and" or "with". No brackets, parentheses, or commas.
3. "foods": an array of objects, one per distinct food item on the plate. Each object must have:
   - name: the most accurate and specific name for this food item
   - qty: specific portion size. Countable: "2 medium eggs", "1 large chicken thigh", "3 thick plantain slices". Non-countable: "1 heaped cup of white rice", "1 large bowl of soup", "1 medium wrap of fufu". Never say just "pieces" or "servings" without specifying exactly what and how big.
   - cal: estimated calories as a number
   - protein: protein in grams as a number
   - carbs: carbohydrates in grams as a number
   - fats: fat in grams as a number
   - fiber: fiber in grams as a number

Return ONLY a valid JSON object — no explanation, no markdown, no code blocks.`,
        },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } },
      ]);
      if (text.startsWith('NOT_FOOD:')) {
        return res.json({ notFood: true, identified: text.replace('NOT_FOOD:', '').trim() });
      }
      const parsed = extractJson(text);
      if (!parsed) return res.status(500).json({ error: 'Could not parse photo scan response' });
      return res.json({
        fromScreen: !!parsed.fromScreen,
        title: parsed.title || null,
        foods: (parsed.foods || []).map(f => normalizeFood(f)),
      });
    }

    // ── Text analysis ────────────────────────────────────────────────────────
    if (type === 'analyze_text') {
      const { mealText } = data;
      const text = await callGemini(GEMINI_KEY, [{
        text: `You are a nutrition expert specializing in African meals. The user has described a meal they ate — this could be a short name like "jollof rice", a messy description like "i had fufu and light soup with chicken and some koobi", or even a long paragraph. Your job is to extract all the food items from whatever they wrote.

IMPORTANT: Be extremely generous — almost anything could reference food. Only return NOT_FOOD if the input contains absolutely zero food references whatsoever (e.g. "my car broke down"). If there is ANY mention of food, extract it. A Ghanaian typing "bknu" likely means "Banku". Give it the benefit of the doubt always.

If after attempting to interpret it there is genuinely NO food content at all, respond with exactly:
NOT_FOOD: [short description of what it is]

If it contains ANY food, return ONLY raw JSON with these fields:
1. "correctedInput": a clean short summary of the meal (e.g. "Fufu with light soup and chicken"). Fix typos — do not add items not mentioned.
2. "title": Name the meal the way a local would naturally say it. Lead with the starchy base or carb if one is present. Follow with only the single most prominent accompaniment. Exactly two components joined by "and" or "with". No brackets, parentheses, or commas.
3. "foods": an array of objects, one per individual food item mentioned. Each object must have:
   - name: full food name as a local would say it
   - qty: estimated portion — COUNT + SIZE + ITEM for countable (e.g. "2 medium eggs"), SIZE + ITEM for non-countable (e.g. "1 heaped cup of white rice"). No brackets, no metric units.
   - cal, protein, carbs, fats, fiber: numbers

What the user wrote: "${mealText}"

Return ONLY a valid JSON object with no explanation, no markdown, no code blocks.`,
      }]);
      if (text.startsWith('NOT_FOOD:')) {
        return res.json({ notFood: true, identified: text.replace('NOT_FOOD:', '').trim() });
      }
      const parsed = extractJson(text);
      if (!parsed) return res.json(null);
      return res.json({
        title: parsed.title || null,
        correctedInput: parsed.correctedInput || null,
        foods: (parsed.foods || []).map(f => normalizeFood(f)),
      });
    }

    // ── Audio analysis ───────────────────────────────────────────────────────
    if (type === 'analyze_audio') {
      const { base64 } = data;
      const text = await callGemini(GEMINI_KEY, [
        {
          text: `You are a nutrition expert specializing in African meals. The user has spoken the name of a meal they ate. Listen to the audio and identify the meal.

If you cannot identify a food or meal, respond with exactly:
NOT_FOOD: [description]

If it IS a food or meal, return ONLY raw JSON with these fields:
1. "title": Name the meal the way a local would naturally say it. Lead with the starchy base or carb if present. Follow with only the single most prominent accompaniment. Exactly two components joined by "and" or "with". No brackets or commas.
2. "foods": array of objects, one per food item. Each must have:
   - name: full food name as a local would say it
   - qty: COUNT + SIZE + ITEM (e.g. "2 medium eggs", "1 large wrap of fufu", "1 heaped cup of rice"). No brackets, no metric units.
   - cal, protein, carbs, fats, fiber: numbers

Return ONLY raw JSON, no markdown, no explanation.`,
        },
        { inline_data: { mime_type: 'audio/m4a', data: base64 } },
      ]);
      if (!text || text.startsWith('NOT_FOOD:')) return res.json({ notFood: true });
      const parsed = extractJson(text);
      if (!parsed) return res.json(null);
      return res.json({
        title: parsed.title || null,
        foods: (parsed.foods || []).map(f => normalizeFood(f)),
      });
    }

    // ── Nutrition lookup ─────────────────────────────────────────────────────
    if (type === 'lookup_nutrition') {
      const { itemName } = data;
      const text = await callGemini(GEMINI_KEY, [{
        text: `You are a nutrition expert. Give the nutritional info for one typical serving of "${itemName}".
Return ONLY a raw JSON object with these fields:
- name: the proper food name
- qty: typical single serving size (e.g. "1 medium egg", "1 cup of rice") — be specific, no brackets or metric units
- cal: calories as a number
- protein: protein in grams as a number
- carbs: carbohydrates in grams as a number
- fats: fat in grams as a number
- fiber: fiber in grams as a number
No explanation, no markdown, just raw JSON.`,
      }]);
      const parsed = extractJson(text);
      if (!parsed) return res.json(null);
      return res.json(normalizeFood(parsed, itemName));
    }

    // ── Portion recalculation ────────────────────────────────────────────────
    if (type === 'recalculate_portion') {
      const { foodName, oldQty, newQty, currentNutrition } = data;
      const text = await callGemini(GEMINI_KEY, [{
        text: `You are a nutrition expert specializing in African and global meals. Recalculate the nutrition for this food item based on the new portion or measurement the user entered.

Food item: "${foodName}"
Old portion: "${oldQty}" → calories: ${currentNutrition?.cal ?? 0} kcal, protein: ${currentNutrition?.protein ?? 0}g, carbs: ${currentNutrition?.carbs ?? 0}g, fats: ${currentNutrition?.fats ?? 0}g, fiber: ${currentNutrition?.fiber ?? 0}g
New portion: "${newQty}"

Rules:
- If the new portion is the same unit but different quantity (e.g. "1 cup" → "2 cups"), scale the old nutrition proportionally.
- If the measurement type changed (e.g. "1 cup" → "200g"), use your nutrition knowledge to calculate correct values for the new portion from scratch.
- Always return realistic, non-zero calorie values. A real food portion always has calories.
- For "name", if the user's new portion text contains a food name (e.g. "1.5 cups of beans"), use that food name. Otherwise keep the original name.
- Return ONLY a raw JSON object: {"name": "food name", "qty": "new portion text", "cal": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0}
No explanation, no markdown, no extra text.`,
      }]);
      const parsed = extractJson(text);
      if (!parsed) return res.json(null);
      return res.json(normalizeFood(parsed, foodName));
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (e) {
    console.error('[/api/gemini]', type, e);
    return res.status(500).json({ error: e.message });
  }
}
