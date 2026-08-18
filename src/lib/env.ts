/**
 * Environment access. Anything not prefixed NEXT_PUBLIC_ is read lazily and
 * only ever from server code, so a secret can never be bundled into the
 * client chunk.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export function requirePublicEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', publicEnv.supabaseUrl),
    supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', publicEnv.supabaseAnonKey),
  };
}

/** Server-only. Never import this from a Client Component. */
export function serverEnv() {
  return {
    supabaseServiceRoleKey: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

/** n8n automation endpoints. All optional — the app degrades gracefully. */
export const n8nEnv = {
  visualizationUrl: process.env.N8N_VISUALIZATION_WEBHOOK_URL ?? '',
  dealSoldUrl: process.env.N8N_DEAL_SOLD_WEBHOOK_URL ?? '',
  dealInstalledUrl: process.env.N8N_DEAL_INSTALLED_WEBHOOK_URL ?? '',
  /** Sent to n8n so the workflow can authenticate us. */
  outboundSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  /** Required on inbound callbacks from n8n. */
  callbackSecret: process.env.N8N_CALLBACK_SECRET ?? '',
};

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
