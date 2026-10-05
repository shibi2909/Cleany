-- ═══════════════════════════════════════════════════════════════════════════
-- Cleany — core schema
-- Money is stored as whole Indian Rupees (integer).
-- Bookings and their history are never physically deleted (see triggers).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────── Helpers ─────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────── Profiles ─────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  email       text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- A new auth user always becomes a *customer*. The role in user metadata is ignored,
-- so nobody can sign themselves up as an admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role changes are only possible from trusted server contexts (service role / SQL editor).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if new.role is distinct from old.role
     and jwt_role in ('anon', 'authenticated') then
    raise exception 'ROLE_CHANGE_FORBIDDEN';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ───────────────────────── Catalogue & pricing ─────────────────────────

create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  description         text not null default '',
  category            text not null default 'Home',
  icon                text not null default 'Sparkles',
  -- BHK_BASE: priced from bhk_pricing; PER_BATHROOM: bathroom_pricing × count; FIXED: services.price
  pricing_type        text not null default 'FIXED' check (pricing_type in ('BHK_BASE', 'PER_BATHROOM', 'FIXED')),
  price               integer not null default 0 check (price >= 0),
  unit_label          text,
  image_url           text,
  duration_minutes    integer,
  is_active           boolean not null default true,
  is_default_selected boolean not null default false,
  is_popular          boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index services_active_sort_idx on public.services (is_active, sort_order);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.bhk_pricing (
  bhk_type     text primary key check (bhk_type in ('1BHK', '2BHK', '3BHK', '4BHK')),
  label        text not null,
  base_price   integer not null check (base_price >= 0),
  typical_sqft integer not null,
  description  text not null default '',
  duration_label text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now()
);
create trigger bhk_pricing_updated_at before update on public.bhk_pricing
  for each row execute function public.set_updated_at();

create table public.area_pricing (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  min_sqft   integer not null check (min_sqft >= 0),
  max_sqft   integer check (max_sqft is null or max_sqft >= min_sqft),
  surcharge  integer not null default 0 check (surcharge >= 0),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger area_pricing_updated_at before update on public.area_pricing
  for each row execute function public.set_updated_at();

create table public.bathroom_pricing (
  bathroom_count     integer primary key check (bathroom_count between 1 and 4),
  label              text not null,
  price_per_bathroom integer not null check (price_per_bathroom >= 0),
  updated_at         timestamptz not null default now()
);
create trigger bathroom_pricing_updated_at before update on public.bathroom_pricing
  for each row execute function public.set_updated_at();

create table public.discounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text not null default '',
  discount_type text not null check (discount_type in ('PERCENTAGE', 'FIXED')),
  value         integer not null check (value > 0),
  min_subtotal  integer not null default 0 check (min_subtotal >= 0),
  max_discount  integer check (max_discount is null or max_discount > 0),
  starts_on     date,
  ends_on       date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (discount_type <> 'PERCENTAGE' or value <= 100)
);
create trigger discounts_updated_at before update on public.discounts
  for each row execute function public.set_updated_at();

-- ───────────────────────── Staff & settings ─────────────────────────

create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text not null,
  status       text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'ON_JOB', 'ON_LEAVE')),
  service_area text not null default '',
  is_active    boolean not null default true,
  notes        text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── Bookings ─────────────────────────

