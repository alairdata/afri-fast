// How long a plate is likely to keep someone full ("Full for ~X hrs" on Fit it in's Your plate).
//
// The measure is the satiety ratio: minutes until the next meal per kcal eaten (de Castro & Elmore 1988).
//   1. A starting ratio from the person's own energy use: their daily burn (TDEE, from weight, height, age,
//      activity and, once there is history, their logs) spread over the waking day. A bigger burn means the
//      same plate runs out sooner.
//   2. What the plate is made of: measured Satiety Index values of the closest common foods (Holt 1995:
//      boiled potatoes most filling, croissants least), protein (Weigle 2005), fibre (Wanders 2011) and energy
//      density (Rolls 2009). Each effect is bounded to a realistic size.
//   3. Their own meal log: how long they actually go after a meal of a given size before logging the next
//      one. It takes over gradually as meals build up; overnight gaps and batch-logged meals are ignored.

const WAKING_MIN = 16 * 60;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Satiety Index (white bread = 100) of the closest measured food, Holt et al. 1995. African foods are mapped
// to the nearest food that was actually tested; foods with no close match (soups, stews, sauces) are left out
// and the plate is judged on its other foods and its make-up.
const SATIETY_INDEX = [
  [/kelewele|fried plantain|dodo|chips|fries|fried yam|fried potato/i, 116], // French fries
  [/puff ?puff|doughnut|donut|bofrot|mandazi|buns?\b/i, 68], // doughnuts
  [/croissant|pastry|meat ?pie|sausage roll/i, 47],
  [/cake|muffin/i, 65],
  [/chin ?chin|biscuit|cookie/i, 120],
  [/crisps|plantain chips/i, 91], // potato crisps
  [/ice ?cream/i, 96],
  [/yog(h)?urt/i, 88],
  [/groundnut|peanut|kuli ?kuli/i, 84],
  [/potato|yam|cassava|cocoyam|taro|ampesi|boiled plantain|unripe plantain/i, 323], // boiled potatoes
  [/oat|porridge|koko|\bpap\b|akamu|ogi|tom brown|hausa koko/i, 209], // porridge
  [/fish|tilapia|mackerel|sardine|wele|kpomo|shrimp|prawn|crab/i, 225], // ling fish
  [/beef|goat|chicken|turkey|meat|suya|steak|gizzard|liver|lamb/i, 176], // beef steak
  [/egg/i, 150],
  [/beans|red red|akara|moi ?moi|cowpea|black-eyed/i, 168], // baked beans
  [/lentil|chickpea/i, 133],
  [/brown rice/i, 132],
  [/rice|jollof|waakye|fried rice|benachin/i, 138], // white rice
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
const TYPICAL_SI = 130; // a mixed everyday plate

// How much longer (or shorter) than an average plate of the same calories this one should keep them full.
export function plateFactor(foods = []) {
  const kcal = foods.reduce((s, f) => s + (f.cal || 0), 0);
  if (kcal <= 0) return { factor: 1, driver: null };
  const g = (k) => foods.reduce((s, f) => s + (Number(f[k]) || 0), 0);
  const protein = g('protein'), fat = g('fats'), fibre = g('fiber');
  const grams = foods.reduce((s, f) => { const m = String(f.qty || '').match(/(\d+(?:\.\d+)?)\s*g\b/); return s + (m ? Number(m[1]) : 0); }, 0);

  // Satiety Index of the foods we can match, weighted by their calories.
  let siKcal = 0, siSum = 0, top = null;
  foods.forEach((f) => {
    const si = siOf(f.name);
    if (si == null || !(f.cal > 0)) return;
    siKcal += f.cal; siSum += si * f.cal;
    if (!top || si * f.cal > top.score) top = { name: f.name, si, score: si * f.cal };
  });
  const coverage = siKcal / kcal;
  const si = siKcal > 0 ? siSum / siKcal : TYPICAL_SI;
  const fSI = Math.pow(clamp(si, 47, 323) / TYPICAL_SI, 0.3 * coverage);

  // The make-up effects overlap with the Satiety Index (it already reflects them), so they count for less when
  // most of the plate was matched.
  const damp = 1 - 0.5 * coverage;
  const proteinShare = (protein * 4) / kcal, fatShare = (fat * 9) / kcal;
  const fProtein = 1 + damp * clamp((proteinShare - 0.15) * 1.0, -0.08, 0.2);
  const fFibre = 1 + damp * clamp((fibre - 5) * 0.012, -0.05, 0.12);
  const fFat = 1 + damp * clamp((fatShare - 0.3) * 0.25, -0.04, 0.05);
  const density = grams > 0 ? kcal / grams : null;
  const fDensity = density == null ? 1 : 1 + damp * clamp((1.6 - density) * 0.08, -0.1, 0.1);

  const factor = clamp(fSI * fProtein * fFibre * fFat * fDensity, 0.6, 1.6);
  let driver = null;
  if (top && top.si >= 160) driver = `the ${top.name.toLowerCase()} and ${Math.round(protein)}g of protein`;
  else if (proteinShare >= 0.22) driver = `${Math.round(protein)}g of protein`;
  else if (fibre >= 8) driver = `${Math.round(fibre)}g of fibre`;
  else if (top && top.si <= 100) driver = null;
  return { factor, driver, protein, fibre };
}

// Their own satiety ratio from the meal log: gap to the next logged meal per kcal, with the plate effect taken
// out so meals of any make-up compare fairly.
export function personalRatio(meals = []) {
  const timed = (meals || [])
    .map((m) => ({ ...m, t: m.timestamp || (typeof m.id === 'number' ? m.id : NaN) }))
    .filter((m) => Number.isFinite(m.t) && (m.calories || 0) >= 100)
    .sort((a, b) => a.t - b.t);
  const ratios = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i], b = timed[i + 1];
    if (new Date(a.t).toDateString() !== new Date(b.t).toDateString()) continue; // overnight
    const gapMin = (b.t - a.t) / 60000;
    if (gapMin < 45 || gapMin > 7 * 60) continue; // batch-logged, or a missed log in between
    const foods = Array.isArray(a.foods) && a.foods.length
      ? a.foods
      : [{ name: a.name, cal: a.calories, protein: a.protein, fats: a.fats, fiber: a.fiber }];
    ratios.push(gapMin / a.calories / plateFactor(foods).factor);
  }
  if (ratios.length < 3) return { ratio: null, n: ratios.length };
  ratios.sort((x, y) => x - y);
  return { ratio: ratios[Math.floor(ratios.length / 2)], n: ratios.length };
}

