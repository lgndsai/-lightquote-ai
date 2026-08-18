import { redirect } from 'next/navigation';
import { getQuoteContext } from '@/lib/quotes';
import { loadPricingConfig, findLevel } from '@/lib/pricing/load';
import { createClient } from '@/lib/supabase/server';
import { calculateQuote, fromQuoteAdder, toSelectedDiscount } from '@/lib/pricing/engine';
import { ProposalScreen } from './ProposalScreen';
import type { Proposal, QuoteAdder } from '@/lib/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your proposal — LightQuote AI' };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getQuoteContext(id);

  if (!ctx.quote.linear_feet) redirect(`/quotes/${id}/measure`);

  const supabase = await createClient();
  const [config, { data: adderRows }, { data: proposalRow }, { data: projectRow }] = await Promise.all([
    loadPricingConfig(ctx.quote.company_id),
    supabase.from('quote_adders').select('*').eq('quote_id', id),
    supabase
      .from('proposals')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('projects').select('id, status').eq('quote_id', id).maybeSingle(),
  ]);

  const level = findLevel(config.proposalLevels, ctx.quote.proposal_level);
  const program = config.financePrograms.find((p) => p.id === ctx.quote.finance_program_id) ?? null;

  // Recomputed from the same engine the contract was written with, so the
  // screen can never drift from the stored totals.
  const pricing = calculateQuote({
    linearFeet: Number(ctx.quote.linear_feet),
    pricePerFoot: Number(ctx.quote.price_per_foot),
    controllerPrice: Number(ctx.quote.controller_price),
    proposalLevel: level,
    adders: ((adderRows ?? []) as QuoteAdder[]).map(fromQuoteAdder),
    discounts: config.discounts
      .filter((d) => (ctx.quote.selected_discount_ids ?? []).includes(d.id))
      .map(toSelectedDiscount),
    financing: ctx.quote.financing_selected,
    financeProgram: program,
    pricing: config.pricing,
  });

  return (
    <ProposalScreen
      quote={ctx.quote}
      company={ctx.session.company}
      customer={ctx.customer}
      property={ctx.property}
      pricing={pricing}
      levelName={level?.name ?? 'Signature'}
      levelFeatures={level?.features ?? []}
      financeProgramName={program?.name ?? null}
      salesRepName={ctx.session.user.full_name ?? ctx.session.user.email}
      proposal={(proposalRow as Proposal | null) ?? null}
      heroUrl={ctx.selectedDesign?.rendered_image_url ?? ctx.baseDesign?.marked_image_url ?? null}
      projectId={(projectRow as { id: string } | null)?.id ?? null}
    />
  );
}
