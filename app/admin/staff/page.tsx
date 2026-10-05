import type { Metadata } from "next";
import { StaffManager } from "@/components/admin/staff-manager";
import { AdminPageHeader } from "@/components/admin/ui";
import { todayIST } from "@/lib/booking/slots";
import { adminDb } from "@/lib/auth";
import type { Staff } from "@/types";

export const metadata: Metadata = { title: "Staff" };

export default async function AdminStaffPage() {
  const db = await adminDb();
  const [staffRes, jobsRes] = await Promise.all([
    db.from("staff").select("*").order("is_active", { ascending: false }).order("full_name"),
    db
      .from("bookings")
      .select("assigned_staff_id")
      .not("assigned_staff_id", "is", null)
      .gte("booking_date", todayIST())
      .in("booking_status", ["ASSIGNED", "TEAM_ON_THE_WAY", "CLEANING", "RESCHEDULE_REQUESTED", "CANCELLATION_REQUESTED"]),
  ]);
  const jobs: Record<string, number> = {};
  for (const r of jobsRes.data ?? []) jobs[r.assigned_staff_id as string] = (jobs[r.assigned_staff_id as string] ?? 0) + 1;
  return (
    <div>
      <AdminPageHeader title="Staff" description="Your cleaning team. Assign staff to confirmed bookings from the booking page." />
      <StaffManager staff={(staffRes.data ?? []) as Staff[]} jobs={jobs} />
    </div>
  );
}
