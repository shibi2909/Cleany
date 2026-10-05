/**
 * Creates clearly-marked DEMO data: 3 demo customers (example.com emails),
 * 3 demo staff and ~10 demo bookings across the whole lifecycle.
 *
 *   npm run seed:demo
 *
 * Every row is flagged is_demo = true and uses fictional names and numbers.
 * Bookings are never deleted (by design), so this script refuses to run twice.
 * Catalogue, prices and settings come from the migrations, not from here.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calculateQuote, type PricingCatalog } from "../lib/pricing/quote";
import { checkServiceability } from "../lib/maps/distance";
import { addDays, slotStartISO, todayIST } from "../lib/booking/slots";
import { parseSettings } from "../lib/settings/schema";
import type { BhkType } from "../types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const CUSTOMERS = [
  { email: "demo.aarav@example.com", full_name: "Aarav Demo", phone: "9000000101" },
  { email: "demo.diya@example.com", full_name: "Diya Demo", phone: "9000000102" },
  { email: "demo.kabir@example.com", full_name: "Kabir Demo", phone: "9000000103" },
];

const STAFF = [
  { full_name: "Demo Team Alpha", phone: "9000000201", service_area: "East Bengaluru", status: "AVAILABLE" },
  { full_name: "Demo Team Beta", phone: "9000000202", service_area: "South Bengaluru", status: "AVAILABLE" },
  { full_name: "Demo Team Gamma", phone: "9000000203", service_area: "North Bengaluru", status: "ON_LEAVE" },
];

// Fictional addresses at real-area coordinates (all within 50 km of MG Road).
const PLACES = [
  { address: "Flat 12B, Demo Residency, 5th Cross", area: "Indiranagar", pincode: "560038", lat: 12.9784, lng: 77.6408 },
  { address: "House 44, Demo Layout, 2nd Main", area: "HSR Layout", pincode: "560102", lat: 12.9116, lng: 77.6389 },
  { address: "Tower C 1103, Demo Heights", area: "Whitefield", pincode: "560066", lat: 12.9698, lng: 77.75 },
  { address: "Villa 7, Demo Greens", area: "Yelahanka", pincode: "560064", lat: 13.1007, lng: 77.5963 },
  { address: "Flat 302, Demo Apartments", area: "Jayanagar", pincode: "560041", lat: 12.925, lng: 77.5938 },
];

function must<T>(res: { data: T; error: unknown }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${JSON.stringify(res.error)}`);
  return res.data as NonNullable<T>;
}

async function main() {
  const existing = must(await db.from("profiles").select("id").eq("is_demo", true).limit(1), "check demo");
  if (existing.length) {
    console.log("Demo data already exists (profiles.is_demo = true). Nothing to do.");
    return;
  }

  const settings = parseSettings(must(await db.from("settings").select("key, value"), "settings"));
  const [bhk, areas, bathrooms, services, discounts] = await Promise.all([
    db.from("bhk_pricing").select("*"),
    db.from("area_pricing").select("*"),
    db.from("bathroom_pricing").select("*"),
    db.from("services").select("*").eq("is_active", true).order("sort_order"),
    db.from("discounts").select("*").eq("is_active", true),
  ]);
  const catalog = {
    bhk: must(bhk, "bhk"),
    areas: must(areas, "areas"),
    bathrooms: must(bathrooms, "bathrooms"),
    services: must(services, "services"),
    discounts: must(discounts, "discounts"),
  } as PricingCatalog;
  const svc = (slug: string) => catalog.services.find((s) => s.slug === slug)?.id;

  // Customers (auth users get random passwords — demo accounts aren't meant for login).
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const { data, error } = await db.auth.admin.createUser({
      email: c.email,
      password: randomBytes(18).toString("base64url"),
      email_confirm: true,
      user_metadata: { full_name: c.full_name, phone: c.phone },
    });
    if (error) throw error;
    await db.from("profiles").update({ is_demo: true, full_name: c.full_name, phone: c.phone }).eq("id", data.user.id);
    customerIds.push(data.user.id);
  }
  console.log(`✓ ${customerIds.length} demo customers`);

  const staff = must(await db.from("staff").insert(STAFF.map((s) => ({ ...s, is_demo: true }))).select("id"), "staff");
  console.log(`✓ ${staff.length} demo staff`);

  // Pick an admin (if one exists) as the actor for demo admin actions.
  const admin = must(await db.from("profiles").select("id").eq("role", "admin").limit(1), "admin")[0]?.id ?? null;

  const today = todayIST();
  const slots = settings.booking.time_slots;
  type Plan = {
    customer: number;
    bhk: BhkType;
    sqft: number;
    baths: number;
    services: string[];
    place: number;
    day: number;
    slot: number;
    flow: ("paymentPending" | "proof" | "verify" | "assign" | "onTheWay" | "rescheduleRequest" | "cancel" | "cancelRequest" | "complete")[];
  };
  const plans: Plan[] = [
    { customer: 0, bhk: "2BHK", sqft: 1200, baths: 2, services: ["deep-home-cleaning", "kitchen-deep-cleaning", "bathroom-deep-cleaning", "sofa-cleaning"], place: 0, day: 3, slot: 0, flow: [] },
    { customer: 1, bhk: "3BHK", sqft: 1500, baths: 3, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "balcony-cleaning"], place: 1, day: 4, slot: 1, flow: ["paymentPending", "proof"] },
    { customer: 2, bhk: "1BHK", sqft: 750, baths: 1, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "fridge-cleaning"], place: 2, day: 5, slot: 2, flow: ["verify"] },
    { customer: 0, bhk: "4BHK", sqft: 2200, baths: 4, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "kitchen-deep-cleaning", "window-cleaning", "chimney-cleaning"], place: 3, day: 6, slot: 0, flow: ["verify", "assign"] },
    { customer: 1, bhk: "2BHK", sqft: 1100, baths: 2, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "mattress-cleaning"], place: 4, day: 7, slot: 1, flow: ["verify", "rescheduleRequest"] },
    { customer: 2, bhk: "2BHK", sqft: 1000, baths: 2, services: ["kitchen-deep-cleaning", "sofa-cleaning"], place: 0, day: 8, slot: 2, flow: ["cancel"] },
    { customer: 0, bhk: "3BHK", sqft: 1450, baths: 2, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "carpet-cleaning"], place: 1, day: 9, slot: 0, flow: ["verify", "cancel"] },
    { customer: 1, bhk: "1BHK", sqft: 650, baths: 1, services: ["deep-home-cleaning", "washing-machine-cleaning"], place: 2, day: 10, slot: 1, flow: ["verify", "cancelRequest"] },
    { customer: 2, bhk: "2BHK", sqft: 1250, baths: 2, services: ["deep-home-cleaning", "bathroom-deep-cleaning", "kitchen-deep-cleaning"], place: 3, day: 2, slot: 2, flow: ["verify", "assign", "onTheWay", "complete"] },
  ];

  let n = 0;
  for (const p of plans) {
    const c = CUSTOMERS[p.customer];
    const place = PLACES[p.place];
    const date = addDays(today, p.day);
    const slot = slots[p.slot % slots.length];
    const quote = calculateQuote(
      catalog,
      { bhkType: p.bhk, areaSqft: p.sqft, bathroomCount: p.baths, serviceIds: p.services.map(svc).filter(Boolean) as string[] },
      today,
    );
    const area = checkServiceability(settings.service_area, place.lat, place.lng);
    const created = must(
      await db.rpc("create_booking", {
        p_booking: {
          user_id: customerIds[p.customer],
          customer_name: c.full_name,
          customer_phone: c.phone,
          customer_email: c.email,
          bhk_type: p.bhk,
          area_sqft: p.sqft,
          area_is_approximate: false,
          area_range_label: quote.areaRange?.label ?? null,
          bathroom_count: p.baths,
          address: `${place.address}, ${place.area}, Bengaluru`,
          landmark: "Demo landmark",
          pincode: place.pincode,
          latitude: place.lat,
          longitude: place.lng,
          distance_from_center: area.distanceKm,
          serviceable: area.serviceable,
          booking_date: date,
          time_slot: slot.label,
          slot_start: slotStartISO(date, slot),
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          notes: "DEMO BOOKING — fictional customer",
          is_demo: true,
        },
        p_items: quote.lines.map((l) => ({ service_id: l.serviceId, item_type: l.itemType, name: l.name, unit_price: l.unitPrice, quantity: l.quantity })),
        p_slot_capacity: 100,
      }),
      "create_booking",
    ) as { id: string; booking_number: string };
    const id = created.id;

    for (const step of p.flow) {
      if (step === "paymentPending") must(await db.rpc("update_booking_status", { p_booking_id: id, p_admin_id: admin, p_new_status: "PAYMENT_PENDING", p_note: "UPI details sent on WhatsApp (demo)" }), step);
      if (step === "proof") must(await db.rpc("submit_payment_proof", { p_booking_id: id, p_user_id: customerIds[p.customer], p_reference: "DEMO000000001", p_proof_path: null }), step);
      if (step === "verify") must(await db.rpc("review_payment", { p_booking_id: id, p_admin_id: admin, p_approve: true, p_reference: `DEMO${Date.now()}`, p_note: "Demo payment verified" }), step);
      if (step === "assign") must(await db.rpc("assign_staff", { p_booking_id: id, p_admin_id: admin, p_staff_id: staff[p.customer % 2].id }), step);
      if (step === "onTheWay") must(await db.rpc("update_booking_status", { p_booking_id: id, p_admin_id: admin, p_new_status: "TEAM_ON_THE_WAY", p_note: null }), step);
      if (step === "complete") {
        must(await db.rpc("update_booking_status", { p_booking_id: id, p_admin_id: admin, p_new_status: "CLEANING", p_note: null }), step);
        must(await db.rpc("update_booking_status", { p_booking_id: id, p_admin_id: admin, p_new_status: "COMPLETED", p_note: "Demo job completed" }), step);
      }
      if (step === "rescheduleRequest") {
        const newDate = addDays(date, 2);
        const newSlot = slots[(p.slot + 1) % slots.length];
        must(
          await db.rpc("request_reschedule", {
            p_booking_id: id,
            p_user_id: customerIds[p.customer],
            p_new_date: newDate,
            p_new_slot: newSlot.label,
            p_new_slot_start: slotStartISO(newDate, newSlot),
            p_reason: "Travelling that weekend (demo)",
            p_fee: 0,
            p_requires_approval: true,
            p_max_reschedules: settings.reschedule.max_reschedules,
            p_slot_capacity: 100,
          }),
          step,
        );
      }
      if (step === "cancel" || step === "cancelRequest") {
        const b = must(await db.from("bookings").select("payment_status, total").eq("id", id).single(), "load");
        must(
          await db.rpc("request_cancellation", {
            p_booking_id: id,
            p_user_id: customerIds[p.customer],
            p_reason: step === "cancel" ? "Change of plans" : "Timing doesn't work",
            p_comment: "Demo cancellation",
            p_requires_approval: step === "cancelRequest",
            p_fee: 0,
            p_refund_amount: b.payment_status === "PAID" ? b.total : 0,
          }),
          step,
        );
      }
    }
    n++;
    console.log(`  • ${created.booking_number}  ${p.bhk}  ${date}  ${p.flow.join(" → ") || "requested"}`);
  }
  console.log(`✓ ${n} demo bookings`);
  if (!admin) console.log("Note: no admin account exists yet, so demo admin actions were recorded without an actor.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
