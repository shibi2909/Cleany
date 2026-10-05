"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "./map-view";

const TONE_COLORS = { brand: "#1A6150", warning: "#C7892B", danger: "#B42318", neutral: "#5D6862" } as const;

function pinIcon(L: typeof Leaflet, color: string, size = 30) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>`,
  });
}

function centerIcon(L: typeof Leaflet) {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:22px;height:22px;border-radius:999px;background:#C7892B;border:3px solid #fff;box-shadow:0 0 0 6px rgba(199,137,43,.25)"></span>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function LeafletMap({ center, centerLabel, radiusKm, customer, markers, onPick, fitToRadius = true, className }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const customerRef = useRef<Leaflet.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([center.lat, center.lng], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      render();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function render() {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const circle = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: "#1A6150",
      weight: 2,
      fillColor: "#2E9677",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layer);
    L.marker([center.lat, center.lng], { icon: centerIcon(L), keyboard: false, title: centerLabel ?? "Service centre" })
      .bindTooltip(centerLabel ?? "Service centre")
      .addTo(layer);

    for (const m of markers ?? []) {
      const lines = (m.lines ?? []).map((l) => `<div>${escapeHtml(l)}</div>`).join("");
      const link = m.href ? `<a href="${escapeHtml(m.href)}" style="display:inline-block;margin-top:6px;font-weight:600;color:#1A6150">Open booking →</a>` : "";
      L.marker([m.lat, m.lng], { icon: pinIcon(L, TONE_COLORS[m.tone ?? "brand"], 26), title: m.title })
        .bindPopup(`<div style="font-size:13px;line-height:1.45"><strong>${escapeHtml(m.title)}</strong>${lines}${link}</div>`)
        .addTo(layer);
    }

    customerRef.current = null;
    if (customer) {
      const marker = L.marker([customer.lat, customer.lng], {
        icon: pinIcon(L, "#0F3B2E", 36),
        draggable: Boolean(onPickRef.current),
        title: "Your location",
        autoPan: true,
      }).addTo(layer);
      marker.bindTooltip("Your location");
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onPickRef.current?.({ lat: p.lat, lng: p.lng });
      });
      customerRef.current = marker;
      map.setView([customer.lat, customer.lng], Math.max(map.getZoom(), 13));
    } else if (fitToRadius) {
      map.fitBounds(circle.getBounds(), { padding: [12, 12] });
    }
  }

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, radiusKm, customer?.lat, customer?.lng, markers]);

  return <div ref={el} className={className} role="application" aria-label="Map" />;
}
