"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminCancelBookingAction,
  assignStaffAction,
  getPaymentProofUrlAction,
  reviewCancellationAction,
  reviewPaymentAction,
  reviewRescheduleAction,
  updateBookingStatusAction,
  updateRefundAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import type { ActionResult, BookingStatus, RefundStatus } from "@/types";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Done");
        after?.();
        router.refresh();
      } catch {
        toast.error("Network error. Please try again.");
      }
    });
  return { pending, run };
}

/** Approve / reject with an optional note (used for payments, reschedules and cancellations). */
function DecisionDialog({
  title,
  description,
  approveLabel,
  rejectLabel,
  notePlaceholder,
  extra,
  onDecide,
  size = "sm",
}: {
  title: string;
  description?: React.ReactNode;
  approveLabel: string;
  rejectLabel: string;
  notePlaceholder?: string;
  extra?: (state: { value: string; set: (v: string) => void }) => React.ReactNode;
  onDecide: (approve: boolean, note: string, extra: string) => Promise<ActionResult<unknown>>;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const { pending, run } = useRun();

  const openWith = (m: "approve" | "reject") => {
    setMode(m);
    setNote("");
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap gap-2">
        <Button size={size} onClick={() => openWith("approve")}>
          <Check aria-hidden /> {approveLabel}
        </Button>
        <Button size={size} variant="danger-outline" onClick={() => openWith("reject")}>
          <X aria-hidden /> {rejectLabel}
        </Button>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "approve" ? approveLabel : rejectLabel}</DialogTitle>
          <DialogDescription>{description ?? title}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {mode === "approve" && extra ? extra({ value: extraValue, set: setExtraValue }) : null}
          <Field label={mode === "reject" ? "Reason (shown to the customer)" : "Note (optional)"} htmlFor="decision-note">
            <Textarea id="decision-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button
            variant={mode === "approve" ? "primary" : "danger"}
            loading={pending}
            onClick={() => run(() => onDecide(mode === "approve", note, extraValue), () => setOpen(false))}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentReview({ bookingId, amount, size }: { bookingId: string; amount: string; size?: "sm" | "md" }) {
  return (
    <DecisionDialog
      size={size}
      title="Verify payment"
      description={`Only verify after confirming ${amount} was received in the business UPI account.`}
      approveLabel="Verify payment"
      rejectLabel="Reject payment"
      notePlaceholder="e.g. Amount mismatch — received ₹4,000"
      extra={({ value, set }) => (
        <Field label="UPI reference / UTR (optional)" htmlFor="utr">
          <Input id="utr" value={value} onChange={(e) => set(e.target.value)} maxLength={60} />
        </Field>
      )}
      onDecide={(approve, note, reference) => reviewPaymentAction({ bookingId, approve, note, reference })}
    />
  );
}

export function RescheduleReview({ requestId, bookingId, summary }: { requestId: string; bookingId: string; summary: string }) {
  return (
    <DecisionDialog
      title="Reschedule request"
      description={summary}
      approveLabel="Approve"
      rejectLabel="Reject"
      notePlaceholder="That time slot is already unavailable."
      onDecide={(approve, note) => reviewRescheduleAction({ requestId, bookingId, approve, note })}
    />
  );
}

export function CancellationReview({
  requestId,
  bookingId,
  paid,
  suggestedRefund,
}: {
  requestId: string;
  bookingId: string;
  paid: boolean;
  suggestedRefund: number;
}) {
  return (
    <DecisionDialog
      title="Cancellation request"
      description={paid ? "This booking is paid. Approving creates a refund record for manual processing." : "This booking is unpaid — no refund is needed."}
      approveLabel="Approve cancellation"
      rejectLabel="Reject"
      notePlaceholder="Reason / note"
      extra={
        paid
          ? ({ value, set }) => (
              <Field label="Refund amount (₹)" htmlFor="refund-amount" hint={`Policy suggests ₹${suggestedRefund}`}>
                <Input id="refund-amount" type="number" min={0} value={value || String(suggestedRefund)} onChange={(e) => set(e.target.value)} />
              </Field>
            )
          : undefined
      }
      onDecide={(approve, note, refund) =>
        reviewCancellationAction({ requestId, bookingId, approve, note, refundAmount: paid ? Number(refund || suggestedRefund) : null })
      }
    />
  );
}

export function StatusButtons({ bookingId, options }: { bookingId: string; options: { status: BookingStatus; label: string }[] }) {
  const { pending, run } = useRun();
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.status} size="sm" variant="secondary" loading={pending} onClick={() => run(() => updateBookingStatusAction({ bookingId, status: o.status }))}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function StaffAssign({
  bookingId,
  staff,
  current,
  disabled,
}: {
  bookingId: string;
  staff: { id: string; full_name: string; status: string }[];
  current: string | null;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(current ?? "");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="staff-select" className="sr-only">
        Staff member
      </label>
      <Select id="staff-select" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} className="sm:flex-1">
        <option value="">Select staff…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name} {s.status !== "AVAILABLE" ? `(${s.status.replace("_", " ").toLowerCase()})` : ""}
          </option>
        ))}
      </Select>
      <Button size="md" loading={pending} disabled={disabled || !value || value === current} onClick={() => run(() => assignStaffAction({ bookingId, staffId: value }))}>
        {current ? "Reassign" : "Assign"}
      </Button>
    </div>
  );
}

