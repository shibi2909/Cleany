"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { getSlotAvailabilityAction } from "@/app/actions/booking";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/form-controls";
import type { SlotAvailability } from "@/lib/booking/availability";
import { maxBookableDate, todayIST, upcomingDates } from "@/lib/booking/slots";
import type { BookingSettings } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";

function chipParts(date: string) {
  const d = new Date(`${date}T12:00:00+05:30`);
  const opts = { timeZone: "Asia/Kolkata" } as const;
  return {
    weekday: d.toLocaleDateString("en-IN", { ...opts, weekday: "short" }),
    day: d.toLocaleDateString("en-IN", { ...opts, day: "numeric" }),
    month: d.toLocaleDateString("en-IN", { ...opts, month: "short" }),
  };
}

/** Date chips + time slots with live availability. Shared by booking and rescheduling. */
export function DateSlotPicker({
  settings,
  date,
  slotId,
  onChange,
  excludeBookingId,
  disabledSlot,
}: {
  settings: BookingSettings;
  date: string | null;
  slotId: string | null;
  onChange: (v: { date: string | null; slotId: string | null; slotLabel: string | null }) => void;
  excludeBookingId?: string;
  /** Hide a slot (e.g. the booking's current slot when rescheduling). */
  disabledSlot?: { date: string; label: string };
}) {
  const chips = useMemo(() => upcomingDates(settings, 14), [settings]);
  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!date) return;
    let active = true;
    setLoading(true);
    setError(null);
    getSlotAvailabilityAction(date, excludeBookingId)
      .then((res) => {
        if (!active) return;
        if (res.ok) setSlots(res.data);
        else setError(res.error);
      })
      .catch(() => active && setError("We couldn't load time slots. Please check your connection."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [date, excludeBookingId, retry]);

  // If the chosen slot turns out to be unavailable, clear it.
  useEffect(() => {
    if (!slots || !slotId) return;
    const s = slots.find((x) => x.id === slotId);
    if (!s || !s.available) onChange({ date, slotId: null, slotLabel: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const inChips = date ? chips.includes(date) : false;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="min-w-0">
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <CalendarDays className="size-4" aria-hidden /> Choose a date
        </legend>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Available dates">
          {chips.map((d) => {
            const p = chipParts(d);
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ date: d, slotId: null, slotLabel: null })}
                className={cn(
                  "flex min-w-[4.25rem] snap-start flex-col items-center rounded-2xl border px-3 py-2.5 transition",
                  selected ? "border-brand-800 bg-brand-900 text-cream shadow-soft" : "border-line bg-white hover:border-brand-200",
                )}
              >
                <span className={cn("text-xs", selected ? "text-brand-100" : "text-muted")}>{p.weekday}</span>
                <span className="text-xl font-semibold leading-tight">{p.day}</span>
                <span className={cn("text-xs", selected ? "text-brand-100" : "text-muted")}>{p.month}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="other-date">Or pick another date</Label>
          <Input
            id="other-date"
            type="date"
            min={chips[0] ?? todayIST()}
            max={maxBookableDate(settings)}
            value={date && !inChips ? date : ""}
            onChange={(e) => onChange({ date: e.target.value || null, slotId: null, slotLabel: null })}
          />
        </div>
      </fieldset>

      <fieldset disabled={!date} className="min-w-0">
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <Clock className="size-4" aria-hidden /> Choose a time
        </legend>
        {!date ? (
          <p className="text-sm text-muted">Select a date to see available times.</p>
        ) : loading ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {settings.time_slots.map((s) => (
              <Skeleton key={s.id} className="h-16" />
            ))}
          </div>
        ) : error ? (
          <Alert tone="danger" title="Couldn't load time slots">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => setRetry((r) => r + 1)}>
              Try again
            </button>
          </Alert>
        ) : slots ? (
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Available time slots">
            {slots.map((s) => {
              const isCurrent = disabledSlot && disabledSlot.date === date && disabledSlot.label === s.label;
              const available = s.available && !isCurrent;
              const selected = s.id === slotId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!available}
                  onClick={() => onChange({ date, slotId: s.id, slotLabel: s.label })}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed",
                    selected ? "border-brand-800 bg-brand-900 text-cream shadow-soft" : "border-line bg-white hover:border-brand-200",
                    !available && "bg-sand-50 text-muted opacity-70 hover:border-line",
                  )}
                >
                  <span className="font-semibold">{s.label}</span>
                  <span className={cn("text-xs", selected ? "text-brand-100" : "text-muted")}>
                    {isCurrent
                      ? "Your current slot"
                      : s.reason === "full"
                        ? "Fully booked"
                        : s.reason === "too_soon"
                          ? "Not available"
                          : s.remaining <= 1
                            ? "Last slot left"
                            : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {slots && date && slots.every((s) => !s.available) ? (
          <p className="mt-3 text-sm text-amber-800">No slots left on this date. Please choose another date.</p>
        ) : null}
      </fieldset>
    </div>
  );
}
