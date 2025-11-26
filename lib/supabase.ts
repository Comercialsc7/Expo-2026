import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  const maskedUrl = supabaseUrl ? supabaseUrl.replace(/(https?:\/\/)([^@\/]+)@?/, '$1****@') : '<missing>';
  const maskedKey = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-8)}` : '<missing>';
  console.error('Supabase URL or Anon Key is missing or empty');
  console.error(`Supabase URL: ${maskedUrl}`);
  console.error(`Supabase Anon Key (masked): ${maskedKey}`);
}

// Configurações específicas para diferentes plataformas
const supabaseConfig = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    headers: {
      'X-Client-Info': `expo-${Platform.OS}`,
    },
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

// Debug: log masked config at import time (useful to verify runtime source)
try {
  const maskedUrl = supabaseUrl ? supabaseUrl.replace(/(https?:\/\/)([^@\/]+)@?/, '$1****@') : '<missing>';
  const maskedKey = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-8)}` : '<missing>';
  console.debug('[supabase] Using URL:', maskedUrl);
  console.debug('[supabase] Anon Key (masked):', maskedKey);
} catch (e) {
  // ignore logging errors
}