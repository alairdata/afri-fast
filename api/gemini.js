const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];

// ── Shared system instructions ───────────────────────────────────────────────

const NUTRITION_SYSTEM =
  'You are an expert nutritionist and visual analysis AI specializing in African cuisine. ' +
  'Accurately identify dishes, estimate realistic portions, and calculate macro structures. ' +
  'cal must always equal (protein × 4) + (carbs × 4) + (fats × 9) — never guess it independently. ' +
  'For portions: use COUNT + SIZE + ITEM for countable foods (e.g. "2 medium eggs", "1 large chicken thigh") ' +
  'and SIZE + ITEM for non-countable foods (e.g. "1 heaped cup of white rice", "1 medium wrap of fufu"). ' +
  'EXCEPTION: if the user explicitly states a precise weight or volume for a food (e.g. "150g rice", "200ml milk", "0.5kg beef"), ' +
  'use that exact figure verbatim as the qty — do not convert it into an approximate description. ' +
  'Only use the COUNT/SIZE approximation style when the user has not given a precise measurement (this is always the case for photo scans, since there is no way to know exact weight from an image). ' +
  'For meal titles: lead with the starchy base or carb, then the single most prominent accompaniment, ' +
  'joined by "and" or "with". No brackets, parentheses, or commas.';

const INGREDIENT_SYSTEM =
  "You are a chef's assistant specializing in identifying food ingredients from photos of fridges, pantries, and kitchen counters.";

// ── Response schemas ─────────────────────────────────────────────────────────

const FOOD_ITEM = {
  type: 'OBJECT',
  properties: {
    name:    { type: 'STRING', description: 'Specific local name of the food item.' },
    qty:     { type: 'STRING', description: 'Portion size with descriptive unit.' },
    protein: { type: 'NUMBER', description: 'Grams of protein.' },
    carbs:   { type: 'NUMBER', description: 'Grams of carbohydrates.' },
    fats:    { type: 'NUMBER', description: 'Grams of fat.' },
    fiber:   { type: 'NUMBER', description: 'Grams of fiber.' },
    cal:     { type: 'NUMBER', description: 'Calories: (protein*4)+(carbs*4)+(fats*9).' },
  },
  required: ['name', 'qty', 'protein', 'carbs', 'fats', 'fiber', 'cal'],
};

const MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood:             { type: 'BOOLEAN', description: 'True if the input contains edible food.' },
    whatIsItIfNotFood:  { type: 'STRING',  description: 'If isFood is false, briefly describe what it actually is.' },
    fromScreen:         { type: 'BOOLEAN', description: 'True if image is a photo of a digital screen.' },
    title:              { type: 'STRING',  description: 'Primary meal name.' },
    correctedInput:     { type: 'STRING',  description: 'Clean short summary of what the user described (text input only).' },
    foods:              { type: 'ARRAY', items: FOOD_ITEM },
  },
  required: ['isFood', 'fromScreen', 'title', 'foods'],
};

const SINGLE_FOOD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name:    { type: 'STRING' },
    qty:     { type: 'STRING' },
    protein: { type: 'NUMBER' },
    carbs:   { type: 'NUMBER' },
    fats:    { type: 'NUMBER' },
    fiber:   { type: 'NUMBER' },
    cal:     { type: 'NUMBER' },
  },
  required: ['name', 'qty', 'protein', 'carbs', 'fats', 'fiber', 'cal'],
};

const INGREDIENTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    scene:       { type: 'STRING' },
  },
  required: ['ingredients', 'scene'],
};

// ── Core fetch helper ────────────────────────────────────────────────────────

async function callGemini(apiKey, parts, { systemInstruction, schema } = {}) {
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
      },
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 503) continue;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API error');
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
  }
  throw new Error('All Gemini models unavailable');
}

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

