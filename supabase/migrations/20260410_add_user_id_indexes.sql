-- Performance indexes: every query filters by user_id, so these turn full-table
-- scans into index seeks. The logged_at/created_at indexes speed up ORDER BY.

CREATE INDEX IF NOT EXISTS idx_meals_user_id         ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_logged_at        ON meals(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_fasting_sessions_user_id  ON fasting_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fasting_sessions_logged_at ON fasting_sessions(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_id      ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_logged_at    ON check_ins(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_id    ON weight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_logged_at  ON weight_logs(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_id     ON water_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_water_logs_logged_at   ON water_logs(logged_at DESC);

-- Note: whisper_posts / whisper_comments indexes to be added once those tables exist.
