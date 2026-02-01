/**
 * SocialCore - Supabase Configuration
 * Initialize and export Supabase client
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Environment check:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Loaded' : '❌ Missing');
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Loaded' : '❌ Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ .env file values:', { supabaseUrl, supabaseAnonKey });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
