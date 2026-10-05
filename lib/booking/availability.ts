import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSettings } from "@/lib/settings/schema";
import { isSlotTimeAllowed, slotStartISO } from "./slots";

export interface SlotAvailability {
  id: string;
  label: string;
  start: string;
  available: boolean;
  reason: "too_soon" | "full" | null;
  remaining: number;
}

/** Counts non-cancelled bookings per slot for a date (service-role client: only counts are exposed). */
export async function getSlotAvailability(
  admin: SupabaseClient,
  settings: BookingSettings,
  date: string,
  opts: { excludeBookingId?: string; now?: Date } = {},
): Promise<SlotAvailability[]> {
  const starts = settings.time_slots.map((s) => new Date(slotStartISO(date, s)).toISOString());
  let query = admin.from("bookings").select("id, slot_start").in("slot_start", starts).neq("booking_status", "CANCELLED");
  if (opts.excludeBookingId) query = query.neq("id", opts.excludeBookingId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const taken = new Map<string, number>();
  for (const row of data ?? []) {
    const key = new Date(row.slot_start as string).toISOString();
    taken.set(key, (taken.get(key) ?? 0) + 1);
  }

  return settings.time_slots.map((slot) => {
    const key = new Date(slotStartISO(date, slot)).toISOString();
    const remaining = Math.max(settings.slot_capacity - (taken.get(key) ?? 0), 0);
    const timeOk = isSlotTimeAllowed(settings, date, slot, opts.now);
    return {
      id: slot.id,
      label: slot.label,
      start: slot.start,
      available: timeOk && remaining > 0,
      reason: !timeOk ? "too_soon" : remaining <= 0 ? "full" : null,
      remaining,
    };
  });
}
