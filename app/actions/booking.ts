"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCatalog, loadSettings } from "@/lib/data/catalog";
import { calculateQuote } from "@/lib/pricing/quote";
import { checkServiceability } from "@/lib/maps/distance";
import { findSlot, isSlotTimeAllowed, slotStartISO, todayIST } from "@/lib/booking/slots";
import { getSlotAvailability, type SlotAvailability } from "@/lib/booking/availability";
import { friendlyDbError } from "@/lib/booking/errors";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validation/booking";
import type { ActionResult } from "@/types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Slot availability for a date (used by the booking wizard and reschedule dialog). */
export async function getSlotAvailabilityAction(date: string, excludeBookingId?: string): Promise<ActionResult<SlotAvailability[]>> {
  if (!dateSchema.safeParse(date).success) return { ok: false, error: "Please choose a valid date." };
  try {
    const admin = createAdminClient();
    const settings = await loadSettings(admin);
    const slots = await getSlotAvailability(admin, settings.booking, date, {
      excludeBookingId: excludeBookingId && z.uuid().safeParse(excludeBookingId).success ? excludeBookingId : undefined,
    });
    return { ok: true, data: slots };
  } catch (err) {
    console.error("[slots]", err);
    return { ok: false, error: "We couldn't load available time slots. Please check your connection and try again." };
  }
}

/**
 * Creates a booking. Everything the client sends is treated as a request:
 * the user, prices, serviceability and slot are all re-validated here.
 */
export async function createBookingAction(input: CreateBookingInput): Promise<ActionResult<{ id: string; bookingNumber: string }>> {
  // 1. Authenticated customer
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please log in to confirm your booking." };

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some details need attention. Please review the form.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { home, location, schedule, customer } = parsed.data;

  try {
    const admin = createAdminClient();
    const [settings, catalog] = await Promise.all([loadSettings(admin), loadCatalog(admin)]);

    // 2–3. Validate services and recalculate the quote from database prices.
    const quote = calculateQuote(catalog, home, todayIST());
    if (quote.errors.length > 0 || quote.lines.length === 0) {
      return { ok: false, error: "Some selected services are no longer available. Please review your quote." };
    }

    // 4–5. Validate location and serviceability with the configured radius.
    const service = checkServiceability(settings.service_area, location.lat, location.lng);
    if (!service.serviceable) {
      return { ok: false, error: "Sorry, we currently don't provide service at this location." };
    }

    // 6. Validate date / time slot (future, lead time, window) — capacity is enforced atomically in SQL.
    const slot = findSlot(settings.booking, schedule.slotId);
    if (!slot || !isSlotTimeAllowed(settings.booking, schedule.date, slot)) {
      return { ok: false, error: "That time slot is no longer available. Please choose another." };
    }

    // 7–11. Create booking, booking number, item snapshots, PENDING payment, REQUESTED status (one transaction).
    const { data, error } = await admin.rpc("create_booking", {
      p_booking: {
        user_id: user.id,
        customer_name: customer.fullName,
        customer_phone: customer.phone,
        customer_email: customer.email,
        bhk_type: home.bhkType,
        area_sqft: home.areaSqft,
        area_is_approximate: home.areaIsApproximate,
        area_range_label: quote.areaRange?.label ?? null,
        bathroom_count: home.bathroomCount,
        address: customer.address,
        landmark: customer.landmark,
        pincode: customer.pincode,
        latitude: location.lat,
        longitude: location.lng,
        distance_from_center: service.distanceKm,
        serviceable: service.serviceable,
        booking_date: schedule.date,
        time_slot: slot.label,
        slot_start: slotStartISO(schedule.date, slot),
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        notes: customer.instructions,
      },
      p_items: quote.lines.map((l) => ({
        service_id: l.serviceId,
        item_type: l.itemType,
        name: l.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
      })),
      p_slot_capacity: settings.booking.slot_capacity,
    });
    if (error) {
      console.error("[createBooking]", error);
      return { ok: false, error: friendlyDbError(error, "We couldn't create your booking. Please try again.") };
    }

    // Keep the profile's contact details filled in for next time.
    if (!user.profile.full_name || !user.profile.phone) {
      await admin
        .from("profiles")
        .update({ full_name: user.profile.full_name || customer.fullName, phone: user.profile.phone || customer.phone })
        .eq("id", user.id);
    }

    revalidatePath("/customer", "layout");
    revalidatePath("/admin", "layout");
    const result = data as { id: string; booking_number: string };
    return { ok: true, data: { id: result.id, bookingNumber: result.booking_number } };
  } catch (err) {
    console.error("[createBooking]", err);
    return { ok: false, error: friendlyDbError(err as Error, "We couldn't create your booking. Please check your connection and try again.") };
  }
}
