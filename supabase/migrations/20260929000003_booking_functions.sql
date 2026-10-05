-- ═══════════════════════════════════════════════════════════════════════════
-- Cleany — transactional booking workflow
--
-- These functions are the ONLY write path for bookings, payments, requests and
-- refunds. They are executable by the service role only; server actions call
-- them after authenticating the user, validating input and recalculating prices.
--
-- Each function locks the booking row, re-checks state (so a stale or forged
-- request cannot move a booking into an invalid state) and writes an audit row
-- to booking_status_history. Errors are raised with stable codes the app maps
-- to friendly messages.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._log_history(
  p_booking_id uuid, p_kind text, p_old text, p_new text, p_actor uuid, p_note text
) returns void
language sql
as $$
  insert into public.booking_status_history (booking_id, kind, old_status, new_status, changed_by, note)
  values (p_booking_id, p_kind, p_old, p_new, p_actor, p_note);
$$;

create or replace function public._slot_label(p_date date, p_slot text)
returns text
language sql
immutable
as $$
  select to_char(p_date, 'FMDD FMMonth YYYY') || ', ' || p_slot;
$$;

-- When a request is closed we return the booking to the status it had before.
-- If the payment was verified in the meantime, that status moves forward to CONFIRMED.
create or replace function public._resolve_status(p_previous text, p_payment_status text)
returns text
language sql
immutable
as $$
  select case
    when p_previous in ('REQUESTED', 'PAYMENT_PENDING') and p_payment_status = 'PAID' then 'CONFIRMED'
    else p_previous
  end;
$$;

-- ───────────────────────── Create booking ─────────────────────────

create or replace function public.create_booking(p_booking jsonb, p_items jsonb, p_slot_capacity integer)
returns jsonb
language plpgsql
as $$
declare
  v_booking   public.bookings;
  v_slot      timestamptz := (p_booking ->> 'slot_start')::timestamptz;
  v_taken     integer;
  v_items_sum integer;
begin
  if v_slot <= now() then
    raise exception 'SLOT_IN_PAST';
  end if;

  -- Serialise bookings per slot so capacity cannot be exceeded by concurrent requests.
  perform pg_advisory_xact_lock(hashtext('slot:' || v_slot::text));

  select count(*) into v_taken
  from public.bookings
  where slot_start = v_slot and booking_status <> 'CANCELLED';

  if v_taken >= p_slot_capacity then
    raise exception 'SLOT_FULL';
  end if;

  select coalesce(sum((i ->> 'unit_price')::int * (i ->> 'quantity')::int), 0)
  into v_items_sum
  from jsonb_array_elements(p_items) as i;

  if v_items_sum <> (p_booking ->> 'subtotal')::int then
    raise exception 'PRICE_MISMATCH';
  end if;

  insert into public.bookings (
    user_id, customer_name, customer_phone, customer_email,
    bhk_type, area_sqft, area_is_approximate, area_range_label, bathroom_count,
    address, landmark, pincode, latitude, longitude, distance_from_center, serviceable,
    booking_date, time_slot, slot_start,
    subtotal, discount, total, notes, is_demo
  ) values (
    (p_booking ->> 'user_id')::uuid,
    p_booking ->> 'customer_name',
    p_booking ->> 'customer_phone',
    p_booking ->> 'customer_email',
    p_booking ->> 'bhk_type',
    (p_booking ->> 'area_sqft')::int,
    coalesce((p_booking ->> 'area_is_approximate')::boolean, false),
    p_booking ->> 'area_range_label',
    (p_booking ->> 'bathroom_count')::int,
    p_booking ->> 'address',
    nullif(p_booking ->> 'landmark', ''),
    p_booking ->> 'pincode',
    (p_booking ->> 'latitude')::double precision,
    (p_booking ->> 'longitude')::double precision,
    (p_booking ->> 'distance_from_center')::numeric,
    (p_booking ->> 'serviceable')::boolean,
    (p_booking ->> 'booking_date')::date,
    p_booking ->> 'time_slot',
    v_slot,
    (p_booking ->> 'subtotal')::int,
    (p_booking ->> 'discount')::int,
    (p_booking ->> 'total')::int,
    nullif(p_booking ->> 'notes', ''),
    coalesce((p_booking ->> 'is_demo')::boolean, false)
  )
  returning * into v_booking;

  insert into public.booking_items (
    booking_id, service_id, item_type, service_name_snapshot, unit_price, quantity, total_price, sort_order
  )
  select
    v_booking.id,
    nullif(i ->> 'service_id', '')::uuid,
    coalesce(i ->> 'item_type', 'SERVICE'),
    i ->> 'name',
    (i ->> 'unit_price')::int,
    (i ->> 'quantity')::int,
    (i ->> 'unit_price')::int * (i ->> 'quantity')::int,
    ord::int
  from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  insert into public.payments (booking_id, user_id, amount, status)
  values (v_booking.id, v_booking.user_id, v_booking.total, 'PENDING');

  perform public._log_history(v_booking.id, 'BOOKING', null, 'REQUESTED', v_booking.user_id, 'Booking requested');

  return jsonb_build_object('id', v_booking.id, 'booking_number', v_booking.booking_number);
