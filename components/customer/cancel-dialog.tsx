"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { requestCancellationAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Label, Textarea } from "@/components/ui/form-controls";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { CANCELLATION_REASONS, type CancellationEvaluation } from "@/lib/cancellation/policy";
import { bhkLabel, formatDate, formatINR } from "@/lib/format";
import { createCancellationWhatsAppMessage, createSupportWhatsAppMessage } from "@/lib/whatsapp/messages";
import { cn } from "@/lib/utils";
import type { Booking, RefundStatus } from "@/types";

type Reason = (typeof CANCELLATION_REASONS)[number];
type Result = { status: "PENDING" | "APPROVED"; refundStatus: RefundStatus; refundAmount: number };

export function CancelDialog({
  booking,
  evaluation,
  refundPolicy,
  whatsapp,
  defaultOpen = false,
}: {
  booking: Pick<Booking, "id" | "booking_number" | "bhk_type" | "booking_date" | "time_slot" | "total" | "payment_status">;
  evaluation: CancellationEvaluation;
  refundPolicy: string;
  whatsapp: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen && evaluation.allowed);
  const [stage, setStage] = useState<"confirm" | "reason">("confirm");
  const [reason, setReason] = useState<Reason | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      if (result) router.refresh();
      setStage("confirm");
      setReason(null);
      setComment("");
      setError(null);
      setResult(null);
    }
  }

  function submit() {
    if (!reason) return setError("Please choose a reason.");
    setError(null);
    start(async () => {
      try {
        const res = await requestCancellationAction({ bookingId: booking.id, reason, comment });
        if (!res.ok) return setError(res.error);
        setResult(res.data);
        toast.success(res.data.status === "APPROVED" ? "Booking cancelled" : "Cancellation requested");
      } catch {
        setError("Cancellation failed. Please check your connection or contact support on WhatsApp.");
      }
    });
  }

  if (!evaluation.allowed) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="danger-outline" disabled>
          <Ban aria-hidden /> Cancel Booking
        </Button>
        <p className="text-xs text-muted">{evaluation.blockedReason}</p>
      </div>
    );
  }

  const service = `${bhkLabel(booking.bhk_type)} Deep Cleaning`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="danger-outline">
          <Ban aria-hidden /> Cancel Booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle2 className="size-12 text-brand-600" aria-hidden />
            <DialogTitle>{result.status === "APPROVED" ? "Your booking has been cancelled." : "Cancellation requested"}</DialogTitle>
            <DialogDescription>
              {result.status === "APPROVED"
                ? "Your booking history is kept in your account."
                : "Our team will review your request and update you. Your booking stays active until then."}
            </DialogDescription>
            {booking.payment_status === "PAID" ? (
              <div className="w-full rounded-2xl bg-sand-50 p-4 text-left text-sm">
                <p>
                  <span className="text-muted">Payment:</span> <strong>Paid</strong>
                </p>
                <p>
                  <span className="text-muted">Refund:</span>{" "}
                  <strong>{result.status === "APPROVED" ? (result.refundStatus === "PENDING" ? "Pending" : "Not applicable") : "Pending review"}</strong>
                </p>
                <p className="mt-2 text-muted">Refund eligibility will be handled according to our cancellation policy.</p>
              </div>
            ) : null}
            <WhatsAppButton
              phone={whatsapp}
              message={createCancellationWhatsAppMessage(booking, reason ?? "Other", { pendingApproval: result.status === "PENDING" })}
            >
              Contact us on WhatsApp
            </WhatsAppButton>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : stage === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancel this booking?</DialogTitle>
              <DialogDescription>Are you sure you want to cancel this booking?</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-sand-50 p-4 text-sm">
              <dt className="text-muted">Booking</dt>
              <dd className="font-mono font-semibold">{booking.booking_number}</dd>
              <dt className="text-muted">Service</dt>
              <dd>{service}</dd>
              <dt className="text-muted">When</dt>
              <dd>
                {formatDate(booking.booking_date, { year: false })} · {booking.time_slot}
              </dd>
              <dt className="text-muted">Amount</dt>
              <dd className="font-semibold">{formatINR(booking.total)}</dd>
            </dl>
            {evaluation.notes.length > 0 || evaluation.isPaid ? (
              <Alert tone="warning" className="mt-4">
                <ul className="flex flex-col gap-1">
                  {evaluation.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {evaluation.isPaid ? (
                    <li>
                      Estimated refund: <strong>{formatINR(evaluation.refundAmount)}</strong>
                      {evaluation.fee > 0 ? ` (after ${formatINR(evaluation.fee)} cancellation fee)` : ""}. Refunds are processed manually by UPI.
                    </li>
                  ) : null}
                </ul>
              </Alert>
            ) : null}
            {refundPolicy ? <p className="mt-3 text-xs text-muted">{refundPolicy}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep Booking
              </Button>
              <Button variant="danger" onClick={() => setStage("reason")}>
                Continue Cancellation
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Why are you cancelling?</DialogTitle>
              <DialogDescription>This helps us improve.</DialogDescription>
            </DialogHeader>
            <fieldset>
              <legend className="sr-only">Cancellation reason</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CANCELLATION_REASONS.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm transition",
                      reason === r ? "border-brand-700 ring-2 ring-brand-700/15" : "border-line hover:border-brand-200",
                    )}
                  >
                    <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-brand-700" />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="cancel-comment">Additional comment (optional)</Label>
              <Textarea
                id="cancel-comment"
                rows={3}
                maxLength={500}
                placeholder="I need to cancel because I am travelling."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            {error ? (
              <Alert tone="danger" title="Cancellation failed" className="mt-4">
                {error}
              </Alert>
            ) : null}
            <DialogFooter>
              <WhatsAppButton phone={whatsapp} message={createSupportWhatsAppMessage("cancellation", booking)} variant="ghost">
                Cancellation Support
              </WhatsAppButton>
              <Button variant="danger" onClick={submit} loading={pending} disabled={!reason}>
                {evaluation.requiresApproval ? "Request Cancellation" : "Cancel Booking"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
