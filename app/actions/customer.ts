"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSettings } from "@/lib/data/catalog";
import { friendlyDbError } from "@/lib/booking/errors";
import { findSlot, isSlotTimeAllowed, slotStartISO } from "@/lib/booking/slots";
import { evaluateCancellation } from "@/lib/cancellation/policy";
import { evaluateReschedule } from "@/lib/rescheduling/policy";
import {
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_PROOF_TYPES,
  cancellationRequestSchema,
  paymentProofSchema,
  profileSchema,
  rescheduleRequestSchema,
} from "@/lib/validation/booking";
import type { ActionResult, Booking, RefundStatus } from "@/types";

const NOT_SIGNED_IN = "Your session has expired. Please log in again.";

/** Loads the booking through the user's RLS-scoped client, so only the owner can act on it. */
async function ownBooking(bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  return data as Booking | null;
}

function revalidateBooking(id: string) {
  revalidatePath(`/customer/bookings/${id}`);
  revalidatePath("/customer", "layout");
  revalidatePath("/admin", "layout");
}

// ───────────────────────── Payment proof ─────────────────────────

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" };

export async function uploadPaymentProofAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const parsed = paymentProofSchema.safeParse({ bookingId: formData.get("bookingId"), reference: formData.get("reference") ?? "" });
  if (!parsed.success) return { ok: false, error: "Please check the payment details and try again." };
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile && !parsed.data.reference) {
    return { ok: false, error: "Upload a payment screenshot or enter the UPI transaction reference." };
  }
  if (hasFile) {
    if (!PAYMENT_PROOF_TYPES.includes(file.type)) return { ok: false, error: "Please upload a PNG, JPG, WEBP image or a PDF." };
    if (file.size > PAYMENT_PROOF_MAX_BYTES) return { ok: false, error: "The file is too large. Please upload a file under 5 MB." };
  }

  const booking = await ownBooking(parsed.data.bookingId);
  if (!booking) return { ok: false, error: "We couldn't find that booking." };
  if (!["PENDING", "REJECTED"].includes(booking.payment_status)) {
    return { ok: false, error: "Payment for this booking is already being verified or has been verified." };
  }

  try {
    const admin = createAdminClient();
    let path: string | null = null;
    if (hasFile) {
      path = `${user.id}/${booking.id}/${Date.now()}.${EXT[file.type]}`;
      const { error: uploadError } = await admin.storage
        .from("payment-proofs")
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (uploadError) {
        console.error("[paymentProof] upload", uploadError);
        return { ok: false, error: "We couldn't upload your screenshot. Please try again, or send it to us on WhatsApp." };
      }
    }
    const { error } = await admin.rpc("submit_payment_proof", {
      p_booking_id: booking.id,
      p_user_id: user.id,
      p_reference: parsed.data.reference,
      p_proof_path: path,
    });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidateBooking(booking.id);
    return { ok: true, data: undefined, message: "Payment proof submitted. Our team will verify it shortly." };
  } catch (err) {
    console.error("[paymentProof]", err);
    return { ok: false, error: "Payment proof upload failed. Please check your connection or send it on WhatsApp." };
  }
}

// ───────────────────────── Rescheduling ─────────────────────────

export async function requestRescheduleAction(
  input: z.input<typeof rescheduleRequestSchema>,
): Promise<ActionResult<{ status: "PENDING" | "APPROVED"; newDate: string; newSlot: string; fee: number }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  const parsed = rescheduleRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a new date and time." };

  const booking = await ownBooking(parsed.data.bookingId);
  if (!booking) return { ok: false, error: "We couldn't find that booking." };

  try {
    const admin = createAdminClient();
    const settings = await loadSettings(admin);
    const policy = evaluateReschedule(booking, settings.reschedule);
    if (!policy.allowed) return { ok: false, error: policy.blockedReason ?? "This booking can't be rescheduled." };

    const slot = findSlot(settings.booking, parsed.data.slotId);
    if (!slot || !isSlotTimeAllowed(settings.booking, parsed.data.date, slot)) {
      return { ok: false, error: "That time slot is unavailable. Please choose another." };
    }

    const { data, error } = await admin.rpc("request_reschedule", {
      p_booking_id: booking.id,
      p_user_id: user.id,
      p_new_date: parsed.data.date,
      p_new_slot: slot.label,
      p_new_slot_start: slotStartISO(parsed.data.date, slot),
      p_reason: parsed.data.reason,
      p_fee: policy.fee,
      p_requires_approval: policy.requiresApproval,
      p_max_reschedules: settings.reschedule.max_reschedules,
      p_slot_capacity: settings.booking.slot_capacity,
    });
    if (error) return { ok: false, error: friendlyDbError(error, "We couldn't submit your reschedule request. Please try again.") };
    revalidateBooking(booking.id);
    const status = (data as { status: "PENDING" | "APPROVED" }).status;
    return { ok: true, data: { status, newDate: parsed.data.date, newSlot: slot.label, fee: policy.fee } };
  } catch (err) {
    console.error("[reschedule]", err);
    return { ok: false, error: "Reschedule failed. Please check your connection and try again." };
  }
}

export async function withdrawRescheduleAction(requestId: string, bookingId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  const { error } = await createAdminClient().rpc("withdraw_reschedule_request", { p_request_id: requestId, p_user_id: user.id });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidateBooking(bookingId);
  return { ok: true, data: undefined, message: "Reschedule request withdrawn." };
}

// ───────────────────────── Cancellation ─────────────────────────

export async function requestCancellationAction(
  input: z.input<typeof cancellationRequestSchema>,
): Promise<ActionResult<{ status: "PENDING" | "APPROVED"; refundStatus: RefundStatus; refundAmount: number }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  const parsed = cancellationRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a reason for cancelling." };

  const booking = await ownBooking(parsed.data.bookingId);
  if (!booking) return { ok: false, error: "We couldn't find that booking." };

  try {
    const admin = createAdminClient();
    const settings = await loadSettings(admin);
    const policy = evaluateCancellation(booking, settings.cancellation);
    if (!policy.allowed) return { ok: false, error: policy.blockedReason ?? "This booking can't be cancelled online." };

    const { data, error } = await admin.rpc("request_cancellation", {
      p_booking_id: booking.id,
      p_user_id: user.id,
      p_reason: parsed.data.reason,
      p_comment: parsed.data.comment,
      p_requires_approval: policy.requiresApproval,
      p_fee: policy.fee,
      p_refund_amount: policy.refundAmount,
    });
    if (error) return { ok: false, error: friendlyDbError(error, "We couldn't cancel your booking. Please try again or contact support.") };
    revalidateBooking(booking.id);
    const res = data as { status: "PENDING" | "APPROVED"; refund_status: RefundStatus };
    return { ok: true, data: { status: res.status, refundStatus: res.refund_status, refundAmount: policy.refundAmount } };
  } catch (err) {
    console.error("[cancel]", err);
    return { ok: false, error: "Cancellation failed. Please check your connection or contact support on WhatsApp." };
  }
}

// ───────────────────────── Profile ─────────────────────────

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  // Only name and phone are writable; role and email are never taken from the client.
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) return { ok: false, error: "We couldn't save your profile. Please try again." };
  revalidatePath("/customer", "layout");
  return { ok: true, data: undefined, message: "Profile updated." };
}
