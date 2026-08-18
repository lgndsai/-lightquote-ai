import { createClient } from '@/lib/supabase/server';
import type { CompanyMarketingConfig } from '@/lib/types/db';

/** Fallback used only until an admin saves their own settings (mirrors the DB column defaults). */
export function defaultMarketingConfig(companyId: string): CompanyMarketingConfig {
  return {
    id: '',
    company_id: companyId,
    show_long_term_comparison: true,
    alternative_name: 'Budget Installed Lighting',
    alternative_installed_cost: 2100,
    alternative_replacement_interval_years: 3,
    comparison_horizon_years: 15,
    comparison_disclaimer:
      'Illustrative long-term cost comparison based on the assumptions shown. Actual product life, replacement frequency, maintenance and installation costs vary.',
    show_resale_stat: true,
    resale_headline: '59%',
    resale_label: 'Estimated Cost Recovery',
    resale_body:
      "The National Association of REALTORS® / National Association of Landscape Professionals' 2023 outdoor remodeling research estimated that landscape lighting projects recovered approximately 59% of their cost at resale.",
    resale_source: '2023 NAR/NALP Remodeling Impact Report: Outdoor Features.',
    resale_disclaimer:
      'Actual resale value varies by property, market, installation, buyer preferences and other factors.',
    show_secondary_resale_stat: false,
    secondary_resale_headline: '1.2%',
    secondary_resale_label: 'Outdoor Lighting Sale Premium',
    secondary_resale_body:
      'Zillow has reported that homes with outdoor lighting sold for 1.2% more than similar homes without outdoor lighting.',
    secondary_resale_source: 'Zillow — Exterior Home Improvements',
    secondary_resale_disclaimer:
      "This is an observed association in Zillow's data and does not guarantee that adding lighting will increase an individual home's sale price.",
    show_security_stat: true,
    security_headline: '14% LOWER CRIME*',
    security_body:
      'An updated systematic review of improved street-lighting interventions found an overall 14% reduction in crime in experimental areas compared with control areas.',
    security_secondary_line: 'Property crime decreased approximately 12%.',
    security_source:
      '2021 systematic review and meta-analysis commissioned by the Swedish National Council for Crime Prevention.',
    security_disclaimer:
      '*Research concerns public-area street-lighting interventions and does not predict the crime risk of an individual residence. Lighting should be considered one layer of home security, not a replacement for locks, alarms, cameras or other security measures.',
    benefits: [
      { title: 'Curb Appeal', body: 'Architectural lighting that makes the home the best-looking one on the street, every night.' },
      { title: 'No More Ladders', body: 'Permanent track means no yearly climb to hang and take down lights.' },
      { title: 'App Control', body: 'Colors, scenes and schedules from a phone — no remotes, no timers.' },
      { title: 'Custom Colors', body: 'Millions of colors for holidays, game days and everyday elegance.' },
      { title: 'Lighting Zones', body: 'Control different areas of the home independently.' },
      { title: 'Professional Installation', body: 'Installed and warrantied by LumaGlow, not a ladder and a weekend.' },
    ],
    created_at: '',
    updated_at: '',
  };
}

export async function loadMarketingConfig(companyId: string): Promise<CompanyMarketingConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('company_marketing_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  return (data as CompanyMarketingConfig | null) ?? defaultMarketingConfig(companyId);
}

export interface LongTermComparison {
  enabled: boolean;
  alternativeName: string;
  alternativeInstalledCost: number;
  replacementIntervalYears: number;
  horizonYears: number;
  numberOfInstallations: number;
  projectedAlternativeCost: number;
  lumaGlowPrice: number;
  /** Positive when LumaGlow projects cheaper over the horizon. Never manufactured — can be negative. */
  difference: number;
  /** True only when `difference` is positive — the UI must not call a negative number a "saving". */
  lumaGlowProjectsCheaper: boolean;
  disclaimer: string;
}

/**
 * number_of_installations = ceil(horizon / replacement_interval)
 * projected_alternative_cost = installations x alternative_installed_cost
 *
 * `lumaGlowPrice` should be the homeowner's actual LumaGlow price (the same
 * total shown as "LumaGlow Price" elsewhere on the proposal) — never a
 * separately invented number.
 */
export function calculateLongTermComparison(
  config: CompanyMarketingConfig,
  lumaGlowPrice: number,
): LongTermComparison {
  const interval = Math.max(0.5, config.alternative_replacement_interval_years);
  const horizon = Math.max(1, config.comparison_horizon_years);
  const installations = Math.max(1, Math.ceil(horizon / interval));
  const projectedAlternativeCost = Math.round(installations * config.alternative_installed_cost * 100) / 100;
  const luma = Math.round(lumaGlowPrice * 100) / 100;
  const difference = Math.round((projectedAlternativeCost - luma) * 100) / 100;

  return {
    enabled: config.show_long_term_comparison,
    alternativeName: config.alternative_name,
    alternativeInstalledCost: config.alternative_installed_cost,
    replacementIntervalYears: interval,
    horizonYears: horizon,
    numberOfInstallations: installations,
    projectedAlternativeCost,
    lumaGlowPrice: luma,
    difference,
    lumaGlowProjectsCheaper: difference > 0,
    disclaimer: config.comparison_disclaimer,
  };
}
