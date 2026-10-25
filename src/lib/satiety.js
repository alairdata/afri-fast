// How satisfying a plate is and how long it keeps you full (Fit it in and kitchen recipes, "Your plate").
//
//   Satiety Score (0-100): how much food it is (stomach fill), its protein, its fibre, and how filling the foods
//   are (the Satiety Index of the closest measured food, Holt 1995; Rolls 2009 on food volume).
//   Fullness Window (hours) = 1.5 + Score / 25, nudged by the time of day (the body clock makes hunger lowest
//   around 8am and highest around 8pm, Scheer 2013; morning food is the most satiating, de Castro 2004), and never
//   more than 5 hours: a single meal is out of the stomach by then.
//   Energy Density (kcal/g) = calories / grams: watery, fibre-rich food fills more for its calories.
// Worked out from the food only, never from meal-log times (they don't show when someone actually got hungry).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const WINDOW_BASE_H = 1.5;
const SCORE_PER_HOUR = 25;
const WINDOW_CAP_H = 5;
const CLOCK_SWING = 0.075; // half the morning-to-evening difference

// The body-clock nudge for a meal eaten at `hour` (0-24): highest at 8am, lowest at 8pm, smooth in between.
export const timeOfDayFactor = (hour) => 1 + CLOCK_SWING * Math.cos((2 * Math.PI * (hour - 8)) / 24);
const TYPICAL_SI = 130; // an ordinary mixed plate

// Satiety Index (white bread = 100) of the closest food Holt et al. 1995 actually tested. Foods with no close
// match (soups, stews, sauces, salads, garden egg) are left out and judged on their make-up alone.
const SATIETY_INDEX = [
  [/garden ?egg|eggplant|aubergine|soup|stew|sauce|salad|shito|pepper/i, null],
  [/kelewele|fried plantain|dodo|chips|fries|fried yam|fried potato/i, 116], // French fries
  [/puff ?puff|doughnut|donut|bofrot|mandazi|\bbuns?\b/i, 68], // doughnuts
  [/croissant|pastry|meat ?pie|sausage roll/i, 47],
  [/cake|muffin/i, 65],
  [/chin ?chin|biscuit|cookie/i, 120],
  [/crisps|plantain chips/i, 91], // potato crisps
  [/ice ?cream/i, 96],
  [/yog(h)?urt/i, 88],
  [/groundnut|peanut|kuli ?kuli/i, 84],
  [/potato|yam|cassava|cocoyam|taro|ampesi|boiled plantain|unripe plantain/i, 323], // boiled potatoes
  [/oat|porridge|koko|\bpap\b|akamu|ogi|tom brown/i, 209], // porridge
  [/fish|tilapia|mackerel|sardine|wele|kpomo|shrimp|prawn|crab/i, 225], // ling fish
  [/beef|goat|chicken|turkey|meat|suya|steak|gizzard|liver|lamb/i, 176], // beef steak
  [/\beggs?\b/i, 150],
  [/beans|red red|akara|moi ?moi|cowpea|black-eyed/i, 168], // baked beans
  [/lentil|chickpea/i, 133],
  [/brown rice/i, 132],
  [/rice|jollof|waakye|benachin/i, 138], // white rice
  [/pasta|spaghetti|macaroni|noodle|indomie/i, 119],
  [/wholemeal|whole ?wheat|brown bread/i, 157],
  [/bread|toast|agege/i, 100],
  [/orange|tangerine/i, 202],
  [/apple/i, 197],
  [/grape/i, 162],
  [/banana/i, 118],
  [/popcorn/i, 154],
  [/cheese|wara/i, 146],
  [/fufu|banku|eba|kenkey|tuo|amala|pounded|semo|garri|gari/i, 138], // dense starch: closest tested is white rice
];
const siOf = (name = '') => { const hit = SATIETY_INDEX.find(([re]) => re.test(name)); return hit ? hit[1] : null; };

// Grams of a food: its own grams, the "(230 g)" in its amount, or, failing both, a typical 1.5 kcal per gram.
export const gramsOf = (f) => {
  if (Number(f.grams) > 0) return Number(f.grams);
  const m = String(f.qty || '').match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) return Number(m[1]);
  return (f.cal || 0) / 1.5;
};

