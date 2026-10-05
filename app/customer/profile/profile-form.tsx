"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { updateProfileAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { profileSchema } from "@/lib/validation/booking";

export function ProfileForm({ defaults }: { defaults: z.input<typeof profileSchema> }) {
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState } = useForm<z.input<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: defaults });

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = await updateProfileAction(values);
      if (res.ok) toast.success(res.message ?? "Saved");
      else toast.error(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Full name" htmlFor="fullName" error={formState.errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
      </Field>
      <Field label="Mobile number (WhatsApp)" htmlFor="phone" error={formState.errors.phone?.message}>
        <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
      </Field>
      <Button type="submit" loading={pending} className="w-fit">
        Save changes
      </Button>
    </form>
  );
}
