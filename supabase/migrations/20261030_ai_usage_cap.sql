-- A daily cap on AI calls per account (2026-10-30), so one account can't drain the AI credit.
-- The server (api/_aiAuth.js) counts each AI call here with the service key; past the cap (AI_DAILY_LIMIT in
-- Vercel, 300 by default) it answers 429 until the next day. No app access. Safe to run more than once.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     DATE    NOT NULL,
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Adds one call for today and returns today's total.
CREATE OR REPLACE FUNCTION bump_ai_usage(p_user UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_usage (user_id, day, calls) VALUES (p_user, (now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1
  RETURNING calls;
$$;
REVOKE ALL ON FUNCTION bump_ai_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bump_ai_usage(UUID) TO service_role;
