// How satisfying a plate is and how long until hunger returns ("Full for ~X" on Fit it in's Your plate).
// Two separate questions, worked out from the food and the person's body (never from meal-log times, which
// don't show when someone actually got hungry):
//
//   How satisfying: how much food it is (stomach fill), its protein, its fibre, and how filling the foods are
//   (the Satiety Index of the closest measured food, Holt 1995; Rolls 2009 on food volume; Weigle 2005 on
//   protein; Wanders 2011 on fibre).
//
//   How long: modelled on stomach emptying. Solid food waits about 20 minutes, then a mixed meal leaves the
//   stomach at roughly 2.5 kcal a minute (Hunt 1985; Brener 1983). Protein, fat and fibre slow it; bulky,
//   low-calorie food (vegetables, soup solids) takes extra room and time; the Satiety Index scales it; and a
//   bigger daily energy burn (weight, height, age, activity) uses the meal up a little sooner.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const LAG_MIN = 20;
const KCAL_PER_MIN = 2.5;
const BULK_MIN_PER_G = 0.25;
const REF_TDEE = 2200;
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

export function estimateSatiety({ foods = [], tdee } = {}) {
  const sum = (k) => foods.reduce((s, f) => s + (Number(f[k]) || 0), 0);
  const kcal = sum('cal'), protein = sum('protein'), fat = sum('fats'), fibre = sum('fiber');
  const grams = foods.reduce((s, f) => s + gramsOf(f), 0);
  if (kcal <= 0 && grams <= 0) return { hours: 0, level: 'Light', driver: null, protein: 0 };

  // How filling the foods are, weighted by their calories (only the ones the study measured).
  let siKcal = 0, siSum = 0, top = null;
  foods.forEach((f) => {
    const si = siOf(f.name);
    if (si == null || !(f.cal > 0)) return;
    siKcal += f.cal; siSum += si * f.cal;
    if (!top || si * f.cal > top.score) top = { name: f.name, si, score: si * f.cal };
  });
  const coverage = kcal > 0 ? siKcal / kcal : 0;
  const si = siKcal > 0 ? siSum / siKcal : TYPICAL_SI;

  // How long: stomach emptying.
  const proteinShare = kcal > 0 ? (protein * 4) / kcal : 0;
  const fatShare = kcal > 0 ? (fat * 9) / kcal : 0;
  const slow = clamp(1 + 0.5 * (proteinShare - 0.15) + 0.3 * (fatShare - 0.3) + 0.02 * fibre, 0.85, 1.4);
  const energyMin = (kcal / KCAL_PER_MIN) * slow;
  const bulkMin = Math.max(0, grams - kcal / 2) * BULK_MIN_PER_G;
  const fSI = Math.pow(clamp(si, 47, 323) / TYPICAL_SI, 0.5 * coverage);
  const body = tdee ? clamp(Math.sqrt(REF_TDEE / tdee), 0.8, 1.25) : 1;
  const minutes = (LAG_MIN + energyMin + bulkMin) * fSI * body;

  // How satisfying: stomach fill, protein, fibre, how filling the foods are.
  const score = 40 * Math.min(1, grams / 500) + 30 * Math.min(1, protein / 30) + 15 * Math.min(1, fibre / 8)
    + 15 * clamp((si - 47) / (323 - 47), 0, 1);
  const level = score >= 65 ? 'Very satisfying' : score >= 40 ? 'Satisfying' : 'Light';

  // The main reasons, in plain words.
  const reasons = [];
  if (top && top.si >= 200) reasons.push(`filling ${top.name.toLowerCase()}`);
  if (grams >= 400) reasons.push('a big plate');
  else if (grams - kcal / 2 >= 80) reasons.push('bulky but light');
  if (protein >= 20) reasons.push(`${Math.round(protein)}g of protein`);
  if (fibre >= 6) reasons.push(`${Math.round(fibre)}g of fibre`);
  if (!reasons.length && top && top.si <= 100) reasons.push(`${top.name.toLowerCase()} doesn't fill you for long`);
  const driver = reasons.length ? reasons.slice(0, 2).join(' and ') : null;

  return { hours: minutes / 60, level, score, driver, protein, grams };
}

// The estimate as it is, to the minute: "37 mins", "1 hr", "3 hrs 8 mins".
export function formatFullFor(hours) {
  const total = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(total / 60), m = total % 60;
  const hrs = h === 0 ? '' : h === 1 ? '1 hr' : `${h} hrs`;
  const mins = m === 0 ? '' : m === 1 ? '1 min' : `${m} mins`;
  return [hrs, mins].filter(Boolean).join(' ');
}

// The fullness curve drawn on the chart, shaped so it drops below the "hungry again" line at `hours`.
export function satietyCurve(hours, { width = 318, top = 18, bot = 108, hungry = 35 } = {}) {
  // Short spans (a snack) zoom the chart in to 2 hours; long ones stretch past 6.
  const span = hours < 1.5 ? 2 : Math.max(6, Math.ceil(hours + 1));
  const rise = Math.max(0.01, Math.min(0.35, hours / 5));
  const full = (t, tau) => 100 * (1 - Math.exp(-t / rise)) * Math.exp(-t / tau);
  let lo = 0.2, hi = 60;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (full(hours, mid) < hungry) lo = mid; else hi = mid; }
  const tau = (lo + hi) / 2;
  const X = (t) => (t / span) * width, Y = (v) => bot - (v / 100) * (bot - top);
  const pts = [];
  for (let t = 0; t <= span + 1e-4; t += span / 60) pts.push(`${X(t).toFixed(1)} ${Y(full(t, tau)).toFixed(1)}`);
  const curve = `M${pts.join(' L')}`;
  const ticks = span === 2 ? [0, 2 / 3, 4 / 3, 2] : span <= 6 ? [0, 2, 4, 6] : [0, Math.round(span / 3), Math.round((2 * span) / 3), span];
  const tickLabel = (t) => {
    if (t === 0) return 'Now';
    const m = Math.round(t * 60);
    if (m < 60) return `${m}m`;
    return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
  };
  return {
    curve, area: `${curve} L${width} ${bot} L0 ${bot} Z`,
    hungerY: Y(hungry), dotX: X(Math.min(hours, span)),
    ticks: ticks.map(tickLabel),
  };
}
