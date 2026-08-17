CREATE TABLE IF NOT EXISTS step_logs (
  id            BIGINT      PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          TEXT        NOT NULL,
  display_date  TEXT,
  steps         INTEGER     NOT NULL,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own step_logs"
  ON step_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS step_logs_user_id_idx ON step_logs(user_id);

CREATE TABLE IF NOT EXISTS activities (
  id                  BIGINT      PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL, -- walking | running | cycling | swimming | strength | sports | other
  name                TEXT,                 -- custom label, mainly for "other"
  date                TEXT        NOT NULL, -- toDateString(), matches meals/weight_logs convention
  timestamp           BIGINT      NOT NULL,
  duration_min        INTEGER     NOT NULL,
  distance             NUMERIC,
  distance_unit        TEXT,                -- 'km' | 'mi'
  session_type         TEXT,                -- e.g. "Push day" for strength training
  estimated_calories   NUMERIC,
  logged_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activities"
  ON activities
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS step_goal INTEGER DEFAULT 10000;
