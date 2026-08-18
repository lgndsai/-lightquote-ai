-- =====================================================================
-- LightQuote AI — core schema
-- Multi-tenant from day one: every business record carries company_id.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type public.user_role      as enum ('admin', 'manager', 'sales_rep');
create type public.quote_status   as enum ('draft', 'pending', 'sold', 'lost');
create type public.design_status  as enum ('pending', 'processing', 'complete', 'failed');
create type public.project_status as enum ('sold', 'scheduled', 'installed', 'cancelled');
create type public.catalog_kind   as enum ('adder', 'controller', 'track_color', 'discount');
create type public.price_unit     as enum ('flat', 'per_foot', 'each', 'percent');

-- ------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------- companies
create table public.companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  logo_url          text,
  brand_primary     text not null default '#0B0F19',
  brand_accent      text not null default '#C8A24A',
  phone             text,
  email             text,
  website           text,
  address_line1     text,
  city              text,
  state             text,
  zip               text,
  license_number    text,
  warranty_copy     text not null default
    'Lifetime warranty on LED diodes and track. 5-year warranty on labor and controller.',
  proposal_benefits jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------- users
-- Application profile mirroring auth.users. id === auth.users.id.
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  email      text not null,
  full_name  text,
  phone      text,
  role       public.user_role not null default 'sales_rep',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_company_id_idx on public.users (company_id);
create index users_company_role_idx on public.users (company_id, role);

-- ------------------------------------------------------------- customers
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  first_name text not null,
  last_name  text not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_company_id_idx on public.customers (company_id, created_at desc);
create index customers_created_by_idx on public.customers (created_by);

-- ------------------------------------------------------------ properties
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  created_by    uuid references public.users (id) on delete set null,
  address_line1 text not null,
  city          text not null,
  state         text not null,
  zip           text not null,
  stories       integer,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index properties_company_id_idx on public.properties (company_id, created_at desc);
create index properties_customer_id_idx on public.properties (customer_id);

-- ---------------------------------------------------------------- quotes
create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  property_id   uuid not null references public.properties (id) on delete cascade,
  created_by    uuid references public.users (id) on delete set null,
  quote_number  text not null,
  status        public.quote_status not null default 'draft',

  -- measurements / system selection
  linear_feet       numeric(10, 2) not null default 0,
  track_color       text,
  controller_name   text,
  controller_price  numeric(12, 2) not null default 0,
  price_per_foot    numeric(10, 2) not null default 0,
  proposal_level    text not null default 'signature',

  -- financing
  finance_program_id uuid,
  financing_selected boolean not null default false,

  -- pricing snapshot (authoritative totals, computed server-side)
  footage_subtotal  numeric(12, 2) not null default 0,
  adders_total      numeric(12, 2) not null default 0,
  discount_total    numeric(12, 2) not null default 0,
  dealer_fee        numeric(12, 2) not null default 0,
  subtotal          numeric(12, 2) not null default 0,
  tax_rate          numeric(6, 4)  not null default 0,
  tax_amount        numeric(12, 2) not null default 0,
  total             numeric(12, 2) not null default 0,
  monthly_payment   numeric(12, 2) not null default 0,
  pricing_breakdown jsonb not null default '{}'::jsonb,

  -- catalog ids of the discounts applied, so re-opening restores the selection
  selected_discount_ids jsonb not null default '[]'::jsonb,

  notes        text,
  presented_at timestamptz,
  sold_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint quotes_quote_number_unique unique (company_id, quote_number)
);
create index quotes_company_status_idx on public.quotes (company_id, status, created_at desc);
create index quotes_created_by_idx on public.quotes (created_by, created_at desc);
create index quotes_customer_idx on public.quotes (customer_id);

