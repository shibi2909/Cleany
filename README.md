# Cleany — Home Deep Cleaning Platform (Bengaluru)

*Professional cleaning. A home you'll love.*

A full-stack booking platform for a home deep-cleaning business serving Bengaluru + 50 km:
instant quotes, map-based serviceability, bookings, a manual **WhatsApp + UPI** payment
workflow with admin verification, rescheduling, cancellations, refund tracking, and a
complete admin panel.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · TypeScript ·
Tailwind CSS 4 · shadcn-style UI on Radix · Lucide · Framer Motion · React Hook Form + Zod ·
Supabase (Postgres, Auth, Storage, RLS) · Leaflet/OpenStreetMap or Google Maps.

---

## 1. Setup

### Prerequisites
- Node.js 20.9+ (tested on 22)
- A Supabase project (free tier is fine) — <https://supabase.com>

### Steps

```bash
npm install
cp .env.example .env.local        # then fill in the values (see below)
```

1. **Create the database.** In the Supabase dashboard → *SQL Editor*, run each file in
   `supabase/migrations/` **in order** (`…0001_schema.sql` → `…0005_default_catalog.sql`).
   Or with the Supabase CLI: ` linksupabase --project-ref <ref>` then `supabase db push`.
2. **Auth settings** (Supabase → Authentication):
   - *URL Configuration*: set **Site URL** to your site (e.g. `http://localhost:3000`) and add
     `http://localhost:3000/auth/callback` to **Redirect URLs**.
   - *Email confirmation* is on by default; customers get a confirmation link. You can turn
     it off for local testing.
3. **Start the app:** `npm run dev` → <http://localhost:3000>
4. **Create your admin:** sign up on the website, then run
   ```bash
   npm run make-admin -- you@yourbusiness.com
   ```
   Admin rights can only be granted this way (or via SQL) — never from the website.
5. **Configure the business** at `/admin/settings`: **WhatsApp number**, **UPI ID / payee
   name** (the default `cleaningbusiness@upi` is a placeholder), slots and policies.
6. *(Optional)* **Demo data:** `npm run seed:demo` creates 3 demo customers
   (`demo.*@example.com`), 3 demo staff and 9 demo bookings across the lifecycle. All rows are
   flagged `is_demo = true` and use fictional names/numbers.

### Environment variables (`.env.local`)

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | public, RLS-restricted |
| `SUPABASE_SERVICE_ROLE_KEY` | same | **server-only secret** — never expose or commit |
| `NEXT_PUBLIC_MAPS_PROVIDER` | `leaflet` (default, no key) or `google` | |
| `NEXT_PUBLIC_MAPS_API_KEY` | Google Cloud (Maps JavaScript + Geocoding APIs) | only for `google`; restrict by HTTP referrer |
| `GOOGLE_MAPS_SERVER_KEY` | Google Cloud (Geocoding API) | optional server-side key |
| `NEXT_PUBLIC_BUSINESS_WHATSAPP_NUMBER` | your WhatsApp Business number, e.g. `919876543210` | admin setting overrides it |
| `NEXT_PUBLIC_SITE_URL` | your domain | used for auth redirects, sitemap, OG |

Without Supabase keys the public site still renders and shows a friendly "live prices
unavailable" notice — prices are never hardcoded as a fallback.

---

## 2. How it works

### Customer journey
Quote (BHK → sq.ft → bathrooms → services, live price) → location (search / GPS / tap map,
50 km check) → date & slot → details → review → **Confirm & Book** → booking ID
(`CLN-2026-10001`) → **Send Booking on WhatsApp** (pre-filled; the customer presses send)
→ business replies with UPI details → customer pays and shares a screenshot on WhatsApp or
uploads it in the dashboard → **admin verifies** → booking **CONFIRMED** → staff assigned →
team on the way → cleaning → completed.

Opening WhatsApp never marks anything as paid. Only an admin can set payment to `PAID`.

### Security model
- **Every write goes through a server action** that authenticates the user, validates input
  with Zod, and then calls a **transactional Postgres function** with the service role.
- **Prices are recalculated on the server** from database prices using the same quote engine
  as the browser; the database function re-checks that item totals match. Client prices are
  never used.
- **Serviceability** (haversine distance from the admin-configured centre/radius) and **slot
  availability** (future, lead time, capacity — locked per slot) are enforced server-side.
- **RLS:** customers can only *read* their own profile, bookings, items, payments, history,
  requests and refunds. They have no insert/update/delete rights on those tables and cannot
  execute workflow functions. Admin checks read `profiles.role` from the database.
- New sign-ups are always `customer` (role in metadata is ignored); a trigger blocks role
  changes from API roles.
- **History is immutable:** bookings, items, payments, status history, requests and refunds
  cannot be deleted (a trigger rejects `DELETE`). Cancelling sets `booking_status = CANCELLED`.
