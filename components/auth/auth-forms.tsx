"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import type { z } from "zod";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { loginSchema, signupSchema } from "@/lib/validation/booking";
import { BRAND } from "@/lib/config/brand";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState } = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      try {
        const res = await signInAction({ ...values, next });
        if (!res.ok) return setError(res.error);
        router.push(res.data.next);
        router.refresh();
      } catch {
        setError("We couldn't reach the server. Please check your connection.");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {notice ? <Alert tone="warning">{notice}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!formState.errors.email || undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!formState.errors.password || undefined} />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        Log in
      </Button>
      <p className="text-center text-sm text-muted">
        New to {BRAND.name}?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState } = useForm<z.input<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  const e = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      try {
        const res = await signUpAction({ ...values, next });
        if (!res.ok) return setError(res.error);
        if (res.data.needsConfirmation) return setConfirmEmail(values.email);
        router.push(res.data.next);
        router.refresh();
      } catch {
        setError("We couldn't reach the server. Please check your connection.");
      }
    });
  });

  if (confirmEmail) {
    return (
      <Alert tone="success" icon={MailCheck} title="Check your email">
        We&apos;ve sent a confirmation link to <strong>{confirmEmail}</strong>. Open it to activate your account — your quote is saved in this
        browser tab.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Full name" htmlFor="fullName" error={e.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...register("fullName")} aria-invalid={!!e.fullName || undefined} />
      </Field>
      <Field label="Mobile number (WhatsApp)" htmlFor="phone" error={e.phone?.message}>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} aria-invalid={!!e.phone || undefined} />
      </Field>
      <Field label="Email" htmlFor="email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!e.email || undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password?.message} hint="At least 8 characters">
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!e.password || undefined} />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
