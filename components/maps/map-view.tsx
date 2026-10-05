"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";
import { MAP_PROVIDER, type LatLng, type MapMarker } from "@/lib/maps/provider";
import { cn } from "@/lib/utils";

export interface MapViewProps {
  center: LatLng;
  centerLabel?: string;
  radiusKm: number;
  customer?: LatLng | null;
  markers?: MapMarker[];
  /** When set, clicking the map or dragging the customer pin reports a new point. */
  onPick?: (p: LatLng) => void;
  fitToRadius?: boolean;
  className?: string;
}

function MapLoading() {
  return (
    <div className="relative h-full w-full">
      <Skeleton className="h-full w-full rounded-none" />
      <span className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</span>
    </div>
  );
}

const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: MapLoading });
const GoogleMap = dynamic(() => import("./google-map"), { ssr: false, loading: MapLoading });

/** Provider-agnostic map. Pick the provider with NEXT_PUBLIC_MAPS_PROVIDER. */
export function MapView({ className, ...props }: MapViewProps) {
  const Impl = MAP_PROVIDER === "google" ? GoogleMap : LeafletMap;
  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border border-line bg-sand-100", className)}>
      <Impl {...props} className="h-full w-full" />
    </div>
  );
}
