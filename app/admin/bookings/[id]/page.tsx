import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import {
  AdminCancelButton,
  CancellationReview,
  PaymentReview,
  ProofLink,
  RefundControls,
  RescheduleReview,
  StaffAssign,
  StatusButtons,
} from "@/components/admin/booking-controls";
import { PriceBreakdown } from "@/components/booking/price-breakdown";
import { HistoryTimeline, JourneyProgress } from "@/components/customer/status-timeline";
import { MapView } from "@/components/maps/map-view";
import { BookingStatusBadge, PaymentStatusBadge, RefundStatusBadge, RequestStatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { ADMIN_NEXT_STATUS } from "@/lib/booking/status";
import { getBookingDetail } from "@/lib/data/bookings";
import { loadSettings } from "@/lib/data/catalog";
import { bhkLabel, formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import { createPaymentWhatsAppMessage, createRescheduleApprovedCustomerMessage } from "@/lib/whatsapp/messages";
import type { Staff } from "@/types";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminDb();
  const detail = await getBookingDetail(id, { asAdmin: true });
  if (!detail) notFound();
  const [settings, staffRes] = await Promise.all([loadSettings(db), db.from("staff").select("id, full_name, status").eq("is_active", true).order("full_name")]);
  const staff = (staffRes.data ?? []) as Pick<Staff, "id" | "full_name" | "status">[];

  const { booking: b, items, payments, history, reschedules, cancellations, refunds } = detail;
  const pendingReschedule = reschedules.find((r) => r.status === "PENDING");
  const pendingCancellation = cancellations.find((c) => c.status === "PENDING");
  const lastApproved = reschedules.find((r) => r.status === "APPROVED");
  const canVerify = b.booking_status !== "CANCELLED" && !["PAID", "REFUNDED"].includes(b.payment_status);
  const canAssign = ["CONFIRMED", "ASSIGNED", "RESCHEDULE_REQUESTED"].includes(b.booking_status);
  const closed = ["CANCELLED", "COMPLETED"].includes(b.booking_status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Bookings
        </Link>
        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-mono text-2xl font-semibold">{b.booking_number}</h1>
            <p className="text-sm text-muted">
              Created {formatDateTime(b.created_at)}
              {b.is_demo ? " · DEMO DATA" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status={b.booking_status} />
            <PaymentStatusBadge status={b.payment_status} />
            {b.refund_status !== "NOT_APPLICABLE" ? <RefundStatusBadge status={b.refund_status} /> : null}
          </div>
        </div>
      </div>

      {pendingCancellation ? (
        <Alert tone="warning" title="Cancellation request">
          <p>
            Reason: <strong>{pendingCancellation.reason}</strong>
            {pendingCancellation.comment ? ` — “${pendingCancellation.comment}”` : ""} · requested {formatDateTime(pendingCancellation.created_at)}
          </p>
          <p>
            Payment: {b.payment_status} · Amount {formatINR(b.total)}
            {b.payment_status === "PAID" ? ` · policy refund ${formatINR(pendingCancellation.refund_amount)}` : ""}
          </p>
          {b.payment_status === "PAYMENT_VERIFICATION_PENDING" ? <p className="font-semibold">Verify or reject the pending payment first.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <CancellationReview
              requestId={pendingCancellation.id}
              bookingId={b.id}
              paid={b.payment_status === "PAID"}
              suggestedRefund={pendingCancellation.refund_amount || b.total}
            />
            <WhatsAppButton size="sm" variant="outline" phone={b.customer_phone} message={`Hello ${b.customer_name}, this is ${BRAND.name} regarding your cancellation request for booking ${b.booking_number}.`}>
              Contact customer
            </WhatsAppButton>
          </div>
        </Alert>
      ) : null}

      {pendingReschedule ? (
        <Alert tone="warning" title="Reschedule request">
          <p>
            {formatDate(pendingReschedule.old_date, { year: false })}, {pendingReschedule.old_time_slot} →{" "}
            <strong>
              {formatDate(pendingReschedule.requested_date, { year: false })}, {pendingReschedule.requested_time_slot}
            </strong>
            {pendingReschedule.reason ? ` · “${pendingReschedule.reason}”` : ""}
          </p>
          {pendingReschedule.fee_amount > 0 ? <p>Rescheduling fee per policy: {formatINR(pendingReschedule.fee_amount)}</p> : null}
          <div className="mt-3">
            <RescheduleReview
              requestId={pendingReschedule.id}
              bookingId={b.id}
              summary={`Move to ${formatDate(pendingReschedule.requested_date, { year: false })}, ${pendingReschedule.requested_time_slot}. Slot capacity is re-checked on approval.`}
            />
          </div>
        </Alert>
      ) : null}

      {b.booking_status !== "CANCELLED" ? (
        <Card>
          <CardContent className="pt-6">
            <JourneyProgress booking={b} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Payment · {formatINR(b.total)}</h3>
                <div className="flex flex-wrap gap-2">
                  <WhatsAppButton size="sm" phone={b.customer_phone} message={createPaymentWhatsAppMessage(b, settings.payment)}>
                    Send UPI details to customer
                  </WhatsAppButton>
                  {b.booking_status === "REQUESTED" ? <StatusButtons bookingId={b.id} options={ADMIN_NEXT_STATUS.REQUESTED ?? []} /> : null}
                </div>
                {canVerify ? (
                  <div className="mt-1">
                    <PaymentReview bookingId={b.id} amount={formatINR(b.total)} />
                    <p className="mt-2 text-xs text-muted">
                      Opening WhatsApp does not mean payment is complete. Verify only after checking the UPI account.
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="flex flex-col gap-2 border-t border-line pt-4">
                <h3 className="text-sm font-semibold">Staff</h3>
                {canAssign ? (
                  <StaffAssign bookingId={b.id} staff={staff} current={b.assigned_staff_id} />
                ) : (
                  <p className="text-sm text-muted">
                    {detail.staff ? `${detail.staff.full_name} (${detail.staff.phone})` : "Staff can be assigned once the booking is confirmed (payment verified)."}
                  </p>
                )}
                {canAssign && staff.length === 0 ? (
                  <p className="text-sm text-muted">
                    No active staff. <Link href="/admin/staff" className="text-brand-700 underline">Add staff</Link>
                  </p>
                ) : null}
              </section>

              {ADMIN_NEXT_STATUS[b.booking_status] && b.booking_status !== "REQUESTED" ? (
                <section className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-sm font-semibold">Job progress</h3>
                  <StatusButtons bookingId={b.id} options={ADMIN_NEXT_STATUS[b.booking_status] ?? []} />
                </section>
              ) : null}

              {lastApproved ? (
                <section className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-sm font-semibold">Reschedule confirmation</h3>
                  <WhatsAppButton
                    size="sm"
                    variant="outline"
                    phone={b.customer_phone}
                    message={createRescheduleApprovedCustomerMessage({
                      booking_number: b.booking_number,
                      oldDate: lastApproved.old_date,
                      oldSlot: lastApproved.old_time_slot,
                      newDate: lastApproved.requested_date,
                      newSlot: lastApproved.requested_time_slot,
                    })}
                  >
                    Send “rescheduled successfully” message
                  </WhatsAppButton>
                </section>
              ) : null}

              {!closed ? (
                <section className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-sm font-semibold">Cancellation</h3>
                  <AdminCancelButton bookingId={b.id} paid={b.payment_status === "PAID"} total={b.total} />
                </section>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Home & services</CardTitle>
              <p className="text-sm text-muted">
                {bhkLabel(b.bhk_type)} · {b.area_is_approximate && b.area_range_label ? `${b.area_range_label} (approx.)` : `${formatNumber(b.area_sqft)} sq.ft`} ·{" "}
                {b.bathroom_count >= 4 ? "4+" : b.bathroom_count} bathroom(s)
              </p>
            </CardHeader>
            <CardContent>
              <PriceBreakdown booking={b} items={items} />
              <p className="mt-3 text-xs text-muted">Prices are snapshots taken at booking time.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments & refunds</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {formatINR(p.amount)} · {p.method} {p.reference ? `· Ref ${p.reference}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      Created {formatDateTime(p.created_at)}
                      {p.submitted_at ? ` · proof ${formatDateTime(p.submitted_at)}` : ""}
                      {p.verified_at ? ` · reviewed ${formatDateTime(p.verified_at)}` : ""}
                    </p>
                    {p.admin_note ? <p className="text-xs text-muted">Note: {p.admin_note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.proof_path ? <ProofLink path={p.proof_path} /> : null}
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
              {refunds.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-honey-50/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Refund {formatINR(r.amount)}</p>
                    <RefundStatusBadge status={r.status} />
                  </div>
                  {r.notes ? <p className="text-xs text-muted">{r.notes}</p> : null}
                  <RefundControls refundId={r.id} bookingId={b.id} status={r.status} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline history={history} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-base font-semibold">{b.customer_name}</p>
              <a href={`tel:${b.customer_phone}`} className="inline-flex items-center gap-2 hover:underline">
                <Phone className="size-4 text-brand-700" aria-hidden /> {b.customer_phone}
              </a>
              <a href={`mailto:${b.customer_email}`} className="inline-flex items-center gap-2 hover:underline">
                <Mail className="size-4 text-brand-700" aria-hidden /> {b.customer_email}
              </a>
              <WhatsAppButton size="sm" variant="outline" phone={b.customer_phone} message={`Hello ${b.customer_name}, this is ${BRAND.name} regarding your booking ${b.booking_number}.`} className="mt-2 w-fit">
                Contact customer
              </WhatsAppButton>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule & location</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="font-semibold">
                {formatDate(b.booking_date, { year: true, weekday: true })} · {b.time_slot}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                <span>
                  {b.address}
                  {b.landmark ? `, near ${b.landmark}` : ""}, {b.pincode}
                  <span className="block text-muted">{Number(b.distance_from_center).toFixed(1)} km from centre</span>
                </span>
              </p>
              <a
                className="text-brand-700 hover:underline"
                href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Maps ↗
              </a>
              <MapView
                center={{ lat: settings.service_area.center_lat, lng: settings.service_area.center_lng }}
                radiusKm={settings.service_area.radius_km}
                customer={{ lat: b.latitude, lng: b.longitude }}
                className="h-56"
              />
              {b.notes ? <p className="rounded-xl bg-sand-50 p-3">Instructions: {b.notes}</p> : null}
            </CardContent>
          </Card>

          {reschedules.length || cancellations.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Requests</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {reschedules.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl bg-sand-50 p-3">
                    <span>
                      Reschedule → {formatDate(r.requested_date, { year: false })}, {r.requested_time_slot}
                      <span className="block text-xs text-muted">{formatDateTime(r.created_at)}{r.admin_note ? ` · ${r.admin_note}` : ""}</span>
                    </span>
                    <RequestStatusBadge status={r.status} />
                  </div>
                ))}
                {cancellations.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 rounded-xl bg-sand-50 p-3">
                    <span>
                      Cancellation · {c.reason}
                      <span className="block text-xs text-muted">{formatDateTime(c.created_at)}{c.admin_note ? ` · ${c.admin_note}` : ""}</span>
                    </span>
                    <RequestStatusBadge status={c.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
