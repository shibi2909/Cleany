"use client";

import { useEffect, useRef, useState } from "react";
import { MAPS_API_KEY } from "@/lib/maps/provider";
import type { MapViewProps } from "./map-view";

let loader: Promise<void> | null = null;

function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&v=weekly`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

const TONE_COLORS = { brand: "#1A6150", warning: "#C7892B", danger: "#B42318", neutral: "#5D6862" } as const;

export default function GoogleMap({ center, centerLabel, radiusKm, customer, markers, onPick, fitToRadius = true, className }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{ setMap(m: google.maps.Map | null): void }[]>([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!el.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(el.current, {
          center,
          zoom: 10,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) onPickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];

    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      strokeColor: "#1A6150",
      strokeWeight: 2,
      fillColor: "#2E9677",
      fillOpacity: 0.08,
      clickable: false,
    });
    overlays.current.push(circle);
    overlays.current.push(
      new google.maps.Marker({
        map,
        position: center,
        title: centerLabel ?? "Service centre",
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#C7892B", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
      }),
    );

    const info = new google.maps.InfoWindow();
    for (const m of markers ?? []) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
        icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 5, fillColor: TONE_COLORS[m.tone ?? "brand"], fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1.5 },
      });
      marker.addListener("click", () => {
        const div = document.createElement("div");
        div.style.fontSize = "13px";
        const strong = document.createElement("strong");
        strong.textContent = m.title;
        div.appendChild(strong);
        for (const l of m.lines ?? []) {
          const line = document.createElement("div");
          line.textContent = l;
          div.appendChild(line);
        }
        if (m.href) {
          const a = document.createElement("a");
          a.href = m.href;
          a.textContent = "Open booking →";
          div.appendChild(a);
        }
        info.setContent(div);
        info.open({ map, anchor: marker });
      });
      overlays.current.push(marker);
    }

    if (customer) {
      const marker = new google.maps.Marker({ map, position: customer, title: "Your location", draggable: Boolean(onPickRef.current) });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (p) onPickRef.current?.({ lat: p.lat(), lng: p.lng() });
      });
      overlays.current.push(marker);
      map.setCenter(customer);
      map.setZoom(Math.max(map.getZoom() ?? 13, 13));
    } else if (fitToRadius) {
      const b = circle.getBounds();
      if (b) map.fitBounds(b, 12);
    }
  }, [ready, center, centerLabel, radiusKm, customer, markers]);

  if (error) {
    return (
      <div className={className}>
        <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">Map unavailable: {error}</div>
      </div>
    );
  }
  return <div ref={el} className={className} role="application" aria-label="Map" />;
}
