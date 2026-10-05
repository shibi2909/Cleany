import type { Metadata } from "next";
import { ServicesManager } from "@/components/admin/services-manager";
import { AdminPageHeader } from "@/components/admin/ui";
import { loadCatalog } from "@/lib/data/catalog";
import { adminDb } from "@/lib/auth";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const catalog = await loadCatalog(await adminDb(), { includeInactive: true });
  return (
    <div>
      <AdminPageHeader
        title="Services"
        description="Add, edit or deactivate services. Deactivated services disappear from the quote but stay on past bookings (price snapshots)."
      />
      <ServicesManager services={catalog.services} />
    </div>
  );
}
