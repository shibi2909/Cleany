import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bath, CalendarDays, Clock, Home, Info, MapPin, Ruler, UserRound } from "lucide-react";
import { PriceBreakdown } from "@/components/booking/price-breakdown";
import { CancelDialog } from "@/components/customer/cancel-dialog";
import { PaymentProofForm } from "@/components/customer/payment-proof-form";
import { RescheduleDialog } from "@/components/customer/reschedule-dialog";
import { HistoryTimeline, JourneyProgress } from "@/components/customer/status-timeline";
import { WithdrawRescheduleButton } from "@/components/customer/withdraw-reschedule";
import { MapView } from "@/components/maps/map-view";
import { BookingStatusBadge, PaymentStatusBadge, RefundStatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_META } from "@/lib/booking/status";
import { evaluateCancellation } from "@/lib/cancellation/policy";
import { getBookingDetail, serviceNames } from "@/lib/data/bookings";
import { getPublicData } from "@/lib/data/catalog";
import { bhkLabel, formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { evaluateReschedule } from "@/lib/rescheduling/policy";
import { resolveWhatsAppNumber } from "@/lib/settings/schema";
import {
  createBookingWhatsAppMessage,
  createCancellationWhatsAppMessage,
  createPaymentProofWhatsAppMessage,
  createRescheduleWhatsAppMessage,
  createSupportWhatsAppMessage,
} from "@/lib/whatsapp/messages";

export const metadata: Metadata = { title: "Booking Details", robots: { index: false } };

export default async function CustomerBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { id } = await params;
  const { action } = await searchParams;
  await requireUser(`/customer/bookings/${id}`);
  const [detail, { settings }] = await Promise.all([getBookingDetail(id), getPublicData()]);
  if (!detail) notFound();

  const { booking: b, items, payments, history, reschedules, cancellations, refunds, staff } = detail;
  const wa = resolveWhatsAppNumber(settings);
  const services = serviceNames(items);
  const rescheduleEval = evaluateReschedule(b, settings.reschedule);
  const cancelEval = evaluateCancellation(b, settings.cancellation);
  const latestReschedule = reschedules[0] ?? null;
  const pendingReschedule = reschedules.find((r) => r.status === "PENDING") ?? null;
  const latestCancellation = cancellations[0] ?? null;
  const cancelled = b.booking_status === "CANCELLED";
  const needsPayment = !cancelled && b.booking_status !== "CANCELLATION_REQUESTED" && (b.payment_status === "PENDING" || b.payment_status === "REJECTED");
  const rejectedPayment = [...payments].reverse().find((p) => p.status === "REJECTED");
  const refund = refunds[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/customer/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All bookings
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted">Booking ID</p>
            <h1 className="font-mono text-2xl font-semibold sm:text-3xl">{b.booking_number}</h1>
            <p className="mt-1 text-muted">{BOOKING_STATUS_META[b.booking_status].description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status={b.booking_status} />
            <PaymentStatusBadge status={b.payment_status} />
            {b.refund_status !== "NOT_APPLICABLE" ? <RefundStatusBadge status={b.refund_status} /> : null}
          </div>
        </div>
      </div>

      {/* ── Contextual banners ── */}
      {cancelled ? (
        <Alert tone="danger" title="Your booking has been cancelled.">
          <p>
            Payment: <strong>{b.payment_status === "PENDING" ? "Pending" : b.payment_status === "REFUNDED" ? "Refunded" : b.payment_status === "PAID" ? "Paid" : b.payment_status}</strong>
            {" · "}Refund: <strong>{b.refund_status === "NOT_APPLICABLE" ? "Not applicable" : b.refund_status.charAt(0) + b.refund_status.slice(1).toLowerCase()}</strong>
            {refund ? ` (${formatINR(refund.amount)})` : ""}
          </p>
          {b.refund_status !== "NOT_APPLICABLE" ? (
            <p className="mt-1">Refund eligibility will be handled according to our cancellation policy. Refunds are processed manually to your UPI account.</p>
          ) : b.payment_status === "PENDING" ? (
            <p className="mt-1">No payment was made, so no refund is required.</p>
          ) : null}
          <div className="mt-3">
            <WhatsAppButton size="sm" phone={wa} message={createCancellationWhatsAppMessage(b, latestCancellation?.reason ?? "Other")}>
              Contact us on WhatsApp
            </WhatsAppButton>
          </div>
        </Alert>
      ) : null}

      {b.booking_status === "CANCELLATION_REQUESTED" && latestCancellation ? (
        <Alert tone="warning" title="Cancellation requested">
          Requested {formatDateTime(latestCancellation.created_at)} · Reason: {latestCancellation.reason}. Our team will review it shortly.
          <div className="mt-3">
            <WhatsAppButton size="sm" phone={wa} message={createCancellationWhatsAppMessage(b, latestCancellation.reason, { pendingApproval: true })}>
              Cancellation Support
            </WhatsAppButton>
          </div>
        </Alert>
      ) : null}

      {!cancelled && latestCancellation?.status === "REJECTED" && b.booking_status !== "CANCELLATION_REQUESTED" ? (
        <Alert tone="info" title="Your cancellation request was not approved.">
          {latestCancellation.admin_note ?? "Please contact support if you have questions."}
        </Alert>
      ) : null}

      {pendingReschedule ? (
        <Alert tone="warning" title="Reschedule request under review">
          <p>
            Current: {formatDate(pendingReschedule.old_date, { year: false })}, {pendingReschedule.old_time_slot} → Requested:{" "}
            <strong>
              {formatDate(pendingReschedule.requested_date, { year: false })}, {pendingReschedule.requested_time_slot}
            </strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <WithdrawRescheduleButton requestId={pendingReschedule.id} bookingId={b.id} />
            <WhatsAppButton size="sm" variant="outline" phone={wa} message={createSupportWhatsAppMessage("reschedule", b)}>
              Rescheduling Support
            </WhatsAppButton>
          </div>
        </Alert>
      ) : latestReschedule?.status === "REJECTED" && !cancelled ? (
        <Alert tone="warning" title="Your reschedule request could not be approved.">
          {latestReschedule.admin_note ? <p>{latestReschedule.admin_note}</p> : null}
          <p className="mt-1">Your original date and time are unchanged.</p>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <RescheduleDialog
              booking={b}
              settings={settings.booking}
              evaluation={rescheduleEval}
              whatsapp={wa}
              triggerLabel="Choose Another Time"
              defaultOpen={action === "reschedule"}
            />
            <WhatsAppButton variant="outline" phone={wa} message={createSupportWhatsAppMessage("reschedule", b)}>
              Contact Support
            </WhatsAppButton>
          </div>
        </Alert>
      ) : latestReschedule?.status === "APPROVED" && !cancelled ? (
        <Alert tone="success" title="Your booking has been rescheduled successfully.">
          <p>
            From {formatDate(latestReschedule.old_date, { year: false })}, {latestReschedule.old_time_slot} to{" "}
            <strong>
              {formatDate(latestReschedule.requested_date, { year: false })}, {latestReschedule.requested_time_slot}
            </strong>
            .
          </p>
          <div className="mt-3">
            <WhatsAppButton
              size="sm"
              phone={wa}
              message={createRescheduleWhatsAppMessage({
                booking_number: b.booking_number,
                oldDate: latestReschedule.old_date,
                oldSlot: latestReschedule.old_time_slot,
                newDate: latestReschedule.requested_date,
                newSlot: latestReschedule.requested_time_slot,
              })}
            >
              Share on WhatsApp
            </WhatsAppButton>
          </div>
        </Alert>
      ) : null}

      {b.payment_status === "PAYMENT_VERIFICATION_PENDING" ? (
        <Alert tone="info" title="We're verifying your payment">
          Thanks! Our team is checking your payment proof. Your booking will be confirmed once it&apos;s verified.
        </Alert>
      ) : null}

      {!cancelled ? (
        <Card>
          <CardContent className="pt-6">
            <JourneyProgress booking={b} />
          </CardContent>
        </Card>
      ) : null}

      {needsPayment ? (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>{b.payment_status === "REJECTED" ? "Payment could not be verified" : "Complete your payment"}</CardTitle>
            <p className="text-sm text-muted">
              {b.payment_status === "REJECTED"
                ? `${rejectedPayment?.admin_note ?? "We couldn't match your payment."} Please pay again or share the correct proof.`
                : "Send your booking on WhatsApp and we'll reply with our official UPI details. Opening WhatsApp doesn't complete payment — we confirm once your payment is verified."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">
                Amount to pay: <span className="font-display text-2xl font-medium text-brand-900">{formatINR(b.total)}</span>
              </p>
              <WhatsAppButton phone={wa} message={createBookingWhatsAppMessage({ ...b, services })}>
                Send Booking on WhatsApp
              </WhatsAppButton>
              <WhatsAppButton phone={wa} variant="outline" message={createSupportWhatsAppMessage("payment", b)}>
                Payment Help
              </WhatsAppButton>
              <WhatsAppButton phone={wa} variant="outline" message={createPaymentProofWhatsAppMessage(b)}>
                Send Payment Proof
              </WhatsAppButton>
              <p className="text-xs text-muted">Only pay to the UPI ID we share on our official WhatsApp number. We never ask for your UPI PIN.</p>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Or upload your payment proof here</p>
              <PaymentProofForm bookingId={b.id} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Home & services</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <p className="flex items-center gap-2">
                  <Home className="size-4 text-brand-700" aria-hidden /> {bhkLabel(b.bhk_type)}
                </p>
                <p className="flex items-center gap-2">
                  <Ruler className="size-4 text-brand-700" aria-hidden />
                  {b.area_is_approximate && b.area_range_label ? `${b.area_range_label} (approx.)` : `${formatNumber(b.area_sqft)} sq.ft`}
                </p>
                <p className="flex items-center gap-2">
                  <Bath className="size-4 text-brand-700" aria-hidden /> {b.bathroom_count >= 4 ? "4+" : b.bathroom_count} bathroom{b.bathroom_count > 1 ? "s" : ""}
                </p>
              </div>
              <PriceBreakdown booking={b} items={items} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                <span>
                  {b.address}
                  {b.landmark ? `, near ${b.landmark}` : ""}, {b.pincode}
                  <span className="block text-muted">{Number(b.distance_from_center).toFixed(1)} km from service centre</span>
                </span>
              </p>
              <MapView
                center={{ lat: settings.service_area.center_lat, lng: settings.service_area.center_lng }}
                centerLabel={settings.service_area.center_label}
                radiusKm={settings.service_area.radius_km}
                customer={{ lat: b.latitude, lng: b.longitude }}
                className="h-64"
              />
              {b.notes ? (
                <p className="rounded-xl bg-sand-50 p-3 text-sm">
                  <span className="font-semibold">Instructions:</span> {b.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking history</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline history={history} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="flex items-center gap-2 font-semibold">
                <CalendarDays className="size-4 text-brand-700" aria-hidden /> {formatDate(b.booking_date, { year: true, weekday: true })}
              </p>
              <p className="flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-brand-700" aria-hidden /> {b.time_slot}
              </p>
              {!cancelled && b.booking_status !== "COMPLETED" ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  {!pendingReschedule && latestReschedule?.status !== "REJECTED" ? (
                    <RescheduleDialog booking={b} settings={settings.booking} evaluation={rescheduleEval} whatsapp={wa} defaultOpen={action === "reschedule"} />
                  ) : null}
                  <CancelDialog
                    booking={b}
                    evaluation={cancelEval}
                    refundPolicy={settings.cancellation.refund_policy_text}
                    whatsapp={wa}
                    defaultOpen={action === "cancel"}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned staff</CardTitle>
            </CardHeader>
            <CardContent>
              {staff ? (
                <p className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{staff.full_name}</span>
                    <a href={`tel:${staff.phone}`} className="text-sm text-brand-700 hover:underline">
                      {staff.phone}
                    </a>
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Info className="size-4" aria-hidden /> No assigned staff yet. We&apos;ll assign a team once your booking is confirmed.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{formatINR(p.amount)} · UPI</p>
                    <p className="text-xs text-muted">
                      {p.reference ? `Ref ${p.reference} · ` : ""}
                      {formatDateTime(p.submitted_at ?? p.created_at)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </div>
              ))}
              {refund ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5 text-sm">
                  <p className="font-medium">Refund {formatINR(refund.amount)}</p>
                  <RefundStatusBadge status={refund.status} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need help?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <WhatsAppButton phone={wa} message={createSupportWhatsAppMessage("booking", b)}>
                Contact Support
              </WhatsAppButton>
              <Link href="/book" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                Book another cleaning <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
