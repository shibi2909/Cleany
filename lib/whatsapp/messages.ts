import { BRAND } from "@/lib/config/brand";
import { PAYMENT_STATUS_META } from "@/lib/booking/status";
import { bhkLabel, formatDate, formatINR, formatNumber } from "@/lib/format";
import type { PaymentSettings } from "@/lib/settings/schema";
import type { Booking, PaymentStatus } from "@/types";

/**
 * WhatsApp click-to-chat helpers. These only *prepare* a message — the customer
 * (or admin) always reviews it and presses Send in WhatsApp themselves.
 */

/** Digits only, with India's country code added to bare 10-digit mobile numbers. */
export function normalizeWhatsAppNumber(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function createWhatsAppUrl(phone: string, message: string) {
  const number = normalizeWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

export type BookingMessageData = Pick<
  Booking,
  | "booking_number"
  | "bhk_type"
  | "area_sqft"
  | "area_is_approximate"
  | "area_range_label"
  | "bathroom_count"
  | "booking_date"
  | "time_slot"
  | "address"
  | "landmark"
  | "pincode"
  | "total"
  | "payment_status"
> & { services: string[] };

function homeSize(b: Pick<Booking, "area_sqft" | "area_is_approximate" | "area_range_label">) {
  return b.area_is_approximate && b.area_range_label ? `${b.area_range_label} (approx.)` : `${formatNumber(b.area_sqft)} sq.ft`;
}

function bathrooms(count: number) {
  return count >= 4 ? "4+" : String(count);
}

function paymentLabel(status: PaymentStatus) {
  return status === "PENDING" ? "Pending" : PAYMENT_STATUS_META[status].label;
}

function fullAddress(b: Pick<Booking, "address" | "landmark" | "pincode">) {
  return [b.address, b.landmark ? `Landmark: ${b.landmark}` : null, b.pincode].filter(Boolean).join(", ");
}

/** Customer → business, right after booking. */
export function createBookingWhatsAppMessage(b: BookingMessageData) {
  return [
    `Hello ${BRAND.name} 👋`,
    `I have booked your home cleaning service.`,
    ``,
    `📋 *BOOKING DETAILS*`,
    `Booking ID: ${b.booking_number}`,
    ``,
    `🏠 Service:`,
    `${bhkLabel(b.bhk_type)} Deep Cleaning`,
    ``,
    `📐 Home Size:`,
    homeSize(b),
    ``,
    `🚿 Bathrooms:`,
    bathrooms(b.bathroom_count),
    ``,
    `🧹 Services:`,
    ...b.services.map((s) => `• ${s}`),
    ``,
    `📅 Date:`,
    formatDate(b.booking_date),
    ``,
    `⏰ Time:`,
    b.time_slot,
    ``,
    `📍 Address:`,
    fullAddress(b),
    ``,
    `💰 Total:`,
    formatINR(b.total),
    ``,
    `Payment Status:`,
    paymentLabel(b.payment_status),
    ``,
    `Please share the payment details for this booking.`,
    `Thank you! 🙏`,
  ].join("\n");
}

/** Business → customer: UPI payment instructions. Values come from admin settings. */
export function createPaymentWhatsAppMessage(b: Pick<Booking, "booking_number" | "total">, payment: PaymentSettings) {
  return [
    `Thank you for booking with ${BRAND.name}! 🧹✨`,
    `Your booking ID is ${b.booking_number}.`,
    ``,
    `Amount to pay:`,
    formatINR(b.total),
    ``,
    `Please make the payment to:`,
    ...(payment.upi_id ? [`UPI:`, payment.upi_id] : []),
    ...(payment.payment_number ? [``, `UPI / Phone number:`, payment.payment_number] : []),
    ``,
    `Payment Name:`,
    payment.payee_name || BRAND.name,
    ``,
    payment.instructions ||
      `After payment, please send the payment screenshot here. Our team will verify your payment and confirm your booking.`,
    ``,
    `Thank you! ❤️`,
  ].join("\n");
}

/** Customer → business: payment proof follow-up. */
export function createPaymentProofWhatsAppMessage(b: Pick<Booking, "booking_number" | "total">) {
  return [
    `Hello ${BRAND.name},`,
    `I have made the payment for my booking.`,
    ``,
    `Booking ID: ${b.booking_number}`,
    `Amount paid: ${formatINR(b.total)}`,
    ``,
    `I'm attaching the payment screenshot. Please verify and confirm my booking.`,
    `Thank you! 🙏`,
  ].join("\n");
}

export function createCancellationWhatsAppMessage(
  b: Pick<Booking, "booking_number" | "bhk_type" | "booking_date" | "total">,
  reason: string,
  opts: { pendingApproval?: boolean } = {},
) {
  return [
    `Hello ${BRAND.name},`,
    opts.pendingApproval ? `I have requested to cancel my cleaning booking.` : `I have cancelled my cleaning booking.`,
    ``,
    `Booking ID:`,
    b.booking_number,
    ``,
    `Service:`,
    `${bhkLabel(b.bhk_type)} Deep Cleaning`,
    ``,
    `Original Date:`,
    formatDate(b.booking_date),
    ``,
    `Amount:`,
    formatINR(b.total),
    ``,
    `Reason:`,
    reason,
    ``,
    `Please confirm the cancellation.`,
    `Thank you.`,
  ].join("\n");
}

export interface ScheduleChange {
  booking_number: string;
  oldDate: string;
  oldSlot: string;
  newDate: string;
  newSlot: string;
}

/** Customer → business after a reschedule is approved. */
export function createRescheduleWhatsAppMessage(c: ScheduleChange) {
  return [
    `Hello ${BRAND.name} 👋`,
    `My booking has been rescheduled.`,
    ``,
    `Booking ID:`,
    c.booking_number,
    ``,
    `Previous:`,
    `${formatDate(c.oldDate, { year: false })}, ${c.oldSlot}`,
    ``,
    `New:`,
    `${formatDate(c.newDate, { year: false })}, ${c.newSlot}`,
    ``,
    `Thank you! 🙏`,
  ].join("\n");
}

/** Business → customer after approving a reschedule. */
export function createRescheduleApprovedCustomerMessage(c: ScheduleChange) {
  return [
    `Hello from ${BRAND.name} 👋`,
    `Your booking has been rescheduled successfully.`,
    ``,
    `Booking ID: ${c.booking_number}`,
    `New date: ${formatDate(c.newDate)}`,
    `New time: ${c.newSlot}`,
    ``,
    `See you then! 🧹✨`,
  ].join("\n");
}

export type SupportTopic = "general" | "payment" | "cancellation" | "reschedule" | "booking";

const SUPPORT_OPENERS: Record<SupportTopic, string> = {
  general: "I have a question about your cleaning services.",
  booking: "I need help with my booking.",
  payment: "I need help with the payment for my booking.",
  cancellation: "I need help with cancelling my booking.",
  reschedule: "I need help with rescheduling my booking.",
};

export function createSupportWhatsAppMessage(
  topic: SupportTopic = "general",
  b?: Pick<Booking, "booking_number" | "booking_date" | "time_slot"> | null,
) {
  return [
    `Hello ${BRAND.name} 👋`,
    SUPPORT_OPENERS[topic],
    ...(b ? [``, `Booking ID: ${b.booking_number}`, `Scheduled: ${formatDate(b.booking_date)}, ${b.time_slot}`] : []),
    ``,
    `Thank you!`,
  ].join("\n");
}
