import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://exvbplhajnvuhanykumm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dmJwbGhham52dWhhbnlrdW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODY2NTEsImV4cCI6MjA5MDY2MjY1MX0.L-D_1nnehcjcQZ52XEl0rhKOoUm7HmOMC4_wGIwQETE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
