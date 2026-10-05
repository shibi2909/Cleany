"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { customerDetailsSchema, type CustomerDetailsInput } from "@/lib/validation/booking";
import { StepHeading } from "./steps";
import type { z } from "zod";

export type CustomerDetails = z.output<typeof customerDetailsSchema>;

export const DETAILS_FORM_ID = "customer-details-form";

export function LoginGate() {
  return (
    <>
      <StepHeading title="Almost there — log in to book" description="Your quote is saved. Log in or create a free account to confirm and track your booking." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/login?next=/book">
            <LogIn aria-hidden /> Log in
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/signup?next=/book">
            <UserPlus aria-hidden /> Create account
          </Link>
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">Your account lets you view bookings, upload payment proof, reschedule or cancel anytime.</p>
    </>
  );
}

export function DetailsStep({ defaults, onSubmit }: { defaults: Partial<CustomerDetailsInput>; onSubmit: (v: CustomerDetails) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerDetailsInput, unknown, CustomerDetails>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: { fullName: "", phone: "", email: "", address: "", landmark: "", pincode: "", instructions: "", ...defaults },
    mode: "onTouched",
  });

  const err = (k: keyof CustomerDetailsInput) => errors[k]?.message as string | undefined;
  const aria = (k: keyof CustomerDetailsInput) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });

  return (
    <>
      <StepHeading title="Your details" description="We'll use these to confirm your booking and reach you on the day." />
      <form id={DETAILS_FORM_ID} noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={err("fullName")} required>
          <Input id="fullName" autoComplete="name" {...register("fullName")} {...aria("fullName")} />
        </Field>
        <Field label="Phone (WhatsApp)" htmlFor="phone" error={err("phone")} required>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" {...register("phone")} {...aria("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={err("email")} required className="sm:col-span-2">
          <Input id="email" type="email" autoComplete="email" {...register("email")} {...aria("email")} />
        </Field>
        <Field
          label="Full address"
          htmlFor="address"
          error={err("address")}
          hint="Flat / house no., building, street and area"
          required
          className="sm:col-span-2"
        >
          <Textarea id="address" rows={3} autoComplete="street-address" {...register("address")} {...aria("address")} />
        </Field>
        <Field label="Landmark" htmlFor="landmark" error={err("landmark")}>
          <Input id="landmark" placeholder="Near…" {...register("landmark")} {...aria("landmark")} />
        </Field>
        <Field label="Pincode" htmlFor="pincode" error={err("pincode")} required>
          <Input id="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" {...register("pincode")} {...aria("pincode")} />
        </Field>
        <Field label="Additional instructions" htmlFor="instructions" error={err("instructions")} hint="Parking, pets, gate code, rooms to focus on…" className="sm:col-span-2">
          <Textarea id="instructions" rows={3} {...register("instructions")} {...aria("instructions")} />
        </Field>
      </form>
    </>
  );
}