export function AdminCancelButton({ bookingId, paid, total }: { bookingId: string; paid: boolean; total: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(String(total));
  const { pending, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="danger-outline">
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel on customer&apos;s behalf</DialogTitle>
          <DialogDescription>The booking is kept with full history. {paid ? "A refund record will be created for manual processing." : "No refund is needed (unpaid)."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="admin-cancel-reason" required>
            <Textarea id="admin-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer requested on WhatsApp" />
          </Field>
          {paid ? (
            <Field label="Refund amount (₹)" htmlFor="admin-refund">
              <Input id="admin-refund" type="number" min={0} max={total} value={refund} onChange={(e) => setRefund(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={reason.trim().length < 3}
            onClick={() => run(() => adminCancelBookingAction({ bookingId, reason, refundAmount: paid ? Number(refund) : null }), () => setOpen(false))}
          >
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RefundControls({ refundId, bookingId, status }: { refundId: string; bookingId: string; status: Exclude<RefundStatus, "NOT_APPLICABLE"> }) {
  const [note, setNote] = useState("");
  const { pending, run } = useRun();
  const next: { status: RefundStatus; label: string; variant: "primary" | "secondary" | "danger-outline" }[] =
    status === "PENDING"
      ? [
          { status: "PROCESSING", label: "Mark processing", variant: "secondary" },
          { status: "COMPLETED", label: "Mark completed", variant: "primary" },
          { status: "REJECTED", label: "Reject", variant: "danger-outline" },
        ]
      : status === "PROCESSING"
        ? [
            { status: "COMPLETED", label: "Mark completed", variant: "primary" },
            { status: "REJECTED", label: "Reject", variant: "danger-outline" },
          ]
        : [];
  if (next.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`refund-note-${refundId}`} className="sr-only">
        Refund note
      </label>
      <Input id={`refund-note-${refundId}`} placeholder="UPI refund reference / note" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" />
      <div className="flex flex-wrap gap-2">
        {next.map((n) => (
          <Button key={n.status} size="sm" variant={n.variant} loading={pending} onClick={() => run(() => updateRefundAction({ refundId, bookingId, status: n.status, note }))}>
            {n.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ProofLink({ path }: { path: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await getPaymentProofUrlAction(path);
          if (!res.ok) return void toast.error(res.error);
          window.open(res.data.url, "_blank", "noopener,noreferrer");
        })
      }
    >
      <Eye aria-hidden /> View proof
    </Button>
  );
}
