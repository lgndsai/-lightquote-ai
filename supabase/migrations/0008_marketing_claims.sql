-- =====================================================================
-- Marketing / proposal value configuration
--
-- The "THE VALUE OF GOING PERMANENT" section of the customer proposal is
-- entirely company-configured: the long-term cost comparison assumptions,
-- the resale statistic (and its source/disclaimer), the optional secondary
-- resale statistic (off by default), the security/visibility statistic, and
-- the 4-6 benefit cards shown under "WHY LUMAGLOW". None of this copy or
-- these numbers live in application code — updating research or marketing
-- language later never requires a deploy.
-- =====================================================================

create table public.company_marketing_config (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,

  -- Card 1 — long-term cost comparison
  show_long_term_comparison           boolean not null default true,
  alternative_name                    text    not null default 'Budget Installed Lighting',
  alternative_installed_cost          numeric(12, 2) not null default 2100.00,
  alternative_replacement_interval_years numeric(6, 2) not null default 3,
  comparison_horizon_years            numeric(6, 2) not null default 15,
  comparison_disclaimer               text    not null default
    'Illustrative long-term cost comparison based on the assumptions shown. Actual product life, replacement frequency, maintenance and installation costs vary.',

  -- Card 2 — resale appeal (primary statistic, on by default)
  show_resale_stat      boolean not null default true,
  resale_headline       text    not null default '59%',
  resale_label           text    not null default 'Estimated Cost Recovery',
  resale_body            text    not null default
    'The National Association of REALTORS® / National Association of Landscape Professionals'' 2023 outdoor remodeling research estimated that landscape lighting projects recovered approximately 59% of their cost at resale.',
  resale_source           text    not null default '2023 NAR/NALP Remodeling Impact Report: Outdoor Features.',
  resale_disclaimer       text    not null default
    'Actual resale value varies by property, market, installation, buyer preferences and other factors.',

  -- Card 2 — optional secondary resale statistic (off by default)
  show_secondary_resale_stat boolean not null default false,
  secondary_resale_headline  text    not null default '1.2%',
  secondary_resale_label     text    not null default 'Outdoor Lighting Sale Premium',
  secondary_resale_body      text    not null default
    'Zillow has reported that homes with outdoor lighting sold for 1.2% more than similar homes without outdoor lighting.',
  secondary_resale_source     text    not null default 'Zillow — Exterior Home Improvements',
  secondary_resale_disclaimer text    not null default
    'This is an observed association in Zillow''s data and does not guarantee that adding lighting will increase an individual home''s sale price.',

  -- Card 3 — security / visibility
  show_security_stat     boolean not null default true,
  security_headline      text    not null default '14% LOWER CRIME*',
  security_body          text    not null default
    'An updated systematic review of improved street-lighting interventions found an overall 14% reduction in crime in experimental areas compared with control areas.',
  security_secondary_line text   not null default 'Property crime decreased approximately 12%.',
  security_source         text    not null default
    '2021 systematic review and meta-analysis commissioned by the Swedish National Council for Crime Prevention.',
  security_disclaimer     text    not null default
    '*Research concerns public-area street-lighting interventions and does not predict the crime risk of an individual residence. Lighting should be considered one layer of home security, not a replacement for locks, alarms, cameras or other security measures.',

  -- "WHY LUMAGLOW" benefit cards — max ~6, rendered in order
  benefits jsonb not null default '[
    {"title":"Curb Appeal","body":"Architectural lighting that makes the home the best-looking one on the street, every night."},
    {"title":"No More Ladders","body":"Permanent track means no yearly climb to hang and take down lights."},
    {"title":"App Control","body":"Colors, scenes and schedules from a phone — no remotes, no timers."},
    {"title":"Custom Colors","body":"Millions of colors for holidays, game days and everyday elegance."},
    {"title":"Lighting Zones","body":"Control different areas of the home independently."},
    {"title":"Professional Installation","body":"Installed and warrantied by LumaGlow, not a ladder and a weekend."}
  ]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_marketing_config_touch_updated_at
  before update on public.company_marketing_config
  for each row execute function public.touch_updated_at();

alter table public.company_marketing_config enable row level security;

create policy marketing_config_select on public.company_marketing_config
  for select to authenticated
  using (company_id = public.current_company_id());

create policy marketing_config_admin on public.company_marketing_config
  for all to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_app_role() = 'admin');

-- Seed a row for every company created from here on.
create or replace function public.seed_marketing_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_marketing_config (company_id)
  values (p_company_id)
  on conflict (company_id) do nothing;
end;
$$;

-- handle_new_user already calls seed_company_defaults for a brand-new
-- company; extend it to also seed the marketing config.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role       public.user_role;
  v_meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  v_company_id := nullif(v_meta ->> 'company_id', '')::uuid;

  if v_company_id is null then
    insert into public.companies (name)
    values (coalesce(nullif(v_meta ->> 'company_name', ''), 'My Company'))
    returning id into v_company_id;

    perform public.seed_company_defaults(v_company_id);
    perform public.seed_marketing_defaults(v_company_id);
    v_role := 'admin';
  else
    v_role := coalesce(nullif(v_meta ->> 'role', ''), 'sales_rep')::public.user_role;
  end if;

  insert into public.users (id, company_id, email, full_name, phone, role)
  values (
    new.id,
    v_company_id,
    new.email,
    nullif(v_meta ->> 'full_name', ''),
    nullif(v_meta ->> 'phone', ''),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
