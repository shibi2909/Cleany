import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/config/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" className="w-fit" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block" aria-hidden>
        <div className="absolute inset-0 bg-weave opacity-40" />
        <div className="relative flex h-full flex-col justify-end p-14 text-cream">
          <p className="font-display text-4xl leading-tight">&ldquo;{BRAND.tagline}&rdquo;</p>
          <p className="mt-4 max-w-sm text-brand-100/80">Track bookings, upload payment proof, reschedule or cancel — all in one place.</p>
        </div>
      </div>
    </div>
  );
}
