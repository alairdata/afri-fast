import { PNG } from 'pngjs';
import jpegJs from 'jpeg-js';
import { fillMethodStep } from '../src/lib/recipeMethod.js';
import { NUTRITION_SYSTEM, callGemini, parseJson } from './_gemini.js';
import { microsForFoods, microsForMeals } from './_micros.js';
import { MEDICAL_SAFETY } from './_safety.js';
import { checkAiAuth } from './_aiAuth.js';
import { toneInstruction } from './_tone.js';

// Lumi's chosen voice for the Insights tab texts (data.coachTone), or nothing.
const withVoice = (data) => { const v = toneInstruction(data?.coachTone); return v ? `\n\n${v}` : ''; };
// ── Shared system instructions ───────────────────────────────────────────────

const INGREDIENT_SYSTEM =
  "You are a chef's assistant specializing in identifying food ingredients from photos of fridges, pantries, and kitchen counters.";

const MOMENTUM_WHY_SYSTEM =
  'You are that friend who happens to know about health and nutrition — not a clinical app, not a fitness influencer, just someone who has been quietly ' +
  'paying attention to this person\'s week and wants to tell them what you actually noticed. You speak in plain, warm, everyday African language. ' +
  'Encouraging without being fake, honest without being harsh, and light humour where it genuinely fits (never forced).\n\n' +
  'The person just tapped "See why" under their Momentum Score, wanting to understand what is actually driving it. You are writing what they will read on ' +
  'that screen: one opening line, an optional second line, and one short passage each for the three things that make up the score — Eating, Staying ' +
  'Satisfied, and Moving. Staying Satisfied is really about whether they are eating enough of the right things to keep going sustainably, not about being ' +
  'strict — treat it that way, never as a discipline score.\n\n' +
  'You are given the exact numbers and history behind all three — kcal, grams, streaks, how today compares to their usual week. Use them exactly, never ' +
  'invent or round loosely. But say them the way a friend would, not a spreadsheet: "you\'re short about 60g of protein today" not "proteinPts: 6". If you ' +
  'have to name a concept (like protein, or a deficit), explain what it actually does in one plain phrase before or instead of naming it clinically — e.g. ' +
  '"the stuff that keeps you full for hours" rather than just "protein", if it helps the sentence read more human.\n\n' +
  'Fields to write:\n' +
  '- headline: ONE sentence, the single most interesting, specific thing true about today. Use a real pattern from the history given when there is one ' +
  '(a comeback after a rough day, a weekday that is usually harder for them and they held steady, a weekend dip they bounced back from, their best ' +
  'stretch in a while) — otherwise just how today stacks up against their normal pace. This is the first thing they read — make it feel like someone ' +
  'actually looked, not a generic line that could apply to anyone.\n' +
  '- connector: OPTIONAL, only when one of the three areas is genuinely out of step with the other two — otherwise leave it an empty string. Frame it as ' +
  'balance ("your eating and moving carried you even though sleep on satiety was rough"), never as a scorecard.\n' +
  '- eating: 1-2 sentences on today specifically — what they have eaten so far vs what they are aiming for. Nothing logged yet today? Say so gently, no ' +
  'guilt trip, it just holds steady till they log something.\n' +
  '- satiety: 1-2 sentences naming whatever is actually pulling this one down this week (short on protein, short on water, deficit running a bit deep, ' +
  'days swinging a lot between over and under) in plain words, or say things look sustainable if nothing is off.\n' +
  '- movement: 1-2 sentences on today\'s movement vs their usual target — describe how they actually move (mostly the gym, mostly walking, a bit of both, ' +
  'or barely anything logged yet) rather than forcing a label.\n\n' +
  'Absolutely no jargon, ever: no "macros", no "caloric deficit", no "subscore", no "pillar", no "target adherence", nothing that sounds like a report or a ' +
  'clinic. Never say "based on your data" or "your logs show" — you just know them, the way a friend would. A little humour is welcome if it fits the ' +
  'moment, but do not force it into every field. If a userName is given, you can use it once, naturally, if it fits — do not force it into every field ' +
  'either, this screen gets reopened often and repeating their name every time would feel odd.';

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
    sugar:   { type: 'NUMBER', description: 'Grams of total sugars (natural and added).' },
    sodium:  { type: 'NUMBER', description: 'Milligrams of sodium, including salt and seasoning cubes used in cooking.' },
    cal:     { type: 'NUMBER', description: 'Calories for this portion, estimated directly from what this food typically contains as prepared (like a food composition table), not added up from the macros.' },
  },
  required: ['name', 'qty', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium', 'cal'],
};

const MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood:             { type: 'BOOLEAN', description: 'True if the input contains edible food.' },
    whatIsItIfNotFood:  { type: 'STRING',  description: 'If isFood is false, briefly describe what it actually is.' },
    fromScreen:         { type: 'BOOLEAN', description: 'True if image is a photo of a digital screen.' },
    shareable:          { type: 'BOOLEAN', description: 'Photo scans only: true only if the photo shows just food or drink (hands are fine) with no people, faces, documents, screens, nudity, or anything offensive or inappropriate.' },
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
    sugar:   { type: 'NUMBER' },
    sodium:  { type: 'NUMBER' },
    cal:     { type: 'NUMBER' },
  },
  required: ['name', 'qty', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium', 'cal'],
};

const INGREDIENTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    scene:       { type: 'STRING' },
  },
  required: ['ingredients', 'scene'],
};

const MOMENTUM_WHY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline:  { type: 'STRING', description: 'The single most interesting/specific thing true about today.' },
    connector: { type: 'STRING', description: 'Cross-pillar balance observation, or empty string if no real gap.' },
    eating:    { type: 'STRING' },
    satiety:   { type: 'STRING' },
    movement:  { type: 'STRING' },
  },
  required: ['headline', 'connector', 'eating', 'satiety', 'movement'],
};

const BURNOUT_WHY_SYSTEM =
  'You are that friend who happens to know about health and food — warm, plain-spoken, honest, a little light-hearted when it fits. ' +
  'You are explaining to someone what their "burnout likelihood" number means for them this week. Burnout here simply means how likely they are ' +
  'to get worn out and drop off their plan: usually from eating far too little, swinging between very low and very high days, or missing the things ' +
  'that keep them full and steady (protein, water, fibre).\n\n' +
  'You are given the exact numbers: the score, the band, what is pulling it up, their last days of calories against their target, and sometimes a ' +
  'predicted "rough patch" date. Use the numbers exactly, but say them the way a friend would. NEVER use jargon or the words: TDEE, deficit, floor, ' +
  'macros, volatility, binge-restrict, subscore, pillar. Say "eating a lot less than your body uses", "days going up and down a lot", ' +
  '"not enough protein to keep you full" instead.\n\n' +
  'Fields:\n' +
  '- summary: 1-2 short sentences. The real story of their week in everyday words, referring to actual days or amounts when that helps. If the ' +
  'score is low and things look steady, say so warmly and briefly.\n' +
  '- tip: ONE short, doable thing to do today or tomorrow (for example a specific kind of meal, a glass of water, not skipping a meal). Empty string if ' +
  'everything is fine.\n' +
  '- crashNote: if a rough-patch date is given, ONE calm sentence about it ("around Thursday you may feel worn down — a proper lunch each day before ' +
  'then helps"). Name the day exactly as roughPatch.sayItAs gives it ("today", "tomorrow", "Thursday", "next Tuesday"), never just ' +
  'the weekday when sayItAs says otherwise. With no rough-patch date, an empty string. Never scary, never guilt.\n\n' +
  'No medical claims, no diagnosing, no shaming. Do not repeat the score number. Keep every field short enough to read at a glance.';

const BURNOUT_WHY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary:   { type: 'STRING' },
    tip:       { type: 'STRING' },
    crashNote: { type: 'STRING' },
  },
  required: ['summary', 'tip', 'crashNote'],
};