export function estimateSatiety({ foods = [], at = new Date() } = {}) {
  const sum = (k) => foods.reduce((acc, f) => acc + (Number(f[k]) || 0), 0);
  const kcal = sum('cal'), protein = sum('protein'), fibre = sum('fiber');
  const grams = foods.reduce((acc, f) => acc + gramsOf(f), 0);
  if (kcal <= 0 && grams <= 0) return { hours: 0, score: 0, density: 0, level: 'Light', driver: null, protein: 0, grams: 0 };

  // How filling the foods are, weighted by their calories (only the ones the study measured).
  let siKcal = 0, siSum = 0, top = null;
  foods.forEach((f) => {
    const si = siOf(f.name);
    if (si == null || !(f.cal > 0)) return;
    siKcal += f.cal; siSum += si * f.cal;
    if (!top || si * f.cal > top.score) top = { name: f.name, si, score: si * f.cal };
  });
  const si = siKcal > 0 ? siSum / siKcal : TYPICAL_SI;

  // Satiety Score: stomach fill, protein, fibre, how filling the foods are.
  const score = Math.round(40 * Math.min(1, grams / 500) + 30 * Math.min(1, protein / 30) + 15 * Math.min(1, fibre / 8)
    + 15 * clamp((si - 47) / (323 - 47), 0, 1));
  const level = score >= 65 ? 'Very satisfying' : score >= 40 ? 'Satisfying' : 'Light';

  // Fullness Window: 1.5 h + 1 h for every 25 points, nudged by the time of day, at most 5 h.
  const clock = timeOfDayFactor(at.getHours() + at.getMinutes() / 60);
  const hours = Math.min(WINDOW_CAP_H, (WINDOW_BASE_H + score / SCORE_PER_HOUR) * clock);

  // Energy Density: calories per gram.
  const density = grams > 0 ? kcal / grams : 0;

  // The main reasons, in plain words.
  const reasons = [];
  if (top && top.si >= 200) reasons.push(`filling ${top.name.toLowerCase()}`);
  if (grams >= 400) reasons.push('a big plate');
  else if (grams - kcal / 2 >= 80) reasons.push('bulky but light');
  if (protein >= 20) reasons.push(`${Math.round(protein)}g of protein`);
  if (fibre >= 6) reasons.push(`${Math.round(fibre)}g of fibre`);
  if (!reasons.length && top && top.si <= 100) reasons.push(`${top.name.toLowerCase()} doesn't fill you for long`);
  const driver = reasons.length ? reasons.slice(0, 2).join(' and ') : null;

  return { hours, score, density, level, driver, protein, grams };
}

// "Full for ~3½ hrs": to the nearest half hour, as the plate card shows it.
export function formatHalfHours(hours) {
  const h = Math.max(0.5, Math.round(hours * 2) / 2);
  const whole = Math.floor(h), half = h - whole >= 0.5;
  const txt = (whole === 0 ? '' : String(whole)) + (half ? '½' : '');
  return `${txt} ${h <= 1 ? 'hr' : 'hrs'}`;
}


// The fullness profile drawn on the plate card, in its own 0-9 hour frame: a short settle after eating, then a
// slow fade that crosses the "Hungry" line (25%) exactly at `hours`.
export const PROFILE = { x0: 48, x1: 330, top: 20, bot: 180, spanH: 9, hungry: 25 };
export function satietyProfile(hours) {
  const { x0, x1, top, bot, spanH, hungry } = PROFILE;
  const X = (t) => x0 + (t / spanH) * (x1 - x0), Y = (v) => bot - (v / 100) * (bot - top);
  const settle = 0.4, width = 0.9;
  const sig = (t, mid) => 1 / (1 + Math.exp((t - mid) / width));
  const full = (t, mid) => (t <= settle ? 100 - (t / settle) * 12 : 4 + (84 * sig(t, mid)) / sig(settle, mid));
  const cross = Math.max(settle + 0.2, Math.min(spanH, hours));
  let lo = -5, hi = 20;
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (full(cross, mid) < hungry) lo = mid; else hi = mid; }
  const mid = (lo + hi) / 2;
  const pts = [];
  for (let t = 0; t <= spanH + 1e-4; t += 0.1) pts.push(`${X(t).toFixed(1)} ${Y(full(t, mid)).toFixed(1)}`);
  const curve = `M${pts.join(' L')}`;
  const dotX = X(cross), late = dotX > 270;
  return {
    curve, area: `${curve} L${x1} ${bot} L${x0} ${bot} Z`,
    dotX, dotY: Y(hungry), late,
    labelX: late ? dotX - 6 : dotX + 6, labelY: Y(hungry) - 6,
    ticks: Array.from({ length: spanH + 1 }, (_, h) => ({ x: X(h), label: `${h}h` })),
  };
}
