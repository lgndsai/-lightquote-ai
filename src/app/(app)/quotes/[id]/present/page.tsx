import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { loadPricingConfig, findLevel, pinPricingToQuote } from '@/lib/pricing/load';
import { loadMarketingConfig, calculateLongTermComparison } from '@/lib/marketing';
import { createClient } from '@/lib/supabase/server';
import { calculateQuote, fromQuoteAdder } from '@/lib/pricing/engine';
import { PresentationScreen } from './PresentationScreen';
import type { QuoteAdder } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your design — LumaGlow' };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.quote.linear_feet) redirect(`/quotes/${id}/measure`);

  const supabase = await createClient();
  const [config, marketing, { data: adderRows }] = await Promise.all([
    loadPricingConfig(ctx.quote.company_id),
    loadMarketingConfig(ctx.quote.company_id),
    supabase.from('quote_adders').select('*').eq('quote_id', id),
  ]);

  const adders = ((adderRows ?? []) as QuoteAdder[]).map(fromQuoteAdder);
  const level = findLevel(config.proposalLevels, ctx.quote.proposal_level);
  const program = config.financePrograms.find((p) => p.id === ctx.quote.finance_program_id) ?? null;

  // Recomputed from the same persisted inputs the quote was saved with, so
  // this screen can never drift from the stored contract.
  const pricing = calculateQuote({
    linearFeet: Number(ctx.quote.linear_feet),
    pricePerFoot: Number(ctx.quote.price_per_foot),
    controllerPrice: 0,
    proposalLevel: level,
    adders,
    discounts: [],
    financing: ctx.quote.financing_selected,
    financeProgram: program,
    pricing: pinPricingToQuote(config.pricing, Number(ctx.quote.price_per_foot)),
  });

  const comparison = calculateLongTermComparison(marketing, pricing.retailComparison.standardValue);

  return (
    <PresentationScreen
      quote={ctx.quote}
      company={ctx.session.company}
      customer={ctx.customer}
      property={ctx.property}
      pricing={pricing}
      adderLabels={adders.map((a) => a.name)}
      financeProgramName={program?.name ?? null}
      marketing={marketing}
      comparison={comparison}
      originalUrl={ctx.baseDesign?.original_image_url ?? null}
      heroUrl={
        ctx.selectedDesign?.rendered_image_url ??
        ctx.baseDesign?.marked_image_url ??
        ctx.baseDesign?.original_image_url ??
        null
      }
    />
  );
}
