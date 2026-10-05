/**
 * Map provider selection. "leaflet" uses OpenStreetMap tiles + Nominatim
 * geocoding and needs no API key. "google" uses the Maps JavaScript API and
 * Geocoding API with NEXT_PUBLIC_MAPS_API_KEY. Swap providers via env only.
 */
export type MapProvider = "leaflet" | "google";

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_MAPS_API_KEY ?? "";

export const MAP_PROVIDER: MapProvider =
  process.env.NEXT_PUBLIC_MAPS_PROVIDER === "google" && MAPS_API_KEY ? "google" : "leaflet";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends LatLng {
  label: string;
  pincode: string | null;
}

export interface MapMarker extends LatLng {
  id: string;
  title: string;
  /** Plain-text lines shown in the marker popup. */
  lines?: string[];
  href?: string;
  tone?: "brand" | "warning" | "danger" | "neutral";
}