end;
$$;

-- ───────────────────────── Payments ─────────────────────────

-- Customer uploads a screenshot / reference. Moves payment to verification.
create or replace function public.submit_payment_proof(
  p_booking_id uuid, p_user_id uuid, p_reference text, p_proof_path text
) returns void
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.user_id <> p_user_id then
    raise exception 'NOT_FOUND';
  end if;
  if v_booking.booking_status in ('CANCELLED', 'CANCELLATION_REQUESTED', 'COMPLETED') then
    raise exception 'INVALID_STATE';
  end if;
  if v_booking.payment_status not in ('PENDING', 'REJECTED') then
    raise exception 'PAYMENT_ALREADY_SUBMITTED';
  end if;

  select * into v_payment from public.payments
  where booking_id = p_booking_id and status = 'PENDING'
  order by created_at desc limit 1;

  if found then
    update public.payments
       set status = 'PAYMENT_VERIFICATION_PENDING', reference = nullif(p_reference, ''),
           proof_path = p_proof_path, submitted_at = now()
     where id = v_payment.id;
  else
    -- Previous attempt was rejected: keep it and record a fresh attempt.
    insert into public.payments (booking_id, user_id, amount, status, reference, proof_path, submitted_at)
    values (p_booking_id, p_user_id, v_booking.total, 'PAYMENT_VERIFICATION_PENDING',
            nullif(p_reference, ''), p_proof_path, now());
  end if;

  update public.bookings set payment_status = 'PAYMENT_VERIFICATION_PENDING' where id = p_booking_id;
  perform public._log_history(p_booking_id, 'PAYMENT', v_booking.payment_status, 'PAYMENT_VERIFICATION_PENDING',
                              p_user_id, 'Payment proof submitted by customer');
end;
$$;

-- Admin verifies (or rejects) a payment. Only this can make a payment PAID.
create or replace function public.review_payment(
  p_booking_id uuid, p_admin_id uuid, p_approve boolean, p_reference text, p_note text
) returns void
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.booking_status = 'CANCELLED' then raise exception 'INVALID_STATE'; end if;
  if v_booking.payment_status in ('PAID', 'REFUNDED') then raise exception 'PAYMENT_ALREADY_VERIFIED'; end if;

  -- The latest open attempt (with or without an uploaded proof — customers may send it on WhatsApp).
  select * into v_payment from public.payments
  where booking_id = p_booking_id and status in ('PENDING', 'PAYMENT_VERIFICATION_PENDING')
  order by created_at desc limit 1;

  if not found then
    if not p_approve then raise exception 'NOTHING_TO_REVIEW'; end if;
    insert into public.payments (booking_id, user_id, amount, status)
    values (p_booking_id, v_booking.user_id, v_booking.total, 'PENDING')
    returning * into v_payment;
  end if;

  if p_approve then
    update public.payments
       set status = 'PAID', verified_by = p_admin_id, verified_at = now(),
           reference = coalesce(nullif(p_reference, ''), reference), admin_note = nullif(p_note, '')
     where id = v_payment.id;
    update public.bookings set payment_status = 'PAID' where id = p_booking_id;
    perform public._log_history(p_booking_id, 'PAYMENT', v_booking.payment_status, 'PAID', p_admin_id,
                                coalesce(nullif(p_note, ''), 'Payment verified'));

    if v_booking.booking_status in ('REQUESTED', 'PAYMENT_PENDING') then
      update public.bookings set booking_status = 'CONFIRMED' where id = p_booking_id;
      perform public._log_history(p_booking_id, 'BOOKING', v_booking.booking_status, 'CONFIRMED', p_admin_id,
                                  'Booking confirmed after payment verification');
    end if;
  else
    update public.payments
       set status = 'REJECTED', verified_by = p_admin_id, verified_at = now(), admin_note = nullif(p_note, '')
     where id = v_payment.id;
    update public.bookings set payment_status = 'REJECTED' where id = p_booking_id;
    perform public._log_history(p_booking_id, 'PAYMENT', v_booking.payment_status, 'REJECTED', p_admin_id,
                                coalesce(nullif(p_note, ''), 'Payment could not be verified'));
  end if;
