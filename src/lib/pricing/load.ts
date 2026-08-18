import { createClient } from '@/lib/supabase/server';
import type { CatalogItem, CompanyPricing, FinanceProgram, ProposalLevel } from '@/lib/types/db';

/** Fallback used only until an admin saves their own settings. */
export const DEFAULT_PROPOSAL_LEVELS: ProposalLevel[] = [
  {
    key: 'essential',
    name: 'Essential',
    description: 'Front elevation coverage with the core system.',
    price_per_foot_delta: -3,
    features: ['Front roofline coverage', 'Warm white + color modes', 'App control', 'Lifetime LED warranty'],
  },
  {
    key: 'signature',
    name: 'Signature',
    description: 'Full front and side coverage with premium track.',
    price_per_foot_delta: 0,
    features: [
      'Front and side rooflines',
      'Full RGBW color spectrum',
      'Scheduling and scenes',
      'Color-matched track',
      'Lifetime LED warranty',
    ],
  },
  {
    key: 'whole_home',
    name: 'Whole Home',
    description: 'Complete perimeter coverage, every feature enabled.',
    price_per_foot_delta: 4,
    features: [
      'Complete perimeter coverage',
      'Full RGBW color spectrum',
      'Scheduling, scenes and music sync',
      'Color-matched track',
      'Priority service',
      'Lifetime LED warranty',
    ],
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
  return levels.find((l) => l.key === key) ?? levels.find((l) => l.key === 'signature') ?? levels[0] ?? null;
}

function emptyPricing(companyId: string): CompanyPricing {
  return {
    id: '',
    company_id: companyId,
    suggested_price_per_foot: 0,
    min_price_per_foot: 0,
    controller_price: 0,
    tax_rate: 0,
    tax_on_labor: true,
    labor_percent_of_price: 0.5,
    dealer_fee_percent: 0,
    minimum_job_price: 0,
    proposal_levels: DEFAULT_PROPOSAL_LEVELS,
    created_at: '',
    updated_at: '',
  };
}
