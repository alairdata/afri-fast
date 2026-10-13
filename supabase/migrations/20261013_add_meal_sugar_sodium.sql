-- Advanced nutrition (Logga Pro): sugar in grams and sodium in milligrams per meal, next to fiber.
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS sugar NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sodium NUMERIC DEFAULT 0;
