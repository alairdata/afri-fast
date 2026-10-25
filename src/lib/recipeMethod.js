// Kitchen recipes: the method's steps name their amounts as {n} (the nth ingredient). These fill them in from the
// ingredients' current grams for the whole pot, so the method always agrees with the ingredient list, including
// after someone edits a portion. Used by the server (api/gemini.js build_recipe) and the app (PortionPlanner).

const quarter = (n) => {
  const q = Math.round(n * 4) / 4, w = Math.floor(q), r = q - w;
  const f = r === 0.25 ? '¼' : r === 0.5 ? '½' : r === 0.75 ? '¾' : '';
  return (w === 0 && f ? '' : String(w)) + f || '0';
};

// "2 tbsp (30 g)" when there's a household measure that reads cleanly, else "30 g"
export function amountText({ grams, unitGrams, unitOne, unitMany }) {
  const g = Math.max(0, Math.round(grams || 0));
  const n = unitGrams > 0 ? g / unitGrams : 0;
  // only real kitchen measures (tbsp, cup, clove, slice, medium onion...), never "half ...", "several ...", "bowl"
  const realMeasure = !!unitOne && /^(tbsp|tsp|tablespoons?|teaspoons?|cups?|cloves?|slices?|pieces?|eggs?|fillets?|(small|medium|large)\b)/i.test(unitOne)
    && !/half|several|bowl|portion|serving|handful|plate/i.test(`${unitOne} ${unitMany || ''}`);
  // eggs, pieces, slices and fillets are counted whole: "3 eggs", never "2¾ eggs"
  if (realMeasure && /eggs?|pieces?|slices?|fillets?/i.test(unitOne)) {
    const c = Math.max(1, Math.round(n));
    return `${c} ${c === 1 ? unitOne : unitMany || unitOne}`;
  }
  const clean = realMeasure && n >= 0.25 && n <= 12 && Math.abs(Math.round(n * 4) / 4 - n) / n < 0.15;
  return clean ? `${quarter(n)} ${n > 1.125 ? unitMany || unitOne : unitOne} (${g} g)` : `${g} g`;
}

// ingredients: [{ name, grams (for the whole pot, or null when it was taken out), unitGrams, unitOne, unitMany }]
export function fillMethodStep(step, ingredients) {
  return String(step)
    .replace(/\{(\d+)\}/g, (m, k) => {
      const f = ingredients[Number(k) - 1];
      if (!f) return '';
      const name = String(f.name).toLowerCase();
      if (f.grams == null) return name;
      const amt = amountText(f);
      // the measure may already say what it is ("1 medium onion"): don't repeat the name
      return amt.toLowerCase().includes(name.split(/\s+/).pop()) ? amt : `${amt} ${name}`;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}
