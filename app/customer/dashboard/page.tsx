import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, CalendarPlus, Clock, Eye } from "lucide-react";
import { BookingCard } from "@/components/customer/booking-card";
import { CancelDialog } from "@/components/customer/cancel-dialog";
import { RescheduleDialog } from "@/components/customer/reschedule-dialog";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import { evaluateCancellation } from "@/lib/cancellation/policy";
import { getPublicData } from "@/lib/data/catalog";
import { bhkLabel, formatDate, formatINR } from "@/lib/format";
import { evaluateReschedule } from "@/lib/rescheduling/policy";
import { resolveWhatsAppNumber } from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/server";
import { createSupportWhatsAppMessage } from "@/lib/whatsapp/messages";
import type { Booking, RescheduleRequest } from "@/types";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "My Dashboard", robots: { index: false } };

export default async function CustomerDashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ settings }, bookingsRes, requestsRes] = await Promise.all([
    getPublicData(),
    supabase.from("bookings").select("*").order("slot_start", { ascending: true }),
    supabase
      .from("reschedule_requests")
      .select("*")
      .in("status", ["APPROVED", "REJECTED"])
      .gte("reviewed_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order("reviewed_at", { ascending: false })
      .limit(3),
  ]);
  const bookings = (bookingsRes.data ?? []) as Booking[];
  const updates = (requestsRes.data ?? []) as RescheduleRequest[];
  const wa = resolveWhatsAppNumber(settings);

  const upcoming = bookings.filter((b) => ACTIVE_STATUSES.includes(b.booking_status) && new Date(b.slot_start).getTime() > Date.now() - 12 * 3_600_000);
  const next = upcoming[0] ?? null;
  const recent = [...bookings].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const firstName = (user.profile.full_name ?? "").split(" ")[0] || "there";

  return (
    <div className="flex flex-col gap-10">
      {notice === "admin-only" ? <Alert tone="warning">That area is only available to {BRAND.name} admins.</Alert> : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="display text-3xl sm:text-4xl">Hello, {firstName} 👋</h1>
          <p className="mt-1 text-muted">Here&apos;s what&apos;s happening with your cleanings.</p>
        </div>
        <Button asChild>
          <Link href="/book">
            <CalendarPlus aria-hidden /> Book a cleaning
          </Link>
        </Button>
      </div>

      {updates.length > 0 ? (
        <section aria-labelledby="updates-heading" className="flex flex-col gap-3">
          <h2 id="updates-heading" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Bell className="size-4" aria-hidden /> Updates
          </h2>
          {updates.map((u) => {
            const b = bookings.find((x) => x.id === u.booking_id);
            return u.status === "APPROVED" ? (
              <Alert key={u.id} tone="success" title="Your booking has been rescheduled successfully.">
                {b?.booking_number}: now {formatDate(u.requested_date, { year: false })}, {u.requested_time_slot}.{" "}
                <Link className="font-semibold underline" href={`/customer/bookings/${u.booking_id}`}>
                  View booking
                </Link>
              </Alert>
            ) : (
              <Alert key={u.id} tone="warning" title="Your reschedule request could not be approved.">
                {b?.booking_number}
                {u.admin_note ? ` — ${u.admin_note}` : ""}.{" "}
                <Link className="font-semibold underline" href={`/customer/bookings/${u.booking_id}?action=reschedule`}>
                  Choose another time
                </Link>
              </Alert>
            );
          })}
        </section>
      ) : null}

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Upcoming booking
        </h2>
        {next ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono font-semibold">{next.booking_number}</span>
              <div className="flex flex-wrap gap-2">
                <BookingStatusBadge status={next.booking_status} />
                <PaymentStatusBadge status={next.payment_status} />
              </div>
            </div>
            <p className="display mt-4 text-2xl sm:text-3xl">{bhkLabel(next.bhk_type)} Deep Cleaning</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4 text-brand-700" aria-hidden /> {formatDate(next.booking_date, { year: false, weekday: true })}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="size-4 text-brand-700" aria-hidden /> {next.time_slot}
              </span>
              <span className="font-semibold text-ink">{formatINR(next.total)}</span>
            </div>
            <div className="mt-6 flex flex-wrap items-start gap-3">
              <Button asChild>
                <Link href={`/customer/bookings/${next.id}`}>
                  <Eye aria-hidden /> View Booking
                </Link>
              </Button>
              <WhatsAppButton phone={wa} message={createSupportWhatsAppMessage(next.payment_status === "PAID" ? "booking" : "payment", next)}>
                WhatsApp
              </WhatsAppButton>
              <RescheduleDialog booking={next} settings={settings.booking} evaluation={evaluateReschedule(next, settings.reschedule)} whatsapp={wa} triggerLabel="Reschedule" />
              <CancelDialog booking={next} evaluation={evaluateCancellation(next, settings.cancellation)} refundPolicy={settings.cancellation.refund_policy_text} whatsapp={wa} />
            </div>
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="No upcoming bookings" description="Your next deep clean is just a few taps away." action={{ label: "Get Instant Quote", href: "/book" }} />
        )}
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent-heading" className="text-sm font-semibold uppercase tracking-wider text-muted">
              Recent bookings
            </h2>
            <Link href="/customer/bookings" className="text-sm font-semibold text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recent.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
