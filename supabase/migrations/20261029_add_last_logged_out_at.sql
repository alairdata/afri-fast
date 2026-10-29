-- When the person last logged out (set by the app just before it signs them out).
alter table public.profiles add column if not exists last_logged_out_at timestamptz;
