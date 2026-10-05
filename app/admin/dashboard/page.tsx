import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  IndianRupee,
  ListChecks,
  RotateCcw,
  Undo2,
  Wallet,
} from "lucide-react";
import { BarList, ColumnChart } from "@/components/admin/charts";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { addDays, todayIST } from "@/lib/booking/slots";
import { bhkLabel, formatDate, formatINR } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import type { Booking, BookingItem } from "@/types";

export const metadata: Metadata = { title: "Dashboard" };

type Row = Pick<Booking, "id" | "booking_number" | "customer_name" | "bhk_type" | "booking_date" | "time_slot" | "total" | "payment_status" | "booking_status" | "created_at" | "reschedule_count">;

export default async function AdminDashboard() {
  const db = await adminDb();
  const today = todayIST();
  const since = addDays(today, -89);

  const [bookingsRes, reschedPending, cancelPending, refundsPending, reschedTotal] = await Promise.all([
    db
      .from("bookings")
      .select("id, booking_number, customer_name, bhk_type, booking_date, time_slot, total, payment_status, booking_status, created_at, reschedule_count")
      .order("created_at", { ascending: false })
      .limit(5000),
    db.from("reschedule_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    db.from("cancellation_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    db.from("refunds").select("id", { count: "exact", head: true }).in("status", ["PENDING", "PROCESSING"]),
    db.from("reschedule_requests").select("id", { count: "exact", head: true }).eq("status", "APPROVED"),
  ]);
  const all = (bookingsRes.data ?? []) as Row[];
  const ids = all.filter((b) => b.created_at.slice(0, 10) >= since).map((b) => b.id);
  const itemsRes = ids.length
    ? await db.from("booking_items").select("booking_id, service_name_snapshot, service_id, item_type").in("booking_id", ids.slice(0, 1000)).eq("item_type", "SERVICE")
    : { data: [] };
  const items = (itemsRes.data ?? []) as Pick<BookingItem, "booking_id" | "service_name_snapshot" | "service_id">[];

  const paidish = (b: Row) => b.payment_status === "PAID";
  const stats = {
    total: all.length,
    today: all.filter((b) => b.booking_date === today && b.booking_status !== "CANCELLED").length,
    pending: all.filter((b) => ["REQUESTED", "PAYMENT_PENDING"].includes(b.booking_status)).length,
    confirmed: all.filter((b) => ["CONFIRMED", "ASSIGNED", "TEAM_ON_THE_WAY", "CLEANING"].includes(b.booking_status)).length,
    completed: all.filter((b) => b.booking_status === "COMPLETED").length,
    cancelled: all.filter((b) => b.booking_status === "CANCELLED").length,
    revenue: all.filter(paidish).reduce((s, b) => s + b.total, 0),
    pendingPayments: all.filter((b) => b.booking_status !== "CANCELLED" && ["PENDING", "PAYMENT_VERIFICATION_PENDING", "REJECTED"].includes(b.payment_status)).length,
    verifying: all.filter((b) => b.payment_status === "PAYMENT_VERIFICATION_PENDING").length,
  };
  const cancellationRate = stats.total ? Math.round((stats.cancelled / stats.total) * 1000) / 10 : 0;

  // Last 14 days by creation date (IST).
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const createdDay = (b: Row) => new Date(new Date(b.created_at).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const perDay = days.map((d) => {
    const list = all.filter((b) => createdDay(b) === d);
    return {
      label: `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`,
      bookings: list.length,
      revenue: list.filter(paidish).reduce((s, b) => s + b.total, 0),
    };
  });

  const bhkCounts = ["1BHK", "2BHK", "3BHK", "4BHK"].map((t) => ({ label: bhkLabel(t), value: all.filter((b) => b.bhk_type === t).length }));
  const svcMap = new Map<string, number>();
  for (const i of items) {
    const name = i.service_name_snapshot.replace(/ \(\d BHK\)$/, "");
    svcMap.set(name, (svcMap.get(name) ?? 0) + 1);
  }
  const popularServices = [...svcMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

  const attention = all
    .filter((b) => b.payment_status === "PAYMENT_VERIFICATION_PENDING" || ["RESCHEDULE_REQUESTED", "CANCELLATION_REQUESTED"].includes(b.booking_status))
    .slice(0, 6);
  const upcoming = all
    .filter((b) => b.booking_date >= today && !["CANCELLED", "COMPLETED"].includes(b.booking_status))
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date))
    .slice(0, 6);

  return (
    <div>
      <AdminPageHeader title="Dashboard" description={`Overview · ${formatDate(today, { year: true, weekday: true })}`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total bookings" value={stats.total} icon={ListChecks} href="/admin/bookings" />
        <StatCard label="Today's bookings" value={stats.today} icon={CalendarDays} href={`/admin/bookings?date=${today}`} />
        <StatCard label="Pending bookings" value={stats.pending} icon={Clock} href="/admin/bookings?status=REQUESTED" />
        <StatCard label="Confirmed" value={stats.confirmed} icon={CalendarCheck} href="/admin/bookings?status=CONFIRMED" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} href="/admin/bookings?status=COMPLETED" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={Ban} hint={`${cancellationRate}% cancellation rate`} href="/admin/cancellations?tab=cancelled" />
        <StatCard label="Revenue (verified)" value={formatINR(stats.revenue)} icon={IndianRupee} href="/admin/payments?tab=PAID" />
        <StatCard
          label="Pending payments"
          value={stats.pendingPayments}
          icon={Wallet}
          hint={`${stats.verifying} awaiting verification`}
          tone={stats.verifying ? "attention" : "default"}
          href="/admin/payments"
        />
        <StatCard label="Reschedule requests" value={reschedPending.count ?? 0} icon={CalendarClock} tone={reschedPending.count ? "attention" : "default"} href="/admin/bookings?tab=reschedules" />
        <StatCard label="Cancellation requests" value={cancelPending.count ?? 0} icon={Ban} tone={cancelPending.count ? "attention" : "default"} href="/admin/cancellations" />
        <StatCard label="Pending refunds" value={refundsPending.count ?? 0} icon={Undo2} tone={refundsPending.count ? "attention" : "default"} href="/admin/cancellations?tab=refunds" />
        <StatCard label="Reschedules approved" value={reschedTotal.count ?? 0} icon={RotateCcw} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bookings per day</CardTitle>
            <p className="text-sm text-muted">New bookings created, last 14 days</p>
          </CardHeader>
          <CardContent className="pt-4">
            <ColumnChart title="Bookings per day" data={perDay.map((d) => ({ label: d.label, value: d.bookings }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verified revenue</CardTitle>
            <p className="text-sm text-muted">Paid bookings by creation date, last 14 days</p>
          </CardHeader>
          <CardContent className="pt-4">
            <ColumnChart title="Verified revenue per day" data={perDay.map((d) => ({ label: d.label, value: d.revenue }))} format={formatINR} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Popular home types</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList title="Bookings by home type" data={bhkCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Popular services</CardTitle>
            <p className="text-sm text-muted">Last 90 days</p>
          </CardHeader>
          <CardContent>
            <BarList title="Bookings by service" data={popularServices} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All caught up" description="No payments or requests waiting for review." />
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-sand-50">
                      <span>
                        <span className="font-mono text-sm font-semibold">{b.booking_number}</span>
                        <span className="block text-sm text-muted">{b.customer_name}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <BookingStatusBadge status={b.booking_status} />
                        <PaymentStatusBadge status={b.payment_status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming jobs" />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-sand-50">
                      <span>
                        <span className="text-sm font-semibold">
                          {formatDate(b.booking_date, { year: false })} · {b.time_slot}
                        </span>
                        <span className="block text-sm text-muted">
                          {b.customer_name} · {bhkLabel(b.bhk_type)}
                        </span>
                      </span>
                      <BookingStatusBadge status={b.booking_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
