"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { requestRescheduleAction } from "@/app/actions/customer";
import { DateSlotPicker } from "@/components/booking/date-slot-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Label, Textarea } from "@/components/ui/form-controls";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { formatDate, formatINR } from "@/lib/format";
import type { RescheduleEvaluation } from "@/lib/rescheduling/policy";
import type { BookingSettings } from "@/lib/settings/schema";
import { createRescheduleWhatsAppMessage, createSupportWhatsAppMessage } from "@/lib/whatsapp/messages";
import type { Booking } from "@/types";

type Result = { status: "PENDING" | "APPROVED"; newDate: string; newSlot: string; fee: number };

export function RescheduleDialog({
  booking,
  settings,
  evaluation,
  whatsapp,
  defaultOpen = false,
  triggerLabel = "Reschedule Booking",
  triggerVariant = "outline",
}: {
  booking: Pick<Booking, "id" | "booking_number" | "booking_date" | "time_slot">;
  settings: BookingSettings;
  evaluation: RescheduleEvaluation;
  whatsapp: string;
  defaultOpen?: boolean;
  triggerLabel?: string;
  triggerVariant?: "outline" | "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen && evaluation.allowed);
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [slotLabel, setSlotLabel] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  function reset(v: boolean) {
    setOpen(v);
    if (!v) {
      setDate(null);
      setSlotId(null);
      setSlotLabel(null);
      setReason("");
      setError(null);
      if (result) router.refresh();
      setResult(null);
    }
  }

  function submit() {
    if (!date || !slotId) return;
    setError(null);
    start(async () => {
      try {
        const res = await requestRescheduleAction({ bookingId: booking.id, date, slotId, reason });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setResult(res.data);
        toast.success(res.data.status === "APPROVED" ? "Booking rescheduled" : "Reschedule request submitted");
      } catch {
        setError("Reschedule failed. Please check your connection and try again.");
      }
    });
  }

  if (!evaluation.allowed) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant={triggerVariant} disabled>
          <CalendarClock aria-hidden /> {triggerLabel}
        </Button>
        <p className="text-xs text-muted">{evaluation.blockedReason}</p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <CalendarClock aria-hidden /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        {result ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-12 text-brand-600" aria-hidden />
            <DialogTitle>{result.status === "APPROVED" ? "Your booking has been rescheduled successfully." : "Reschedule request submitted"}</DialogTitle>
            <DialogDescription>
              {result.status === "APPROVED"
                ? `New schedule: ${formatDate(result.newDate)}, ${result.newSlot}.`
                : `We'll review your request for ${formatDate(result.newDate)}, ${result.newSlot}. Your current booking stays in place until it's approved.`}
            </DialogDescription>
            {result.fee > 0 ? <p className="text-sm text-amber-800">A rescheduling fee of {formatINR(result.fee)} applies and will be collected via UPI.</p> : null}
            {result.status === "APPROVED" ? (
              <WhatsAppButton
                phone={whatsapp}
                message={createRescheduleWhatsAppMessage({
                  booking_number: booking.booking_number,
                  oldDate: booking.booking_date,
                  oldSlot: booking.time_slot,
                  newDate: result.newDate,
                  newSlot: result.newSlot,
                })}
              >
                Share on WhatsApp
              </WhatsAppButton>
            ) : null}
            <Button variant="outline" onClick={() => reset(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose a new date and time.</DialogTitle>
              <DialogDescription>
                {evaluation.requiresApproval ? "Your request will be reviewed by our team. " : "Your booking will be updated instantly. "}
                {evaluation.remaining} reschedule{evaluation.remaining === 1 ? "" : "s"} remaining.
                {evaluation.fee > 0 ? ` A rescheduling fee of ${formatINR(evaluation.fee)} applies.` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-5 rounded-2xl bg-sand-50 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Current booking</p>
              <p className="mt-1 font-semibold">
                {formatDate(booking.booking_date, { year: false })} · {booking.time_slot}
              </p>
            </div>

            <DateSlotPicker
              settings={settings}
              date={date}
              slotId={slotId}
              excludeBookingId={booking.id}
              disabledSlot={{ date: booking.booking_date, label: booking.time_slot }}
              onChange={(v) => {
                setDate(v.date);
                setSlotId(v.slotId);
                setSlotLabel(v.slotLabel);
              }}
            />

            {date && slotLabel ? (
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Current</p>
                  <p className="font-semibold">{formatDate(booking.booking_date, { year: false })}</p>
                  <p className="text-muted">{booking.time_slot}</p>
                </div>
                <ArrowRight className="size-5 text-brand-600" aria-hidden />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">New</p>
                  <p className="font-semibold text-brand-800">{formatDate(date, { year: false })}</p>
                  <p className="text-brand-800">{slotLabel}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-1.5">
              <Label htmlFor="reschedule-reason">Reason (optional)</Label>
              <Textarea id="reschedule-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            {error ? (
              <Alert tone="danger" title="Reschedule failed" className="mt-4">
                {error}
              </Alert>
            ) : null}

            <DialogFooter>
              <WhatsAppButton phone={whatsapp} message={createSupportWhatsAppMessage("reschedule", booking)} variant="ghost">
                Rescheduling Support
              </WhatsAppButton>
              <Button onClick={submit} disabled={!date || !slotId} loading={pending}>
                {evaluation.requiresApproval ? "Submit Reschedule Request" : "Confirm New Time"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
