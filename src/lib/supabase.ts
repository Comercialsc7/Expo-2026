import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Debug: log masked config at import time (useful to verify runtime source)
try {
  const maskedUrl = supabaseUrl ? supabaseUrl.replace(/(https?:\/\/)([^@\/]+)@?/, '$1****@') : '<missing>';
  const maskedKey = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-8)}` : '<missing>';
  // Use console.debug so it's easy to filter in browser console
  console.debug('[supabase] Using URL:', maskedUrl);
  console.debug('[supabase] Anon Key (masked):', maskedKey);
} catch (e) {
  // ignore logging errors
}