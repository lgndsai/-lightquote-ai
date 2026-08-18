-- =====================================================================
-- Three-color branding
--
-- Companies already had brand_primary / brand_accent; this adds
-- brand_secondary so admin can configure a full primary/secondary/accent
-- palette rather than two colors. Defaults switch from the old
-- placeholder navy/gold to the LumaGlow palette (deep violet / near-black
-- charcoal-purple / magenta-pink) so a freshly provisioned company starts
-- on-brand — still fully editable in Admin, never hardcoded in components.
-- =====================================================================

alter table public.companies
  add column brand_secondary text not null default '#170F26';

alter table public.companies
  alter column brand_primary set default '#7C3AED',
  alter column brand_accent  set default '#E0299B';

comment on column public.companies.brand_primary is
  'Primary brand color — CTAs, headers, the dominant accent on customer-facing screens.';
comment on column public.companies.brand_secondary is
  'Secondary brand color — pairs with primary in gradients and dark surfaces.';
comment on column public.companies.brand_accent is
  'Accent color — highlights, selected states, glow effects.';
