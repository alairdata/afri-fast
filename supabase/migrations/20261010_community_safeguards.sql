-- Community meal photos ("How others ate this meal"): App Store guideline 1.2 (user-generated content) and 5.1.2
-- (no sharing without permission). Sharing became opt-in in the app; this adds what the guideline asks for:
-- reporting (a reported photo is hidden for everyone straight away until it is reviewed), blocking (hide one
-- person's photos), and no personal data on the shared rows.

-- 1. Who posted each photo (for blocking and moderation) and whether it is hidden.
ALTER TABLE recipe_community_photos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE recipe_community_photos ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

-- Fill in the poster for existing rows from their meal.
UPDATE recipe_community_photos p
SET user_id = m.user_id
FROM meals m
WHERE p.user_id IS NULL AND m.id::text = p.meal_id::text;

-- 2. Nothing shared before sharing was opt-in was shared with consent, so hide all of it.
UPDATE recipe_community_photos SET hidden = true;

-- 3. No email addresses on shared rows. Older app builds still send one, and they share without asking,
--    so strip the email and hide anything that arrives without a user_id (only builds before opt-in do that).
UPDATE recipe_community_photos SET user_email = NULL WHERE user_email IS NOT NULL;

CREATE OR REPLACE FUNCTION community_photo_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_email := NULL;
  IF NEW.user_id IS NULL THEN NEW.hidden := true; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS community_photo_before_insert ON recipe_community_photos;
CREATE TRIGGER community_photo_before_insert
  BEFORE INSERT ON recipe_community_photos
  FOR EACH ROW EXECUTE FUNCTION community_photo_before_insert();

-- 4. Hidden photos are invisible to everyone except the person who posted them. RESTRICTIVE, so it applies on
--    top of whatever select policy the table already has.
ALTER TABLE recipe_community_photos ENABLE ROW LEVEL SECURITY;

-- The base rules, stated explicitly so this works whether or not the table had policies before:
-- signed-in people can see community photos, and add or remove only their own.
DROP POLICY IF EXISTS "Signed-in users can view community photos" ON recipe_community_photos;
CREATE POLICY "Signed-in users can view community photos"
  ON recipe_community_photos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users share their own community photos" ON recipe_community_photos;
CREATE POLICY "Users share their own community photos"
  ON recipe_community_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users remove their own community photos" ON recipe_community_photos;
CREATE POLICY "Users remove their own community photos"
  ON recipe_community_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hidden community photos are not shown" ON recipe_community_photos;
CREATE POLICY "Hidden community photos are not shown"
  ON recipe_community_photos AS RESTRICTIVE FOR SELECT
  USING (hidden = false OR user_id = auth.uid());

-- 5. Reports. Anyone signed in can report a photo; it is hidden at once and waits for review in the dashboard
--    (set hidden back to false to restore it, or delete the row to remove it).
CREATE TABLE IF NOT EXISTS community_reports (
  id          BIGSERIAL   PRIMARY KEY,
  photo_id    TEXT        NOT NULL,
  reporter_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT,
  reviewed    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can report photos" ON community_reports;
CREATE POLICY "Users can report photos"
  ON community_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_reports_created_at ON community_reports(created_at DESC);

CREATE OR REPLACE FUNCTION hide_reported_community_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE recipe_community_photos SET hidden = true WHERE id::text = NEW.photo_id::text;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hide_reported_community_photo ON community_reports;
CREATE TRIGGER hide_reported_community_photo
  AFTER INSERT ON community_reports
  FOR EACH ROW EXECUTE FUNCTION hide_reported_community_photo();

-- 6. Blocks: a person can hide everything another user has shared.
CREATE TABLE IF NOT EXISTS community_blocks (
  blocker_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own blocks" ON community_blocks;
CREATE POLICY "Users manage their own blocks"
  ON community_blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- Blocked people's photos never come back to the blocker.
DROP POLICY IF EXISTS "Blocked users' photos are not shown" ON recipe_community_photos;
CREATE POLICY "Blocked users' photos are not shown"
  ON recipe_community_photos AS RESTRICTIVE FOR SELECT
  USING (NOT EXISTS (
    SELECT 1 FROM community_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = recipe_community_photos.user_id
  ));
