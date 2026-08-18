-- =====================================================================
-- Row Level Security — tenant isolation + role rules
--
--   admin    : full access to everything inside their company
--   manager   : read all company records, write their own
--   sales_rep : read/write only records they created
--
-- The helpers below are SECURITY DEFINER so that a policy on public.users
-- never has to read public.users through RLS (which would recurse).
-- =====================================================================

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where id = auth.uid();
$$;

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- Read rule shared by every owned business record.
create or replace function public.can_read_record(p_company_id uuid, p_owner uuid)
returns boolean
language sql
stable
as $$
  select p_company_id = public.current_company_id()
     and (public.current_app_role() in ('admin', 'manager') or p_owner = auth.uid());
$$;

-- Write rule: managers may not edit another rep's record; admins may.
create or replace function public.can_write_record(p_company_id uuid, p_owner uuid)
returns boolean
language sql
stable
as $$
  select p_company_id = public.current_company_id()
     and (public.current_app_role() = 'admin' or p_owner = auth.uid());
$$;

-- Child rows (quote_adders, designs, proposals) inherit their quote's access.
create or replace function public.can_read_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.quotes q
    where q.id = p_quote_id
      and q.company_id = public.current_company_id()
      and (public.current_app_role() in ('admin', 'manager') or q.created_by = auth.uid())
  );
$$;

create or replace function public.can_write_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.quotes q
    where q.id = p_quote_id
      and q.company_id = public.current_company_id()
      and (public.current_app_role() = 'admin' or q.created_by = auth.uid())
  );
$$;

grant execute on function public.current_company_id()            to authenticated;
grant execute on function public.current_app_role()              to authenticated;
grant execute on function public.can_read_record(uuid, uuid)     to authenticated;
grant execute on function public.can_write_record(uuid, uuid)    to authenticated;
grant execute on function public.can_read_quote(uuid)            to authenticated;
grant execute on function public.can_write_quote(uuid)           to authenticated;

-- --------------------------------------------------------------- enable
alter table public.companies             enable row level security;
alter table public.users                 enable row level security;
alter table public.customers             enable row level security;
alter table public.properties            enable row level security;
alter table public.quotes                enable row level security;
alter table public.designs               enable row level security;
alter table public.company_pricing       enable row level security;
alter table public.company_catalog_items enable row level security;
alter table public.quote_adders          enable row level security;
alter table public.finance_programs      enable row level security;
alter table public.proposals             enable row level security;
alter table public.projects              enable row level security;

-- ------------------------------------------------------------ companies
create policy companies_select on public.companies
  for select to authenticated
  using (id = public.current_company_id());

create policy companies_update on public.companies
  for update to authenticated
  using (id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (id = public.current_company_id());

-- ---------------------------------------------------------------- users
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_select_company on public.users
  for select to authenticated
  using (company_id = public.current_company_id());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.current_company_id());

create policy users_admin_write on public.users
  for all to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_app_role() = 'admin');

-- ------------------------------------------------------------ customers
create policy customers_select on public.customers
  for select to authenticated
  using (public.can_read_record(company_id, created_by));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (company_id = public.current_company_id() and created_by = auth.uid());

create policy customers_update on public.customers
  for update to authenticated
  using (public.can_write_record(company_id, created_by))
  with check (company_id = public.current_company_id());

create policy customers_delete on public.customers
  for delete to authenticated
  using (public.can_write_record(company_id, created_by));

-- ----------------------------------------------------------- properties
create policy properties_select on public.properties
  for select to authenticated
  using (public.can_read_record(company_id, created_by));

create policy properties_insert on public.properties
  for insert to authenticated
  with check (company_id = public.current_company_id() and created_by = auth.uid());

create policy properties_update on public.properties
  for update to authenticated
  using (public.can_write_record(company_id, created_by))
  with check (company_id = public.current_company_id());

create policy properties_delete on public.properties
  for delete to authenticated
  using (public.can_write_record(company_id, created_by));

-- --------------------------------------------------------------- quotes
create policy quotes_select on public.quotes
  for select to authenticated
  using (public.can_read_record(company_id, created_by));

create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (company_id = public.current_company_id() and created_by = auth.uid());

create policy quotes_update on public.quotes
  for update to authenticated
  using (public.can_write_record(company_id, created_by))
  with check (company_id = public.current_company_id());

create policy quotes_delete on public.quotes
  for delete to authenticated
  using (public.can_write_record(company_id, created_by));

-- -------------------------------------------------------------- designs
create policy designs_select on public.designs
  for select to authenticated
  using (public.can_read_quote(quote_id));

create policy designs_insert on public.designs
  for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_write_quote(quote_id));

create policy designs_update on public.designs
  for update to authenticated
  using (public.can_write_quote(quote_id))
  with check (company_id = public.current_company_id());

create policy designs_delete on public.designs
  for delete to authenticated
  using (public.can_write_quote(quote_id));

-- --------------------------------------------------------- quote_adders
create policy quote_adders_select on public.quote_adders
  for select to authenticated
  using (public.can_read_quote(quote_id));

create policy quote_adders_write on public.quote_adders
  for all to authenticated
  using (public.can_write_quote(quote_id))
  with check (company_id = public.current_company_id() and public.can_write_quote(quote_id));

-- ------------------------------------------------------ pricing + catalog
-- Everyone in the company reads pricing (the quote screens need it);
-- only admins change it.
create policy company_pricing_select on public.company_pricing
  for select to authenticated
  using (company_id = public.current_company_id());

create policy company_pricing_admin on public.company_pricing
  for all to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_app_role() = 'admin');

create policy catalog_select on public.company_catalog_items
  for select to authenticated
  using (company_id = public.current_company_id());

create policy catalog_admin on public.company_catalog_items
  for all to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_app_role() = 'admin');

create policy finance_programs_select on public.finance_programs
  for select to authenticated
  using (company_id = public.current_company_id());

create policy finance_programs_admin on public.finance_programs
  for all to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_app_role() = 'admin');

-- ------------------------------------------------------------ proposals
create policy proposals_select on public.proposals
  for select to authenticated
  using (public.can_read_quote(quote_id));

create policy proposals_write on public.proposals
  for all to authenticated
  using (public.can_write_quote(quote_id))
  with check (company_id = public.current_company_id() and public.can_write_quote(quote_id));

-- ------------------------------------------------------------- projects
create policy projects_select on public.projects
  for select to authenticated
  using (public.can_read_record(company_id, sales_rep_id));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_write_quote(quote_id));

create policy projects_update on public.projects
  for update to authenticated
  using (public.can_write_record(company_id, sales_rep_id))
  with check (company_id = public.current_company_id());

create policy projects_delete on public.projects
  for delete to authenticated
  using (company_id = public.current_company_id() and public.current_app_role() = 'admin');
