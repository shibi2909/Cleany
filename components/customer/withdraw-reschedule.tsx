"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { withdrawRescheduleAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";

export function WithdrawRescheduleButton({ requestId, bookingId }: { requestId: string; bookingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await withdrawRescheduleAction(requestId, bookingId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? "Request withdrawn");
          router.refresh();
        })
      }
    >
      Withdraw request
    </Button>
  );
}
