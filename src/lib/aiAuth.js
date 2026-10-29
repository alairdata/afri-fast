import { supabase } from './supabase';

// Headers for calls to our AI endpoints (/api/gemini, /api/ai, /api/chat): JSON plus the signed-in
// person's session token, which the server checks (see api/_aiAuth.js).
export async function aiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return headers;
}
