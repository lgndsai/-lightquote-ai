-- =====================================================================
-- Storage buckets + policies
--
-- property-photos / renders : public READ (unguessable uuid paths) so the
--   n8n workflow and the customer-facing screens can load images without a
--   signing round-trip on every render.
-- proposals : PRIVATE, served through short-lived signed URLs.
--
-- Writes on every bucket are restricted to authenticated users whose
-- company_id matches the first path segment: {company_id}/{quote_id}/{file}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-photos', 'property-photos', true,  20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('renders', 'renders', true, 20971520,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('proposals', 'proposals', false, 20971520,
   array['application/pdf', 'text/html'])
on conflict (id) do nothing;

create or replace function public.storage_company_matches(p_name text)
returns boolean
language sql
stable
as $$
  select nullif((storage.foldername(p_name))[1], '')::uuid = public.current_company_id();
$$;

grant execute on function public.storage_company_matches(text) to authenticated;

-- ---------------------------------------------------------------- writes
create policy "tenant insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('property-photos', 'renders', 'proposals')
    and public.storage_company_matches(name)
  );

create policy "tenant update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('property-photos', 'renders', 'proposals')
    and public.storage_company_matches(name)
  )
  with check (
    bucket_id in ('property-photos', 'renders', 'proposals')
    and public.storage_company_matches(name)
  );

create policy "tenant delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('property-photos', 'renders', 'proposals')
    and public.storage_company_matches(name)
  );

-- ----------------------------------------------------------------- reads
-- Private bucket: only the owning company can read (signed URLs are minted
-- server-side with the caller's session, so this still applies).
create policy "tenant read proposals" on storage.objects
  for select to authenticated
  using (bucket_id = 'proposals' and public.storage_company_matches(name));

create policy "tenant read images" on storage.objects
  for select to authenticated
  using (bucket_id in ('property-photos', 'renders'));
