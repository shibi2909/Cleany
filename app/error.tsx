"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="display text-3xl">{offline ? "You seem to be offline" : "Something went wrong"}</h1>
        <p className="mt-2 text-muted">
          {offline ? "Check your internet connection and try again." : "Sorry about that. Please try again — if it keeps happening, contact us on WhatsApp."}
        </p>
        {error.digest ? <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex gap-3">
          <Button onClick={reset}>
            <RotateCcw aria-hidden /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
