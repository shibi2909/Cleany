import { describe, expect, it } from "vitest";
import { calculateQuote, findAreaRange, type PricingCatalog } from "@/lib/pricing/quote";
import { checkServiceability, haversineKm } from "@/lib/maps/distance";
import { evaluateCancellation } from "@/lib/cancellation/policy";
import { evaluateReschedule } from "@/lib/rescheduling/policy";
import { isSlotTimeAllowed, slotStartISO, todayIST, upcomingDates } from "@/lib/booking/slots";
import { parseSettings } from "@/lib/settings/schema";
import {
  createBookingWhatsAppMessage,
  createCancellationWhatsAppMessage,
  createPaymentWhatsAppMessage,
  createRescheduleWhatsAppMessage,
  createWhatsAppUrl,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp/messages";
import type { Service } from "@/types";

const svc = (id: string, name: string, pricing_type: Service["pricing_type"], price: number, sort: number): Service => ({
  id, slug: id, name, description: "", category: "Home", icon: "Home", pricing_type, price, unit_label: null,
  image_url: null, duration_minutes: null, is_active: true, is_default_selected: false, is_popular: false, sort_order: sort,
});

// Mirrors supabase/migrations/*_default_catalog.sql
const catalog: PricingCatalog = {
  bhk: [
    { bhk_type: "1BHK", label: "1 BHK", base_price: 1999, typical_sqft: 800, description: "", duration_label: null, is_active: true, sort_order: 1 },
    { bhk_type: "2BHK", label: "2 BHK", base_price: 2799, typical_sqft: 1200, description: "", duration_label: null, is_active: true, sort_order: 2 },
  ],
  areas: [
    { id: "a1", label: "Below 800 sq.ft", min_sqft: 0, max_sqft: 799, surcharge: 0, is_active: true, sort_order: 1 },
    { id: "a3", label: "1000–1200 sq.ft", min_sqft: 1000, max_sqft: 1200, surcharge: 0, is_active: true, sort_order: 3 },
    { id: "a4", label: "1200–1500 sq.ft", min_sqft: 1201, max_sqft: 1500, surcharge: 400, is_active: true, sort_order: 4 },
    { id: "a6", label: "Above 2000 sq.ft", min_sqft: 2001, max_sqft: null, surcharge: 1400, is_active: true, sort_order: 6 },
  ],
  bathrooms: [
    { bathroom_count: 1, label: "1", price_per_bathroom: 299 },
    { bathroom_count: 2, label: "2", price_per_bathroom: 299 },
    { bathroom_count: 4, label: "4+", price_per_bathroom: 269 },
  ],
  services: [
    svc("deep", "Deep Home Cleaning", "BHK_BASE", 0, 1),
    svc("kitchen", "Kitchen Deep Cleaning", "FIXED", 499, 2),
    svc("bath", "Bathroom Deep Cleaning", "PER_BATHROOM", 0, 3),
    svc("sofa", "Sofa Cleaning", "FIXED", 499, 4),
  ],
  discounts: [],
};

describe("quote engine", () => {
  it("matches the reference quote: 2 BHK, 1,200 sq.ft, 2 bathrooms → ₹4,395", () => {
    const q = calculateQuote(catalog, { bhkType: "2BHK", areaSqft: 1200, bathroomCount: 2, serviceIds: ["sofa", "deep", "kitchen", "bath"] }, "2026-09-29");
    expect(q.errors).toEqual([]);
    expect(q.lines.map((l) => [l.displayName, l.total])).toEqual([
      ["Deep Home Cleaning", 2799],
      ["Kitchen Deep Cleaning", 499],
      ["Bathroom × 2", 598],
      ["Sofa Cleaning", 499],
    ]);
    expect(q.total).toBe(4395);
  });

  it("adds a size adjustment for larger homes right after whole-home cleaning", () => {
    const q = calculateQuote(catalog, { bhkType: "2BHK", areaSqft: 1300, bathroomCount: 1, serviceIds: ["kitchen", "deep"] }, "2026-09-29");
    expect(q.lines.map((l) => l.itemType)).toEqual(["SERVICE", "AREA_SURCHARGE", "SERVICE"]);
    expect(q.total).toBe(2799 + 400 + 499);
  });

  it("does not add a size adjustment without whole-home cleaning", () => {
    const q = calculateQuote(catalog, { bhkType: "2BHK", areaSqft: 2500, bathroomCount: 1, serviceIds: ["sofa"] }, "2026-09-29");
    expect(q.total).toBe(499);
  });

  it("flags unknown services and empty selections", () => {
    expect(calculateQuote(catalog, { bhkType: "2BHK", areaSqft: 1000, bathroomCount: 1, serviceIds: ["nope"] }, "2026-09-29").errors).toContain("UNKNOWN_SERVICE");
    expect(calculateQuote(catalog, { bhkType: "2BHK", areaSqft: 1000, bathroomCount: 1, serviceIds: [] }, "2026-09-29").errors).toContain("NO_SERVICES");
  });

  it("applies the best eligible discount within its dates", () => {
    const withDiscounts: PricingCatalog = {
      ...catalog,
      discounts: [
        { id: "d1", name: "Festive 10%", description: "", discount_type: "PERCENTAGE", value: 10, min_subtotal: 3000, max_discount: 300, starts_on: null, ends_on: null, is_active: true },
        { id: "d2", name: "Flat 200", description: "", discount_type: "FIXED", value: 200, min_subtotal: 0, max_discount: null, starts_on: "2026-01-01", ends_on: "2026-01-31", is_active: true },
      ],
    };
    const q = calculateQuote(withDiscounts, { bhkType: "2BHK", areaSqft: 1200, bathroomCount: 2, serviceIds: ["deep", "kitchen", "bath", "sofa"] }, "2026-09-29");
    expect(q.discount).toBe(300);
    expect(q.discountLabel).toBe("Festive 10%");
    expect(q.total).toBe(4095);
  });

  it("finds area ranges at boundaries", () => {
    expect(findAreaRange(catalog.areas, 1200)?.id).toBe("a3");
    expect(findAreaRange(catalog.areas, 1201)?.id).toBe("a4");
    expect(findAreaRange(catalog.areas, 9000)?.id).toBe("a6");
  });
});

describe("serviceability", () => {
  const area = parseSettings([]).service_area;

  it("uses the configured radius", () => {
    expect(area.radius_km).toBe(50);
    const indiranagar = checkServiceability(area, 12.9784, 77.6408);
    expect(indiranagar.serviceable).toBe(true);
    expect(indiranagar.distanceKm).toBeLessThan(10);
  });

  it("rejects locations beyond the radius (Mysuru ≈ 125 km)", () => {
    const mysuru = checkServiceability(area, 12.2958, 76.6394);
    expect(mysuru.serviceable).toBe(false);
    expect(mysuru.distanceKm).toBeGreaterThan(100);
  });

  it("haversine is symmetric and ~111 km per degree of latitude", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });
});

