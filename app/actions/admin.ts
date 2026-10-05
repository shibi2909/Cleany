"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSettings } from "@/lib/data/catalog";
import { friendlyDbError } from "@/lib/booking/errors";
import { settingsSchemas, type SettingsKey } from "@/lib/settings/schema";
import {
  areaPricingSchema,
  bathroomPricingSchema,
  bhkPricingSchema,
  bookingStatusSchema,
  discountSchema,
  noteSchema,
  refundStatusSchema,
  serviceSchema,
  staffSchema,
} from "@/lib/validation/admin";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "You don't have permission to do that." };
const uuid = z.uuid();

function revalidateAdmin(bookingId?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/customer", "layout");
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
}

function revalidateCatalog() {
  // Public pages show prices, services and policies.
  revalidatePath("/", "layout");
}

async function rpc(fn: string, args: Record<string, unknown>, bookingId?: string, success = "Updated."): Promise<ActionResult> {
  const { error } = await createAdminClient().rpc(fn, args);
  if (error) {
    console.error(`[admin:${fn}]`, error);
    return { ok: false, error: friendlyDbError(error) };
  }
  revalidateAdmin(bookingId);
  return { ok: true, data: undefined, message: success };
}

// ───────────────────────── Bookings & payments ─────────────────────────

export async function reviewPaymentAction(input: { bookingId: string; approve: boolean; reference?: string; note?: string }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(input.bookingId).success) return { ok: false, error: "Invalid booking." };
  return rpc(
    "review_payment",
    {
      p_booking_id: input.bookingId,
      p_admin_id: admin.id,
      p_approve: input.approve,
      p_reference: (input.reference ?? "").trim().slice(0, 60),
      p_note: noteSchema.parse(input.note ?? ""),
    },
    input.bookingId,
    input.approve ? "Payment verified. Booking confirmed." : "Payment marked as rejected.",
  );
}

export async function updateBookingStatusAction(input: { bookingId: string; status: string; note?: string }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const status = bookingStatusSchema.safeParse(input.status);
  if (!status.success || !uuid.safeParse(input.bookingId).success) return { ok: false, error: "Invalid status change." };
  return rpc(
    "update_booking_status",
    { p_booking_id: input.bookingId, p_admin_id: admin.id, p_new_status: status.data, p_note: noteSchema.parse(input.note ?? "") },
    input.bookingId,
    "Status updated.",
  );
}

export async function assignStaffAction(input: { bookingId: string; staffId: string }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(input.bookingId).success || !uuid.safeParse(input.staffId).success) return { ok: false, error: "Choose a staff member." };
  return rpc("assign_staff", { p_booking_id: input.bookingId, p_admin_id: admin.id, p_staff_id: input.staffId }, input.bookingId, "Staff assigned.");
}

export async function reviewRescheduleAction(input: { requestId: string; bookingId: string; approve: boolean; note?: string }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(input.requestId).success) return { ok: false, error: "Invalid request." };
  const settings = await loadSettings(createAdminClient());
  return rpc(
    "review_reschedule",
    {
      p_request_id: input.requestId,
      p_admin_id: admin.id,
      p_approve: input.approve,
      p_note: noteSchema.parse(input.note ?? ""),
      p_slot_capacity: settings.booking.slot_capacity,
    },
    input.bookingId,
    input.approve ? "Reschedule approved. Booking updated." : "Reschedule request rejected.",
  );
}

export async function reviewCancellationAction(input: {
  requestId: string;
  bookingId: string;
  approve: boolean;
  note?: string;
  refundAmount?: number | null;
}): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(input.requestId).success) return { ok: false, error: "Invalid request." };
  const refund = input.refundAmount === null || input.refundAmount === undefined ? null : z.coerce.number().int().min(0).safeParse(input.refundAmount);
  if (refund && !refund.success) return { ok: false, error: "Enter a valid refund amount." };
  return rpc(
    "review_cancellation",
    {
      p_request_id: input.requestId,
      p_admin_id: admin.id,
      p_approve: input.approve,
      p_note: noteSchema.parse(input.note ?? ""),
      p_refund_amount: refund ? refund.data : null,
    },
    input.bookingId,
    input.approve ? "Cancellation approved." : "Cancellation request rejected.",
  );
}

export async function adminCancelBookingAction(input: { bookingId: string; reason: string; refundAmount?: number | null }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(input.bookingId).success) return { ok: false, error: "Invalid booking." };
  const reason = z.string().trim().min(3, "Enter a reason").max(300).safeParse(input.reason);
  if (!reason.success) return { ok: false, error: "Enter a reason for cancelling." };
  return rpc(
    "admin_cancel_booking",
    { p_booking_id: input.bookingId, p_admin_id: admin.id, p_reason: reason.data, p_refund_amount: input.refundAmount ?? null },
    input.bookingId,
    "Booking cancelled.",
  );
}

export async function updateRefundAction(input: { refundId: string; bookingId: string; status: string; note?: string; amount?: number | null }): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const status = refundStatusSchema.safeParse(input.status);
  if (!status.success || !uuid.safeParse(input.refundId).success) return { ok: false, error: "Invalid refund update." };
  return rpc(
    "update_refund",
    {
      p_refund_id: input.refundId,
      p_admin_id: admin.id,
      p_status: status.data,
      p_note: noteSchema.parse(input.note ?? ""),
      p_amount: input.amount ?? null,
    },
    input.bookingId,
    `Refund marked ${status.data.toLowerCase()}.`,
  );
}

