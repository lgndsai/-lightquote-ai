'use client';

import { createBrowserClient } from '@supabase/ssr';
import { requirePublicEnv } from '@/lib/env';

/** Browser client — anon key only, every read/write passes through RLS. */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
