-- =====================================================================
-- New-account bootstrap
--
-- Sign-up metadata drives what happens:
--   company_name present -> create a new company, caller becomes 'admin'
--   company_id   present -> join an existing company with the given role
-- Either way a public.users profile row always exists for an auth user,
-- which is what every RLS helper depends on.
-- =====================================================================

create or replace function public.seed_company_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_pricing (company_id, proposal_levels)
  values (
    p_company_id,
    '[
      {"key":"essential","name":"Essential","description":"Front elevation coverage with the core system.",
       "price_per_foot_delta":-3,
       "features":["Front roofline coverage","Warm white + color modes","App control","Lifetime LED warranty"]},
      {"key":"signature","name":"Signature","description":"Full front and side coverage with premium track.",
       "price_per_foot_delta":0,
       "features":["Front and side rooflines","Full RGBW color spectrum","Scheduling and scenes","Color-matched track","Lifetime LED warranty"]},
      {"key":"whole_home","name":"Whole Home","description":"Complete perimeter coverage, every feature enabled.",
       "price_per_foot_delta":4,
       "features":["Complete perimeter coverage","Full RGBW color spectrum","Scheduling, scenes and music sync","Color-matched track","Priority service","Lifetime LED warranty"]}
    ]'::jsonb
  )
  on conflict (company_id) do nothing;

  insert into public.company_catalog_items (company_id, kind, name, description, price, unit, sort_order)
  values
    (p_company_id, 'controller',  'Standard Controller', 'Wi-Fi controller, app enabled',        399.00, 'flat',     1),
    (p_company_id, 'controller',  'Pro Controller',      'Extended range, multi-zone control',   649.00, 'flat',     2),
    (p_company_id, 'track_color', 'Bronze',              null,                                     0.00, 'flat',     1),
    (p_company_id, 'track_color', 'White',               null,                                     0.00, 'flat',     2),
    (p_company_id, 'track_color', 'Black',               null,                                     0.00, 'flat',     3),
    (p_company_id, 'track_color', 'Custom Color Match',  'Paint-matched to trim',                350.00, 'flat',     4),
    (p_company_id, 'adder',       'Second Story Access', 'Additional labor for 2+ story runs',     4.00, 'per_foot', 1),
    (p_company_id, 'adder',       'Steep Pitch',         'Roof pitch above 8/12',                  3.00, 'per_foot', 2),
    (p_company_id, 'adder',       'Landscape Lighting',  'Per fixture installed',                285.00, 'each',     3),
    (p_company_id, 'adder',       'Additional Zone',     'Independent control zone',              225.00, 'each',     4),
    (p_company_id, 'adder',       'Permit',              'Municipal permit filing',               175.00, 'flat',     5),
    (p_company_id, 'discount',    'Neighborhood Referral', 'Referred by an existing customer',      5.00, 'percent',  1),
    (p_company_id, 'discount',    'Seasonal Promotion',    'Current promotional offer',           500.00, 'flat',     2),
    (p_company_id, 'discount',    'Military / First Responder', null,                            250.00, 'flat',     3)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
