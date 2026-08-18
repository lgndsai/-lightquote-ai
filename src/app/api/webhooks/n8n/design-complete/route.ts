import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { n8nEnv } from '@/lib/env';

export const runtime = 'nodejs';

const schema = z.object({
  design_id: z.string().uuid(),
  status: z.enum(['processing', 'complete', 'failed']),
  /**
   * Path within the private 'renders' bucket, e.g. "{company_id}/{quote_id}/render-<uuid>.jpg".
   * n8n uploads the finished image itself (with its own Supabase credentials,
   * never the browser's) and reports back the path — never a bare URL, since
   * the bucket is private and a URL alone would not be servable.
   */
  rendered_image_path: z.string().max(500).optional().nullable(),
  error_message: z.string().max(1000).optional().nullable(),
  job_id: z.string().max(200).optional().nullable(),
});

/**
 * Callback from the n8n visualization workflow.
 *
 * n8n has no Supabase session, so this route authenticates with a shared
 * secret and then uses the service-role client. It only ever touches the one
 * design row named in the payload.
 */
export async function POST(request: Request) {
  if (!n8nEnv.callbackSecret) {
    return NextResponse.json({ error: 'Callback secret is not configured.' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-callback-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  if (!timingSafeEqual(provided, n8nEnv.callbackSecret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const { design_id, status, rendered_image_path, error_message, job_id } = parsed.data;

  if (status === 'complete' && !rendered_image_path) {
    return NextResponse.json(
      { error: 'rendered_image_path is required when status is complete.' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('designs')
    .update({
      status,
      rendered_image_path: rendered_image_path ?? null,
      error_message: error_message ?? null,
      ...(job_id ? { job_id } : {}),
      ...(status === 'complete' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', design_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Constant-time compare so the secret can't be probed byte by byte. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
