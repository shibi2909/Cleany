import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Undo2 } from "lucide-react";
import { CancellationReview, RefundControls } from "@/components/admin/booking-controls";
import { AdminPageHeader, FilterBar, FilterLink, TableShell, Td, Th } from "@/components/admin/ui";
import { PaymentStatusBadge, RefundStatusBadge, RequestStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import type { Booking, CancellationRequest, Refund } from "@/types";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Cancellations" };

async function bookingsById(ids: string[]) {
  if (ids.length === 0) return new Map<string, Booking>();
  const { data } = await (await adminDb()).from("bookings").select("*").in("id", ids);
  return new Map(((data ?? []) as Booking[]).map((b) => [b.id, b]));
}

export default async function AdminCancellationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = t === "cancelled" || t === "refunds" ? t : "requests";
  return (
    <div>
      <AdminPageHeader title="Cancellations" description="Review requests, see cancelled bookings and process refunds manually via UPI." />
      <FilterBar>
        <FilterLink href="/admin/cancellations" active={tab === "requests"}>
          Cancellation Requests
        </FilterLink>
        <FilterLink href="/admin/cancellations?tab=cancelled" active={tab === "cancelled"}>
          Cancelled Bookings
        </FilterLink>
        <FilterLink href="/admin/cancellations?tab=refunds" active={tab === "refunds"}>
          Refunds
        </FilterLink>
      </FilterBar>
      {tab === "requests" ? <Requests /> : tab === "cancelled" ? <Cancelled /> : <Refunds />}
    </div>
  );
}

async function Requests() {
  const { data } = await (await adminDb()).from("cancellation_requests").select("*").order("created_at", { ascending: false }).limit(200);
  const requests = (data ?? []) as CancellationRequest[];
  const bookings = await bookingsById([...new Set(requests.map((r) => r.booking_id))]);
  const visible = requests.filter((r) => r.status === "PENDING" || r.requires_approval);
  if (visible.length === 0) return <EmptyState icon={Ban} title="No cancellation requests." description="Requests that need approval will appear here." />;
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Booking ID</Th>
          <Th>Customer</Th>
          <Th>Date</Th>
          <Th className="text-right">Amount</Th>
          <Th>Payment</Th>
          <Th>Reason</Th>
          <Th>Request date</Th>
          <Th>Status</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {visible.map((r) => {
          const b = bookings.get(r.booking_id);
          if (!b) return null;
          return (
            <tr key={r.id} className="align-top">
              <Td>
                <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                  {b.booking_number}
                </Link>
              </Td>
              <Td>
                {b.customer_name}
                <span className="block text-xs text-muted">{b.customer_phone}</span>
              </Td>
              <Td className="whitespace-nowrap">
                {formatDate(b.booking_date, { year: false })}
                <span className="block text-xs text-muted">{b.time_slot}</span>
              </Td>
              <Td className="text-right font-semibold tabular-nums">{formatINR(b.total)}</Td>
              <Td>
                <PaymentStatusBadge status={b.payment_status} />
              </Td>
              <Td className="max-w-52">
                {r.reason}
                {r.comment ? <span className="block text-xs text-muted">“{r.comment}”</span> : null}
              </Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</Td>
              <Td>
                <RequestStatusBadge status={r.status} />
                {r.admin_note ? <span className="mt-1 block max-w-40 text-xs text-muted">{r.admin_note}</span> : null}
              </Td>
              <Td>
                <div className="flex flex-col gap-2">
                  {r.status === "PENDING" ? (
                    <CancellationReview requestId={r.id} bookingId={b.id} paid={b.payment_status === "PAID"} suggestedRefund={r.refund_amount || b.total} />
                  ) : null}
                  <WhatsAppButton size="sm" variant="outline" phone={b.customer_phone} message={`Hello ${b.customer_name}, this is ${BRAND.name} regarding the cancellation of booking ${b.booking_number}.`}>
                    Contact Customer
                  </WhatsAppButton>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

async function Cancelled() {
  const db = await adminDb();
  const { data } = await db.from("bookings").select("*").eq("booking_status", "CANCELLED").order("cancelled_at", { ascending: false }).limit(200);
  const bookings = (data ?? []) as Booking[];
  const { data: reqs } = bookings.length
    ? await db.from("cancellation_requests").select("booking_id, reason, created_at").in("booking_id", bookings.map((b) => b.id)).order("created_at", { ascending: false })
    : { data: [] };
  const reasons = new Map<string, string>();
  for (const r of reqs ?? []) if (!reasons.has(r.booking_id)) reasons.set(r.booking_id, r.reason);
  if (bookings.length === 0) return <EmptyState icon={Ban} title="No cancelled bookings." />;
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Booking ID</Th>
          <Th>Customer</Th>
          <Th>Date</Th>
          <Th className="text-right">Amount</Th>
          <Th>Payment</Th>
          <Th>Refund</Th>
          <Th>Reason</Th>
          <Th>Cancelled</Th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.id}>
            <Td>
              <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                {b.booking_number}
              </Link>
            </Td>
            <Td>{b.customer_name}</Td>
            <Td className="whitespace-nowrap">{formatDate(b.booking_date, { year: false })}</Td>
            <Td className="text-right tabular-nums">{formatINR(b.total)}</Td>
            <Td>
              <PaymentStatusBadge status={b.payment_status} />
            </Td>
            <Td>
              <RefundStatusBadge status={b.refund_status} />
            </Td>
            <Td>{reasons.get(b.id) ?? "Cancelled by admin"}</Td>
            <Td className="whitespace-nowrap text-xs">{b.cancelled_at ? formatDateTime(b.cancelled_at) : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

async function Refunds() {
  const { data } = await (await adminDb()).from("refunds").select("*").order("created_at", { ascending: false }).limit(200);
  const refunds = (data ?? []) as Refund[];
  const bookings = await bookingsById([...new Set(refunds.map((r) => r.booking_id))]);
  if (refunds.length === 0) return <EmptyState icon={Undo2} title="No refunds." description="Refunds are created when a paid booking is cancelled." />;
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Booking ID</Th>
          <Th>Customer</Th>
          <Th className="text-right">Refund</Th>
          <Th>Reason</Th>
          <Th>Created</Th>
          <Th>Status</Th>
          <Th>Update (manual UPI refund)</Th>
        </tr>
      </thead>
      <tbody>
        {refunds.map((r) => {
          const b = bookings.get(r.booking_id);
          return (
            <tr key={r.id} className="align-top">
              <Td>
                <Link href={`/admin/bookings/${r.booking_id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                  {b?.booking_number}
                </Link>
              </Td>
              <Td>
                {b?.customer_name}
                <span className="block text-xs text-muted">{b?.customer_phone}</span>
              </Td>
              <Td className="text-right font-semibold tabular-nums">
                {formatINR(r.amount)}
                <span className="block text-xs font-normal text-muted">of {b ? formatINR(b.total) : "—"}</span>
              </Td>
              <Td className="max-w-52 text-xs">{r.reason}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</Td>
              <Td>
                <RefundStatusBadge status={r.status} />
                {r.notes ? <span className="mt-1 block max-w-40 text-xs text-muted">{r.notes}</span> : null}
              </Td>
              <Td className="min-w-64">
                <RefundControls refundId={r.id} bookingId={r.booking_id} status={r.status} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}