const PATTERN_INSIGHT_SYSTEM =
  'You are that friend who happens to know about health and food, quietly paying attention to someone\'s eating over the last two weeks. ' +
  'Write ONE short insight card about the most useful pattern you notice, in plain, warm, everyday language — no jargon, no report-speak, never a ' +
  'scolding. You are given each recent day with its weekday, calories eaten and their target for that day, plus a few pattern flags.\n\n' +
  'Look at ALL the days, not just the biggest one. Good patterns to spot: a couple of heavy days and what followed; a heavy day then a very light one ' +
  '(up and down); the same weekday being harder each week; several days in a row well under target; one rough day after a steady stretch (and that one ' +
  'day not mattering much); or steady and fine. Mention real days and amounts exactly as given ("Monday was about 3,000 and Thursday about 4,000, more ' +
  'than double your target"). Explain what it likely means for them in one plain sentence and give one gentle next step.\n\n' +
  'Fields:\n' +
  '- title: 3-6 words, specific to the pattern (not generic like "Big swing").\n' +
  '- body: 2-3 short sentences: what you noticed (with real days/numbers), what it means, one gentle next step. Reassuring where the picture is fine.\n\n' +
  'Never say TDEE, deficit, variance, or any clinical term. No medical claims. No guilt.';

const PATTERN_INSIGHT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    body:  { type: 'STRING' },
  },
  required: ['title', 'body'],
};

const PORTION_PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    whatIsItIfNotFood: { type: 'STRING' },
    title: { type: 'STRING', description: 'Short meal title, starch first, e.g. "Rice and garden egg stew".' },
    foods: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          kcal100: { type: 'NUMBER' }, protein100: { type: 'NUMBER' }, carbs100: { type: 'NUMBER' }, fat100: { type: 'NUMBER' },
          fiber100: { type: 'NUMBER' }, sugar100: { type: 'NUMBER' }, sodium100: { type: 'NUMBER', description: 'mg per 100 g' },
          unitGrams: { type: 'NUMBER' }, unitOne: { type: 'STRING' }, unitMany: { type: 'STRING' },
          grams: { type: 'NUMBER', description: 'Planned portion in grams.' },
        },
        required: ['name', 'kcal100', 'protein100', 'carbs100', 'fat100', 'unitGrams', 'unitOne', 'unitMany', 'grams'],
      },
    },
    tip: { type: 'STRING' },
  },
  required: ['isFood', 'foods', 'title', 'tip'],
};

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    whatIsItIfNotFood: { type: 'STRING' },
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    minutes: { type: 'NUMBER' },
    usedCount: { type: 'NUMBER' },
    totalCount: { type: 'NUMBER' },
    foods: PORTION_PLAN_SCHEMA.properties.foods,
    method: { type: 'ARRAY', items: { type: 'STRING' } },
    tip: { type: 'STRING' },
  },
  required: ['isFood', 'title', 'description', 'foods', 'method', 'tip'],
};

// ── Core fetch helper ────────────────────────────────────────────────────────

function normalizeFood(f, fallback = 'Unknown food') {
  const protein = Number(f.protein) || 0;
  const carbs   = Number(f.carbs)   || 0;
  const fats    = Number(f.fats)    || 0;
  const fiber   = Number(f.fiber)   || 0;
  const sugar   = Number(f.sugar)   || 0;
  const sodium  = Number(f.sodium)  || 0;
  // Calories come first: the model's own estimate for that food and portion. Macros only fill in when it gave none.
  const macroCal = Math.round(protein * 4 + carbs * 4 + fats * 9);
  const cal = Number(f.cal) > 0 ? Math.round(Number(f.cal)) : macroCal;
  return { name: f.name || fallback, qty: f.qty || '1 serving', cal, protein, carbs, fats, fiber, sugar, sodium };
}

// One generated kitchen recipe into generated_recipes, with the service key (the table has no app access).
async function recordGeneratedRecipe(row) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  const r = await fetch(`${url}/rest/v1/generated_recipes`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) console.warn('[generated_recipes] save failed', r.status, (await r.text().catch(() => '')).slice(0, 200));
}

