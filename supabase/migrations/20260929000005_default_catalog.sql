-- ═══════════════════════════════════════════════════════════════════════════
-- Cleany — default catalogue, pricing and settings
-- These are starting values only. Everything here is editable from /admin.
-- ON CONFLICT DO NOTHING keeps admin edits if this migration is re-run.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.bhk_pricing (bhk_type, label, base_price, typical_sqft, description, duration_label, sort_order) values
  ('1BHK', '1 BHK', 1999,  800, 'Studio and 1 bedroom homes',  '4–5 hours', 1),
  ('2BHK', '2 BHK', 2799, 1200, 'Most popular for families',   '5–6 hours', 2),
  ('3BHK', '3 BHK', 3699, 1500, 'Spacious family homes',       '6–8 hours', 3),
  ('4BHK', '4 BHK', 4799, 2000, 'Large homes and duplexes',    '8–10 hours', 4)
on conflict (bhk_type) do nothing;

insert into public.area_pricing (label, min_sqft, max_sqft, surcharge, sort_order)
select * from (values
  ('Below 800 sq.ft',  0,    799,  0,    1),
  ('800–1000 sq.ft',   800,  999,  0,    2),
  ('1000–1200 sq.ft',  1000, 1200, 0,    3),
  ('1200–1500 sq.ft',  1201, 1500, 400,  4),
  ('1500–2000 sq.ft',  1501, 2000, 800,  5),
  ('Above 2000 sq.ft', 2001, null, 1400, 6)
) as v(label, min_sqft, max_sqft, surcharge, sort_order)
where not exists (select 1 from public.area_pricing);

insert into public.bathroom_pricing (bathroom_count, label, price_per_bathroom) values
  (1, '1 bathroom',   299),
  (2, '2 bathrooms',  299),
  (3, '3 bathrooms',  279),
  (4, '4+ bathrooms', 269)
on conflict (bathroom_count) do nothing;

insert into public.services
  (slug, name, description, category, icon, pricing_type, price, unit_label, duration_minutes, is_default_selected, is_popular, sort_order)
values
  ('deep-home-cleaning', 'Deep Home Cleaning',
   'Top-to-bottom cleaning of every room: dusting, cobwebs, floors scrubbed and mopped, doors, switchboards and fixtures.',
   'Home', 'Home', 'BHK_BASE', 0, 'per home', 300, true, true, 1),
  ('kitchen-deep-cleaning', 'Kitchen Deep Cleaning',
   'Degreasing of slab, tiles, sink and cabinet exteriors. Stove and backsplash scrubbed spotless.',
   'Kitchen', 'CookingPot', 'FIXED', 499, 'per kitchen', 90, false, true, 2),
  ('bathroom-deep-cleaning', 'Bathroom Deep Cleaning',
   'Hard-water stain removal, tiles, grout, fittings, mirrors and exhaust fan. Priced per bathroom.',
   'Bathroom', 'Bath', 'PER_BATHROOM', 0, 'per bathroom', 60, true, true, 3),
  ('sofa-cleaning', 'Sofa Cleaning',
   'Vacuum and shampoo cleaning for fabric sofas up to 5 seats. Removes dust, stains and odour.',
   'Furniture', 'Sofa', 'FIXED', 499, 'up to 5 seats', 60, false, true, 4),
  ('mattress-cleaning', 'Mattress Cleaning',
   'Deep vacuum and dry shampoo for one double mattress. Reduces dust mites and allergens.',
   'Furniture', 'BedDouble', 'FIXED', 449, 'per mattress', 45, false, false, 5),
  ('window-cleaning', 'Window Cleaning',
   'Glass, frames, grills and sliding tracks cleaned inside and out (where safely reachable).',
   'Home', 'AppWindow', 'FIXED', 399, 'whole home', 60, false, false, 6),
  ('balcony-cleaning', 'Balcony Cleaning',
   'Floor scrubbing, railing and grill wipe-down, drain area and wall cleaning.',
   'Outdoor', 'Fence', 'FIXED', 299, 'per balcony', 45, false, false, 7),
  ('chimney-cleaning', 'Chimney Cleaning',
   'Filter degreasing and exterior hood cleaning for kitchen chimneys.',
   'Kitchen', 'Wind', 'FIXED', 599, 'per chimney', 60, false, false, 8),
  ('fridge-cleaning', 'Fridge Cleaning',
   'Shelves, trays and gaskets cleaned and sanitised. Exterior wiped. Please empty the fridge beforehand.',
   'Appliances', 'Refrigerator', 'FIXED', 349, 'per fridge', 45, false, false, 9),
  ('washing-machine-cleaning', 'Washing Machine Cleaning',
   'Drum descaling, detergent drawer and gasket cleaning to remove odour and residue.',
   'Appliances', 'WashingMachine', 'FIXED', 399, 'per machine', 45, false, false, 10),
  ('carpet-cleaning', 'Carpet Cleaning',
   'Shampoo cleaning for one medium carpet (up to 6×4 ft). Lifts dust and everyday stains.',
   'Furniture', 'Layers', 'FIXED', 449, 'per carpet', 45, false, false, 11)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('business', jsonb_build_object(
    'name', 'Cleany',
    'legal_name', 'Cleany Services',
    'phone', '',
    'email', '',
    'address', 'Bengaluru, Karnataka',
    'hours', '8:00 AM – 8:00 PM, all days'
  )),
  ('whatsapp', jsonb_build_object(
    'number', '',
    'support_hours', '8:00 AM – 8:00 PM'
  )),
  ('payment', jsonb_build_object(
    'upi_id', 'cleaningbusiness@upi',
    'payee_name', 'Cleany Services',
    'payment_number', '',
    'instructions', 'After payment, please send the payment screenshot here. Our team will verify your payment and confirm your booking.'
  )),
  ('service_area', jsonb_build_object(
    'center_label', 'Bengaluru (MG Road)',
    'center_lat', 12.9716,
    'center_lng', 77.5946,
    'radius_km', 50
  )),
  ('booking', jsonb_build_object(
    'time_slots', jsonb_build_array(
      jsonb_build_object('id', 'morning',   'label', '9 AM – 12 PM', 'start', '09:00', 'end', '12:00'),
      jsonb_build_object('id', 'afternoon', 'label', '12 PM – 3 PM', 'start', '12:00', 'end', '15:00'),
      jsonb_build_object('id', 'evening',   'label', '3 PM – 6 PM',  'start', '15:00', 'end', '18:00')
    ),
    'slot_capacity', 3,
    'min_lead_hours', 12,
    'max_advance_days', 45
  )),
  ('cancellation', jsonb_build_object(
    'enabled', true,
    'min_notice_hours', 12,
    'approval_required', false,
    'fee_type', 'none',
    'fee_value', 0,
    'fee_window_hours', 24,
    'refund_policy_text', 'Cancel more than 24 hours before your slot for a full refund of any amount paid. Cancellations within 12 hours of the slot need approval from our team. Refunds are processed manually to your original UPI account, usually within 5–7 working days.'
  )),
  ('reschedule', jsonb_build_object(
    'enabled', true,
    'min_notice_hours', 12,
    'max_reschedules', 2,
    'approval_required', true,
    'fee_type', 'none',
    'fee_value', 0
  ))
on conflict (key) do nothing;
