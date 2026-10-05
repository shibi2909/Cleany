import type { Metadata } from "next";
import { PricingEditor } from "@/components/admin/pricing-editor";
import { AdminPageHeader } from "@/components/admin/ui";
import { loadCatalog } from "@/lib/data/catalog";
import { adminDb } from "@/lib/auth";

export const metadata: Metadata = { title: "Pricing" };

export default async function AdminPricingPage() {
  const catalog = await loadCatalog(await adminDb(), { includeInactive: true });
  return (
    <div>
      <AdminPageHeader
        title="Pricing"
        description="All customer prices come from here. Changes apply to new quotes immediately; existing bookings keep their price snapshots."
      />
      <PricingEditor catalog={catalog} />
    </div>
  );
}