end;
$$;

-- ───────────────────────── Operational status ─────────────────────────

create or replace function public.update_booking_status(
  p_booking_id uuid, p_admin_id uuid, p_new_status text, p_note text
) returns void
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_ok boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  v_ok := case
    when v_booking.booking_status = 'REQUESTED'       and p_new_status = 'PAYMENT_PENDING' then true
    when v_booking.booking_status in ('REQUESTED', 'PAYMENT_PENDING') and p_new_status = 'CONFIRMED'
         then v_booking.payment_status = 'PAID'
    when v_booking.booking_status = 'CONFIRMED'       and p_new_status = 'ASSIGNED'
         then v_booking.assigned_staff_id is not null
    when v_booking.booking_status = 'ASSIGNED'        and p_new_status = 'TEAM_ON_THE_WAY' then true
    when v_booking.booking_status = 'TEAM_ON_THE_WAY' and p_new_status = 'CLEANING' then true
    when v_booking.booking_status = 'CLEANING'        and p_new_status = 'COMPLETED' then true
    else false
  end;

  if not v_ok then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.bookings
     set booking_status = p_new_status,
         completed_at = case when p_new_status = 'COMPLETED' then now() else completed_at end
   where id = p_booking_id;

  perform public._log_history(p_booking_id, 'BOOKING', v_booking.booking_status, p_new_status, p_admin_id, nullif(p_note, ''));
end;
$$;

create or replace function public.assign_staff(p_booking_id uuid, p_admin_id uuid, p_staff_id uuid)
returns void
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_staff   public.staff;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.booking_status not in ('CONFIRMED', 'ASSIGNED', 'RESCHEDULE_REQUESTED') then
    raise exception 'INVALID_STATE';
  end if;

  select * into v_staff from public.staff where id = p_staff_id and is_active;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;

  update public.bookings set assigned_staff_id = p_staff_id where id = p_booking_id;
  perform public._log_history(p_booking_id, 'STAFF', null, null, p_admin_id, 'Assigned to ' || v_staff.full_name);

  if v_booking.booking_status = 'CONFIRMED' then
    update public.bookings set booking_status = 'ASSIGNED' where id = p_booking_id;
    perform public._log_history(p_booking_id, 'BOOKING', 'CONFIRMED', 'ASSIGNED', p_admin_id, 'Staff assigned');
  end if;
end;
$$;

-- ───────────────────────── Rescheduling ─────────────────────────

create or replace function public._apply_reschedule(
  p_booking public.bookings, p_new_date date, p_new_slot text, p_new_slot_start timestamptz,
  p_restore_status text, p_actor uuid, p_slot_capacity integer
) returns void
language plpgsql
as $$
declare
  v_taken integer;