describe("slots", () => {
  const booking = parseSettings([]).booking;
  const now = new Date("2026-09-29T10:00:00+05:30");

  it("respects lead time and the booking window", () => {
    const slot = booking.time_slots[0];
    expect(isSlotTimeAllowed(booking, "2026-09-29", slot, now)).toBe(false); // past
    expect(isSlotTimeAllowed(booking, "2026-09-30", slot, now)).toBe(true); // 23h ahead
    expect(isSlotTimeAllowed(booking, "2027-01-30", slot, now)).toBe(false); // beyond 45 days
  });

  it("computes IST dates and slot instants", () => {
    expect(todayIST(new Date("2026-09-29T20:00:00Z"))).toBe("2026-09-30");
    expect(slotStartISO("2026-09-30", { start: "09:00" })).toBe("2026-09-30T09:00:00+05:30");
    expect(upcomingDates(booking, 3, now)[0]).toBe("2026-09-30"); // no slot today has 12h lead time
  });
});

describe("cancellation policy", () => {
  const policy = parseSettings([]).cancellation;
  const now = new Date("2026-09-29T10:00:00+05:30");
  const booking = { booking_status: "CONFIRMED" as const, payment_status: "PENDING" as const, slot_start: "2026-10-02T09:00:00+05:30", total: 4395 };

  it("auto-cancels unpaid bookings with enough notice and no refund", () => {
    const r = evaluateCancellation(booking, policy, now);
    expect(r).toMatchObject({ allowed: true, requiresApproval: false, refundAmount: 0 });
  });

  it("refunds paid bookings in full when no fee applies", () => {
    const r = evaluateCancellation({ ...booking, payment_status: "PAID" }, policy, now);
    expect(r).toMatchObject({ allowed: true, isPaid: true, refundAmount: 4395 });
  });

  it("requires approval inside the minimum notice window and applies fees", () => {
    const r = evaluateCancellation(
      { ...booking, payment_status: "PAID", slot_start: "2026-09-29T18:00:00+05:30" },
      { ...policy, fee_type: "percentage", fee_value: 20 },
      now,
    );
    expect(r).toMatchObject({ allowed: true, requiresApproval: true, fee: 879, refundAmount: 3516 });
  });

  it("blocks completed bookings and disabled policy", () => {
    expect(evaluateCancellation({ ...booking, booking_status: "COMPLETED" }, policy, now).allowed).toBe(false);
    expect(evaluateCancellation(booking, { ...policy, enabled: false }, now).allowed).toBe(false);
  });
});

