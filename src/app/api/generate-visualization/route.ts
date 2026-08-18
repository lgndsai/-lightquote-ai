import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { isVisualizationConfigured, sendVisualizationRequest } from '@/lib/n8n';
import { signedUrl } from '@/lib/storage';
import type { Design } from '@/lib/types/db';

export const runtime = 'nodejs';

const PHOTO_BUCKET = 'property-photos';
/** Long enough for n8n to fetch the source images even on a slow render queue. */
const N8N_IMAGE_EXPIRY_SECONDS = 60 * 60;

const schema = z.object({
  design_id: z.string().uuid(),
  quote_id: z.string().uuid(),
  /** Set when regenerating the same tracing in a different look. */
  preset: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { design_id, quote_id, preset } = parsed.data;
  const supabase = await createClient();

  // RLS scopes this read, so a design from another tenant simply isn't found.
  const { data: source } = await supabase
    .from('designs')
    .select('*')
    .eq('id', design_id)
    .eq('quote_id', quote_id)
    .maybeSingle<Design>();

  if (!source) {
    return NextResponse.json({ error: 'Design not found.' }, { status: 404 });
  }

  if (!source.original_image_path) {
    return NextResponse.json({ error: 'Upload a property photo first.' }, { status: 400 });
  }

  // A preset run clones the tracing into its own design record so the rep can
  // flip between finished looks instead of overwriting one.
  let design = source;

  if (preset && preset !== source.preset) {
    const { data: clone, error: cloneError } = await supabase
      .from('designs')
      .insert({
        company_id: source.company_id,
        quote_id: source.quote_id,
        property_id: source.property_id,
        original_image_path: source.original_image_path,
        marked_image_path: source.marked_image_path,
        roofline_coordinates: source.roofline_coordinates,
        lighting_style: preset,
        preset,
        status: 'processing',
      })
      .select('*')
      .single<Design>();

    if (cloneError || !clone) {
      return NextResponse.json(
        { error: cloneError?.message ?? 'Could not start the preset.' },
        { status: 500 },
      );
    }
    design = clone;
  } else {
    const { error: updateError } = await supabase
      .from('designs')
      .update({ status: 'processing', error_message: null, rendered_image_path: null })
      .eq('id', design.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (!isVisualizationConfigured()) {
    await supabase
      .from('designs')
      .update({
        status: 'failed',
        error_message: 'The visualization workflow is not configured for this environment.',
      })
      .eq('id', design.id);

    return NextResponse.json(
      { error: 'The visualization workflow is not configured.', design_id: design.id },
      { status: 503 },
    );
  }

  // property-photos is private, so n8n gets time-boxed signed URLs rather
  // than a public link — the images are never reachable without this token.
  const [originalImageUrl, markedImageUrl] = await Promise.all([
    signedUrl(supabase, PHOTO_BUCKET, design.original_image_path, N8N_IMAGE_EXPIRY_SECONDS),
    signedUrl(supabase, PHOTO_BUCKET, design.marked_image_path, N8N_IMAGE_EXPIRY_SECONDS),
  ]);

  if (!originalImageUrl) {
    await supabase
      .from('designs')
      .update({ status: 'failed', error_message: 'Could not access the property photo.' })
      .eq('id', design.id);
    return NextResponse.json({ error: 'Could not access the property photo.' }, { status: 500 });
  }

  const result = await sendVisualizationRequest({
    design_id: design.id,
    quote_id: design.quote_id,
    company_id: design.company_id,
    original_image_url: originalImageUrl,
    marked_image_url: markedImageUrl,
    roofline_coordinates: design.roofline_coordinates,
    lighting_style: design.lighting_style,
    preset: design.preset,
  });

  if (!result.ok) {
    await supabase
      .from('designs')
      .update({ status: 'failed', error_message: result.error ?? 'Visualization request failed.' })
      .eq('id', design.id);

    return NextResponse.json({ error: result.error, design_id: design.id }, { status: 502 });
  }

  // n8n may hand back its own job id for correlation.
  const jobId =
    result.body && typeof result.body === 'object' && 'job_id' in result.body
      ? String((result.body as { job_id: unknown }).job_id)
      : null;

  if (jobId) {
    await supabase.from('designs').update({ job_id: jobId }).eq('id', design.id);
  }

  return NextResponse.json({ design_id: design.id, status: 'processing' });
}