begin
  perform pg_advisory_xact_lock(hashtext('slot:' || p_new_slot_start::text));
  select count(*) into v_taken from public.bookings
  where slot_start = p_new_slot_start and booking_status <> 'CANCELLED' and id <> p_booking.id;
  if v_taken >= p_slot_capacity then raise exception 'SLOT_FULL'; end if;

  update public.bookings
     set booking_date = p_new_date, time_slot = p_new_slot, slot_start = p_new_slot_start,
         booking_status = public._resolve_status(p_restore_status, p_booking.payment_status),
         reschedule_count = reschedule_count + 1
   where id = p_booking.id;

  perform public._log_history(
    p_booking.id, 'RESCHEDULE', p_booking.booking_status,
    public._resolve_status(p_restore_status, p_booking.payment_status), p_actor,
    'Booking rescheduled from ' || public._slot_label(p_booking.booking_date, p_booking.time_slot)
      || ' to ' || public._slot_label(p_new_date, p_new_slot) || '.'
  );
end;
$$;

create or replace function public.request_reschedule(
  p_booking_id uuid, p_user_id uuid, p_new_date date, p_new_slot text, p_new_slot_start timestamptz,
  p_reason text, p_fee integer, p_requires_approval boolean, p_max_reschedules integer, p_slot_capacity integer
) returns jsonb
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_request public.reschedule_requests;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.user_id <> p_user_id then raise exception 'NOT_FOUND'; end if;
  if v_booking.booking_status not in ('REQUESTED', 'PAYMENT_PENDING', 'CONFIRMED', 'ASSIGNED') then
    raise exception 'INVALID_STATE';
  end if;
  if v_booking.reschedule_count >= p_max_reschedules then raise exception 'RESCHEDULE_LIMIT'; end if;
  if p_new_slot_start <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if p_new_slot_start = v_booking.slot_start then raise exception 'SAME_SLOT'; end if;

  insert into public.reschedule_requests (
    booking_id, user_id, old_date, old_time_slot, old_slot_start,
    requested_date, requested_time_slot, requested_slot_start, reason,
    status, previous_booking_status, fee_amount
  ) values (
    p_booking_id, p_user_id, v_booking.booking_date, v_booking.time_slot, v_booking.slot_start,
    p_new_date, p_new_slot, p_new_slot_start, nullif(p_reason, ''),
    'PENDING', v_booking.booking_status, coalesce(p_fee, 0)
  ) returning * into v_request;

  if p_requires_approval then
    update public.bookings set booking_status = 'RESCHEDULE_REQUESTED' where id = p_booking_id;
    perform public._log_history(p_booking_id, 'RESCHEDULE', v_booking.booking_status, 'RESCHEDULE_REQUESTED', p_user_id,
      'Reschedule requested to ' || public._slot_label(p_new_date, p_new_slot));
    return jsonb_build_object('request_id', v_request.id, 'status', 'PENDING');
  end if;

  perform public._apply_reschedule(v_booking, p_new_date, p_new_slot, p_new_slot_start,
                                   v_booking.booking_status, p_user_id, p_slot_capacity);
  update public.reschedule_requests set status = 'APPROVED', reviewed_at = now(),
         admin_note = 'Automatically approved by rescheduling policy'
   where id = v_request.id;
  return jsonb_build_object('request_id', v_request.id, 'status', 'APPROVED');
end;
$$;

create or replace function public.review_reschedule(
  p_request_id uuid, p_admin_id uuid, p_approve boolean, p_note text, p_slot_capacity integer
) returns void
language plpgsql
as $$
declare
  v_request public.reschedule_requests;
  v_booking public.bookings;
begin
  select * into v_request from public.reschedule_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_request.status <> 'PENDING' then raise exception 'ALREADY_REVIEWED'; end if;

  select * into v_booking from public.bookings where id = v_request.booking_id for update;
  if v_booking.booking_status <> 'RESCHEDULE_REQUESTED' then raise exception 'INVALID_STATE'; end if;

  if p_approve then
    if v_request.requested_slot_start <= now() then raise exception 'SLOT_IN_PAST'; end if;
    perform public._apply_reschedule(v_booking, v_request.requested_date, v_request.requested_time_slot,
                                     v_request.requested_slot_start, v_request.previous_booking_status,
                                     p_admin_id, p_slot_capacity);
  else
    update public.bookings
       set booking_status = public._resolve_status(v_request.previous_booking_status, v_booking.payment_status)
     where id = v_booking.id;
    perform public._log_history(v_booking.id, 'RESCHEDULE', 'RESCHEDULE_REQUESTED',
      public._resolve_status(v_request.previous_booking_status, v_booking.payment_status),
      p_admin_id, 'Reschedule request rejected' || coalesce(': ' || nullif(p_note, ''), ''));
  end if;

  update public.reschedule_requests
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
         admin_note = nullif(p_note, ''), reviewed_by = p_admin_id, reviewed_at = now()
   where id = p_request_id;
