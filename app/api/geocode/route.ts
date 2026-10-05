import { NextResponse, type NextRequest } from "next/server";
import { getGeocoder } from "@/lib/maps/geocode";
import { getPublicData } from "@/lib/data/catalog";
import { isValidCoordinate } from "@/lib/maps/distance";

// Simple per-instance throttle to stay polite with free geocoding providers.
const lastCall = new Map<string, number>();
const MIN_INTERVAL_MS = 700;

function throttled(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const prev = lastCall.get(ip) ?? 0;
  lastCall.set(ip, now);
  if (lastCall.size > 5000) lastCall.clear();
  return now - prev < MIN_INTERVAL_MS;
}

/**
 * GET /api/geocode?q=Indiranagar         → address search
 * GET /api/geocode?lat=12.97&lng=77.64   → reverse geocode
 */
export async function GET(req: NextRequest) {
  if (throttled(req)) {
    return NextResponse.json({ error: "Please wait a moment before searching again." }, { status: 429 });
  }
  const { searchParams } = req.nextUrl;
  const geocoder = getGeocoder();
  try {
    const q = searchParams.get("q")?.trim();
    if (q) {
      if (q.length < 3 || q.length > 200) return NextResponse.json({ error: "Enter at least 3 characters." }, { status: 400 });
      const { settings } = await getPublicData();
      const results = await geocoder.search(q, { lat: settings.service_area.center_lat, lng: settings.service_area.center_lng });
      return NextResponse.json({ results });
    }
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!isValidCoordinate(lat, lng)) return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
    const result = await geocoder.reverse(lat, lng);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[geocode]", err);
    return NextResponse.json({ error: "Address lookup is unavailable right now. You can place the pin on the map instead." }, { status: 502 });
  }
}
