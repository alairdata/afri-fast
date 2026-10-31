// Working out a meal's micronutrients (app side; lib/micros.js stays free of app code because the server uses it).
// One answer per set of foods: a second ask while the first is still running waits for it instead of asking the
// AI again, so starting early (as soon as a scan's foods are known) and the meal's card showing later share a call.
import { callGeminiApi } from './geminiApi';
import { microsCache } from './micros';

const inflight = new Map(); // foods signature -> promise of micros

export const microsSig = (foods) => (foods || []).map((f) => `${f.name}|${f.qty || ''}|${Math.round(f.cal || 0)}`).join(';');

/** The micros for these foods: from this session, or worked out now. Resolves null when the AI gives nothing. */
export function getMicrosFor(foods) {
  const sig = microsSig(foods);
  if (!sig) return Promise.resolve(null);
  if (microsCache.has(sig)) return Promise.resolve(microsCache.get(sig));
  if (inflight.has(sig)) return inflight.get(sig);
  const p = callGeminiApi('meal_micros', { foods })
    .then((res) => { if (res?.micros) microsCache.set(sig, res.micros); return res?.micros || null; })
    .finally(() => inflight.delete(sig));
  inflight.set(sig, p);
  return p;
}
