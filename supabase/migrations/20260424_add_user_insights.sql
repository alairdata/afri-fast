CREATE TABLE IF NOT EXISTS user_insights (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  cards       JSONB       NOT NULL DEFAULT '[]',
  alert_card  TEXT,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own insights"
  ON user_insights
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
