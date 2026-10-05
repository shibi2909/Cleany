"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";
import { uploadPaymentProofAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { PAYMENT_PROOF_MAX_BYTES, PAYMENT_PROOF_TYPES } from "@/lib/validation/booking";

export function PaymentProofForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) return setFileName(null);
    if (!PAYMENT_PROOF_TYPES.includes(f.type)) {
      e.target.value = "";
      setFileName(null);
      return setError("Please choose a PNG, JPG, WEBP image or a PDF.");
    }
    if (f.size > PAYMENT_PROOF_MAX_BYTES) {
      e.target.value = "";
      setFileName(null);
      return setError("That file is larger than 5 MB. Please choose a smaller screenshot.");
    }
    setFileName(f.name);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const res = await uploadPaymentProofAction(data);
        if (!res.ok) return setError(res.error);
        toast.success(res.message ?? "Payment proof submitted");
        formRef.current?.reset();
        setFileName(null);
        router.refresh();
      } catch {
        setError("Payment proof upload failed. Please check your connection, or send the screenshot on WhatsApp.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label
        htmlFor="proof-file"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50/60 px-4 py-6 text-center transition hover:border-brand-300 focus-within:border-brand-500"
      >
        <ImageUp className="size-6 text-brand-700" aria-hidden />
        <span className="text-sm font-semibold">{fileName ?? "Upload payment screenshot"}</span>
        <span className="text-xs text-muted">PNG, JPG, WEBP or PDF · up to 5 MB</span>
        <input id="proof-file" name="file" type="file" accept={PAYMENT_PROOF_TYPES.join(",")} className="sr-only" onChange={onFile} />
      </label>
      <Field label="UPI transaction reference (UTR)" htmlFor="reference" hint="12-digit UPI reference from your payment app (optional if you upload a screenshot)">
        <Input id="reference" name="reference" maxLength={60} placeholder="e.g. 426812345678" />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" loading={pending}>
        Submit payment proof
      </Button>
    </form>
  );
}
