import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { requirePublicEnv } from '@/lib/env';

/**
 * Server client bound to the request cookies. Still the anon key, so RLS
 * remains the security boundary even in Server Components.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}