describe("reschedule policy", () => {
  const policy = parseSettings([]).reschedule;
  const now = new Date("2026-09-29T10:00:00+05:30");
  const booking = { booking_status: "CONFIRMED" as const, slot_start: "2026-09-30T09:00:00+05:30", total: 4395, reschedule_count: 0 };

  it("allows with enough notice and requires approval by default", () => {
    expect(evaluateReschedule(booking, policy, now)).toMatchObject({ allowed: true, requiresApproval: true, remaining: 2 });
  });

  it("blocks inside the notice window and past the limit", () => {
    expect(evaluateReschedule({ ...booking, slot_start: "2026-09-29T18:00:00+05:30" }, policy, now).allowed).toBe(false);
    expect(evaluateReschedule({ ...booking, reschedule_count: 2 }, policy, now).allowed).toBe(false);
  });
});

describe("whatsapp", () => {
  it("normalises Indian numbers and builds wa.me links", () => {
    expect(normalizeWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("9876543210")).toBe("919876543210");
    expect(createWhatsAppUrl("9876543210", "Hi 👋")).toBe("https://wa.me/919876543210?text=Hi%20%F0%9F%91%8B");
  });

  const b = {
    booking_number: "CLN-2026-10245", bhk_type: "2BHK" as const, area_sqft: 1200, area_is_approximate: false,
    area_range_label: null, bathroom_count: 2, booking_date: "2026-09-30", time_slot: "9 AM – 12 PM",
    address: "12 Demo Street", landmark: null, pincode: "560038", total: 4395, payment_status: "PENDING" as const,
    services: ["Deep Home Cleaning", "Kitchen Deep Cleaning"],
  };

  it("creates the booking message", () => {
    const m = createBookingWhatsAppMessage(b);
    expect(m).toContain("Booking ID: CLN-2026-10245");
    expect(m).toContain("2 BHK Deep Cleaning");
    expect(m).toContain("1,200 sq.ft");
    expect(m).toContain("30 September 2026");
    expect(m).toContain("₹4,395");
    expect(m).toContain("• Kitchen Deep Cleaning");
    expect(m).toContain("Pending");
  });

  it("creates payment, cancellation and reschedule messages", () => {
    const pay = createPaymentWhatsAppMessage(b, { upi_id: "cleaningbusiness@upi", payee_name: "Cleany Services", payment_number: "", instructions: "" });
    expect(pay).toContain("cleaningbusiness@upi");
    expect(pay).toContain("₹4,395");
    expect(createCancellationWhatsAppMessage(b, "Change of plans")).toContain("Reason:\nChange of plans");
    const r = createRescheduleWhatsAppMessage({ booking_number: b.booking_number, oldDate: "2026-09-30", oldSlot: "9 AM – 12 PM", newDate: "2026-10-02", newSlot: "12 PM – 3 PM" });
    expect(r).toContain("30 September, 9 AM – 12 PM");
    expect(r).toContain("2 October, 12 PM – 3 PM");
  });
});