end;
$$;

create or replace function public.withdraw_reschedule_request(p_request_id uuid, p_user_id uuid)
returns void
language plpgsql
as $$
declare
  v_request public.reschedule_requests;
  v_booking public.bookings;
begin
  select * into v_request from public.reschedule_requests where id = p_request_id for update;
  if not found or v_request.user_id <> p_user_id then raise exception 'NOT_FOUND'; end if;
  if v_request.status <> 'PENDING' then raise exception 'ALREADY_REVIEWED'; end if;

  select * into v_booking from public.bookings where id = v_request.booking_id for update;
  update public.reschedule_requests set status = 'CANCELLED', reviewed_at = now(),
         admin_note = 'Withdrawn by customer' where id = p_request_id;
  update public.bookings
     set booking_status = public._resolve_status(v_request.previous_booking_status, v_booking.payment_status)
   where id = v_request.booking_id and booking_status = 'RESCHEDULE_REQUESTED';
  perform public._log_history(v_request.booking_id, 'RESCHEDULE', 'RESCHEDULE_REQUESTED',
                              public._resolve_status(v_request.previous_booking_status, v_booking.payment_status),
                              p_user_id, 'Reschedule request withdrawn');
end;
$$;

-- ───────────────────────── Cancellation & refunds ─────────────────────────

create or replace function public._finalize_cancellation(
  p_booking_id uuid, p_actor uuid, p_refund_amount integer, p_note text
) returns text
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_paid    public.payments;
  v_refund_status text := 'NOT_APPLICABLE';
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.payment_status = 'PAYMENT_VERIFICATION_PENDING' then
    -- Money may have been sent; an admin must verify or reject it first.
    raise exception 'VERIFY_PAYMENT_FIRST';
  end if;

  if v_booking.payment_status = 'PAID' and coalesce(p_refund_amount, 0) > 0 then
    select * into v_paid from public.payments
    where booking_id = p_booking_id and status = 'PAID' order by verified_at desc nulls last limit 1;

    insert into public.refunds (booking_id, payment_id, amount, status, reason)
    values (p_booking_id, v_paid.id, least(p_refund_amount, v_booking.total), 'PENDING',
            coalesce(nullif(p_note, ''), 'Booking cancelled'));
    v_refund_status := 'PENDING';
  end if;

  -- Any open reschedule request is superseded by the cancellation.
  update public.reschedule_requests set status = 'CANCELLED', reviewed_at = now(),
         admin_note = 'Superseded by cancellation'
   where booking_id = p_booking_id and status = 'PENDING';

  update public.bookings
     set booking_status = 'CANCELLED', cancelled_at = now(), refund_status = v_refund_status
   where id = p_booking_id;

  perform public._log_history(p_booking_id, 'CANCELLATION', v_booking.booking_status, 'CANCELLED', p_actor,
                              coalesce(nullif(p_note, ''), 'Booking cancelled'));
  if v_refund_status = 'PENDING' then
    perform public._log_history(p_booking_id, 'REFUND', 'NOT_APPLICABLE', 'PENDING', p_actor,
                                'Refund of ₹' || least(p_refund_amount, v_booking.total) || ' pending manual processing');
  end if;
  return v_refund_status;
end;
$$;

