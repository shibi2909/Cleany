-- ═══════════════════════════════════════════════════════════════════════════
-- Cleany — Storage buckets
--   payment-proofs  (private): <user_id>/<booking_id>/<file>. Uploaded by the
--                   server after validation; customers can read their own files,
--                   admins can read all. Served to admins through signed URLs.
--   service-images  (public):  service photos uploaded by admins.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('service-images', 'service-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "payment proofs: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "payment proofs: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));

create policy "service images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'service-images');

create policy "service images: admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'service-images' and (select public.is_admin()))
  with check (bucket_id = 'service-images' and (select public.is_admin()));
