import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, MapPin } from "lucide-react";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { bhkLabel, formatDate, formatINR } from "@/lib/format";
import type { Booking } from "@/types";

export function BookingCard({ booking: b }: { booking: Booking }) {
  return (
    <Link
      href={`/customer/bookings/${b.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:border-brand-200 hover:shadow-lift"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{b.booking_number}</span>
        <div className="flex flex-wrap gap-1.5">
          <BookingStatusBadge status={b.booking_status} />
          <PaymentStatusBadge status={b.payment_status} />
        </div>
      </div>
      <p className="font-semibold">{bhkLabel(b.bhk_type)} Deep Cleaning</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden /> {formatDate(b.booking_date, { year: true })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden /> {b.time_slot}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="size-4 shrink-0" aria-hidden /> <span className="truncate">{b.address}</span>
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="font-display text-xl font-medium">{formatINR(b.total)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          View <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