create sequence public.booking_number_seq start with 10001;

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  booking_number       text not null unique default (
    'CLN-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || nextval('public.booking_number_seq')::text
  ),
  user_id              uuid not null references public.profiles (id),

  -- Contact snapshot for this booking
  customer_name        text not null,
  customer_phone       text not null,
  customer_email       text not null,

  -- Home
  bhk_type             text not null check (bhk_type in ('1BHK', '2BHK', '3BHK', '4BHK')),
  area_sqft            integer not null check (area_sqft > 0),
  area_is_approximate  boolean not null default false,
  area_range_label     text,
  bathroom_count       integer not null check (bathroom_count between 1 and 4),

  -- Location
  address              text not null,
  landmark             text,
  pincode              text not null,
  latitude             double precision not null,
  longitude            double precision not null,
  distance_from_center numeric(7, 2) not null,
  serviceable          boolean not null,

  -- Schedule (time_slot is the label snapshot; slot_start is the exact instant)
  booking_date         date not null,
  time_slot            text not null,
  slot_start           timestamptz not null,

  -- Money (server-calculated)
  subtotal             integer not null check (subtotal >= 0),
  discount             integer not null default 0 check (discount >= 0),
  total                integer not null check (total >= 0),

  payment_status       text not null default 'PENDING'
    check (payment_status in ('PENDING', 'PAYMENT_VERIFICATION_PENDING', 'PAID', 'REJECTED', 'REFUNDED')),
  booking_status       text not null default 'REQUESTED'
    check (booking_status in ('REQUESTED', 'PAYMENT_PENDING', 'CONFIRMED', 'ASSIGNED', 'TEAM_ON_THE_WAY',
                              'CLEANING', 'COMPLETED', 'RESCHEDULE_REQUESTED', 'CANCELLATION_REQUESTED', 'CANCELLED')),
  refund_status        text not null default 'NOT_APPLICABLE'
    check (refund_status in ('NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),

  assigned_staff_id    uuid references public.staff (id),
  reschedule_count     integer not null default 0,
  notes                text,
  is_demo              boolean not null default false,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  cancelled_at         timestamptz,
  completed_at         timestamptz,

  check (total = subtotal - discount),
  check (serviceable)
);

create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_date_idx on public.bookings (booking_date);
create index bookings_slot_idx on public.bookings (slot_start) where booking_status <> 'CANCELLED';
create index bookings_status_idx on public.bookings (booking_status);
create index bookings_payment_idx on public.bookings (payment_status);
create index bookings_created_idx on public.bookings (created_at desc);

create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_items (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id),
  service_id            uuid references public.services (id),
  item_type             text not null default 'SERVICE' check (item_type in ('SERVICE', 'AREA_SURCHARGE')),
  service_name_snapshot text not null,
  unit_price            integer not null check (unit_price >= 0),
  quantity              integer not null default 1 check (quantity > 0),
  total_price           integer not null check (total_price >= 0),
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  check (total_price = unit_price * quantity)
);
create index booking_items_booking_idx on public.booking_items (booking_id);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id),
  user_id      uuid not null references public.profiles (id),
  amount       integer not null check (amount >= 0),
  method       text not null default 'UPI',
  status       text not null default 'PENDING'
    check (status in ('PENDING', 'PAYMENT_VERIFICATION_PENDING', 'PAID', 'REJECTED', 'REFUNDED')),
  reference    text,
  proof_path   text,
  submitted_at timestamptz,
  verified_by  uuid references public.profiles (id),
  verified_at  timestamptz,
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id, created_at desc);
create index payments_status_idx on public.payments (status);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.booking_status_history (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  kind       text not null default 'BOOKING'
    check (kind in ('BOOKING', 'PAYMENT', 'REFUND', 'RESCHEDULE', 'CANCELLATION', 'STAFF', 'NOTE')),
  old_status text,
  new_status text,
  changed_by uuid references public.profiles (id),
  note       text,
  created_at timestamptz not null default clock_timestamp()
);
create index booking_history_booking_idx on public.booking_status_history (booking_id, created_at);

create table public.reschedule_requests (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references public.bookings (id),
  user_id                 uuid not null references public.profiles (id),
  old_date                date not null,
  old_time_slot           text not null,
  old_slot_start          timestamptz not null,
  requested_date          date not null,
  requested_time_slot     text not null,
  requested_slot_start    timestamptz not null,
  reason                  text,
  status                  text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  previous_booking_status text not null,
  fee_amount              integer not null default 0,
  admin_note              text,
  reviewed_by             uuid references public.profiles (id),
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now()
);
create index reschedule_booking_idx on public.reschedule_requests (booking_id, created_at desc);
create index reschedule_status_idx on public.reschedule_requests (status);
create unique index reschedule_one_pending_idx on public.reschedule_requests (booking_id) where status = 'PENDING';

create table public.cancellation_requests (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references public.bookings (id),
  user_id                 uuid not null references public.profiles (id),
  reason                  text not null,
  comment                 text,
  status                  text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requires_approval       boolean not null default false,
  previous_booking_status text not null,
  fee_amount              integer not null default 0,
  refund_amount           integer not null default 0,
  admin_note              text,
  reviewed_by             uuid references public.profiles (id),
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now()
);
create index cancellation_booking_idx on public.cancellation_requests (booking_id, created_at desc);
create index cancellation_status_idx on public.cancellation_requests (status);
create unique index cancellation_one_pending_idx on public.cancellation_requests (booking_id) where status = 'PENDING';

create table public.refunds (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id),
  payment_id   uuid references public.payments (id),
  amount       integer not null check (amount >= 0),
  status       text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
  reason       text,
  processed_by uuid references public.profiles (id),
  processed_at timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index refunds_booking_idx on public.refunds (booking_id);
create index refunds_status_idx on public.refunds (status);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- ───────────────────────── Never delete history ─────────────────────────

create or replace function public.prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'HISTORY_IS_IMMUTABLE: rows in % cannot be deleted', tg_table_name;
end;
$$;

create trigger bookings_no_delete before delete on public.bookings
  for each row execute function public.prevent_delete();
create trigger booking_items_no_delete before delete on public.booking_items
  for each row execute function public.prevent_delete();
create trigger payments_no_delete before delete on public.payments
  for each row execute function public.prevent_delete();
create trigger history_no_delete before delete on public.booking_status_history
  for each row execute function public.prevent_delete();
create trigger reschedule_no_delete before delete on public.reschedule_requests
  for each row execute function public.prevent_delete();
create trigger cancellation_no_delete before delete on public.cancellation_requests
  for each row execute function public.prevent_delete();
create trigger refunds_no_delete before delete on public.refunds
  for each row execute function public.prevent_delete();
