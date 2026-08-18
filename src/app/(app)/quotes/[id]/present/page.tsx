import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { loadPricingConfig } from '@/lib/pricing/load';
import { createClient } from '@/lib/supabase/server';
import { PresentationScreen } from './PresentationScreen';
import type { QuoteAdder } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your design — LightQuote AI' };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.quote.linear_feet) redirect(`/quotes/${id}/measure`);

  const supabase = await createClient();
  const [config, { data: adderRows }] = await Promise.all([
    loadPricingConfig(ctx.quote.company_id),
    supabase.from('quote_adders').select('*').eq('quote_id', id),
  ]);

  return (
    <PresentationScreen
      quote={ctx.quote}
      company={ctx.session.company}
      customer={ctx.customer}
      property={ctx.property}
      config={config}
      adders={(adderRows ?? []) as QuoteAdder[]}
      heroUrl={
        ctx.selectedDesign?.rendered_image_url ??
        ctx.baseDesign?.marked_image_url ??
        ctx.baseDesign?.original_image_url ??
        null
      }
    />
  );
}
