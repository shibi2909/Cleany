-- ═══════════════════════════════════════════════════════════════════════════
-- Rebrand: CleanNest → Cleany
-- Updates stored settings only where they still hold the old default values,
-- so any custom names entered by an admin are left untouched.
-- Past bookings keep their snapshots (nothing in bookings stores the brand name).
-- ═══════════════════════════════════════════════════════════════════════════

update public.settings
   set value = value || jsonb_build_object('name', 'Cleany')
 where key = 'business' and value ->> 'name' = 'CleanNest';

update public.settings
   set value = value || jsonb_build_object('legal_name', 'Cleany Services')
 where key = 'business' and value ->> 'legal_name' = 'CleanNest Services';

update public.settings
   set value = value || jsonb_build_object('payee_name', 'Cleany Services')
 where key = 'payment' and value ->> 'payee_name' = 'CleanNest Services';
