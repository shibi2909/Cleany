-- ═══════════════════════════════════════════════════════════════════════════
-- Cleany — Row Level Security
--
-- Model:
--   • Customers can READ only their own rows. They cannot INSERT/UPDATE/DELETE
--     bookings, payments, requests or refunds directly — every write goes through
--     server actions that validate input, recalculate prices and call the
--     transactional functions in 0003 with the service role.
--   • Admins (profiles.role = 'admin') can read and manage business data.
--   • Catalogue, pricing and public settings are readable by everyone.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles               enable row level security;
alter table public.services               enable row level security;
alter table public.bhk_pricing            enable row level security;
alter table public.area_pricing           enable row level security;
alter table public.bathroom_pricing       enable row level security;
alter table public.discounts              enable row level security;
alter table public.staff                  enable row level security;
alter table public.settings               enable row level security;
alter table public.bookings               enable row level security;
alter table public.booking_items          enable row level security;
alter table public.payments               enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.reschedule_requests    enable row level security;
alter table public.cancellation_requests  enable row level security;
alter table public.refunds                enable row level security;

-- ───────── profiles ─────────
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "profiles: admin update" on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ───────── public catalogue ─────────
create policy "services: public read active" on public.services
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "services: admin write" on public.services
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "bhk_pricing: public read" on public.bhk_pricing
  for select to anon, authenticated using (true);
create policy "bhk_pricing: admin write" on public.bhk_pricing
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "area_pricing: public read" on public.area_pricing
  for select to anon, authenticated using (true);
create policy "area_pricing: admin write" on public.area_pricing
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "bathroom_pricing: public read" on public.bathroom_pricing
  for select to anon, authenticated using (true);
create policy "bathroom_pricing: admin write" on public.bathroom_pricing
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "discounts: public read active" on public.discounts
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "discounts: admin write" on public.discounts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Settings hold business-facing configuration only (UPI ID, policies, slots).
-- Secrets never live here; they stay in server environment variables.
create policy "settings: public read" on public.settings
  for select to anon, authenticated using (true);
create policy "settings: admin write" on public.settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ───────── staff (admin only) ─────────
create policy "staff: admin all" on public.staff
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ───────── bookings & children ─────────
create policy "bookings: read own" on public.bookings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "bookings: admin read" on public.bookings
  for select to authenticated using ((select public.is_admin()));

create policy "booking_items: read own" on public.booking_items
  for select to authenticated using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
  );
create policy "booking_items: admin read" on public.booking_items
  for select to authenticated using ((select public.is_admin()));

create policy "payments: read own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "payments: admin read" on public.payments
  for select to authenticated using ((select public.is_admin()));

create policy "history: read own" on public.booking_status_history
  for select to authenticated using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
  );
create policy "history: admin read" on public.booking_status_history
  for select to authenticated using ((select public.is_admin()));

create policy "reschedule: read own" on public.reschedule_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reschedule: admin read" on public.reschedule_requests
  for select to authenticated using ((select public.is_admin()));

create policy "cancellation: read own" on public.cancellation_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cancellation: admin read" on public.cancellation_requests
  for select to authenticated using ((select public.is_admin()));

create policy "refunds: read own" on public.refunds
  for select to authenticated using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
  );
create policy "refunds: admin read" on public.refunds
  for select to authenticated using ((select public.is_admin()));
