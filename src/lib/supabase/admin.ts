import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requirePublicEnv, serverEnv } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS, so it is only ever used by trusted
 * server code that has already established the caller's company_id — the
 * n8n callback route and admin user provisioning.
 *
 * The `server-only` import makes importing this from a Client Component a
 * build-time error.
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();
  const { supabaseServiceRoleKey } = serverEnv();

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