- Payment proofs live in a **private** storage bucket; admins view them through short-lived
  signed URLs.

### Statuses
- Booking: `REQUESTED → PAYMENT_PENDING → CONFIRMED → ASSIGNED → TEAM_ON_THE_WAY → CLEANING → COMPLETED`,
  plus `RESCHEDULE_REQUESTED`, `CANCELLATION_REQUESTED`, `CANCELLED`.
- Payment: `PENDING · PAYMENT_VERIFICATION_PENDING · PAID · REJECTED · REFUNDED`.
- Refund: `NOT_APPLICABLE · PENDING · PROCESSING · COMPLETED · REJECTED` (processed manually).
- Every change is written to `booking_status_history` (the customer timeline and audit trail).

### Policies (Admin → Settings)
- **Rescheduling:** enabled, minimum notice (default 12 h), max reschedules (2), approval
  required (yes), fee (none/fixed/percentage). Approval re-checks slot capacity.
- **Cancellation:** enabled, minimum notice (12 h — later cancellations need approval),
  approval for all, fee type/value and the window it applies in (24 h), refund policy text.
  Unpaid → `CANCELLED`, refund `NOT_APPLICABLE`. Paid → `CANCELLED`, refund `PENDING`
  (admin moves it to `PROCESSING` → `COMPLETED`). A booking whose payment proof is still
  being verified always needs admin review.

---

## 3. Project structure

```
app/
  (public)/        home, services, pricing, how-it-works, about, contact,
                   service-area, book, booking/success
  (auth)/          login, signup
  customer/        dashboard, bookings, bookings/[id], profile
  admin/           dashboard, bookings(+reschedule tab), bookings/[id], customers,
                   services, pricing, payments, staff, service-area, cancellations, settings
  actions/         server actions: booking, customer, admin, auth, location
  api/geocode/     provider-agnostic geocoding endpoint
  auth/callback/   email confirmation handler
components/        ui/ layout/ booking/ customer/ admin/ maps/ whatsapp/ marketing/ brand/
lib/
  pricing/         quote engine (shared client + server)
  maps/            distance/serviceability, provider abstraction, geocoders
  whatsapp/        createWhatsAppUrl + all message builders
  booking/         slots, statuses, availability, error mapping
  cancellation/    cancellation policy
  rescheduling/    rescheduling policy
  validation/      Zod schemas
  settings/        settings schemas + defaults
  supabase/        server / browser / admin clients, proxy session refresh
  config/brand.ts  ← change the brand name/tagline here
supabase/migrations/  schema, RLS, workflow functions, storage, default catalogue
scripts/           seed-demo.ts, make-admin.ts
tests/             domain unit tests + database tests (PGlite)
```

**Rebranding:** edit `lib/config/brand.ts` (name, wordmark, tagline), the colour tokens at
the top of `app/globals.css`, and the logo in `components/brand/logo.tsx` / `app/icon.svg`.

**Maps:** set `NEXT_PUBLIC_MAPS_PROVIDER=google` + key to switch from Leaflet/OSM to Google.
Both implement the same `MapView` props (`components/maps/`), and geocoding goes through
`lib/maps/geocode.ts`.

---

## 4. Tests

```bash
npm test          # all tests
npm run test:db   # database tests only
npm run typecheck
npm run build
```

- `tests/domain.test.ts` — quote engine (incl. the reference 2 BHK / 1,200 sq.ft / 2 bath =
  ₹4,395 quote), discounts, 50 km serviceability, slots/lead time, cancellation & reschedule
  policies, WhatsApp messages.
- `tests/db/workflow.test.ts` — runs the **real migrations** in an embedded Postgres (PGlite)
  with a stand-in for Supabase's `auth` schema, then exercises the full workflow: booking
  creation & unique IDs, price mismatch and out-of-area rejection, slot capacity, payment
  proof → verification → `PAID` + `CONFIRMED`, staff assignment → completion, reschedule
  approve/reject/limit/withdraw, cancellation before/after payment, refund
  `PENDING → PROCESSING → COMPLETED`, immutability, and RLS isolation between customers,
  anonymous users and admins.

Storage policies and Supabase Auth itself are not covered by the embedded tests — verify
those against your Supabase project (sign up, book, upload a proof, verify as admin).

---

## 5. Before going live
- Replace the placeholder UPI ID and add your WhatsApp number (Admin → Settings).
- Replace the sample testimonials on the homepage (`components/marketing/sections.tsx`)
  with verified reviews, and consider adding real photography to `public/images/`.
- Set `NEXT_PUBLIC_SITE_URL` to your domain and update Supabase Auth redirect URLs.
- Configure a custom SMTP sender in Supabase Auth for confirmation emails.
- Demo data is flagged `is_demo`; bookings can't be deleted by design, so seed demo data
  only in a staging project.
