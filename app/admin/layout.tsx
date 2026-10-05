import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

async function pendingCounts() {
  const db = createAdminClient();
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [reschedules, payments, cancellations, refunds] = await Promise.all([
    count(db.from("reschedule_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING")),
    count(db.from("bookings").select("id", { count: "exact", head: true }).eq("payment_status", "PAYMENT_VERIFICATION_PENDING")),
    count(db.from("cancellation_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING")),
    count(db.from("refunds").select("id", { count: "exact", head: true }).in("status", ["PENDING", "PROCESSING"])),
  ]);
  return { reschedules, payments, cancellations: cancellations + refunds };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Role is read from the database on every request — never from the client.
  const user = await requireAdminPage();
  const badges = await pendingCounts();
  return (
    <div className="flex min-h-dvh bg-sand-50/60">
      <AdminSidebar badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-cream/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <AdminMobileNav badges={badges} />
            <p className="text-sm text-muted">
              Signed in as <span className="font-semibold text-ink">{user.profile.full_name || user.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                <ExternalLink aria-hidden /> <span className="hidden sm:inline">View site</span>
              </Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Log out">
                <LogOut aria-hidden /> <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </header>
        <main id="main" className="w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
