import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Booking,
  BookingItem,
  CancellationRequest,
  Payment,
  Refund,
  RescheduleRequest,
  Staff,
  StatusHistory,
} from "@/types";

export interface BookingDetail {
  booking: Booking;
  items: BookingItem[];
  payments: Payment[];
  history: StatusHistory[];
  reschedules: RescheduleRequest[];
  cancellations: CancellationRequest[];
  refunds: Refund[];
  staff: Pick<Staff, "id" | "full_name" | "phone"> | null;
}

/** Loads a full booking. `asAdmin` uses the service role (caller must have checked the role). */
export async function getBookingDetail(id: string, opts: { asAdmin?: boolean } = {}): Promise<BookingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = opts.asAdmin ? createAdminClient() : await createClient();

  // RLS restricts customers to their own booking; a foreign id simply returns null.
  const { data: booking } = await client.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!booking) return null;

  const [items, payments, history, reschedules, cancellations, refunds] = await Promise.all([
    client.from("booking_items").select("*").eq("booking_id", id).order("sort_order"),
    client.from("payments").select("*").eq("booking_id", id).order("created_at"),
    client.from("booking_status_history").select("*").eq("booking_id", id).order("created_at"),
    client.from("reschedule_requests").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
    client.from("cancellation_requests").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
    client.from("refunds").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
  ]);

  // Staff table is admin-only; expose just the assigned member's name and phone to the booking's owner.
  let staff: BookingDetail["staff"] = null;
  if (booking.assigned_staff_id) {
    const { data } = await createAdminClient().from("staff").select("id, full_name, phone").eq("id", booking.assigned_staff_id).maybeSingle();
    staff = data;
  }

  return {
    booking: booking as Booking,
    items: (items.data ?? []) as BookingItem[],
    payments: (payments.data ?? []) as Payment[],
    history: (history.data ?? []) as StatusHistory[],
    reschedules: (reschedules.data ?? []) as RescheduleRequest[],
    cancellations: (cancellations.data ?? []) as CancellationRequest[],
    refunds: (refunds.data ?? []) as Refund[],
    staff,
  };
}

/** Booking items grouped by booking, for list views and WhatsApp messages. */
export async function getItemsFor(bookingIds: string[], opts: { asAdmin?: boolean } = {}) {
  const map = new Map<string, BookingItem[]>();
  if (bookingIds.length === 0) return map;
  const client = opts.asAdmin ? createAdminClient() : await createClient();
  const { data } = await client.from("booking_items").select("*").in("booking_id", bookingIds).order("sort_order");
  for (const item of (data ?? []) as BookingItem[]) {
    const list = map.get(item.booking_id) ?? [];
    list.push(item);
    map.set(item.booking_id, list);
  }
  return map;
}

/** Customer-facing service names for messages ("Deep Home Cleaning (2 BHK)" → kept as snapshot). */
export function serviceNames(items: BookingItem[]) {
  return items.filter((i) => i.item_type === "SERVICE").map((i) => (i.quantity > 1 ? `${i.service_name_snapshot} × ${i.quantity}` : i.service_name_snapshot));
}
