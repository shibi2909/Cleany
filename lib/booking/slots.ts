import type { BookingSettings, TimeSlot } from "@/lib/settings/schema";

/** All scheduling is in India Standard Time (UTC+05:30, no DST). */
const IST_OFFSET = "+05:30";
const DAY_MS = 86_400_000;

/** YYYY-MM-DD for "today" in Bengaluru. */
export function todayIST(now: Date = new Date()) {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function isDateString(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

/** ISO timestamp of the slot start, e.g. 2026-09-30T09:00:00+05:30 */
export function slotStartISO(date: string, slot: Pick<TimeSlot, "start">) {
  return `${date}T${slot.start}:00${IST_OFFSET}`;
}

export function hoursUntil(slotStart: string | Date, now: Date = new Date()) {
  return (new Date(slotStart).getTime() - now.getTime()) / 3_600_000;
}

export function findSlot(settings: BookingSettings, slotId: string) {
  return settings.time_slots.find((s) => s.id === slotId) ?? null;
}

/** Latest date a customer can pick. */
export function maxBookableDate(settings: BookingSettings, now: Date = new Date()) {
  return addDays(todayIST(now), settings.max_advance_days);
}

/** Slot is in the future, has enough lead time and falls inside the booking window. */
export function isSlotTimeAllowed(settings: BookingSettings, date: string, slot: TimeSlot, now: Date = new Date()) {
  if (!isDateString(date)) return false;
  if (date > maxBookableDate(settings, now)) return false;
  return hoursUntil(slotStartISO(date, slot), now) >= settings.min_lead_hours;
}

/** The next `count` dates (from today) that have at least one slot with enough lead time. */
export function upcomingDates(settings: BookingSettings, count: number, now: Date = new Date()) {
  const out: string[] = [];
  const today = todayIST(now);
  for (let i = 0; out.length < count && i <= settings.max_advance_days; i++) {
    const date = addDays(today, i);
    if (settings.time_slots.some((s) => isSlotTimeAllowed(settings, date, s, now))) out.push(date);
  }
  return out;
}