// ── Route handler ────────────────────────────────────────────────────────────

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
        { text: `Analyze this plate. Look carefully at the actual contents before identifying anything.\nEstimate portion sizes and look up realistic macro distributions for those portions.${userCountry ? `\nThe user is from ${userCountry} — prioritise local dish names.` : ''}\nIf the image does not contain food, set isFood to false and describe what you see in whatIsItIfNotFood.\nIf the image is a photo of a digital screen, set fromScreen to true.` },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } },
      ], { systemInstruction: NUTRITION_SYSTEM, schema: MEAL_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.status(500).json({ error: 'Could not parse photo scan response' });
      if (!parsed.isFood) return res.json({ notFood: true, identified: parsed.whatIsItIfNotFood || '' });
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
        text: `The user wrote: "${mealText}"\n\nExtract all food items. Be generous — interpret typos and local shorthand (e.g. "bknu" = Banku, "jrice" = Jollof Rice). If there is genuinely no food content at all, set isFood to false. Include a correctedInput summarising what they wrote.`,
      }], { systemInstruction: NUTRITION_SYSTEM, schema: MEAL_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.json(null);
      if (!parsed.isFood) return res.json({ notFood: true, identified: parsed.whatIsItIfNotFood || '' });
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
        { text: 'Listen to the audio and identify the meal or food the user mentioned. If you cannot identify any food, set isFood to false.' },
        { inline_data: { mime_type: 'audio/m4a', data: base64 } },
      ], { systemInstruction: NUTRITION_SYSTEM, schema: MEAL_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed || !parsed.isFood) return res.json({ notFood: true });
      return res.json({
        title: parsed.title || null,
        foods: (parsed.foods || []).map(f => normalizeFood(f)),
      });
    }

    // ── Nutrition lookup ─────────────────────────────────────────────────────
    if (type === 'lookup_nutrition') {
      const { itemName } = data;
      const text = await callGemini(GEMINI_KEY, [{
        text: `Give the nutritional info for one typical serving of "${itemName}". Be specific about the portion size.`,
      }], { systemInstruction: NUTRITION_SYSTEM, schema: SINGLE_FOOD_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.json(null);
      return res.json(normalizeFood(parsed, itemName));
    }

    // ── Portion recalculation ────────────────────────────────────────────────
    if (type === 'recalculate_portion') {
      const { foodName, oldQty, newQty, currentNutrition: n } = data;
      const text = await callGemini(GEMINI_KEY, [{
        text: `Food: "${foodName}"\nPrevious portion: ${oldQty} → cal: ${n?.cal ?? 0} kcal, protein: ${n?.protein ?? 0}g, carbs: ${n?.carbs ?? 0}g, fats: ${n?.fats ?? 0}g, fiber: ${n?.fiber ?? 0}g\nNew portion: "${newQty}"\n\nIf the new portion is a precise weight or volume (e.g. 200g, 150ml, 3oz), calculate directly from nutrition knowledge for that exact amount and return the qty as that exact figure verbatim — do not convert it into an approximate description.\nIf same unit type but different quantity, scale proportionally.\nIf the unit type changed without a precise weight, recalculate from scratch.\nIf the new portion text contains a food name (e.g. "1.5 cups of beans"), use that as the name.`,
      }], { systemInstruction: NUTRITION_SYSTEM, schema: SINGLE_FOOD_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.json(null);
      return res.json(normalizeFood(parsed, foodName));
    }

    // ── Ingredient identification from photo(s) ──────────────────────────────
    if (type === 'identify_ingredients') {
      const { base64, images } = data;
      const allImages = images || (base64 ? [base64] : []);
      if (!allImages.length) return res.status(400).json({ error: 'No images provided' });
      const photoWord = allImages.length === 1 ? 'this image' : 'these images';
      const text = await callGemini(GEMINI_KEY, [
        { text: `Look at ${photoWord} carefully. Identify ALL food items, ingredients, and produce you can see across all images. Combine findings into one deduplicated list. Use simple common names (e.g. "chicken" not "poultry").` },
        ...allImages.map(b => ({ inline_data: { mime_type: 'image/jpeg', data: b } })),
      ], { systemInstruction: INGREDIENT_SYSTEM, schema: INGREDIENTS_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.status(500).json({ error: 'Could not analyse image' });
      return res.json({ ingredients: parsed.ingredients || [], scene: parsed.scene || '' });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (e) {
    console.error('[/api/gemini]', type, e);
    return res.status(500).json({ error: e.message });
  }
}
