"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LayoutDashboard, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customer/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/customer/profile", label: "Profile", icon: UserRound },
];

export function CustomerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = pathname === l.href || (l.href !== "/customer/dashboard" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
              active ? "bg-brand-900 text-cream" : "text-ink-soft hover:bg-sand-100",
            )}
          >
            <l.icon className="size-4" aria-hidden />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
