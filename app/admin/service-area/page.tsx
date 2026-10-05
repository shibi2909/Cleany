import type { Metadata } from "next";
import { BookingsMap } from "./bookings-map";
import { ServiceAreaForm } from "@/components/admin/settings-forms";
import { AdminPageHeader } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, todayIST } from "@/lib/booking/slots";
import { BOOKING_STATUS_META } from "@/lib/booking/status";
import { loadSettings } from "@/lib/data/catalog";
import { bhkLabel, formatDate, formatINR } from "@/lib/format";
import type { MapMarker } from "@/lib/maps/provider";
import { adminDb } from "@/lib/auth";
import type { Booking } from "@/types";

export const metadata: Metadata = { title: "Service area" };

export default async function AdminServiceAreaPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const db = await adminDb();
  const today = todayIST();
  const window = range === "all" ? null : range === "past" ? { from: addDays(today, -30), to: today } : { from: today, to: addDays(today, 30) };
  let q = db.from("bookings").select("*").order("booking_date").limit(500);
  if (window) q = q.gte("booking_date", window.from).lte("booking_date", window.to);
  const [settings, bookingsRes] = await Promise.all([loadSettings(db), q]);
  const bookings = (bookingsRes.data ?? []) as Booking[];
  const staffIds = [...new Set(bookings.map((b) => b.assigned_staff_id).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await db.from("staff").select("id, full_name").in("id", staffIds) : { data: [] };
  const staffName = new Map((staff ?? []).map((s) => [s.id as string, s.full_name as string]));

  const markers: MapMarker[] = bookings.map((b) => ({
    id: b.id,
    lat: b.latitude,
    lng: b.longitude,
    title: b.booking_number,
    href: `/admin/bookings/${b.id}`,
    tone: b.booking_status === "CANCELLED" ? "danger" : ["REQUESTED", "PAYMENT_PENDING", "RESCHEDULE_REQUESTED", "CANCELLATION_REQUESTED"].includes(b.booking_status) ? "warning" : "brand",
    lines: [
      b.customer_name,
      `${bhkLabel(b.bhk_type)} Deep Cleaning`,
      `${formatDate(b.booking_date, { year: false })} · ${b.time_slot}`,
      `${formatINR(b.total)} · ${BOOKING_STATUS_META[b.booking_status].label}`,
      `Staff: ${b.assigned_staff_id ? (staffName.get(b.assigned_staff_id) ?? "—") : "Not assigned"}`,
    ],
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Service area" description="Configure where you operate and see bookings on the map." />
      <ServiceAreaForm initial={settings.service_area} />
      <Card>
        <CardHeader>
          <CardTitle>Bookings map</CardTitle>
          <p className="text-sm text-muted">
            {markers.length} bookings · green = confirmed/active, amber = awaiting action, red = cancelled. Click a marker for details.
          </p>
        </CardHeader>
        <CardContent>
          <BookingsMap settings={settings.service_area} markers={markers} range={range ?? "upcoming"} />
        </CardContent>
      </Card>
    </div>
  );
}
