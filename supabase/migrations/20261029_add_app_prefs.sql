-- Small preferences and "already seen" markers kept on the account (2026-10-29), so a new phone or a log out
-- doesn't lose them: notification choices, community photo sharing, milestones already celebrated, dismissed
-- insights, the weight checkpoint already shown, the catch-up prompts already shown, kitchen Recents.
-- See src/lib/accountPrefs.js. Safe to run more than once.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Sets one key, merged on the server, so two phones saving different keys at once never overwrite each other.
CREATE OR REPLACE FUNCTION set_app_pref(p_key TEXT, p_value JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE profiles
  SET app_prefs = COALESCE(app_prefs, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
  WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION set_app_pref(TEXT, JSONB) TO authenticated;
