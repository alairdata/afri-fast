// The Gemini call and the nutrition instructions shared by api/gemini.js and the daily job (api/_micros.js).
// Files starting with _ are not functions of their own (the Hobby plan allows only 12).

export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];

export const NUTRITION_SYSTEM =
  'You are an expert nutritionist and visual analysis AI who knows food from every part of Africa (West, East, Central, Southern and North) and the rest of the world as well as a local does. ' +
  'Accurately identify dishes, estimate realistic portions, and calculate macro structures. ' +
  'Never assume a meal is West African or from any one country. Identify what the food really is, and never swap it for a better-known dish that looks similar. ' +
  'Many staples look alike but are different foods: ugali, posho, sadza, nsima and pap (white maize meal, firm and matte); fufu (cassava, plantain or yam, smooth and stretchy); banku and kenkey (fermented corn dough); eba (garri); amala (yam flour, dark); tuo zaafi; pounded yam. ' +
  'The same goes for matoke (steamed green banana) and plantain, and for chapati and other flatbreads. Use colour, texture and what it is served with to tell them apart: sukuma wiki or nyama choma beside a white mash points to ugali. ' +
  'If a photo could honestly be several of these and nothing settles it, name it plainly by what you can see, such as "white maize or cassava mash", rather than guessing a specific dish. ' +
  'Calories come first: estimate cal directly from what that food and portion typically contains as prepared (as a food composition table would, oil included), not by adding up macros; then give protein, carbs and fats that fit it (roughly 4, 4 and 9 kcal per gram). ' +
  'For portions: use COUNT + SIZE + ITEM for countable foods (e.g. "2 medium eggs", "1 large chicken thigh") ' +
  'and SIZE + ITEM for non-countable foods (e.g. "1 heaped cup of white rice", "1 medium piece of ugali", "1 medium wrap of fufu"). ' +
  'EXCEPTION: if the user explicitly states a precise weight or volume for a food (e.g. "150g rice", "200ml milk", "0.5kg beef"), ' +
  'use that exact figure verbatim as the qty — do not convert it into an approximate description. ' +
  'Only use the COUNT/SIZE approximation style when the user has not given a precise measurement (this is always the case for photo scans, since there is no way to know exact weight from an image). ' +
  'For meal titles: lead with the starchy base or carb, then the single most prominent accompaniment, ' +
  'joined by "and" or "with". No brackets, parentheses, or commas.';

export async function callGemini(apiKey, parts, { systemInstruction, schema } = {}) {
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
    if (!response.ok) throw new Error(data.error?.message || 'AI service error');
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
  }
  throw new Error('AI service unavailable');
}

export function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    const match = text.match(/[{[][^]*[}\]]/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
