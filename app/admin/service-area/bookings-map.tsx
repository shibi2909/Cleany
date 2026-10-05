"use client";

import Link from "next/link";
import { MapView } from "@/components/maps/map-view";
import type { MapMarker } from "@/lib/maps/provider";
import type { ServiceAreaSettings } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "upcoming", label: "Next 30 days" },
  { key: "past", label: "Last 30 days" },
  { key: "all", label: "All" },
];

export function BookingsMap({ settings, markers, range }: { settings: ServiceAreaSettings; markers: MapMarker[]; range: string }) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Date range" className="flex w-fit gap-1 rounded-full border border-line bg-white p-1">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/service-area?range=${r.key}`}
            aria-current={range === r.key ? "page" : undefined}
            className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", range === r.key ? "bg-brand-900 text-cream" : "text-muted hover:text-ink")}
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <MapView
        center={{ lat: settings.center_lat, lng: settings.center_lng }}
        centerLabel={settings.center_label}
        radiusKm={settings.radius_km}
        markers={markers}
        className="h-[32rem]"
      />
    </div>
  );
}
