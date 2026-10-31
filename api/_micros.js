// Meal micronutrients (the 29 in src/lib/micros.js), worked out by the AI for one meal or several at once, and the
// daily job that fills them in for every saved meal that doesn't have them yet, so the app only has to read them.
import { MICRO_ITEMS } from '../src/lib/micros.js';
import { callGemini, parseJson, NUTRITION_SYSTEM } from './_gemini.js';

// A meal's foods as lines for the prompt ("- Jollof rice, 1 cup (320 kcal)").
export const foodLines = (foods) => (Array.isArray(foods) ? foods : []).slice(0, 20)
  .map((f) => `- ${String(f?.name || '').slice(0, 80)}${f?.qty ? `, ${String(f.qty).slice(0, 60)}` : ''}${f?.cal ? ` (${Math.round(f.cal)} kcal)` : ''}`)
  .filter((l) => l.length > 2)
  .join('\n');

// Every micronutrient as a non-negative number (unknown or invalid = 0), 2 decimals.
export const cleanMicros = (r) => {
  const out = {};
  MICRO_ITEMS.forEach((m) => { const v = Number(r?.[m.key]); out[m.key] = v >= 0 && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; });
  return out;
};

const UNITS = () => MICRO_ITEMS.map((m) => `${m.key} = ${m.name} in ${m.unit}`).join('; ');
const props = () => Object.fromEntries(MICRO_ITEMS.map((m) => [m.key, { type: 'NUMBER', description: `${m.name} in ${m.unit}` }]));

/** One meal: its foods -> micros, or null. */
export async function microsForFoods(apiKey, foods) {
  const lines = foodLines(foods);
  if (!lines) return null;
  const text = await callGemini(apiKey, [{
    text: `Estimate the vitamins and minerals in this whole meal, as prepared (cooking oil, salt and seasoning cubes included), the way a food composition table would. Add up all the foods.\n\n${lines}\n\n` +
      `Give each value for the whole meal in exactly this unit: ${UNITS()}. ` +
      'Use realistic amounts for these foods and portions; 0 only when the meal really has none of it.',
  }], { systemInstruction: NUTRITION_SYSTEM, schema: { type: 'OBJECT', properties: props(), required: MICRO_ITEMS.map((m) => m.key) } });
  const parsed = parseJson(text);
  return parsed ? cleanMicros(parsed) : null;
}

/** Up to 8 meals at once: [{ id, foods }] -> { [id]: micros }. */
export async function microsForMeals(apiKey, list) {
  const meals = (Array.isArray(list) ? list : []).slice(0, 8)
    .map((m) => ({ id: String(m.id), foods: foodLines(m.foods) }))
    .filter((m) => m.foods);
  if (!meals.length) return {};
  const text = await callGemini(apiKey, [{
    text: 'For EACH meal below, estimate the vitamins and minerals in the whole meal, as prepared (cooking oil, salt and seasoning cubes included), the way a food composition table would. Add up the foods within each meal; keep meals separate and return one entry per meal with its id.\n\n' +
      meals.map((m) => `MEAL id=${m.id}\n${m.foods}`).join('\n\n') +
      `\n\nGive each value per meal in exactly this unit: ${UNITS()}. ` +
      'Use realistic amounts for these foods and portions; 0 only when the meal really has none of it.',
  }], {
    systemInstruction: NUTRITION_SYSTEM,
    schema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, ...props() }, required: ['id', ...MICRO_ITEMS.map((m) => m.key)] } },
  });
  const parsed = parseJson(text);
  const results = {};
  (Array.isArray(parsed) ? parsed : []).forEach((r) => {
    if (r && meals.some((m) => m.id === String(r.id))) results[String(r.id)] = cleanMicros(r);
  });
  return results;
}

// What the AI needs for a saved meal: its foods, else its name and calories.
const foodsOfRow = (m) => (Array.isArray(m.foods) && m.foods.length ? m.foods : m.name ? [{ name: m.name, cal: m.calories }] : []);

/**
 * The daily job: newest meals without micros first, up to `limit` a run (8 per AI call), each saved as soon as
 * it's known. Returns { checked, filled, errors }.
 */
export async function fillMissingMicros({ limit = 160 } = {}) {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const base = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!key || !base || !service) return { skipped: 'not configured' };
  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${base}/rest/v1/meals?micros=is.null&select=id,name,calories,foods&order=logged_at.desc&limit=${limit}`, { headers });
  if (!r.ok) return { error: `load ${r.status}` };
  const rows = (await r.json()).filter((m) => foodsOfRow(m).length);
  const out = { checked: rows.length, filled: 0, errors: 0 };
  for (let i = 0; i < rows.length; i += 8) {
    const batch = rows.slice(i, i + 8);
    let results = {};
    try { results = await microsForMeals(key, batch.map((m) => ({ id: m.id, foods: foodsOfRow(m) }))); } catch (e) { out.errors++; continue; }
    for (const [id, micros] of Object.entries(results)) {
      const u = await fetch(`${base}/rest/v1/meals?id=eq.${encodeURIComponent(id)}&micros=is.null`, { method: 'PATCH', headers, body: JSON.stringify({ micros }) });
      if (u.ok) out.filled++; else out.errors++;
    }
  }
  return out;
}
