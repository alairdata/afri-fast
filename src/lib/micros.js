// The essential vitamins and minerals shown under a meal (Logga Pro), in four groups. The AI estimates each one
// for the whole meal in the unit given here (api/gemini.js, type 'meal_micros'); dv is an adult's daily value in
// that unit (FDA Daily Values; adequate intakes where there's no DV), or null where none is set.
export const MICRO_GROUPS = [
  {
    title: 'Water-soluble vitamins',
    note: 'Not stored for long, so you need them often.',
    items: [
      { key: 'b1', name: 'Vitamin B1 (Thiamin)', unit: 'mg', dv: 1.2, what: 'Turns food into energy.' },
      { key: 'b2', name: 'Vitamin B2 (Riboflavin)', unit: 'mg', dv: 1.3, what: 'Energy, growth and fat use.' },
      { key: 'b3', name: 'Vitamin B3 (Niacin)', unit: 'mg', dv: 16, what: 'Releases energy, protects cells.' },
      { key: 'b5', name: 'Vitamin B5 (Pantothenic acid)', unit: 'mg', dv: 5, what: 'Makes hormones, breaks down fats.' },
      { key: 'b6', name: 'Vitamin B6 (Pyridoxine)', unit: 'mg', dv: 1.7, what: 'Red blood cells and brain messengers.' },
      { key: 'b7', name: 'Vitamin B7 (Biotin)', unit: 'µg', dv: 30, what: 'Hair, skin and nails.' },
      { key: 'b9', name: 'Vitamin B9 (Folate)', unit: 'µg', dv: 400, what: 'New cells and healthy pregnancies.' },
      { key: 'b12', name: 'Vitamin B12 (Cobalamin)', unit: 'µg', dv: 2.4, what: 'Nerves and red blood cells.' },
      { key: 'c', name: 'Vitamin C', unit: 'mg', dv: 90, what: 'Immunity and collagen.' },
    ],
  },
  {
    title: 'Fat-soluble vitamins',
    note: 'Absorbed with fat and stored in the body.',
    items: [
      { key: 'a', name: 'Vitamin A', unit: 'µg', dv: 900, what: 'Eyesight and skin.' },
      { key: 'd', name: 'Vitamin D', unit: 'µg', dv: 20, what: 'Helps you absorb calcium for strong bones.' },
      { key: 'e', name: 'Vitamin E', unit: 'mg', dv: 15, what: 'Protects your cells.' },
      { key: 'k', name: 'Vitamin K', unit: 'µg', dv: 120, what: 'Blood clotting and bones.' },
    ],
  },
  {
    title: 'Major minerals',
    note: 'Needed in larger amounts, for fluids and bones.',
    items: [
      { key: 'sodium', name: 'Sodium', unit: 'mg', dv: 2300, what: 'Fluid balance and muscles.' },
      { key: 'potassium', name: 'Potassium', unit: 'mg', dv: 4700, what: 'Heartbeat, nerves and fluids.' },
      { key: 'calcium', name: 'Calcium', unit: 'mg', dv: 1300, what: 'Bones, teeth and muscles.' },
      { key: 'magnesium', name: 'Magnesium', unit: 'mg', dv: 420, what: 'Muscles, nerves and energy.' },
      { key: 'phosphorus', name: 'Phosphorus', unit: 'mg', dv: 1250, what: 'Bones and cell energy.' },
      { key: 'chloride', name: 'Chloride', unit: 'mg', dv: 2300, what: 'Fluid balance and stomach acid.' },
      { key: 'sulfur', name: 'Sulfur', unit: 'mg', dv: null, what: 'Hair, skin and cartilage (from protein).' },
    ],
  },
  {
    title: 'Trace minerals',
    note: 'Tiny amounts, but each one matters.',
    items: [
      { key: 'iron', name: 'Iron', unit: 'mg', dv: 18, what: 'Carries oxygen in your blood.' },
      { key: 'zinc', name: 'Zinc', unit: 'mg', dv: 11, what: 'Healing, immunity and taste.' },
      { key: 'iodine', name: 'Iodine', unit: 'µg', dv: 150, what: 'Thyroid and metabolism.' },
      { key: 'selenium', name: 'Selenium', unit: 'µg', dv: 55, what: 'Protects your thyroid and cells.' },
      { key: 'copper', name: 'Copper', unit: 'mg', dv: 0.9, what: 'Iron use, blood vessels and nerves.' },
      { key: 'manganese', name: 'Manganese', unit: 'mg', dv: 2.3, what: 'Carb use and bones.' },
      { key: 'fluoride', name: 'Fluoride', unit: 'mg', dv: 4, what: 'Strong teeth.' },
      { key: 'chromium', name: 'Chromium', unit: 'µg', dv: 35, what: 'Helps insulin manage blood sugar.' },
      { key: 'molybdenum', name: 'Molybdenum', unit: 'µg', dv: 45, what: 'Helps break down toxins.' },
    ],
  },
];

export const MICRO_ITEMS = MICRO_GROUPS.flatMap((g) => g.items);
