'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { findLevel, loadPricingConfig, pinPricingToQuote } from '@/lib/pricing/load';
import { calculateQuote, fromQuoteAdder, type SelectedAdder } from '@/lib/pricing/engine';
import { renderProposalHtml } from '@/lib/proposal/html';
import { sendDealSold } from '@/lib/n8n';
import { getQuoteContext } from '@/lib/quotes';
import { formatDate } from '@/lib/format';
import { signedUrl, PROPOSAL_IMAGE_EXPIRY_SECONDS } from '@/lib/storage';
import { loadMarketingConfig, calculateLongTermComparison } from '@/lib/marketing';
import type { CatalogItem, FinanceProgram, Proposal, QuoteAdder } from '@/lib/types/db';

export interface SaveQuoteState {
  ok?: boolean;
  error?: string;
  total?: number;
  monthlyPayment?: number;
}

const schema = z.object({
  quote_id: z.string().uuid(),
  linear_feet: z.coerce.number().min(0).max(100000),
  track_color: z.string().max(120).nullable().optional(),
  financing: z.coerce.boolean().optional(),
  finance_program_id: z.string().uuid().nullable().optional(),
  adders: z
    .array(z.object({ catalog_item_id: z.string().uuid(), quantity: z.coerce.number().min(0).max(999) }))
    .default([]),
  notes: z.string().max(4000).nullable().optional(),
});

export type SaveQuoteInput = z.input<typeof schema>;

/**
 * Single write path for quote pricing.
 *
 * The browser sends only footage, track color, selected adder ids/quantities
 * and a finance program id — never a price. The per-foot rate always comes
 * from company_pricing.standard_price_per_ft and every total is recomputed
 * here, so a tampered client can never move a number on the contract.
 */
