import type { AreaPricing, BathroomPricing, BhkPricing, BhkType, Discount, Service } from "@/types";

/**
 * The quotation engine. Pure and deterministic: the browser uses it for the live
 * quote, and the server runs the exact same function against freshly loaded
 * database prices when a booking is created. Client-submitted prices are never used.
 */

export interface PricingCatalog {
  bhk: BhkPricing[];
  areas: AreaPricing[];
  bathrooms: BathroomPricing[];
  services: Service[];
  discounts: Discount[];
}

export interface QuoteInput {
  bhkType: BhkType;
  areaSqft: number;
  bathroomCount: number;
  serviceIds: string[];
}

export interface QuoteLine {
  key: string;
  serviceId: string | null;
  itemType: "SERVICE" | "AREA_SURCHARGE";
  /** Name stored as the booking item snapshot. */
  name: string;
  /** Short label for the live quote, e.g. "Bathroom × 2". */
  displayName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export type QuoteError = "UNKNOWN_BHK" | "NO_AREA_RANGE" | "NO_SERVICES" | "UNKNOWN_SERVICE" | "NO_BATHROOM_PRICE";

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  total: number;
  bhk: BhkPricing | null;
  areaRange: AreaPricing | null;
  errors: QuoteError[];
}

export function findAreaRange(areas: AreaPricing[], sqft: number): AreaPricing | null {
  return (
    areas
      .filter((a) => a.is_active)
      .sort((a, b) => a.min_sqft - b.min_sqft)
      .find((a) => sqft >= a.min_sqft && (a.max_sqft === null || sqft <= a.max_sqft)) ?? null
  );
}

/** A representative sq.ft value for customers who pick a range instead of an exact size. */
export function representativeSqft(range: AreaPricing): number {
  if (range.max_sqft === null) return range.min_sqft;
  return Math.round((range.min_sqft + range.max_sqft) / 2);
}

export function bestDiscount(discounts: Discount[], subtotal: number, today: string) {
  let best: { amount: number; label: string } | null = null;
  for (const d of discounts) {
    if (!d.is_active || subtotal < d.min_subtotal) continue;
    if (d.starts_on && today < d.starts_on) continue;
    if (d.ends_on && today > d.ends_on) continue;
    let amount = d.discount_type === "PERCENTAGE" ? Math.floor((subtotal * d.value) / 100) : d.value;
    if (d.max_discount !== null) amount = Math.min(amount, d.max_discount);
    amount = Math.min(amount, subtotal);
    if (amount > 0 && (!best || amount > best.amount)) best = { amount, label: d.name };
  }
  return best;
}

export function calculateQuote(catalog: PricingCatalog, input: QuoteInput, today: string): Quote {
  const errors: QuoteError[] = [];
  const lines: QuoteLine[] = [];

  const bhk = catalog.bhk.find((b) => b.bhk_type === input.bhkType && b.is_active) ?? null;
  if (!bhk) errors.push("UNKNOWN_BHK");

  const areaRange = findAreaRange(catalog.areas, input.areaSqft);
  if (!areaRange) errors.push("NO_AREA_RANGE");

  const bathroomTier = Math.min(Math.max(Math.round(input.bathroomCount), 1), 4);
  const bathroomPrice = catalog.bathrooms.find((b) => b.bathroom_count === bathroomTier) ?? null;

  const uniqueIds = [...new Set(input.serviceIds)];
  if (uniqueIds.length === 0) errors.push("NO_SERVICES");

  const services = uniqueIds
    .map((id) => catalog.services.find((s) => s.id === id && s.is_active))
    .filter((s): s is Service => {
      return Boolean(s);
    })
    .sort((a, b) => a.sort_order - b.sort_order);
  if (services.length !== uniqueIds.length) errors.push("UNKNOWN_SERVICE");

  let wholeHomeLineIndex = -1;
  for (const s of services) {
    if (s.pricing_type === "BHK_BASE") {
      if (!bhk) continue;
      wholeHomeLineIndex = lines.length;
      lines.push({
        key: s.id,
        serviceId: s.id,
        itemType: "SERVICE",
        name: `${s.name} (${bhk.label})`,
        displayName: s.name,
        unitPrice: bhk.base_price,
        quantity: 1,
        total: bhk.base_price,
      });
    } else if (s.pricing_type === "PER_BATHROOM") {
      if (!bathroomPrice) {
        errors.push("NO_BATHROOM_PRICE");
        continue;
      }
      lines.push({
        key: s.id,
        serviceId: s.id,
        itemType: "SERVICE",
        name: s.name,
        displayName: `Bathroom × ${bathroomTier}`,
        unitPrice: bathroomPrice.price_per_bathroom,
        quantity: bathroomTier,
        total: bathroomPrice.price_per_bathroom * bathroomTier,
      });
    } else {
      lines.push({
        key: s.id,
        serviceId: s.id,
        itemType: "SERVICE",
        name: s.name,
        displayName: s.name,
        unitPrice: s.price,
        quantity: 1,
        total: s.price,
      });
    }
  }

  // Larger homes take longer; the size adjustment applies to whole-home cleaning.
  if (wholeHomeLineIndex >= 0 && areaRange && areaRange.surcharge > 0) {
    lines.splice(wholeHomeLineIndex + 1, 0, {
      key: `area-${areaRange.id}`,
      serviceId: null,
      itemType: "AREA_SURCHARGE",
      name: `Home size adjustment (${areaRange.label})`,
      displayName: `Size adjustment (${areaRange.label})`,
      unitPrice: areaRange.surcharge,
      quantity: 1,
      total: areaRange.surcharge,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const disc = bestDiscount(catalog.discounts, subtotal, today);
  const discount = disc?.amount ?? 0;

  return {
    lines,
    subtotal,
    discount,
    discountLabel: disc?.label ?? null,
    total: subtotal - discount,
    bhk,
    areaRange,
    errors: [...new Set(errors)],
  };
}

/** Lowest "from" price for a BHK card (whole-home cleaning with one bathroom). */
export function startingPrice(catalog: PricingCatalog, bhkType: BhkType) {
  const bhk = catalog.bhk.find((b) => b.bhk_type === bhkType);
  return bhk?.base_price ?? null;
}
