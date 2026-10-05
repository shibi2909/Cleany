import * as React from "react";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_META,
  PAYMENT_STATUS_META,
  REFUND_STATUS_META,
  REQUEST_STATUS_META,
  type Tone,
} from "@/lib/booking/status";
import type { BookingStatus, PaymentStatus, RefundStatus, RequestStatus } from "@/types";

const TONES: Record<Tone, string> = {
  neutral: "bg-sand-100 text-ink-soft ring-sand-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-brand-50 text-brand-800 ring-brand-200",
  warning: "bg-honey-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  brand: "bg-brand-900 text-cream ring-brand-900",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-muted",
  info: "bg-sky-500",
  success: "bg-brand-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  brand: "bg-brand-400",
};

export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const m = BOOKING_STATUS_META[status];
  return (
    <Badge tone={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const m = PAYMENT_STATUS_META[status];
  return (
    <Badge tone={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}

export function RefundStatusBadge({ status, className }: { status: RefundStatus; className?: string }) {
  const m = REFUND_STATUS_META[status];
  return (
    <Badge tone={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const m = REQUEST_STATUS_META[status];
  return (
    <Badge tone={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}
