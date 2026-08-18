import { createClient } from '@/lib/supabase/server';
import type { CatalogItem, CompanyPricing, FinanceProgram, ProposalLevel } from '@/lib/types/db';

/**
 * Fallback used only until an admin saves their own settings.
 *
 * The simplified LumaGlow quoting flow doesn't ask the rep to pick a tier —
 * standard_price_per_ft is the single per-foot rate — so this is one level
 * with no delta. The mechanism (admin-editable JSON, price_per_foot_delta)
 * is left in place in case a company ever wants tiered systems again.
 */
export const DEFAULT_PROPOSAL_LEVELS: ProposalLevel[] = [
  {
    key: 'standard',
    name: 'LumaGlow Permanent Lighting',
    description: 'Professionally installed permanent architectural lighting.',
    price_per_foot_delta: 0,
    features: [],
  },
];

export interface PricingConfig {
  pricing: CompanyPricing;
  controllers: CatalogItem[];
  trackColors: CatalogItem[];
  adders: CatalogItem[];
  discounts: CatalogItem[];
  financePrograms: FinanceProgram[];
  proposalLevels: ProposalLevel[];
}

/**
 * Loads everything the pricing engine needs for a company. Screens receive
 * this and render it — they never carry price constants of their own.
 */
export async function loadPricingConfig(companyId: string): Promise<PricingConfig> {
  const supabase = await createClient();

  const [pricingResult, catalogResult, financeResult] = await Promise.all([
    supabase.from('company_pricing').select('*').eq('company_id', companyId).maybeSingle(),
    supabase
      .from('company_catalog_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('finance_programs')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const pricing = (pricingResult.data as CompanyPricing | null) ?? emptyPricing(companyId);
  const catalog = (catalogResult.data ?? []) as CatalogItem[];

  const levels =
    Array.isArray(pricing.proposal_levels) && pricing.proposal_levels.length > 0
      ? pricing.proposal_levels
      : DEFAULT_PROPOSAL_LEVELS;

  return {
    pricing,
    controllers: catalog.filter((c) => c.kind === 'controller'),
    trackColors: catalog.filter((c) => c.kind === 'track_color'),
    adders: catalog.filter((c) => c.kind === 'adder'),
    discounts: catalog.filter((c) => c.kind === 'discount'),
    financePrograms: (financeResult.data ?? []) as FinanceProgram[],
    proposalLevels: levels,
  };
}

export function findLevel(levels: ProposalLevel[], key: string | null | undefined) {
  return levels.find((l) => l.key === key) ?? levels.find((l) => l.key === 'standard') ?? levels[0] ?? null;
}

/**
 * Pins standard_price_per_ft to the rate already locked into a saved quote,
 * rather than whatever the company's live pricing config says right now.
 *
 * Without this, a company editing standard_price_per_ft between "measure"
 * and "present/proposal" would make the retail-comparison stat
 * (linearFeet x standard_price_per_ft) drift away from the quote's real
 * footageSubtotal/total, which are still keyed off the locked
 * quote.price_per_foot. Only used for re-displaying an already-saved quote —
 * saveQuotePricing itself intentionally reads the live config, since that's
 * the moment the rate gets locked in.
 */
export function pinPricingToQuote(pricing: CompanyPricing, quotePricePerFoot: number): CompanyPricing {
  return { ...pricing, standard_price_per_ft: quotePricePerFoot };
}

function emptyPricing(companyId: string): CompanyPricing {
  return {
    id: '',
    company_id: companyId,
    suggested_price_per_foot: 35,
    min_price_per_foot: 28,
    controller_price: 0,
    tax_rate: 0,
    tax_on_labor: true,
    labor_percent_of_price: 0.5,
    dealer_fee_percent: 0,
    minimum_job_price: 0,
    retail_price_per_ft: 52,
    standard_price_per_ft: 35,
    show_retail_comparison: true,
    retail_label: 'Retail Value',
    selling_price_label: 'LumaGlow Price',
    savings_label: 'Your Savings',
    proposal_levels: DEFAULT_PROPOSAL_LEVELS,
    created_at: '',
    updated_at: '',
  };
}
