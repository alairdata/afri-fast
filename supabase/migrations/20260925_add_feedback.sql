-- In-app "Contact Support" messages and "Rate the App" ratings. Users can only add rows for
-- themselves and cannot read anyone's (including their own) back; read them in the dashboard.
CREATE TABLE IF NOT EXISTS feedback (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('support', 'rating')),
  rating      SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  message     TEXT,
  email       TEXT,
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can send their own feedback" ON feedback;
CREATE POLICY "Users can send their own feedback"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
