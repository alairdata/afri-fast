-- Vitamins and minerals (Logga Pro): the AI's estimate for the whole meal, saved the first time it's worked out.
-- Keys and units are in src/lib/micros.js (e.g. {"b1": 0.4, "iron": 3.2, ...}); null until then.
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS micros JSONB;
