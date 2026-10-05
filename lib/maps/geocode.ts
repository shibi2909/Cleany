import "server-only";
import { MAP_PROVIDER, MAPS_API_KEY, type GeocodeResult } from "./provider";

/**
 * Server-side geocoding behind a provider interface. Runs on the server so we
 * can set required headers (Nominatim usage policy) and keep providers swappable.
 */
interface Geocoder {
  search(query: string, bias: { lat: number; lng: number }): Promise<GeocodeResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
}

const USER_AGENT = `Cleany/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`;

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: { postcode?: string };
}

const nominatim: Geocoder = {
  async search(query, bias) {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      countrycodes: "in",
      // Prefer results around the service centre (roughly ±1°), without excluding others.
      viewbox: `${bias.lng - 1},${bias.lat + 1},${bias.lng + 1},${bias.lat - 1}`,
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const items = (await res.json()) as NominatimItem[];
    return items.map((i) => ({
      lat: Number(i.lat),
      lng: Number(i.lon),
      label: i.display_name,
      pincode: i.address?.postcode?.replace(/\s/g, "") ?? null,
    }));
  },
  async reverse(lat, lng) {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1", zoom: "18" });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
    const i = (await res.json()) as NominatimItem & { error?: string };
    if (i.error) return null;
    return { lat, lng, label: i.display_name, pincode: i.address?.postcode?.replace(/\s/g, "") ?? null };
  },
};

interface GoogleResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; types: string[] }[];
}

function googlePincode(r: GoogleResult) {
  return r.address_components.find((c) => c.types.includes("postal_code"))?.long_name ?? null;
}

const google: Geocoder = {
  async search(query, bias) {
    const params = new URLSearchParams({
      address: query,
      region: "in",
      bounds: `${bias.lat - 1},${bias.lng - 1}|${bias.lat + 1},${bias.lng + 1}`,
      key: process.env.GOOGLE_MAPS_SERVER_KEY || MAPS_API_KEY,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const json = (await res.json()) as { status: string; results: GoogleResult[] };
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") throw new Error(`Geocoding failed (${json.status})`);
    return json.results.slice(0, 6).map((r) => ({
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      label: r.formatted_address,
      pincode: googlePincode(r),
    }));
  },
  async reverse(lat, lng) {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: process.env.GOOGLE_MAPS_SERVER_KEY || MAPS_API_KEY });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const json = (await res.json()) as { status: string; results: GoogleResult[] };
    if (json.status !== "OK") return null;
    const r = json.results[0];
    return { lat, lng, label: r.formatted_address, pincode: googlePincode(r) };
  },
};

export function getGeocoder(): Geocoder {
  return MAP_PROVIDER === "google" ? google : nominatim;
}
