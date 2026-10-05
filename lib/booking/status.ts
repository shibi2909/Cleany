import type { BookingStatus, PaymentStatus, RefundStatus, RequestStatus } from "@/types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: Tone; description: string }> = {
  REQUESTED: { label: "Requested", tone: "info", description: "We've received your booking request." },
  PAYMENT_PENDING: { label: "Payment pending", tone: "warning", description: "Awaiting payment to confirm your slot." },
  CONFIRMED: { label: "Confirmed", tone: "success", description: "Your booking is confirmed." },
  ASSIGNED: { label: "Team assigned", tone: "brand", description: "A cleaning team has been assigned." },
  TEAM_ON_THE_WAY: { label: "Team on the way", tone: "brand", description: "Your cleaning team is on the way." },
  CLEANING: { label: "Cleaning in progress", tone: "brand", description: "Your home is being cleaned." },
  COMPLETED: { label: "Completed", tone: "success", description: "Cleaning completed. Enjoy your home!" },
  RESCHEDULE_REQUESTED: { label: "Reschedule requested", tone: "warning", description: "Your reschedule request is being reviewed." },
  CANCELLATION_REQUESTED: { label: "Cancellation requested", tone: "warning", description: "Your cancellation request is being reviewed." },
  CANCELLED: { label: "Cancelled", tone: "danger", description: "This booking has been cancelled." },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Payment pending", tone: "warning" },
  PAYMENT_VERIFICATION_PENDING: { label: "Verifying payment", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  REJECTED: { label: "Payment rejected", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const REFUND_STATUS_META: Record<RefundStatus, { label: string; tone: Tone }> = {
  NOT_APPLICABLE: { label: "Not applicable", tone: "neutral" },
  PENDING: { label: "Refund pending", tone: "warning" },
  PROCESSING: { label: "Refund processing", tone: "info" },
  COMPLETED: { label: "Refund completed", tone: "success" },
  REJECTED: { label: "Refund rejected", tone: "danger" },
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Withdrawn", tone: "neutral" },
};

/** Statuses from which the customer may cancel / reschedule. Mirrors the SQL guards. */
export const CANCELLABLE_STATUSES: BookingStatus[] = ["REQUESTED", "PAYMENT_PENDING", "CONFIRMED", "ASSIGNED", "RESCHEDULE_REQUESTED"];
export const RESCHEDULABLE_STATUSES: BookingStatus[] = ["REQUESTED", "PAYMENT_PENDING", "CONFIRMED", "ASSIGNED"];
export const ACTIVE_STATUSES: BookingStatus[] = [
  "REQUESTED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "TEAM_ON_THE_WAY",
  "CLEANING",
  "RESCHEDULE_REQUESTED",
  "CANCELLATION_REQUESTED",
];

/** Operational transitions an admin can trigger directly (the database enforces the same rules). */
export const ADMIN_NEXT_STATUS: Partial<Record<BookingStatus, { status: BookingStatus; label: string }[]>> = {
  REQUESTED: [{ status: "PAYMENT_PENDING", label: "Mark payment details sent" }],
  ASSIGNED: [{ status: "TEAM_ON_THE_WAY", label: "Team on the way" }],
  TEAM_ON_THE_WAY: [{ status: "CLEANING", label: "Start cleaning" }],
  CLEANING: [{ status: "COMPLETED", label: "Mark completed" }],
};

/** The happy-path journey shown on the customer timeline. */
export const JOURNEY_STEPS = [
  { key: "REQUESTED", label: "Booking requested" },
  { key: "PAYMENT_PENDING", label: "Payment pending" },
  { key: "PAID", label: "Payment verified" },
  { key: "CONFIRMED", label: "Booking confirmed" },
  { key: "ASSIGNED", label: "Staff assigned" },
  { key: "TEAM_ON_THE_WAY", label: "Team on the way" },
  { key: "CLEANING", label: "Cleaning" },
  { key: "COMPLETED", label: "Completed" },
] as const;

/** Index of the last reached journey step for a booking. */
export function journeyProgress(status: BookingStatus, payment: PaymentStatus) {
  const order: Partial<Record<BookingStatus, number>> = {
    REQUESTED: 0,
    PAYMENT_PENDING: 1,
    CONFIRMED: 3,
    ASSIGNED: 4,
    TEAM_ON_THE_WAY: 5,
    CLEANING: 6,
    COMPLETED: 7,
  };
  let idx = order[status] ?? 0;
  if (status === "RESCHEDULE_REQUESTED" || status === "CANCELLATION_REQUESTED") idx = payment === "PAID" ? 3 : 1;
  if (payment === "PAID" || payment === "REFUNDED") idx = Math.max(idx, 2);
  return idx;
}
