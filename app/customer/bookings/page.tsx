import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { BookingCard } from "@/components/customer/booking-card";
import { EmptyState } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

export default async function CustomerBookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser("/customer/bookings");
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "upcoming";
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").order("slot_start", { ascending: tab === "upcoming" });
  const all = (data ?? []) as Booking[];
  const list = all.filter((b) =>
    tab === "upcoming" ? ACTIVE_STATUSES.includes(b.booking_status) : tab === "past" ? b.booking_status === "COMPLETED" : tab === "cancelled" ? b.booking_status === "CANCELLED" : true,
  );

  return (
    <div>
      <h1 className="display text-3xl sm:text-4xl">My bookings</h1>
      <nav aria-label="Filter bookings" className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/customer/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold", tab === t.key ? "bg-brand-900 text-cream" : "text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={all.length === 0 ? "No bookings yet." : "Nothing here."}
            description={all.length === 0 ? "Get an instant quote and book your first deep clean." : "No bookings match this filter."}
            action={{ label: "Get Instant Quote", href: "/book" }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