create or replace function public.request_cancellation(
  p_booking_id uuid, p_user_id uuid, p_reason text, p_comment text,
  p_requires_approval boolean, p_fee integer, p_refund_amount integer
) returns jsonb
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_request public.cancellation_requests;
  v_previous text;
  v_requires_approval boolean := p_requires_approval;
  v_refund_status text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.user_id <> p_user_id then raise exception 'NOT_FOUND'; end if;
  if v_booking.booking_status not in ('REQUESTED', 'PAYMENT_PENDING', 'CONFIRMED', 'ASSIGNED', 'RESCHEDULE_REQUESTED') then
    raise exception 'INVALID_STATE';
  end if;

  -- An unverified payment always needs an admin to look at it.
  if v_booking.payment_status = 'PAYMENT_VERIFICATION_PENDING' then
    v_requires_approval := true;
  end if;

  v_previous := v_booking.booking_status;
  if v_previous = 'RESCHEDULE_REQUESTED' then
    select previous_booking_status into v_previous from public.reschedule_requests
    where booking_id = p_booking_id and status = 'PENDING' limit 1;
    v_previous := coalesce(v_previous, 'CONFIRMED');
  end if;

  insert into public.cancellation_requests (
    booking_id, user_id, reason, comment, status, requires_approval,
    previous_booking_status, fee_amount, refund_amount
  ) values (
    p_booking_id, p_user_id, p_reason, nullif(p_comment, ''), 'PENDING', v_requires_approval,
    v_previous, coalesce(p_fee, 0),
    case when v_booking.payment_status = 'PAID' then greatest(coalesce(p_refund_amount, 0), 0) else 0 end
  ) returning * into v_request;

  if v_requires_approval then
    update public.reschedule_requests set status = 'CANCELLED', reviewed_at = now(),
           admin_note = 'Superseded by cancellation request'
     where booking_id = p_booking_id and status = 'PENDING';
    update public.bookings set booking_status = 'CANCELLATION_REQUESTED' where id = p_booking_id;
    perform public._log_history(p_booking_id, 'CANCELLATION', v_booking.booking_status, 'CANCELLATION_REQUESTED',
                                p_user_id, 'Cancellation requested: ' || p_reason);
    return jsonb_build_object('request_id', v_request.id, 'status', 'PENDING', 'refund_status', v_booking.refund_status);
  end if;

  v_refund_status := public._finalize_cancellation(p_booking_id, p_user_id, v_request.refund_amount,
                                                   'Cancelled by customer: ' || p_reason);
  update public.cancellation_requests set status = 'APPROVED', reviewed_at = now(),
         admin_note = 'Automatically approved by cancellation policy'
   where id = v_request.id;
  return jsonb_build_object('request_id', v_request.id, 'status', 'APPROVED', 'refund_status', v_refund_status);
end;
$$;

create or replace function public.review_cancellation(
  p_request_id uuid, p_admin_id uuid, p_approve boolean, p_note text, p_refund_amount integer
) returns void
language plpgsql
as $$
declare
  v_request public.cancellation_requests;
  v_booking public.bookings;
  v_refund integer;
begin
  select * into v_request from public.cancellation_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_request.status <> 'PENDING' then raise exception 'ALREADY_REVIEWED'; end if;

  select * into v_booking from public.bookings where id = v_request.booking_id for update;
  if v_booking.booking_status <> 'CANCELLATION_REQUESTED' then raise exception 'INVALID_STATE'; end if;

  if p_approve then
    v_refund := case when v_booking.payment_status = 'PAID'
                     then coalesce(p_refund_amount, v_request.refund_amount) else 0 end;
    perform public._finalize_cancellation(v_booking.id, p_admin_id, v_refund,
      'Cancellation approved' || coalesce(': ' || nullif(p_note, ''), ''));
    update public.cancellation_requests
       set status = 'APPROVED', refund_amount = v_refund, admin_note = nullif(p_note, ''),
           reviewed_by = p_admin_id, reviewed_at = now()
     where id = p_request_id;
  else
    update public.bookings
       set booking_status = public._resolve_status(v_request.previous_booking_status, v_booking.payment_status)
     where id = v_booking.id;
    perform public._log_history(v_booking.id, 'CANCELLATION', 'CANCELLATION_REQUESTED',
      public._resolve_status(v_request.previous_booking_status, v_booking.payment_status),
      p_admin_id, 'Cancellation request rejected' || coalesce(': ' || nullif(p_note, ''), ''));
    update public.cancellation_requests
       set status = 'REJECTED', admin_note = nullif(p_note, ''), reviewed_by = p_admin_id, reviewed_at = now()
     where id = p_request_id;
  end if;