// ── Route handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await checkAiAuth(req, res, 'gemini'))) return;

  const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'AI service not configured' });

  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });

  try {
    // ── Photo scan ──────────────────────────────────────────────────────────
    if (type === 'scan_photo') {
      const { base64, userCountry } = data;
      const text = await callGemini(GEMINI_KEY, [
        { text: `Analyze this photo. Look carefully at the actual contents before identifying anything.\n` +
          `ONLY list what you can actually see in the photo. Never add a dish, side or drink because it usually comes with this meal or is common where the user lives. If something is not clearly visible, leave it out.\n` +
          `COUNT countable items one by one (eggs, pieces of chicken or fish, slices, sausages, balls of kenkey, drinks) and give the exact whole number you see: three eggs are "3 eggs", never 1.5 or "a few". Use a part only for an item that is visibly cut or half eaten.\n` +
          `PACKAGED food and drinks (cartons, cans, bottles, sachets, wrappers): read the label to work out what the product really is, then name it the way people actually know and ask for it: usually brand + variant (e.g. "Frutelli Mango", "Malta Guinness", "Coca-Cola Zero", "Indomie Chicken", "La Vache qui rit"). Think like someone who knows these products: keep the brand's real name in whatever language it is, and write it as it is normally written even when the logo splits or stylises it ("FRU Telli" is "Frutelli"). Leave out label wording that only describes the product, such as "100% natural juice" or "jus naturel" on a carton whose flavour is already named, plus marketing words and sizes. The result should be short and natural, the name a person would type to log it. Give that product's typical nutrition for the size shown. Do not turn a branded product into a generic one like "mango juice".\n` +
          `Estimate portion sizes and look up realistic macro distributions for those portions.${userCountry ? `\nThe user is from ${userCountry}: when a visible food has a local name there, use it. This is only for naming what is in the photo, never a reason to add or guess a food.` : ''}\nIf the image does not contain food, set isFood to false and describe what you see in whatIsItIfNotFood.\nIf the image is a photo of a digital screen, set fromScreen to true.\nSet shareable to true only if the photo shows just food or drink (hands are fine) and nothing that would be inappropriate to show other people: no people or faces, no documents, no screens, no nudity, nothing offensive. When in doubt, set it to false.` },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } },
      ], { systemInstruction: NUTRITION_SYSTEM, schema: MEAL_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.status(500).json({ error: 'Could not parse photo scan response' });
      if (!parsed.isFood) return res.json({ notFood: true, identified: parsed.whatIsItIfNotFood || '' });
      return res.json({
        fromScreen: !!parsed.fromScreen,
        shareable: parsed.shareable === true && !parsed.fromScreen,
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

    // ── Voice to text (phones; the web uses the browser's own speech recognition) ──
    if (type === 'transcribe_audio') {
      const { base64 } = data;
      const raw = await callGemini(GEMINI_KEY, [
        { text: 'Write down exactly what the person says about the food they have, in plain words. Keep local food names as they say them. If nothing is said, return an empty string.' },
        { inline_data: { mime_type: 'audio/m4a', data: base64 } },
      ], { schema: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } });
      const parsed = parseJson(raw);
      return res.json({ text: String(parsed?.text || '').trim() });
    }

    // ── Build a recipe from my kitchen: a recipe from what they have, scaled to a calorie amount per person ──
    if (type === 'build_recipe') {
      const { text: haveText, base64, budget, servings, userCountry } = data;
      const target = Math.max(100, Math.min(3000, Math.round(Number(budget) || 0)));
      const people = Math.max(1, Math.min(8, Math.round(Number(servings) || 1)));
      if (!haveText && !base64) return res.status(400).json({ error: 'Tell us what ingredients you have' });
      const parts = [{
        text: `The person has these ingredients at home${haveText ? `: "${String(haveText).slice(0, 600)}"` : ' (see the photo)'}.\n` +
          `Create ONE home recipe they can cook from ONLY these, cooking for ${people} ${people === 1 ? 'person' : 'people'}, about ${target} kcal per person.${userCountry ? ` They live in ${userCountry}: prefer a familiar local dish and local names.` : ''}\n` +
          `Use ONLY what they said they have${base64 ? ' or what is clearly visible in the photo' : ''}, plus salt, pepper, water and, only if needed (see below), a little cooking oil, which every kitchen has. Do NOT add any other ingredient: no onion, tomato, peppers, garlic, spices, seasoning cubes, sugar, butter, stock or anything else they did not name, even if the dish usually has it. Every item in foods must be one of theirs or one of those four basics. If one extra item would really help, mention it only in the tip as optional ("If you have an onion, ..."), never in foods or the method. Pick a dish that works with just what they have.\n` +
          'Where they haven\'t said how they cook it, prefer lighter cooking (grilling, boiling, roasting, less oil) when it still tastes right.\n' +
          'Listen to how THEY describe things. If they say how they make it or what they want ("I fry my plantain in coconut oil", "no oil", "I use smoked fish", "make it spicy", "my mum\'s way: palm oil and onions only"), follow it exactly, even if a lighter way exists; only suggest a lighter swap in the tip. If they say an item is already cooked or leftover ("leftover rice", "cooked beans"), treat that item as cooked (cooked amounts and nutrition, and the method just warms or adds it) and say "(cooked)" in its name. A dish that only exists cooked (stew, soup, sauce, jollof, waakye, egusi and the like) is always already made, even if they don\'t say so: use its cooked nutrition (its oil is already in it) and only warm it or cook other things in it.\n' +
          'Cooking oil is NOT automatic. Add it only when a step truly needs fat AND nothing they have already brings fat (a stew, sauce or soup, palm oil, butter, margarine, fatty meat or fish they named all count). When they have something like that, cook in it instead: eggs poached or scrambled in the stew, plantain warmed in the sauce, rice boiled in water. Never use more of something than they said they have (at most 3 eggs if they have three). Use a generous share of any protein they have and keep starch to about a third to half of the calories.\n' +
          'Everything they don\'t describe as cooked is RAW (uncooked, as bought): every amount and all nutrition are for the raw ingredient. foods: every ingredient with nutrition per 100 g RAW, a household measure for the raw ingredient (unitOne/unitMany and unitGrams for one of them, e.g. cup dry beans, medium onion, tbsp oil) and RAW grams PER PERSON. Count EVERYTHING that goes in (still only their ingredients and the four basics): every oil, butter, margarine, sugar, honey, seasoning cube and sauce used in ANY step (oil to fry or sauté, oil to grease the pan, butter to finish) is its own ingredient with exact grams, and the step that uses it names it with {n} (e.g. "Heat {6} in a frying pan and fry the plantain until golden."). If the same oil is used in two steps, list it twice with what each step uses ("Palm oil (for the stew)", "Vegetable oil (for frying)"). For deep-frying, list only the oil the food soaks up (about 10 to 15% of the food\'s weight) as "Oil for frying (absorbed)". The method starts from the raw ingredients (washing, soaking, boiling dry beans and so on).\n' +
          'method: 4 to 7 short, clear steps for the whole pot (all servings). Never write an amount or weight yourself: where a step needs one, write {n}, n being that ingredient\'s number in foods (1 = the first), only the FIRST time that ingredient is added or measured; after that call it by its plain name, e.g. "Heat {3} in a pan, add {4} and fry the onion until soft." The app fills in the exact amount for the whole pot. foods name: the plain ingredient, then its state in brackets wherever cooking changes its weight, so the person knows what the grams are for: "(raw)" for anything weighed uncooked (grains, beans, meat, fish, eggs, yam, plantain, vegetables: "White rice (raw)", "Eggs (raw)"), "(cooked)" for anything already cooked ("Rice (cooked)"). No bracket on oil, butter, salt, pepper, spices, sugar, water, or a ready-made dish like stew or soup. unitOne/unitMany: a simple kitchen measure such as tbsp, tsp, cup, clove, slice or medium onion, never words like half, several, portion or bowl. minutes: total time. usedCount: how many of the ingredients they listed the recipe uses; totalCount: how many they listed.\n' +
          'description: one appetising sentence. tip: one practical sentence about this recipe (a swap or cooking choice and what it saves or adds, or one optional extra if they happen to have it), no medical claims.\n' +
          'If there are no usable ingredients, set isFood to false and say what you see in whatIsItIfNotFood.',
      }];
      if (base64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64 } });
      const raw = await callGemini(GEMINI_KEY, parts, { systemInstruction: `${NUTRITION_SYSTEM}\n\n${MEDICAL_SAFETY}`, schema: RECIPE_SCHEMA });
      const parsed = parseJson(raw);
      if (!parsed) return res.status(500).json({ error: 'Could not build a recipe. Try again.' });
      if (!parsed.isFood) return res.json({ notFood: true, identified: parsed.whatIsItIfNotFood || '' });
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      let foods = (parsed.foods || []).filter((f) => f && f.name && num(f.kcal100) >= 0).slice(0, 12).map((f) => ({
        name: String(f.name),
        kcal100: num(f.kcal100), protein100: num(f.protein100), carbs100: num(f.carbs100), fat100: num(f.fat100),
        fiber100: num(f.fiber100), sugar100: num(f.sugar100), sodium100: num(f.sodium100),
        unitGrams: Math.max(1, num(f.unitGrams) || 100), unitOne: f.unitOne || 'serving', unitMany: f.unitMany || f.unitOne || 'servings',
        grams: Math.max(0, num(f.grams)),
      }));
      if (!foods.length) return res.json({ notFood: true, identified: '' });
      const total = foods.reduce((s, f) => s + (f.kcal100 * f.grams) / 100, 0);
      const factor = total > 0 ? target / total : 1;
      if (total > 0 && Math.abs(factor - 1) > 0.05) foods = foods.map((f) => ({ ...f, grams: f.grams * factor }));
      foods = foods.map((f) => ({ ...f, grams: Math.max(1, Math.round(f.grams)) }));
      // the method names its amounts as {n}; fill them from the final grams for the whole pot, so the method always
      // matches the ingredient list (the app refills them when a portion is edited)
      const methodTemplate = (parsed.method || []).map(String).filter(Boolean).slice(0, 8);
      const method = methodTemplate.map((step) => fillMethodStep(step, foods.map((f) => ({ name: f.name, grams: f.grams * people, unitGrams: f.unitGrams, unitOne: f.unitOne, unitMany: f.unitMany }))));
      // Keep every generated recipe, saved or not, in generated_recipes (owner-only). Never holds the person up.
      await Promise.race([
        recordGeneratedRecipe({
          user_id: req.aiUser?.id || null, input_text: haveText ? String(haveText).slice(0, 2000) : null, had_photo: !!base64,
          budget_kcal: target, servings: people, country: userCountry || null,
          title: parsed.title || null, description: parsed.description || null, minutes: Math.round(num(parsed.minutes)) || null,
          used_count: Math.round(num(parsed.usedCount)) || null, total_count: Math.round(num(parsed.totalCount)) || null,
          total_kcal: Math.round(foods.reduce((s, f) => s + (f.kcal100 * f.grams) / 100, 0)), foods, method, tip: parsed.tip || null,
        }),
        new Promise((r) => setTimeout(r, 2000)),
      ]).catch(() => {});
      return res.json({
        title: parsed.title || 'Your recipe', description: parsed.description || '', tip: parsed.tip || '',
        minutes: Math.round(num(parsed.minutes)) || null, servings: people,
        usedCount: Math.round(num(parsed.usedCount)) || null, totalCount: Math.round(num(parsed.totalCount)) || null,
        method, methodTemplate, foods,
      });
    }

    // ── A photo of a recipe (generated only when someone opens the recipe) ──
    if (type === 'recipe_image') {
      const { title, ingredients } = data;
      if (!title) return res.status(400).json({ error: 'Missing recipe' });
      const prompt = `A realistic, appetising overhead food photo of "${String(title).slice(0, 120)}", a home-cooked West African-style dish` +
        `${Array.isArray(ingredients) && ingredients.length ? ` made with ${ingredients.slice(0, 10).map(String).join(', ')}` : ''}. ` +
        'One normal single-person portion on a simple plate, natural daylight, plain kitchen table, no text, no hands, no extra garnish.';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(502).json({ error: out.error?.message || 'Image service error' });
      const img = (out?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
      const inline = img?.inlineData || img?.inline_data;
      if (!inline?.data) return res.status(502).json({ error: 'No image returned' });
      const mime = inline.mimeType || inline.mime_type || 'image/png';
      // The model sends a ~2 MB PNG; a quality-88 JPEG of it looks the same at about a seventh of the size.
      if (/png/i.test(mime)) {
        try {
          const png = PNG.sync.read(Buffer.from(inline.data, 'base64'));
          const jpg = jpegJs.encode({ data: png.data, width: png.width, height: png.height }, 88);
          return res.json({ mimeType: 'image/jpeg', data: Buffer.from(jpg.data).toString('base64') });
        } catch (e) { console.error('[recipe_image jpeg]', e.message); }
      }
      return res.json({ mimeType: mime, data: inline.data });
    }

    // ── Fit it in: plan portions of food they already have to a calorie amount ──
    if (type === 'plan_portions') {
      const { text: haveText, base64, budget, userCountry } = data;
      const target = Math.max(100, Math.min(3000, Math.round(Number(budget) || 0)));
      if (!haveText && !base64) return res.status(400).json({ error: 'Tell us what food you have' });
      const parts = [{
        text: `The person already has this food (they bought it or it's at home, so they don't know exactly how it was made)${haveText ? `: "${String(haveText).slice(0, 600)}"` : ' (see the photo)'}.\n` +
          `They want to eat about ${target} kcal of it now.${userCountry ? ` They live in ${userCountry}; use local dish names and the usual local way of preparing each food, oil included.` : ''}\n\n` +
          'Decide for EACH food whether they have it cooked or raw, from their words: "uncooked", "raw", "dry", "not cooked yet" mean raw; "cooked", "leftover", "already made", a finished dish (soup, stew, jollof) mean cooked. If they don\'t say, a finished dish is cooked and a plain ingredient people buy raw (rice grains, dry beans, raw eggs, raw meat or fish, flour) is raw. A RAW food is planned in RAW amounts, what they measure before cooking it (e.g. "Rice (uncooked)", unit "cup uncooked", nutrition per 100 g raw); a COOKED food in cooked amounts as served, oil it was cooked in included. Put "(uncooked)" in a raw food\'s name (not eggs: just "Eggs"). Eggs are counted in eggs (unit "egg"/"eggs", about 50 g each) and never called boiled or fried unless they said so. Identify each distinct food. For each give realistic nutrition per 100 g in that state, a household measure people use for it (unitOne and unitMany, e.g. "cup cooked"/"cups cooked", "ladle"/"ladles", "piece"/"pieces", "slice"/"slices", "medium fish"/"medium fish") and how many grams one of that measure weighs (unitGrams).\n' +
          `Then plan grams of each so the plate totals ${target} kcal (within 5%). Favour protein and vegetables so it keeps them full: when they have a protein food (eggs, fish, meat, beans) use a generous share of what they have before adding starch, keep starch (rice, yam, bread, fufu) to about a third of the calories, never more than half, and keep fried foods moderate. Never plan more of a food than they said they have (e.g. at most 5 eggs if they have five). Give every food they have at least a small portion unless it is only a condiment.\n` +
          'tip: one short, practical sentence about THESE foods only, never telling them to add or buy something they did not mention. Make it specific to what they have: which food to take more or less of and why (e.g. "Take the extra piece of chicken instead of more rice: the protein keeps you full longer"), eating the protein or soup first, leaving visible oil or skin, or saving part for later. Do not start with "To feel fuller" or "Consider". No medical claims, no guilt, never suggest skipping meals.\n' +
          'If there is no food at all, set isFood to false and say what you see in whatIsItIfNotFood.',
      }];
      if (base64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64 } });
      const raw = await callGemini(GEMINI_KEY, parts, { systemInstruction: `${NUTRITION_SYSTEM}\n\n${MEDICAL_SAFETY}`, schema: PORTION_PLAN_SCHEMA });
      const parsed = parseJson(raw);
      if (!parsed) return res.status(500).json({ error: 'Could not plan that meal. Try again.' });
      if (!parsed.isFood) return res.json({ notFood: true, identified: parsed.whatIsItIfNotFood || '' });

      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      let foods = (parsed.foods || []).filter((f) => f && f.name && num(f.kcal100) > 0).slice(0, 8).map((f) => ({
        name: String(f.name),
        kcal100: num(f.kcal100), protein100: num(f.protein100), carbs100: num(f.carbs100), fat100: num(f.fat100),
        fiber100: num(f.fiber100), sugar100: num(f.sugar100), sodium100: num(f.sodium100),
        unitGrams: Math.max(5, num(f.unitGrams) || 100), unitOne: f.unitOne || 'serving', unitMany: f.unitMany || f.unitOne || 'servings',
        grams: Math.max(0, num(f.grams)),
      }));
      if (!foods.length) return res.json({ notFood: true, identified: '' });
      // Hold the plan to the amount they chose: scale every portion if the model's total drifted.
      const total = foods.reduce((s, f) => s + (f.kcal100 * f.grams) / 100, 0);
      const factor = total > 0 ? target / total : 1;
      if (total <= 0 || Math.abs(factor - 1) > 0.05) {
        foods = foods.map((f) => ({ ...f, grams: total > 0 ? f.grams * factor : (target / foods.length / f.kcal100) * 100 }));
      }
      foods = foods.map((f) => ({ ...f, grams: Math.max(5, Math.round(f.grams / 5) * 5) }));
      return res.json({ title: parsed.title || null, tip: parsed.tip || '', foods });
    }

    // ── Nutrition lookup ─────────────────────────────────────────────────────
    // ── Vitamins and minerals for a whole meal (Logga Pro, shown under the meal) ──
    if (type === 'meal_micros') {
      return res.json({ micros: await microsForFoods(GEMINI_KEY, data.foods) });
    }

    // ── The same for several logged meals at once (Calorie Details > Micronutrients fills in older meals) ──
    if (type === 'meals_micros') {
      return res.json({ results: await microsForMeals(GEMINI_KEY, data.meals) });
    }

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
        text: `Food: "${foodName}"\nPrevious portion: ${oldQty} → cal: ${n?.cal ?? 0} kcal, protein: ${n?.protein ?? 0}g, carbs: ${n?.carbs ?? 0}g, fats: ${n?.fats ?? 0}g, fiber: ${n?.fiber ?? 0}g, sugar: ${n?.sugar ?? 0}g, sodium: ${n?.sodium ?? 0}mg\nNew portion: "${newQty}"\n\nIf the new portion is a precise weight or volume (e.g. 200g, 150ml, 3oz), calculate directly from nutrition knowledge for that exact amount and return the qty as that exact figure verbatim — do not convert it into an approximate description.\nIf same unit type but different quantity, scale proportionally.\nIf the unit type changed without a precise weight, recalculate from scratch.\nIf the new portion text contains a food name (e.g. "1.5 cups of beans"), use that as the name.`,
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

    // ── Momentum "See why" breakdown ─────────────────────────────────────────
    if (type === 'momentum_why') {
      const text = await callGemini(GEMINI_KEY, [
        { text: `TODAY'S MOMENTUM DATA:\n${JSON.stringify(data)}` },
      ], { systemInstruction: `${MOMENTUM_WHY_SYSTEM}\n\n${MEDICAL_SAFETY}${withVoice(data)}`, schema: MOMENTUM_WHY_SCHEMA });

      const parsed = parseJson(text);
      if (!parsed) return res.status(500).json({ error: 'Could not parse momentum why' });
      return res.json({
        headline: parsed.headline || null,
        connector: parsed.connector || null,
        eating: parsed.eating || null,
        satiety: parsed.satiety || null,
        movement: parsed.movement || null,
      });
    }

    // ── Burnout likelihood: plain-language explanation ───────────────────────
    if (type === 'burnout_why') {
      const text = await callGemini(GEMINI_KEY, [
        { text: `THIS WEEK'S BURNOUT DATA:\n${JSON.stringify(data)}` },
      ], { systemInstruction: `${BURNOUT_WHY_SYSTEM}\n\n${MEDICAL_SAFETY}${withVoice(data)}`, schema: BURNOUT_WHY_SCHEMA });
      const parsed = parseJson(text);
      if (!parsed?.summary) return res.status(500).json({ error: 'Could not parse burnout why' });
      return res.json({ summary: parsed.summary, tip: parsed.tip || '', crashNote: parsed.crashNote || '' });
    }

    // ── Weekly pattern insight (replaces the old "big swing" template) ───────
    if (type === 'pattern_insight') {
      const text = await callGemini(GEMINI_KEY, [
        { text: `RECENT EATING DATA:\n${JSON.stringify(data)}` },
      ], { systemInstruction: `${PATTERN_INSIGHT_SYSTEM}\n\n${MEDICAL_SAFETY}${withVoice(data)}`, schema: PATTERN_INSIGHT_SCHEMA });
      const parsed = parseJson(text);
      if (!parsed?.body) return res.status(500).json({ error: 'Could not parse pattern insight' });
      return res.json({ title: parsed.title || null, body: parsed.body });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (e) {
    console.error('[/api/gemini]', type, e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' }); // the details are in the server log above
  }
}
