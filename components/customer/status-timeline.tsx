import { Check, Circle } from "lucide-react";
import { BOOKING_STATUS_META, JOURNEY_STEPS, PAYMENT_STATUS_META, REFUND_STATUS_META, journeyProgress } from "@/lib/booking/status";
import { formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Booking, BookingStatus, PaymentStatus, RefundStatus, StatusHistory } from "@/types";

/** Happy-path progress: requested → payment → confirmed → … → completed. */
export function JourneyProgress({ booking }: { booking: Pick<Booking, "booking_status" | "payment_status"> }) {
  if (booking.booking_status === "CANCELLED") return null;
  const reached = journeyProgress(booking.booking_status, booking.payment_status);
  return (
    <ol className="grid grid-cols-4 gap-y-4 sm:grid-cols-8" aria-label="Booking progress">
      {JOURNEY_STEPS.map((s, i) => {
        const done = i <= reached;
        const current = i === reached;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 ? (
              <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full", i <= reached ? "bg-brand-600" : "bg-sand-200")} aria-hidden />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2",
                done ? "border-brand-700 bg-brand-700 text-cream" : "border-sand-300 bg-white text-sand-300",
                current && "ring-4 ring-brand-100",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <Circle className="size-2 fill-current" aria-hidden />}
            </span>
            <span className={cn("mt-2 px-1 text-[0.7rem] leading-tight sm:text-xs", done ? "font-semibold text-ink" : "text-muted")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function label(kind: StatusHistory["kind"], status: string | null) {
  if (!status) return null;
  if (kind === "PAYMENT") return PAYMENT_STATUS_META[status as PaymentStatus]?.label ?? titleCase(status);
  if (kind === "REFUND") return REFUND_STATUS_META[status as RefundStatus]?.label ?? titleCase(status);
  return BOOKING_STATUS_META[status as BookingStatus]?.label ?? titleCase(status);
}

const KIND_LABEL: Record<StatusHistory["kind"], string> = {
  BOOKING: "Booking",
  PAYMENT: "Payment",
  REFUND: "Refund",
  RESCHEDULE: "Reschedule",
  CANCELLATION: "Cancellation",
  STAFF: "Staff",
  NOTE: "Note",
};

/** Full audit trail from booking_status_history. */
export function HistoryTimeline({ history }: { history: StatusHistory[] }) {
  if (history.length === 0) return <p className="text-sm text-muted">No updates yet.</p>;
  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-sand-200 pl-6">
      {[...history].reverse().map((h) => {
        const to = label(h.kind, h.new_status);
        const from = label(h.kind, h.old_status);
        return (
          <li key={h.id} className="relative">
            <span className="absolute -left-[1.95rem] top-1 size-3.5 rounded-full border-2 border-cream bg-brand-600" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {KIND_LABEL[h.kind]} · <time dateTime={h.created_at}>{formatDateTime(h.created_at)}</time>
            </p>
            {to ? (
              <p className="mt-0.5 font-semibold text-ink">
                {from ? <span className="font-normal text-muted">{from} → </span> : null}
                {to}
              </p>
            ) : null}
            {h.note ? <p className="text-sm text-ink-soft">{h.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
