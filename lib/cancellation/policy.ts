import { CANCELLABLE_STATUSES } from "@/lib/booking/status";
import { hoursUntil } from "@/lib/booking/slots";
import type { CancellationSettings, FeeType } from "@/lib/settings/schema";
import type { Booking } from "@/types";

export const CANCELLATION_REASONS = [
  "Change of plans",
  "Found another service",
  "Price",
  "Timing doesn't work",
  "Location issue",
  "Duplicate booking",
  "Other",
] as const;

export interface CancellationEvaluation {
  allowed: boolean;
  /** Why it is not allowed (customer-facing). */
  blockedReason?: string;
  requiresApproval: boolean;
  fee: number;
  /** Amount to refund if the booking has been paid. */
  refundAmount: number;
  isPaid: boolean;
  hoursUntilService: number;
  notes: string[];
}

export function computeFee(total: number, feeType: FeeType, feeValue: number) {
  if (feeType === "fixed") return Math.min(Math.round(feeValue), total);
  if (feeType === "percentage") return Math.min(Math.round((total * Math.min(feeValue, 100)) / 100), total);
  return 0;
}

/**
 * Applies the admin-configured cancellation policy. Used to preview the outcome in
 * the customer UI and re-evaluated on the server when the request is submitted.
 */
export function evaluateCancellation(
  booking: Pick<Booking, "booking_status" | "payment_status" | "slot_start" | "total">,
  policy: CancellationSettings,
  now: Date = new Date(),
): CancellationEvaluation {
  const hrs = hoursUntil(booking.slot_start, now);
  const isPaid = booking.payment_status === "PAID";
  const base = { requiresApproval: false, fee: 0, refundAmount: 0, isPaid, hoursUntilService: hrs, notes: [] as string[] };

  if (!CANCELLABLE_STATUSES.includes(booking.booking_status)) {
    return { ...base, allowed: false, blockedReason: "This booking can no longer be cancelled online." };
  }
  if (!policy.enabled) {
    return { ...base, allowed: false, blockedReason: "Online cancellation is currently unavailable. Please contact support on WhatsApp." };
  }
  if (hrs <= 0) {
    return { ...base, allowed: false, blockedReason: "The scheduled service time has passed. Please contact support." };
  }

  const notes: string[] = [];
  let requiresApproval = policy.approval_required;
  if (policy.approval_required) notes.push("Our team will review and confirm your cancellation.");
  if (hrs < policy.min_notice_hours) {
    requiresApproval = true;
    notes.push(`Cancellations within ${policy.min_notice_hours} hours of the slot need approval from our team.`);
  }
  if (booking.payment_status === "PAYMENT_VERIFICATION_PENDING") {
    requiresApproval = true;
    notes.push("Your payment is still being verified, so our team will review this cancellation.");
  }

  const feeApplies = policy.fee_type !== "none" && hrs < policy.fee_window_hours;
  const fee = feeApplies ? computeFee(booking.total, policy.fee_type, policy.fee_value) : 0;
  if (fee > 0 && isPaid) notes.push(`A cancellation fee applies because the slot is within ${policy.fee_window_hours} hours.`);

  const refundAmount = isPaid ? Math.max(booking.total - fee, 0) : 0;
  return { allowed: true, requiresApproval, fee, refundAmount, isPaid, hoursUntilService: hrs, notes };
}
