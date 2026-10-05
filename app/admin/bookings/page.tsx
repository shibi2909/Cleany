import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardList, Search } from "lucide-react";
import { RescheduleReview } from "@/components/admin/booking-controls";
import { AdminPageHeader, FilterBar, FilterLink, TableShell, Td, Th } from "@/components/admin/ui";
import { BookingStatusBadge, PaymentStatusBadge, RequestStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form-controls";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { BOOKING_STATUS_META, PAYMENT_STATUS_META } from "@/lib/booking/status";
import { getItemsFor, serviceNames } from "@/lib/data/bookings";
import { bhkLabel, formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import { createRescheduleApprovedCustomerMessage } from "@/lib/whatsapp/messages";
import { BHK_TYPES, BOOKING_STATUSES, PAYMENT_STATUSES, type Booking, type RescheduleRequest } from "@/types";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 25;
type SP = Record<string, string | undefined>;

function qs(sp: SP, patch: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  return `?${p.toString()}`;
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab === "reschedules" ? "reschedules" : "all";
  return (
    <div>
      <AdminPageHeader title="Bookings" description="All bookings, filters and reschedule requests." />
      <FilterBar>
        <FilterLink href="/admin/bookings" active={tab === "all"}>
          <ClipboardList className="size-4" aria-hidden /> All bookings
        </FilterLink>
        <FilterLink href="/admin/bookings?tab=reschedules" active={tab === "reschedules"}>
          <CalendarClock className="size-4" aria-hidden /> Reschedule requests
        </FilterLink>
      </FilterBar>
      {tab === "reschedules" ? <Reschedules status={sp.rstatus ?? "PENDING"} /> : <AllBookings sp={sp} />}
    </div>
  );
}

async function AllBookings({ sp }: { sp: SP }) {
  const db = await adminDb();
  const page = Math.max(1, Number(sp.page) || 1);
  let query = db.from("bookings").select("*", { count: "exact" });
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) query = query.eq("booking_date", sp.date);
  if (sp.status && (BOOKING_STATUSES as readonly string[]).includes(sp.status)) query = query.eq("booking_status", sp.status);
  if (sp.payment && (PAYMENT_STATUSES as readonly string[]).includes(sp.payment)) query = query.eq("payment_status", sp.payment);
  if (sp.bhk && (BHK_TYPES as readonly string[]).includes(sp.bhk)) query = query.eq("bhk_type", sp.bhk);
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ").trim().slice(0, 60);
    if (q) query = query.or(`booking_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,address.ilike.%${q}%,pincode.ilike.%${q}%`);
  }
  const sort = sp.sort === "date" ? "slot_start" : "created_at";
  const { data, count } = await query.order(sort, { ascending: sp.sort === "date" }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const bookings = (data ?? []) as Booking[];
  const items = await getItemsFor(bookings.map((b) => b.id), { asAdmin: true });
  const staffIds = [...new Set(bookings.map((b) => b.assigned_staff_id).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await db.from("staff").select("id, full_name").in("id", staffIds) : { data: [] };
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name as string]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <form className="mb-5 grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <Input id="q" name="q" defaultValue={sp.q} placeholder="Booking ID, customer, phone, area, pincode" className="pl-9" />
        </div>
        <label className="sr-only" htmlFor="f-date">Date</label>
        <Input id="f-date" type="date" name="date" defaultValue={sp.date} />
        <label className="sr-only" htmlFor="f-status">Booking status</label>
        <Select id="f-status" name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="f-payment">Payment status</label>
        <Select id="f-payment" name="payment" defaultValue={sp.payment ?? ""}>
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="f-bhk">BHK</label>
          <Select id="f-bhk" name="bhk" defaultValue={sp.bhk ?? ""}>
            <option value="">All BHK</option>
            {BHK_TYPES.map((b) => (
              <option key={b} value={b}>
                {bhkLabel(b)}
              </option>
            ))}
          </Select>
          <Button type="submit" size="md">
            Filter
          </Button>
        </div>
      </form>

      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{formatNumber(count ?? 0)} bookings</span>
        <span className="flex gap-3">
          <Link className={sp.sort !== "date" ? "font-semibold text-ink" : "hover:text-ink"} href={qs(sp, { sort: undefined, page: undefined })}>
            Newest
          </Link>
          <Link className={sp.sort === "date" ? "font-semibold text-ink" : "hover:text-ink"} href={qs(sp, { sort: "date", page: undefined })}>
            By service date
          </Link>
          {Object.keys(sp).some((k) => ["q", "date", "status", "payment", "bhk"].includes(k)) ? (
            <Link href="/admin/bookings" className="text-brand-700 hover:underline">
              Clear filters
            </Link>
          ) : null}
        </span>
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No bookings found" description="Try changing the filters." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking ID</Th>
              <Th>Customer</Th>
              <Th>Service</Th>
              <Th>BHK</Th>
              <Th>Area</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th className="text-right">Amount</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Staff</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const svc = serviceNames(items.get(b.id) ?? []);
              return (
                <tr key={b.id} className="hover:bg-sand-50/60">
                  <Td>
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                      {b.booking_number}
                    </Link>
                    {b.is_demo ? <span className="ml-1 rounded bg-sand-100 px-1 text-[0.65rem] text-muted">DEMO</span> : null}
                  </Td>
                  <Td>
                    <span className="block font-medium">{b.customer_name}</span>
                    <span className="text-xs text-muted">{b.customer_phone}</span>
                  </Td>
                  <Td className="max-w-48">
                    <span className="line-clamp-2 text-xs" title={svc.join(", ")}>
                      {svc.join(", ")}
                    </span>
                  </Td>
                  <Td>{bhkLabel(b.bhk_type)}</Td>
                  <Td className="whitespace-nowrap">
                    {formatNumber(b.area_sqft)} sq.ft
                    <span className="block max-w-36 truncate text-xs text-muted" title={b.address}>
                      {b.pincode}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(b.booking_date, { year: false })}</Td>
                  <Td className="whitespace-nowrap">{b.time_slot}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatINR(b.total)}</Td>
                  <Td>
                    <PaymentStatusBadge status={b.payment_status} />
                  </Td>
                  <Td>
                    <BookingStatusBadge status={b.booking_status} />
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{b.assigned_staff_id ? staffName.get(b.assigned_staff_id) : <span className="text-muted">—</span>}</Td>
                  <Td>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/bookings/${b.id}`}>Manage</Link>
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={qs(sp, { page: String(page - 1) })} className="font-semibold text-brand-700">← Previous</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={qs(sp, { page: String(page + 1) })} className="font-semibold text-brand-700">Next →</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}

async function Reschedules({ status }: { status: string }) {
  const db = await adminDb();
  const statuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
  const current = statuses.includes(status) ? status : "PENDING";
  const { data } = await db.from("reschedule_requests").select("*").eq("status", current).order("created_at", { ascending: false }).limit(100);
  const requests = (data ?? []) as RescheduleRequest[];
  const { data: bookingRows } = requests.length ? await db.from("bookings").select("*").in("id", requests.map((r) => r.booking_id)) : { data: [] };
  const bookings = new Map(((bookingRows ?? []) as Booking[]).map((b) => [b.id, b]));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/bookings?tab=reschedules&rstatus=${s}`}
            className={s === current ? "rounded-full bg-sand-100 px-3 py-1 font-semibold" : "rounded-full px-3 py-1 text-muted hover:text-ink"}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No reschedule requests." description={current === "PENDING" ? "New customer requests will appear here." : undefined} />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking ID</Th>
              <Th>Customer</Th>
              <Th>Current date</Th>
              <Th>Requested date</Th>
              <Th>Current time</Th>
              <Th>Requested time</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const b = bookings.get(r.booking_id);
              return (
                <tr key={r.id} className="align-top">
                  <Td>
                    <Link href={`/admin/bookings/${r.booking_id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                      {b?.booking_number}
                    </Link>
                    <span className="block text-xs text-muted">{formatDateTime(r.created_at)}</span>
                  </Td>
                  <Td>
                    {b?.customer_name}
                    <span className="block text-xs text-muted">{b?.customer_phone}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(r.old_date, { year: false })}</Td>
                  <Td className="whitespace-nowrap font-semibold">{formatDate(r.requested_date, { year: false })}</Td>
                  <Td className="whitespace-nowrap">{r.old_time_slot}</Td>
                  <Td className="whitespace-nowrap font-semibold">{r.requested_time_slot}</Td>
                  <Td className="max-w-48 text-xs">{r.reason ?? "—"}</Td>
                  <Td>
                    <RequestStatusBadge status={r.status} />
                    {r.admin_note ? <span className="mt-1 block max-w-40 text-xs text-muted">{r.admin_note}</span> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-2">
                      {r.status === "PENDING" ? (
                        <RescheduleReview
                          requestId={r.id}
                          bookingId={r.booking_id}
                          summary={`${formatDate(r.old_date, { year: false })}, ${r.old_time_slot} → ${formatDate(r.requested_date, { year: false })}, ${r.requested_time_slot}`}
                        />
                      ) : null}
                      {b ? (
                        <WhatsAppButton
                          size="sm"
                          variant="outline"
                          phone={b.customer_phone}
                          message={
                            r.status === "APPROVED"
                              ? createRescheduleApprovedCustomerMessage({
                                  booking_number: b.booking_number,
                                  oldDate: r.old_date,
                                  oldSlot: r.old_time_slot,
                                  newDate: r.requested_date,
                                  newSlot: r.requested_time_slot,
                                })
                              : `Hello ${b.customer_name}, this is ${BRAND.name} regarding your reschedule request for booking ${b.booking_number}.`
                          }
                        >
                          Contact customer
                        </WhatsAppButton>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