// The estimate for a plate: hours until hungry again, a High/Medium/Low label, and what it's based on.
export function estimateSatiety({ foods = [], tdee, meals = [] }) {
  const kcal = foods.reduce((s, f) => s + (f.cal || 0), 0);
  const base = WAKING_MIN / clamp(tdee || 2000, 1200, 4500); // minutes per kcal
  const mine = personalRatio(meals);
  let ratio = base;
  if (mine.ratio) {
    const w = mine.n / (mine.n + 10);
    ratio = Math.exp(w * Math.log(clamp(mine.ratio, base * 0.5, base * 2)) + (1 - w) * Math.log(base));
  }
  const plate = plateFactor(foods);
  const hours = clamp((kcal * ratio * plate.factor) / 60, kcal > 0 ? 0.5 : 0, 7);
  return {
    hours,
    level: hours >= 4 ? 'High' : hours >= 2.5 ? 'Medium' : 'Low',
    driver: plate.driver,
    protein: plate.protein || 0,
    personal: !!mine.ratio,
    mealsUsed: mine.n,
  };
}

// The fullness curve drawn on the chart, shaped so it drops below the "hungry again" line at `hours`.
export function satietyCurve(hours, { width = 318, top = 18, bot = 108, hungry = 35 } = {}) {
  const span = Math.max(6, Math.ceil(hours + 1));
  const full = (t, tau) => 100 * (1 - Math.exp(-t / 0.35)) * Math.exp(-t / tau);
  let lo = 0.2, hi = 60;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (full(hours, mid) < hungry) lo = mid; else hi = mid; }
  const tau = (lo + hi) / 2;
  const X = (t) => (t / span) * width, Y = (v) => bot - (v / 100) * (bot - top);
  const pts = [];
  for (let t = 0; t <= span + 1e-4; t += span / 60) pts.push(`${X(t).toFixed(1)} ${Y(full(t, tau)).toFixed(1)}`);
  const curve = `M${pts.join(' L')}`;
  const ticks = span <= 6 ? [0, 2, 4, 6] : [0, Math.round(span / 3), Math.round((2 * span) / 3), span];
  return {
    curve, area: `${curve} L${width} ${bot} L0 ${bot} Z`,
    hungerY: Y(hungry), dotX: X(Math.min(hours, span)),
    ticks: ticks.map((t) => (t === 0 ? 'Now' : `${t}h`)),
  };
}
