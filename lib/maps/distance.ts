import type { ServiceAreaSettings } from "@/lib/settings/schema";

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points (haversine), in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ServiceabilityResult {
  distanceKm: number;
  radiusKm: number;
  serviceable: boolean;
}

/** The radius comes from admin settings — never hardcode it. */
export function checkServiceability(area: ServiceAreaSettings, lat: number, lng: number): ServiceabilityResult {
  const distanceKm = Math.round(haversineKm({ lat: area.center_lat, lng: area.center_lng }, { lat, lng }) * 100) / 100;
  return { distanceKm, radiusKm: area.radius_km, serviceable: distanceKm <= area.radius_km };
}

export function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