/** Short-lived signed URL for a private payment proof. */
export async function getPaymentProofUrlAction(path: string): Promise<ActionResult<{ url: string }>> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) return { ok: false, error: "Invalid file." };
  const { data, error } = await createAdminClient().storage.from("payment-proofs").createSignedUrl(path, 300);
  if (error || !data) return { ok: false, error: "Couldn't open the payment proof." };
  return { ok: true, data: { url: data.signedUrl } };
}

// ───────────────────────── Catalogue & pricing ─────────────────────────

export async function upsertServiceAction(input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, ...values } = parsed.data;
  const client = createAdminClient();
  const { error } = id ? await client.from("services").update(values).eq("id", id) : await client.from("services").insert(values);
  if (error) return { ok: false, error: error.code === "23505" ? "A service with this slug already exists." : "Couldn't save the service." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: id ? "Service updated." : "Service added." };
}

export async function setServiceActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid service." };
  const { error } = await createAdminClient().from("services").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the service." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: active ? "Service activated." : "Service deactivated." };
}

export async function uploadServiceImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const id = String(formData.get("serviceId") ?? "");
  const file = formData.get("file");
  if (!uuid.safeParse(id).success || !(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { ok: false, error: "Use a PNG, JPG or WEBP image." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Image must be under 5 MB." };
  const client = createAdminClient();
  const path = `services/${id}-${Date.now()}.${file.type.split("/")[1]}`;
  const { error } = await client.storage.from("service-images").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return { ok: false, error: "Upload failed. Please try again." };
  const url = client.storage.from("service-images").getPublicUrl(path).data.publicUrl;
  await client.from("services").update({ image_url: url }).eq("id", id);
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: { url }, message: "Image uploaded." };
}

export async function saveBhkPricingAction(rows: z.input<typeof bhkPricingSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = bhkPricingSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Check the BHK prices — all fields are required." };
  // Update existing rows only. An upsert is validated as a full insert first, and
  // the form doesn't send every NOT NULL column (e.g. label), so it would fail.
  const client = createAdminClient();
  const results = await Promise.all(
    parsed.data.map(({ bhk_type, ...values }) => client.from("bhk_pricing").update(values).eq("bhk_type", bhk_type)),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) {
    console.error("[admin:saveBhkPricing]", error);
    return { ok: false, error: "Couldn't save BHK pricing." };
  }
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: "BHK pricing saved." };
}

export async function saveAreaPricingAction(rows: z.input<typeof areaPricingSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = areaPricingSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the area ranges." };
  const client = createAdminClient();
  const withOrder = parsed.data.map((r, i) => ({ ...r, sort_order: i + 1 }));
  const existing = withOrder.filter((r) => r.id);
  const created = withOrder.filter((r) => !r.id).map(({ id: _id, ...r }) => r);
  const [a, b] = await Promise.all([
    existing.length ? client.from("area_pricing").upsert(existing) : Promise.resolve({ error: null }),
    created.length ? client.from("area_pricing").insert(created) : Promise.resolve({ error: null }),
  ]);
  if (a.error || b.error) return { ok: false, error: "Couldn't save area pricing." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: "Area pricing saved." };
}

export async function saveBathroomPricingAction(rows: z.input<typeof bathroomPricingSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = bathroomPricingSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Check the bathroom prices." };
  const { error } = await createAdminClient().from("bathroom_pricing").upsert(parsed.data, { onConflict: "bathroom_count" });
  if (error) return { ok: false, error: "Couldn't save bathroom pricing." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: "Bathroom pricing saved." };
}

export async function upsertDiscountAction(input: z.input<typeof discountSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the discount details." };
  const { id, ...values } = parsed.data;
  const client = createAdminClient();
  const { error } = id ? await client.from("discounts").update(values).eq("id", id) : await client.from("discounts").insert(values);
  if (error) return { ok: false, error: "Couldn't save the discount." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: "Discount saved." };
}

// ───────────────────────── Staff ─────────────────────────

export async function upsertStaffAction(input: z.input<typeof staffSchema>): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, ...values } = parsed.data;
  const client = createAdminClient();
  const { error } = id ? await client.from("staff").update(values).eq("id", id) : await client.from("staff").insert(values);
  if (error) return { ok: false, error: "Couldn't save the staff member." };
  revalidateAdmin();
  return { ok: true, data: undefined, message: id ? "Staff updated." : "Staff member added." };
}

// ───────────────────────── Settings ─────────────────────────

export async function updateSettingsAction(key: SettingsKey, value: unknown): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return FORBIDDEN;
  const schema = settingsSchemas[key];
  if (!schema) return { ok: false, error: "Unknown settings section." };
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".") || key}: ${issue.message}` : "Invalid settings." };
  }
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key, value: parsed.data, updated_by: admin.id }, { onConflict: "key" });
  if (error) return { ok: false, error: "Couldn't save settings." };
  revalidateAdmin();
  revalidateCatalog();
  return { ok: true, data: undefined, message: "Settings saved." };
}
