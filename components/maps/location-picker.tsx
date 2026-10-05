"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, LocateFixed, MapPin, Search, XCircle } from "lucide-react";
import { MapView } from "./map-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Alert, Spinner } from "@/components/ui/feedback";
import { checkServiceabilityAction } from "@/app/actions/location";
import type { ServiceabilityResult } from "@/lib/maps/distance";
import type { GeocodeResult, LatLng } from "@/lib/maps/provider";
import type { ServiceAreaSettings } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";

export interface PickedLocation extends LatLng {
  formattedAddress: string;
  pincode: string | null;
  serviceability: ServiceabilityResult;
}

type GeoError = "denied" | "unavailable" | "timeout" | "unsupported" | null;

const GEO_MESSAGES: Record<Exclude<GeoError, null>, string> = {
  denied: "Location permission was denied. Search for your address or tap your home on the map instead.",
  unavailable: "We couldn't detect your location. Search for your address or tap your home on the map.",
  timeout: "Finding your location took too long. Please try again or search for your address.",
  unsupported: "Your browser doesn't support location detection. Search for your address instead.",
};

export function LocationPicker({
  area,
  value,
  onChange,
  mapClassName = "h-72 sm:h-80",
}: {
  area: ServiceAreaSettings;
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
  mapClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<GeoError>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [pending, setPending] = useState<LatLng | null>(value);
  const reqId = useRef(0);

  useEffect(() => setPending(value), [value]);

  async function select(point: LatLng, label?: string, pincode?: string | null) {
    const id = ++reqId.current;
    setPending(point);
    setResults(null);
    setCheckError(null);
    startCheck(async () => {
      const [check, reverse] = await Promise.all([
        checkServiceabilityAction(point.lat, point.lng).catch(() => null),
        label
          ? Promise.resolve<GeocodeResult | null>({ ...point, label, pincode: pincode ?? null })
          : fetch(`/api/geocode?lat=${point.lat}&lng=${point.lng}`)
              .then((r) => (r.ok ? r.json() : { result: null }))
              .then((j: { result: GeocodeResult | null }) => j.result)
              .catch(() => null),
      ]);
      if (id !== reqId.current) return;
      if (!check || !check.ok) {
        setCheckError(check && !check.ok ? check.error : "We couldn't check this location. Please check your connection and try again.");
        onChange(null);
        return;
      }
      onChange({
        ...point,
        formattedAddress: reverse?.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        pincode: reverse?.pincode ?? null,
        serviceability: check.data,
      });
    });
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) return setSearchError("Type at least 3 characters of your address or area.");
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: GeocodeResult[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Search failed");
      setResults(json.results ?? []);
      if (!json.results?.length) setSearchError("No matching address found. Try a nearby landmark or area name, or tap the map.");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search is unavailable right now. Tap your home on the map instead.");
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) return setGeoError("unsupported");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        select({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  const s = value?.serviceability;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="address-search" className="sr-only">
          Search your address
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            id="address-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apartment, street or area (e.g. Indiranagar)"
            className="pl-10"
            autoComplete="street-address"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" loading={searching} className="flex-1 sm:flex-none">
            Search
          </Button>
          <Button type="button" variant="outline" onClick={locateMe} loading={locating} className="flex-1 sm:flex-none">
            {!locating ? <LocateFixed aria-hidden /> : null} Use current location
          </Button>
        </div>
      </form>

      {searchError ? <p className="text-sm text-red-700" role="alert">{searchError}</p> : null}
      {geoError ? <Alert tone="warning">{GEO_MESSAGES[geoError]}</Alert> : null}

      {results && results.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-line bg-white" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => select({ lat: r.lat, lng: r.lng }, r.label, r.pincode)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-sand-50"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                <span>{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <MapView
        center={{ lat: area.center_lat, lng: area.center_lng }}
        centerLabel={area.center_label}
        radiusKm={area.radius_km}
        customer={pending}
        onPick={(p) => select(p)}
        className={mapClassName}
      />
      <p className="-mt-2 text-xs text-muted">Tip: tap the map or drag the pin to your exact building.</p>

      <div aria-live="polite">
        {checking ? (
          <Spinner label="Checking if we service your location…" />
        ) : checkError ? (
          <Alert tone="danger" title="Couldn't check location">{checkError}</Alert>
        ) : s ? (
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              s.serviceable ? "border-brand-200 bg-brand-50 text-brand-900" : "border-red-200 bg-red-50 text-red-900",
            )}
          >
            {s.serviceable ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden />}
            <div className="text-sm">
              <p className="font-semibold">
                {s.serviceable ? "We service your location." : "Sorry, we currently don't provide service at this location."}
              </p>
              <p className="mt-0.5 opacity-85">
                {s.distanceKm.toFixed(1)} km from {area.center_label} · service radius {s.radiusKm} km
              </p>
              {value?.formattedAddress ? <p className="mt-1 opacity-75">{value.formattedAddress}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
