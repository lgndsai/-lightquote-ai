import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession, type Session } from '@/lib/auth';
import type { Customer, Design, Property, Quote } from '@/lib/types/db';

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

  const designs = (designRows ?? []) as Design[];
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