end;
$$;

-- Admin cancels on the customer's behalf (e.g. requested over WhatsApp or phone).
create or replace function public.admin_cancel_booking(
  p_booking_id uuid, p_admin_id uuid, p_reason text, p_refund_amount integer
) returns text
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_result  text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_booking.booking_status in ('CANCELLED', 'COMPLETED') then raise exception 'INVALID_STATE'; end if;

  -- Close any open customer request so the audit trail stays consistent.
  update public.cancellation_requests set status = 'APPROVED', reviewed_by = p_admin_id, reviewed_at = now(),
         admin_note = coalesce(admin_note, 'Cancelled by admin')
   where booking_id = p_booking_id and status = 'PENDING';

  v_result := public._finalize_cancellation(p_booking_id, p_admin_id,
                case when v_booking.payment_status = 'PAID' then coalesce(p_refund_amount, v_booking.total) else 0 end,
                'Cancelled by admin: ' || coalesce(nullif(p_reason, ''), 'no reason given'));
  return v_result;
end;
$$;

create or replace function public.update_refund(
  p_refund_id uuid, p_admin_id uuid, p_status text, p_note text, p_amount integer
) returns void
language plpgsql
as $$
declare
  v_refund  public.refunds;
  v_booking public.bookings;
  v_ok boolean;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  v_ok := case
    when v_refund.status = 'PENDING'    and p_status in ('PROCESSING', 'COMPLETED', 'REJECTED') then true
    when v_refund.status = 'PROCESSING' and p_status in ('COMPLETED', 'REJECTED') then true
    else false
  end;
  if not v_ok then raise exception 'INVALID_TRANSITION'; end if;

  select * into v_booking from public.bookings where id = v_refund.booking_id for update;
  if p_amount is not null and (p_amount < 0 or p_amount > v_booking.total) then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.refunds
     set status = p_status,
         amount = coalesce(p_amount, amount),
         notes = coalesce(nullif(p_note, ''), notes),
         processed_by = p_admin_id,
         processed_at = case when p_status in ('COMPLETED', 'REJECTED') then now() else processed_at end
   where id = p_refund_id;

  update public.bookings set refund_status = p_status where id = v_refund.booking_id;

  if p_status = 'COMPLETED' then
    update public.bookings set payment_status = 'REFUNDED' where id = v_refund.booking_id;
    if v_refund.payment_id is not null then
      update public.payments set status = 'REFUNDED' where id = v_refund.payment_id;
    end if;
    perform public._log_history(v_refund.booking_id, 'PAYMENT', v_booking.payment_status, 'REFUNDED', p_admin_id,
      'Refund of ₹' || coalesce(p_amount, v_refund.amount) || ' completed');
  end if;

  perform public._log_history(v_refund.booking_id, 'REFUND', v_refund.status, p_status, p_admin_id, nullif(p_note, ''));
end;
$$;

-- ───────────────────────── Permissions ─────────────────────────
-- Only the service role (used by trusted server code) may run workflow functions.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public._log_history(uuid, text, text, text, uuid, text)',
    'public.create_booking(jsonb, jsonb, integer)',
    'public.submit_payment_proof(uuid, uuid, text, text)',
    'public.review_payment(uuid, uuid, boolean, text, text)',
    'public.update_booking_status(uuid, uuid, text, text)',
    'public.assign_staff(uuid, uuid, uuid)',
    'public._apply_reschedule(public.bookings, date, text, timestamptz, text, uuid, integer)',
    'public.request_reschedule(uuid, uuid, date, text, timestamptz, text, integer, boolean, integer, integer)',
    'public.review_reschedule(uuid, uuid, boolean, text, integer)',
    'public.withdraw_reschedule_request(uuid, uuid)',
    'public._finalize_cancellation(uuid, uuid, integer, text)',
    'public.request_cancellation(uuid, uuid, text, text, boolean, integer, integer)',
    'public.review_cancellation(uuid, uuid, boolean, text, integer)',
    'public.admin_cancel_booking(uuid, uuid, text, integer)',
    'public.update_refund(uuid, uuid, text, text, integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
