import type { Metadata } from "next";
import { SectionHeading } from "@/components/marketing/sections";
import { ServiceAreaChecker } from "./checker";
import { getPublicData } from "@/lib/data/catalog";
import { BRAND } from "@/lib/config/brand";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Service Area — Bengaluru + 50 km",
  description: `Check if ${BRAND.name} home deep cleaning is available at your address in Bengaluru and surrounding areas.`,
  alternates: { canonical: "/service-area" },
};

const AREAS = [
  "Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Marathahalli", "Electronic City", "Jayanagar", "JP Nagar",
  "Bannerghatta Road", "Hebbal", "Yelahanka", "Malleshwaram", "Rajajinagar", "Sarjapur Road", "Bellandur", "Kengeri",
  "Hennur", "KR Puram", "Banashankari", "Devanahalli",
];

export default async function ServiceAreaPage() {
  const { settings } = await getPublicData();
  const area = settings.service_area;
  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Service area"
        title={`Bengaluru + ${area.radius_km} km`}
        description={`We clean homes within ${area.radius_km} km of ${area.center_label}. Search your address or use your current location to check.`}
      />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ServiceAreaChecker area={area} />
        <aside className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-semibold">Popular areas we serve</h2>
          <ul className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <li key={a} className="rounded-full bg-sand-100 px-3 py-1 text-sm text-ink-soft">
                {a}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Not sure? The map check uses the straight-line distance from our service centre. If you&apos;re right at the edge, message us on
            WhatsApp and we&apos;ll do our best to help.
          </p>
        </aside>
      </div>
    </div>
  );
}
