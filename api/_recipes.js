// Recipes are served by our server so nobody can copy the whole collection in one go:
//  - recipe_cards: every published recipe as a card (name, photo, calories, times, the names of its ingredients),
//    without amounts or method. Signed-in accounts only.
//  - recipe_detail: one recipe in full, when someone opens it. Each account can open RECIPE_DAILY_LIMIT different
//    recipes a day (default 40); opening one again the same day doesn't count. Restricted accounts are refused.
// The day's counts live in admin_settings under 'recipe_opens:YYYY-MM-DD' (admins only, so people can't reset them).
// Routed from api/gemini.js (type 'recipe_cards' / 'recipe_detail'), so this adds no new Vercel function.
import { userFromRequest } from './_purgeUser.js';
import { isRestricted } from './_aiAuth.js';

const sb = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });
const headers = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
const LIMIT = () => (Number(process.env.RECIPE_DAILY_LIMIT) > 0 ? Number(process.env.RECIPE_DAILY_LIMIT) : 40);

// What a card carries: enough for the grid, search, filters, matching by ingredient and logging; never the method.
export function cardOf(id, data) {
  const { instructions, note, tips, ingredients, ...rest } = data || {};
  return { ...rest, id, partial: true, ingredients: (ingredients || []).map((i) => ({ name: i?.name || '' })) };
}

async function published(filter = '') {
  const { url, key } = sb();
  const r = await fetch(`${url}/rest/v1/recipes?published=eq.true${filter}&select=id,data&order=sort.asc`, { headers: headers(key) });
  if (!r.ok) throw new Error(`recipes ${r.status}`);
  return r.json();
}

// Records that this account opened this recipe today; returns false once the day's limit is reached.
async function countOpen(userId, recipeId) {
  const { url, key } = sb();
  const day = new Date().toISOString().slice(0, 10);
  const name = `recipe_opens:${day}`;
  const r = await fetch(`${url}/rest/v1/admin_settings?key=eq.${encodeURIComponent(name)}&select=value`, { headers: headers(key) });
  if (!r.ok) return true; // can't count right now: let it through rather than break recipes
  const rows = await r.json();
  const value = rows?.[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {};
  const mine = Array.isArray(value[userId]) ? value[userId] : [];
  const id = String(recipeId);
  if (mine.includes(id)) return true;
  if (mine.length >= LIMIT()) {
    console.warn(`[recipes] daily limit reached for ${userId} (${mine.length})`);
    return false;
  }
  value[userId] = [...mine, id];
  await fetch(`${url}/rest/v1/admin_settings`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ key: name, value, updated_at: new Date().toISOString() }),
  }).catch(() => {});
  if (!rows?.length) {
    // First open of a new day: clear the older days' counts.
    fetch(`${url}/rest/v1/admin_settings?key=like.recipe_opens:*&key=neq.${encodeURIComponent(name)}`, { method: 'DELETE', headers: headers(key) }).catch(() => {});
  }
  return true;
}

export async function handleRecipes(req, res) {
  const { type, data } = req.body || {};
  let user = null;
  try { user = await userFromRequest(req); } catch (_) {}
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  if (await isRestricted(user.id)) return res.status(403).json({ error: 'This account is on hold.' });
  try {
    if (type === 'recipe_cards') {
      const rows = await published();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({ recipes: rows.map((r) => cardOf(r.id, r.data)) });
    }
    // recipe_detail
    const id = String(data?.id ?? '');
    if (!/^\d{1,12}$/.test(id)) return res.status(400).json({ error: 'Missing recipe' });
    const rows = await published(`&id=eq.${encodeURIComponent(id)}`);
    if (!rows.length) return res.status(404).json({ error: 'Recipe not found' });
    if (!(await countOpen(user.id, id))) {
      return res.status(429).json({ error: "You've opened a lot of recipes today. Please come back tomorrow for more." });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ recipe: { ...rows[0].data, id: rows[0].id } });
  } catch (e) {
    console.error('[recipes]', e.message);
    return res.status(500).json({ error: "Couldn't load recipes right now." });
  }
}
