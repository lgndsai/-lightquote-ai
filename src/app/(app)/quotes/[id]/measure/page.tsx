import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { loadPricingConfig } from '@/lib/pricing/load';
import { createClient } from '@/lib/supabase/server';
import { MeasureForm } from './MeasureForm';
import type { QuoteAdder } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System measurements — LumaGlow' };

export default async function MeasurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.baseDesign?.original_image_url) redirect(`/quotes/${id}/photo`);

  const supabase = await createClient();
  const [config, { data: adderRows }] = await Promise.all([
    loadPricingConfig(ctx.quote.company_id),
    supabase.from('quote_adders').select('*').eq('quote_id', id),
  ]);

  return (
    <MeasureForm
      quote={ctx.quote}
      config={config}
      existingAdders={(adderRows ?? []) as QuoteAdder[]}
    />
  );
}
