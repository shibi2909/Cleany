import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { getSessionUser } from "@/lib/auth";
import { getBookingDetail, serviceNames } from "@/lib/data/bookings";
import { getPublicData } from "@/lib/data/catalog";
import { bhkLabel, formatDate, formatINR, formatNumber } from "@/lib/format";
import { resolveWhatsAppNumber } from "@/lib/settings/schema";
import { createBookingWhatsAppMessage } from "@/lib/whatsapp/messages";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Booking Created", robots: { index: false } };

export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/booking/success?id=${id ?? ""}`)}`);

  const detail = id ? await getBookingDetail(id) : null;
  if (!detail) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={Info} title="Booking not found" description="We couldn't find this booking on your account." action={{ label: "View my bookings", href: "/customer/bookings" }} />
      </div>
    );
  }

  const { booking: b, items } = detail;
  const { settings } = await getPublicData();
  const wa = resolveWhatsAppNumber(settings);
  const message = createBookingWhatsAppMessage({ ...b, services: serviceNames(items) });

  const rows: [string, React.ReactNode][] = [
    ["Booking ID", <span key="id" className="font-mono font-semibold">{b.booking_number}</span>],
    ["Service", `${bhkLabel(b.bhk_type)} Deep Cleaning`],
    ["Area", b.area_is_approximate && b.area_range_label ? `${b.area_range_label} (approx.)` : `${formatNumber(b.area_sqft)} sq.ft`],
    ["Date", formatDate(b.booking_date, { year: true, weekday: true })],
    ["Time", b.time_slot],
    ["Address", [b.address, b.landmark, b.pincode].filter(Boolean).join(", ")],
    ["Total", <span key="t" className="font-display text-xl font-medium">{formatINR(b.total)}</span>],
    ["Payment status", <PaymentStatusBadge key="p" status={b.payment_status} />],
  ];

  return (
    <div className="container-page max-w-2xl py-12 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-900 text-cream shadow-lift">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h1 className="display mt-6 text-3xl sm:text-4xl">Your booking has been created!</h1>
        <p className="mt-2 text-muted">Thank you for choosing {BRAND.name}.</p>
      </div>

      <dl className="mt-10 divide-y divide-line rounded-3xl border border-line bg-white px-6 shadow-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-ink sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-3xl bg-sand-50 p-6">
        <p className="font-semibold">Next: send your booking on WhatsApp</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-soft">
          <li>Tap the button below — your booking details are pre-filled. Press send in WhatsApp.</li>
          <li>We&apos;ll reply with our official UPI payment details.</li>
          <li>Pay and share the screenshot on WhatsApp (or upload it in your dashboard).</li>
          <li>We verify the payment and confirm your booking.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Your booking is not confirmed until our team verifies your payment. We will never ask for your UPI PIN.</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <WhatsAppButton phone={wa} message={message} size="lg" className="flex-1">
          Send Booking on WhatsApp
        </WhatsAppButton>
        <Button asChild size="lg" variant="outline" className="flex-1">
          <Link href={`/customer/bookings/${b.id}`}>View My Booking</Link>
        </Button>
      </div>
    </div>
  );
}
