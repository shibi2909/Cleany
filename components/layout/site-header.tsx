"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/config/brand";

export const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/service-area", label: "Service area" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return setSignedIn(false);
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const signedIn = useSignedIn();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled || open ? "border-line bg-cream/90 backdrop-blur-md" : "border-transparent bg-cream",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-18">
        <Link href="/" aria-label={`${BRAND.name} home`} className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand-100 hover:text-ink",
                pathname === l.href && "bg-sand-100 text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={signedIn ? "/customer/dashboard" : "/login"}
            className="hidden items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand-100 hover:text-ink sm:inline-flex"
          >
            <UserRound className="size-4" aria-hidden />
            {signedIn ? "My bookings" : "Log in"}
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/book">Get Instant Quote</Link>
          </Button>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-ink hover:bg-sand-100 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-line xl:hidden"
          >
            <div className="container-page flex flex-col gap-1 py-4">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-sand-100">
                  {l.label}
                </Link>
              ))}
              <Link
                href={signedIn ? "/customer/dashboard" : "/login"}
                className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-sand-100"
              >
                {signedIn ? "My bookings" : "Log in / Sign up"}
              </Link>
              <Button asChild size="lg" className="mt-2">
                <Link href="/book">Get Instant Quote</Link>
              </Button>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
