import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { PaymentReview, ProofLink } from "@/components/admin/booking-controls";
import { AdminPageHeader, FilterBar, FilterLink, TableShell, Td, Th } from "@/components/admin/ui";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { loadSettings } from "@/lib/data/catalog";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import { createPaymentWhatsAppMessage } from "@/lib/whatsapp/messages";
import type { Booking, Payment } from "@/types";

export const metadata: Metadata = { title: "Payments" };

const TABS = [
  { key: "PAYMENT_VERIFICATION_PENDING", label: "Awaiting verification" },
  { key: "PENDING", label: "Not paid yet" },
  { key: "REJECTED", label: "Rejected" },
  { key: "PAID", label: "Paid" },
  { key: "REFUNDED", label: "Refunded" },
] as const;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t)?.key ?? "PAYMENT_VERIFICATION_PENDING";
  const db = await adminDb();
  const [settings, bookingsRes] = await Promise.all([
    loadSettings(db),
    (() => {
      let q = db.from("bookings").select("*").eq("payment_status", tab);
      // Unpaid cancelled bookings don't need chasing.
      if (tab === "PENDING") q = q.neq("booking_status", "CANCELLED");
      return q.order("slot_start", { ascending: true }).limit(200);
    })(),
  ]);
  const bookings = (bookingsRes.data ?? []) as Booking[];
  const { data: paymentRows } = bookings.length
    ? await db.from("payments").select("*").in("booking_id", bookings.map((b) => b.id)).order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, Payment>();
  for (const p of (paymentRows ?? []) as Payment[]) if (!latest.has(p.booking_id)) latest.set(p.booking_id, p);

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="UPI payments are made directly to the business and verified here. Only verified payments count as paid."
      />
      <FilterBar>
        {TABS.map((x) => (
          <FilterLink key={x.key} href={`/admin/payments?tab=${x.key}`} active={tab === x.key}>
            {x.label}
          </FilterLink>
        ))}
      </FilterBar>
      {bookings.length === 0 ? (
        <EmptyState icon={Wallet} title={tab === "PAYMENT_VERIFICATION_PENDING" ? "No pending payments." : "Nothing here."} description="Payments in this state will appear here." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Service date</Th>
              <Th className="text-right">Amount</Th>
              <Th>Proof / reference</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const p = latest.get(b.id);
              return (
                <tr key={b.id} className="align-top">
                  <Td>
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-brand-800 hover:underline">
                      {b.booking_number}
                    </Link>
                    <span className="mt-1 block">
                      <BookingStatusBadge status={b.booking_status} />
                    </span>
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
                    <div className="flex flex-col gap-1 text-xs">
                      {p?.proof_path ? <ProofLink path={p.proof_path} /> : null}
                      {p?.reference ? <span>Ref: {p.reference}</span> : null}
                      {p?.submitted_at ? <span className="text-muted">Submitted {formatDateTime(p.submitted_at)}</span> : null}
                      {!p?.proof_path && !p?.reference ? <span className="text-muted">— (check WhatsApp)</span> : null}
                    </div>
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={b.payment_status} />
                    {p?.admin_note ? <span className="mt-1 block max-w-40 text-xs text-muted">{p.admin_note}</span> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-2">
                      {["PENDING", "PAYMENT_VERIFICATION_PENDING", "REJECTED"].includes(b.payment_status) && b.booking_status !== "CANCELLED" ? (
                        <PaymentReview bookingId={b.id} amount={formatINR(b.total)} />
                      ) : null}
                      {b.payment_status !== "PAID" && b.payment_status !== "REFUNDED" ? (
                        <WhatsAppButton size="sm" variant="outline" phone={b.customer_phone} message={createPaymentWhatsAppMessage(b, settings.payment)}>
                          Send UPI details
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
    </div>
  );
}
