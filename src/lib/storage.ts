import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * property-photos, renders and proposals are private buckets — RLS on
 * storage.objects still scopes every read to the caller's own company
 * folder, but nothing is servable by URL alone. Every display of a stored
 * image goes through a signed URL minted at read time, never a stored
 * public URL.
 */
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour — enough for a working appointment.
/** Proposals are a persisted document; the embedded hero image needs to keep working long after the visit. */
export const PROPOSAL_IMAGE_EXPIRY_SECONDS = 60 * 60 * 24 * 365; // 1 year

export async function signedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Signs every path in one round trip so a page with several images stays fast. */
export async function signedUrls(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}
