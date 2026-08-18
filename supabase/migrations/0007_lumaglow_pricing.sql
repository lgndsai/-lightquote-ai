-- =====================================================================
-- LumaGlow production pricing
--
-- Retail vs. standard-selling-price is a distinct, configurable value-
-- framing stat — "187 ft x $52 retail" vs "187 ft x $35 LumaGlow price" —
-- computed from footage alone, before adders/tax/dealer fee. The actual
-- charged total still runs through the full engine (adders, tax, dealer
-- fee) using standard_price_per_ft as the per-foot rate.
--
-- suggested_price_per_foot / min_price_per_foot / controller_price are kept
-- for backward compatibility but are no longer surfaced in the simplified
-- rep quoting screen — standard_price_per_ft is now the single source of
-- truth for the per-foot rate.
-- =====================================================================

alter table public.company_pricing
  add column retail_price_per_ft    numeric(10, 2) not null default 52.00,
  add column standard_price_per_ft  numeric(10, 2) not null default 35.00,
  add column show_retail_comparison boolean        not null default true,
  add column retail_label           text           not null default 'Retail Value',
  add column selling_price_label    text           not null default 'LumaGlow Price',
  add column savings_label          text           not null default 'Your Savings';

comment on column public.company_pricing.retail_price_per_ft is
  'Comparison-only retail rate per linear foot. Never used to compute the actual charged total.';
comment on column public.company_pricing.standard_price_per_ft is
  'The real per-foot selling rate. The rep quoting screen no longer lets a rep type a price — this is the single source of truth.';

alter table public.quotes alter column proposal_level set default 'standard';

-- ---------------------------------------------------- LumaGlow default catalog
-- Replaces the earlier generic seed with LumaGlow's real adder lineup.
-- All values remain fully editable (enable/disable/rename/amount/calc-type)
-- in Admin — nothing here is hardcoded into the application.
create or replace function public.seed_company_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_pricing (
    company_id, suggested_price_per_foot, min_price_per_foot, controller_price,
    retail_price_per_ft, standard_price_per_ft, show_retail_comparison,
    retail_label, selling_price_label, savings_label, proposal_levels
  )
  values (
    p_company_id, 35.00, 28.00, 0,
    52.00, 35.00, true,
    'Retail Value', 'LumaGlow Price', 'Your Savings',
    '[{"key":"standard","name":"Standard","description":"","price_per_foot_delta":0,"features":[]}]'::jsonb
  )
  on conflict (company_id) do nothing;

  insert into public.company_catalog_items (company_id, kind, name, description, price, unit, sort_order)
  values
    (p_company_id, 'track_color', 'Bronze', null, 0.00, 'flat', 1),
    (p_company_id, 'track_color', 'White',  null, 0.00, 'flat', 2),
    (p_company_id, 'track_color', 'Black',  null, 0.00, 'flat', 3),

    (p_company_id, 'adder', 'Small System Fee',
     'Applies to small jobs where the standard rate does not cover minimum install cost.',
     1.00, 'per_foot', 1),
    (p_company_id, 'adder', 'Double Track',
     'Two independently controlled runs instead of one.',
     4.00, 'per_foot', 2),
    (p_company_id, 'adder', 'Custom Painted Channel',
     'Track color-matched to trim rather than a stock finish.',
     2.00, 'per_foot', 3),
    (p_company_id, 'adder', 'Travel',
     'Flat trip fee for jobs outside the standard service area.',
     500.00, 'flat', 4),
    (p_company_id, 'adder', 'Lift Rental',
     'Equipment rental for install heights that need it.',
     1200.00, 'flat', 5),
    (p_company_id, 'adder', 'Other',
     'One-off line item — set the amount for this specific job.',
     0.00, 'flat', 6)
  on conflict do nothing;

  insert into public.finance_programs
    (company_id, name, provider, term_months, apr, payment_factor, dealer_fee_percent, min_amount, sort_order)
  values
    (p_company_id, '12 Months Same As Cash', 'Financing Partner',  12, 0.0000, 0,      0.0500, 1000, 1),
    (p_company_id, '120 Months @ 9.99%',     'Financing Partner', 120, 0.0999, 0,      0.1200, 2500, 2),
    (p_company_id, '144 Months @ 7.99%',     'Financing Partner', 144, 0.0799, 0,      0.1800, 3500, 3)
  on conflict do nothing;
end;
$$;
