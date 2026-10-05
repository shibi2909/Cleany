/** Maps stable error codes raised by the database functions to friendly messages. */
const MESSAGES: Record<string, string> = {
  SLOT_FULL: "Sorry, that time slot was just taken. Please choose another slot.",
  SLOT_IN_PAST: "That time slot is no longer available. Please choose a later slot.",
  PRICE_MISMATCH: "Prices were updated while you were booking. Please review your quote and try again.",
  NOT_FOUND: "We couldn't find that booking.",
  INVALID_STATE: "This action isn't available for the booking's current status.",
  INVALID_TRANSITION: "That status change isn't allowed from the booking's current status.",
  PAYMENT_ALREADY_SUBMITTED: "Payment proof has already been submitted and is being verified.",
  PAYMENT_ALREADY_VERIFIED: "This payment has already been verified.",
  NOTHING_TO_REVIEW: "There's no payment waiting for review.",
  RESCHEDULE_LIMIT: "This booking has reached the maximum number of reschedules.",
  SAME_SLOT: "Please choose a different date or time from your current booking.",
  ALREADY_REVIEWED: "This request has already been reviewed.",
  VERIFY_PAYMENT_FIRST: "Please verify or reject the pending payment before approving this cancellation.",
  STAFF_NOT_FOUND: "That staff member is not active.",
  INVALID_AMOUNT: "The refund amount must be between ₹0 and the booking total.",
  HISTORY_IS_IMMUTABLE: "Booking history can't be deleted.",
};

export function friendlyDbError(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  const msg = error?.message ?? "";
  const code = Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (code) return MESSAGES[code];
  if (/fetch failed|network|ECONN|ETIMEDOUT/i.test(msg)) return "We couldn't reach the server. Please check your connection and try again.";
  return fallback;
}