-- --------------------------------------------------------------- designs
create table public.designs (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  quote_id             uuid not null references public.quotes (id) on delete cascade,
  property_id          uuid references public.properties (id) on delete set null,
  created_by           uuid references public.users (id) on delete set null,

  original_image_path  text,
  original_image_url   text,
  marked_image_path    text,
  marked_image_url     text,
  rendered_image_path  text,
  rendered_image_url   text,

  -- normalized (0..1) stroke data so markings survive any screen size
  roofline_coordinates jsonb not null default '[]'::jsonb,
  lighting_style       text not null default 'warm_white',
  preset               text,

  status        public.design_status not null default 'pending',
  error_message text,
  job_id        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index designs_quote_idx on public.designs (quote_id, created_at desc);
create index designs_company_status_idx on public.designs (company_id, status);

-- quotes -> selected design (added after designs exists to avoid a cycle)
alter table public.quotes
  add column selected_design_id uuid references public.designs (id) on delete set null;
create index quotes_selected_design_idx on public.quotes (selected_design_id);

-- --------------------------------------------------------- company_pricing
-- Exactly one settings row per company. Never hardcode pricing in components.
create table public.company_pricing (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null unique references public.companies (id) on delete cascade,
  suggested_price_per_foot numeric(10, 2) not null default 32.00,
  min_price_per_foot       numeric(10, 2) not null default 24.00,
  controller_price         numeric(12, 2) not null default 399.00,
  tax_rate                 numeric(6, 4)  not null default 0.0000,
  tax_on_labor             boolean not null default true,
  -- share of the per-foot price treated as labor; used when labor is untaxed
  labor_percent_of_price   numeric(6, 4)  not null default 0.5000,
  dealer_fee_percent       numeric(6, 4)  not null default 0.0000,
  minimum_job_price        numeric(12, 2) not null default 0,
  proposal_levels          jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- --------------------------------------------------- company_catalog_items
-- Adders, controllers, track colors and discounts share one shape, so they
-- share one table + one admin CRUD screen.
create table public.company_catalog_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  kind        public.catalog_kind not null,
  name        text not null,
  description text,
  price       numeric(12, 2) not null default 0,
  unit        public.price_unit not null default 'flat',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index catalog_company_kind_idx
  on public.company_catalog_items (company_id, kind, is_active, sort_order);

-- ---------------------------------------------------------- quote_adders
-- Snapshot of the adder at time of sale so later price edits never rewrite
-- an existing quote.
create table public.quote_adders (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  catalog_item_id uuid references public.company_catalog_items (id) on delete set null,
  name            text not null,
  unit            public.price_unit not null default 'flat',
  unit_price      numeric(12, 2) not null default 0,
  quantity        numeric(10, 2) not null default 1,
  total           numeric(12, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index quote_adders_quote_idx on public.quote_adders (quote_id);
create index quote_adders_company_idx on public.quote_adders (company_id);

-- ------------------------------------------------------- finance_programs
create table public.finance_programs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  name               text not null,
  provider           text,
  term_months        integer not null default 120,
  apr                numeric(6, 4) not null default 0.0999,
  -- monthly payment per $1,000 financed; when > 0 it wins over APR amortization
  payment_factor     numeric(10, 4) not null default 0,
  dealer_fee_percent numeric(6, 4) not null default 0,
  min_amount         numeric(12, 2) not null default 0,
  max_amount         numeric(12, 2),
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index finance_programs_company_idx
  on public.finance_programs (company_id, is_active, sort_order);

alter table public.quotes
  add constraint quotes_finance_program_fk
  foreign key (finance_program_id) references public.finance_programs (id) on delete set null;

-- ------------------------------------------------------------- proposals
create table public.proposals (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  quote_id          uuid not null references public.quotes (id) on delete cascade,
  created_by        uuid references public.users (id) on delete set null,
  proposal_number   text not null,
  storage_path      text,
  total_amount      numeric(12, 2) not null default 0,
  monthly_payment   numeric(12, 2) not null default 0,
  snapshot          jsonb not null default '{}'::jsonb,
  accepted_at       timestamptz,
  accepted_by_name  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint proposals_number_unique unique (company_id, proposal_number)
);
create index proposals_quote_idx on public.proposals (quote_id, created_at desc);

-- -------------------------------------------------------------- projects
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  quote_id       uuid not null unique references public.quotes (id) on delete cascade,
  customer_id    uuid not null references public.customers (id) on delete cascade,
  property_id    uuid not null references public.properties (id) on delete cascade,
  design_id      uuid references public.designs (id) on delete set null,
  proposal_id    uuid references public.proposals (id) on delete set null,
  sales_rep_id   uuid references public.users (id) on delete set null,
  status         public.project_status not null default 'sold',
  contract_value numeric(12, 2) not null default 0,
  sold_at        timestamptz not null default now(),
  scheduled_at   timestamptz,
  installed_at   timestamptz,
  cancelled_at   timestamptz,
  install_notes  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index projects_company_status_idx on public.projects (company_id, status, sold_at desc);
create index projects_sales_rep_idx on public.projects (sales_rep_id);

-- ------------------------------------------------------- updated_at wiring
do $$
declare t text;
begin
  foreach t in array array[
    'companies', 'users', 'customers', 'properties', 'quotes', 'designs',
    'company_pricing', 'company_catalog_items', 'quote_adders',
    'finance_programs', 'proposals', 'projects'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- --------------------------------------------------------- quote numbers
-- Human-friendly, per-company sequential: LQ-2026-000123
create sequence if not exists public.quote_number_seq;
create sequence if not exists public.proposal_number_seq;

create or replace function public.next_quote_number()
returns text
language sql
volatile
as $$
  select 'LQ-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.quote_number_seq')::text, 6, '0');
$$;

create or replace function public.next_proposal_number()
returns text
language sql
volatile
as $$
  select 'P-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.proposal_number_seq')::text, 6, '0');
$$;

alter table public.quotes    alter column quote_number    set default public.next_quote_number();
alter table public.proposals alter column proposal_number set default public.next_proposal_number();
