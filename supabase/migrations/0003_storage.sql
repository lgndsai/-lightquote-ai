-- =====================================================================
-- Storage buckets + policies
--
-- property-photos / renders / proposals : PRIVATE. Homeowner photographs,
--   AI renders and generated proposals are never reachable by a bare URL —
--   every read goes through a signed URL minted at request time from a
--   caller who has already passed RLS on storage.objects.
-- branding : public READ. Company logos need to render on the signed-out
--   login screen, so this bucket alone stays public.
--
-- Writes on every private bucket are restricted to authenticated users
-- whose company_id matches the first path segment:
-- {company_id}/{quote_id}/{file}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-photos', 'property-photos', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('renders', 'renders', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('branding', 'branding', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('proposals', 'proposals', false, 20971520,
   array['application/pdf', 'text/html'])
on conflict (id) do update set public = excluded.public;

-- Deny rather than error when the first path segment isn't a uuid.
create or replace function public.storage_company_matches(p_name text)
returns boolean
language sql
stable
as $$
  select case
    when (storage.foldername(p_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(p_name))[1]::uuid = public.current_company_id()
    else false
  end;
$$;

grant execute on function public.storage_company_matches(text) to authenticated;

-- ---------------------------------------------------------------- writes
create policy "tenant insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('property-photos', 'renders', 'proposals', 'branding')
    and public.storage_company_matches(name)
  );

create policy "tenant update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('property-photos', 'renders', 'proposals', 'branding')
    and public.storage_company_matches(name)
  )
  with check (
    bucket_id in ('property-photos', 'renders', 'proposals', 'branding')
    and public.storage_company_matches(name)
  );

create policy "tenant delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('property-photos', 'renders', 'proposals', 'branding')
    and public.storage_company_matches(name)
  );

-- ----------------------------------------------------------------- reads
-- Every private bucket is scoped to the caller's own company folder —
-- signed URLs still evaluate against this policy, so a rep can never mint a
-- working URL for another tenant's object even if they guessed the path.
create policy "tenant read own images" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('property-photos', 'renders', 'proposals')
    and public.storage_company_matches(name)
  );

-- branding is the one public bucket (logos render on the signed-out login
-- screen); storage.objects RLS is bypassed entirely for public buckets, so
-- no read policy is needed for it here.