export async function saveQuotePricing(input: SaveQuoteInput): Promise<SaveQuoteState> {
  const session = await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid quote details.' };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, company_id, status')
    .eq('id', data.quote_id)
    .maybeSingle();

  if (!quote) return { error: 'Quote not found.' };
  if (quote.status === 'sold') return { error: 'This quote is already sold and cannot be repriced.' };

  const config = await loadPricingConfig(session.company.id);

  const catalogById = new Map<string, CatalogItem>(config.adders.map((i) => [i.id, i]));

  const selectedAdders: SelectedAdder[] = data.adders.flatMap(({ catalog_item_id, quantity }) => {
    const item = catalogById.get(catalog_item_id);
    if (!item || item.kind !== 'adder' || quantity <= 0) return [];
    return [
      {
        catalog_item_id: item.id,
        name: item.name,
        unit: item.unit,
        unit_price: Number(item.price),
        quantity,
      },
    ];
  });

  const financeProgram: FinanceProgram | null =
    config.financePrograms.find((p) => p.id === data.finance_program_id) ?? null;

  const level = findLevel(config.proposalLevels, 'standard');

  const result = calculateQuote({
    linearFeet: data.linear_feet,
    pricePerFoot: config.pricing.standard_price_per_ft,
    controllerPrice: 0,
    proposalLevel: level,
    adders: selectedAdders,
    discounts: [],
    financing: Boolean(data.financing),
    financeProgram,
    pricing: config.pricing,
  });

  const { error: updateError } = await supabase
    .from('quotes')
    .update({
      linear_feet: data.linear_feet,
      price_per_foot: config.pricing.standard_price_per_ft,
      track_color: data.track_color ?? null,
      controller_name: null,
      controller_price: 0,
      proposal_level: level?.key ?? 'standard',
      financing_selected: Boolean(data.financing),
      finance_program_id: financeProgram?.id ?? null,
      footage_subtotal: result.footageSubtotal,
      adders_total: result.addersTotal,
      discount_total: 0,
      dealer_fee: result.dealerFee,
      subtotal: result.subtotal,
      tax_rate: result.taxRate,
      tax_amount: result.taxAmount,
      total: result.total,
      monthly_payment: result.monthlyPayment,
      pricing_breakdown: result as unknown as Record<string, unknown>,
      selected_discount_ids: [],
      notes: data.notes ?? null,
    })
    .eq('id', data.quote_id);

  if (updateError) return { error: updateError.message };

  // Adder rows are a snapshot, so replace them wholesale on every save.
  const { error: deleteError } = await supabase
    .from('quote_adders')
    .delete()
    .eq('quote_id', data.quote_id);

  if (deleteError) return { error: deleteError.message };

  if (selectedAdders.length > 0) {
    const rows = selectedAdders.map((adder, index) => ({
      company_id: quote.company_id,
      quote_id: data.quote_id,
      catalog_item_id: adder.catalog_item_id,
      name: adder.name,
      unit: adder.unit,
      unit_price: adder.unit_price,
      quantity: adder.quantity,
      total: result.adderLines[index]?.amount ?? 0,
    }));

    const { error: insertError } = await supabase.from('quote_adders').insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/quotes/${data.quote_id}`, 'layout');

  return { ok: true, total: result.total, monthlyPayment: result.monthlyPayment };
}

// ---------------------------------------------------------------- proposals

export interface ProposalState {
  ok?: boolean;
  error?: string;
  proposal_id?: string;
}

const PROPOSAL_BUCKET = 'proposals';

/**
 * Builds the customer proposal from the saved quote, stores the document in
 * Supabase Storage under the tenant's folder, and records the proposal row.
 * Re-running replaces the document for the same proposal number.
 */
export async function createProposal(quoteId: string): Promise<ProposalState> {
  const ctx = await getQuoteContext(quoteId);
  const supabase = await createClient();
  const { quote, customer, property, session } = ctx;

  if (!quote.linear_feet) return { error: 'Add the system measurements first.' };

  const [config, marketing] = await Promise.all([
    loadPricingConfig(quote.company_id),
    loadMarketingConfig(quote.company_id),
  ]);
  const level = findLevel(config.proposalLevels, quote.proposal_level);

  const { data: adderRows } = await supabase.from('quote_adders').select('*').eq('quote_id', quoteId);
  const adders = ((adderRows ?? []) as QuoteAdder[]).map(fromQuoteAdder);

  const program = config.financePrograms.find((p) => p.id === quote.finance_program_id) ?? null;

  const pricing = calculateQuote({
    linearFeet: Number(quote.linear_feet),
    pricePerFoot: Number(quote.price_per_foot),
    controllerPrice: Number(quote.controller_price),
    proposalLevel: level,
    adders,
    discounts: [],
    financing: quote.financing_selected,
    financeProgram: program,
    pricing: pinPricingToQuote(config.pricing, Number(quote.price_per_foot)),
  });

  const comparison = calculateLongTermComparison(marketing, pricing.retailComparison.standardValue);

  // Reuse the existing proposal number so a revised document keeps its identity.
  const { data: existing } = await supabase
    .from('proposals')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<Proposal>();

  const proposalNumber = existing?.proposal_number ?? `P-${quote.quote_number.replace(/^LQ-/, '')}`;

  // The stored HTML is a static snapshot that may be opened months later, so
  // its embedded hero image gets its own long-lived signed URL rather than
  // reusing the short-lived one this page view was rendered with.
  const heroImageUrl = ctx.selectedDesign?.rendered_image_path
    ? await signedUrl(supabase, 'renders', ctx.selectedDesign.rendered_image_path, PROPOSAL_IMAGE_EXPIRY_SECONDS)
    : ctx.baseDesign?.marked_image_path
      ? await signedUrl(
          supabase,
          'property-photos',
          ctx.baseDesign.marked_image_path,
          PROPOSAL_IMAGE_EXPIRY_SECONDS,
        )
      : null;

  const html = renderProposalHtml({
    proposalNumber,
    company: session.company,
    customer,
    property,
    quote,
    pricing,
    renderedImageUrl: heroImageUrl,
    adderLabels: adders.map((a) => a.name),
    financeProgramName: program?.name ?? null,
    salesRepName: session.user.full_name ?? session.user.email,
    salesRepEmail: session.user.email,
    salesRepPhone: session.user.phone,
    issuedAt: formatDate(new Date().toISOString()),
    marketing,
    comparison,
  });

  const storagePath = `${quote.company_id}/${quote.id}/${proposalNumber}.html`;

  const { error: uploadError } = await supabase.storage
    .from(PROPOSAL_BUCKET)
    .upload(storagePath, new Blob([html], { type: 'text/html' }), {
      contentType: 'text/html',
      upsert: true,
    });

  if (uploadError) return { error: uploadError.message };

  const payload = {
    company_id: quote.company_id,
    quote_id: quote.id,
    created_by: session.user.id,
    storage_path: storagePath,
    total_amount: pricing.total,
    monthly_payment: pricing.monthlyPayment,
    snapshot: { pricing, level, program_name: program?.name ?? null } as Record<string, unknown>,
  };

  const { data: proposal, error: writeError } = existing
    ? await supabase.from('proposals').update(payload).eq('id', existing.id).select('id').single()
    : await supabase
        .from('proposals')
        .insert({ ...payload, proposal_number: proposalNumber })
        .select('id')
        .single();

  if (writeError || !proposal) {
    return { error: writeError?.message ?? 'Could not save the proposal.' };
  }

  // Presented, awaiting the homeowner's decision.
  if (quote.status === 'draft') {
    await supabase
      .from('quotes')
      .update({ status: 'pending', presented_at: new Date().toISOString() })
      .eq('id', quote.id);
  }

  revalidatePath(`/quotes/${quoteId}`, 'layout');
  return { ok: true, proposal_id: proposal.id };
}

const acceptSchema = z.object({
  quote_id: z.string().uuid(),
  accepted_by_name: z.string().trim().min(2, 'Enter the name of the person accepting.').max(200),
});

/**
 * Homeowner acceptance: marks the quote SOLD, opens the project record and
 * notifies the deal-sold automation. The webhook is best-effort — a failing
 * automation must never block a signature.
 */
export async function acceptProposal(input: z.input<typeof acceptSchema>): Promise<ProposalState> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a name to accept.' };
  }

  const { quote_id, accepted_by_name } = parsed.data;
  const ctx = await getQuoteContext(quote_id);
  const supabase = await createClient();
  const { quote, customer, property, session } = ctx;

  if (quote.status === 'sold') return { ok: true };

  const soldAt = new Date().toISOString();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('quote_id', quote_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<Proposal>();

  const { error: quoteError } = await supabase
    .from('quotes')
    .update({ status: 'sold', sold_at: soldAt })
    .eq('id', quote_id);

  if (quoteError) return { error: quoteError.message };

  if (proposal) {
    await supabase
      .from('proposals')
      .update({ accepted_at: soldAt, accepted_by_name })
      .eq('id', proposal.id);
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .upsert(
      {
        company_id: quote.company_id,
        quote_id: quote.id,
        customer_id: customer.id,
        property_id: property.id,
        design_id: ctx.selectedDesign?.id ?? ctx.baseDesign?.id ?? null,
        proposal_id: proposal?.id ?? null,
        sales_rep_id: quote.created_by ?? session.user.id,
        status: 'sold',
        contract_value: Number(quote.total),
        sold_at: soldAt,
      },
      { onConflict: 'quote_id' },
    )
    .select('id')
    .single();

  if (projectError) return { error: projectError.message };

  await sendDealSold({
    project_id: project?.id ?? null,
    quote_id: quote.id,
    quote_number: quote.quote_number,
    company_id: quote.company_id,
    proposal_id: proposal?.id ?? null,
    proposal_number: proposal?.proposal_number ?? null,
    sold_at: soldAt,
    contract_value: Number(quote.total),
    monthly_payment: Number(quote.monthly_payment),
    financing_selected: quote.financing_selected,
    accepted_by_name,
    sales_rep: {
      id: session.user.id,
      name: session.user.full_name,
      email: session.user.email,
    },
    customer: {
      id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      email: customer.email,
    },
    property: {
      id: property.id,
      address_line1: property.address_line1,
      city: property.city,
      state: property.state,
      zip: property.zip,
    },
    design: {
      id: ctx.selectedDesign?.id ?? null,
      rendered_image_url: ctx.selectedDesign?.rendered_image_url ?? null,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath(`/quotes/${quote_id}`, 'layout');

  return { ok: true, proposal_id: proposal?.id };
}

/** Short-lived signed URL for the stored proposal document. */
export async function getProposalDocumentUrl(quoteId: string): Promise<string | null> {
  await requireSession();
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('storage_path')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ storage_path: string | null }>();

  if (!proposal?.storage_path) return null;

  const { data } = await supabase.storage
    .from(PROPOSAL_BUCKET)
    .createSignedUrl(proposal.storage_path, 60 * 30);

  return data?.signedUrl ?? null;
}
