import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <Logo />
        <p className="mt-10 font-display text-7xl text-brand-900">404</p>
        <h1 className="mt-2 text-xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted">It may have moved, or the link might be incomplete.</p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book">Get a quote</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
