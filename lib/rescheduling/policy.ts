import { RESCHEDULABLE_STATUSES } from "@/lib/booking/status";
import { hoursUntil } from "@/lib/booking/slots";
import { computeFee } from "@/lib/cancellation/policy";
import type { RescheduleSettings } from "@/lib/settings/schema";
import type { Booking } from "@/types";

export interface RescheduleEvaluation {
  allowed: boolean;
  blockedReason?: string;
  requiresApproval: boolean;
  fee: number;
  remaining: number;
  hoursUntilService: number;
}

/** Applies the admin-configured rescheduling policy (client preview + server enforcement). */
export function evaluateReschedule(
  booking: Pick<Booking, "booking_status" | "slot_start" | "total" | "reschedule_count">,
  policy: RescheduleSettings,
  now: Date = new Date(),
): RescheduleEvaluation {
  const hrs = hoursUntil(booking.slot_start, now);
  const remaining = Math.max(policy.max_reschedules - booking.reschedule_count, 0);
  const fee = computeFee(booking.total, policy.fee_type, policy.fee_value);
  const base = { requiresApproval: policy.approval_required, fee, remaining, hoursUntilService: hrs };

  if (booking.booking_status === "RESCHEDULE_REQUESTED") {
    return { ...base, allowed: false, blockedReason: "A reschedule request is already being reviewed." };
  }
  if (!RESCHEDULABLE_STATUSES.includes(booking.booking_status)) {
    return { ...base, allowed: false, blockedReason: "This booking can no longer be rescheduled online." };
  }
  if (!policy.enabled) {
    return { ...base, allowed: false, blockedReason: "Online rescheduling is currently unavailable. Please contact support on WhatsApp." };
  }
  if (remaining <= 0) {
    return {
      ...base,
      allowed: false,
      blockedReason: `You've reached the limit of ${policy.max_reschedules} reschedule${policy.max_reschedules === 1 ? "" : "s"} for this booking.`,
    };
  }
  if (hrs < policy.min_notice_hours) {
    return {
      ...base,
      allowed: false,
      blockedReason: `Rescheduling is available up to ${policy.min_notice_hours} hours before the service. Please contact support on WhatsApp.`,
    };
  }
  return { ...base, allowed: true };
}
