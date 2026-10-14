-- How Lumi talks to this person, chosen in onboarding: 'cheerleader', 'gentle', 'auntie' or 'elder'.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_tone TEXT;
