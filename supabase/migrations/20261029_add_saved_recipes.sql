-- Saved recipes on the account (2026-10-29). They used to live only on the phone, so logging out (which wipes the
-- phone's copy) lost them. kind 'bookmark': a built-in recipe they saved (recipe_id only); kind 'custom': a recipe
-- built from their kitchen (the whole recipe in data, its photo already in Storage). Safe to run more than once.
CREATE TABLE IF NOT EXISTS saved_recipes (
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT        NOT NULL CHECK (kind IN ('bookmark', 'custom')),
  recipe_id  TEXT        NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, recipe_id)
);
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved recipes" ON saved_recipes;
CREATE POLICY "own saved recipes" ON saved_recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
