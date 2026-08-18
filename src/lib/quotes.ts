import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession, type Session } from '@/lib/auth';
import { signedUrls } from '@/lib/storage';
import type { Customer, Design, Property, Quote } from '@/lib/types/db';

const PHOTO_BUCKET = 'property-photos';
const RENDER_BUCKET = 'renders';

export interface QuoteContext {
  session: Session;
  quote: Quote;
  customer: Customer;
  property: Property;
  designs: Design[];
  /** The design holding the traced roofline (preset === null). */
  baseDesign: Design | null;
  /** The render the rep has chosen to present. */
  selectedDesign: Design | null;
}

/**
 * Loads everything the quote wizard needs. RLS does the tenant check — a
 * quote belonging to another company simply returns no row, so this 404s.
 */
export async function getQuoteContext(quoteId: string): Promise<QuoteContext> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, customers(*), properties(*)')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) notFound();

  const { customers, properties, ...rest } = quote as Quote & {
    customers: Customer | null;
    properties: Property | null;
  };

  if (!customers || !properties) notFound();

  const { data: designRows } = await supabase
    .from('designs')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  const rawDesigns = (designRows ?? []) as Design[];

  // property-photos and renders are private buckets — every *_url is minted
  // fresh from its *_path here rather than trusted from the stored column,
  // so a stale or tampered URL can never leak an image across tenants.
  const photoPaths = rawDesigns.flatMap((d) =>
    [d.original_image_path, d.marked_image_path].filter((p): p is string => Boolean(p)),
  );
  const renderPaths = rawDesigns
    .map((d) => d.rendered_image_path)
    .filter((p): p is string => Boolean(p));

  const [photoUrls, renderUrls] = await Promise.all([
    signedUrls(supabase, PHOTO_BUCKET, photoPaths),
    signedUrls(supabase, RENDER_BUCKET, renderPaths),
  ]);

  const designs = rawDesigns.map((d) => ({
    ...d,
    original_image_url: d.original_image_path ? (photoUrls[d.original_image_path] ?? null) : null,
    marked_image_url: d.marked_image_path ? (photoUrls[d.marked_image_path] ?? null) : null,
    rendered_image_url: d.rendered_image_path ? (renderUrls[d.rendered_image_path] ?? null) : null,
  }));

  const baseDesign = designs.find((d) => !d.preset) ?? null;
  const selectedDesign =
    designs.find((d) => d.id === rest.selected_design_id) ??
    designs.filter((d) => d.status === 'complete' && d.rendered_image_url).at(-1) ??
    null;

  return {
    session,
    quote: rest as Quote,
    customer: customers,
    property: properties,
    designs,
    baseDesign,
    selectedDesign,
  };
}

/** The step a quote should resume at. */
export function nextStepFor(ctx: QuoteContext): string {
  const { quote, baseDesign, designs } = ctx;
  const id = quote.id;

  if (quote.status === 'sold') return `/quotes/${id}/proposal`;
  if (!baseDesign?.original_image_url) return `/quotes/${id}/photo`;
  if (!baseDesign.roofline_coordinates?.length) return `/quotes/${id}/design`;

  const anyRendered = designs.some((d) => d.status === 'complete' && d.rendered_image_url);
  const anyRunning = designs.some((d) => d.status === 'pending' || d.status === 'processing');

  if (!anyRendered) return anyRunning ? `/quotes/${id}/generating` : `/quotes/${id}/design`;
  if (!quote.linear_feet) return `/quotes/${id}/measure`;

  return `/quotes/${id}/present`;
}
