"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  CalendarCheck,
  LayoutDashboard,
  Map,
  Menu,
  Settings,
  Sparkles,
  Tags,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck, badgeKey: "reschedules" },
  { href: "/admin/payments", label: "Payments", icon: Wallet, badgeKey: "payments" },
  { href: "/admin/cancellations", label: "Cancellations", icon: Ban, badgeKey: "cancellations" },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/services", label: "Services", icon: Sparkles },
  { href: "/admin/pricing", label: "Pricing", icon: Tags },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
  { href: "/admin/service-area", label: "Service area", icon: Map },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export type AdminBadges = Partial<Record<"reschedules" | "payments" | "cancellations", number>>;

function Links({ badges, onNavigate }: { badges: AdminBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {ADMIN_LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        const count = "badgeKey" in l ? badges[l.badgeKey] : undefined;
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-800 text-cream" : "text-brand-100/80 hover:bg-brand-800/60 hover:text-cream",
              )}
            >
              <l.icon className="size-4" aria-hidden />
              <span className="flex-1">{l.label}</span>
              {count ? (
                <span className="min-w-5 rounded-full bg-honey px-1.5 text-center text-xs font-bold text-brand-950" aria-label={`${count} pending`}>
                  {count}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar({ badges }: { badges: AdminBadges }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-brand-950 p-4 lg:flex">
      <Link href="/admin/dashboard" className="px-2 pt-2" aria-label="Admin dashboard">
        <Logo inverted />
      </Link>
      <nav aria-label="Admin">
        <Links badges={badges} />
      </nav>
    </aside>
  );
}

export function AdminMobileNav({ badges }: { badges: AdminBadges }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full hover:bg-sand-100"
        aria-label="Open admin menu"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav aria-label="Admin" className="relative flex w-72 flex-col gap-6 overflow-y-auto bg-brand-950 p-4">
            <div className="flex items-center justify-between px-2 pt-2">
              <Logo inverted />
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-cream" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <Links badges={badges} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      ) : null}
    </div>
  );
}
