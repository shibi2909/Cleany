import { z } from "zod";
import { BOOKING_STATUSES, REFUND_STATUSES } from "@/types";
import { SERVICE_ICON_NAMES } from "@/components/ui/icon";

const money = z.coerce.number({ message: "Enter an amount" }).int("Whole rupees only").min(0, "Can't be negative").max(1_000_000);

export const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().trim().max(400).default(""),
  category: z.string().trim().min(2).max(40),
  icon: z.enum(SERVICE_ICON_NAMES as [string, ...string[]]),
  pricing_type: z.enum(["BHK_BASE", "PER_BATHROOM", "FIXED"]),
  price: money,
  unit_label: z.string().trim().max(40).optional().default(""),
  duration_minutes: z.coerce.number().int().min(0).max(1440).optional(),
  is_active: z.boolean(),
  is_default_selected: z.boolean(),
  is_popular: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export const bhkPricingSchema = z.array(
  z.object({
    bhk_type: z.enum(["1BHK", "2BHK", "3BHK", "4BHK"]),
    base_price: money,
    typical_sqft: z.coerce.number().int().min(100).max(20000),
    description: z.string().trim().max(120),
    duration_label: z.string().trim().max(40),
    is_active: z.boolean(),
  }),
);

export const areaPricingSchema = z
  .array(
    z.object({
      id: z.uuid().optional(),
      label: z.string().trim().min(2).max(40),
      min_sqft: z.coerce.number().int().min(0),
      max_sqft: z.union([z.coerce.number().int().min(0), z.null()]),
      surcharge: money,
      is_active: z.boolean(),
    }),
  )
  .superRefine((rows, ctx) => {
    rows.forEach((r, i) => {
      if (r.max_sqft !== null && r.max_sqft < r.min_sqft) ctx.addIssue({ code: "custom", message: `Row ${i + 1}: max must be ≥ min`, path: [i, "max_sqft"] });
    });
    const active = rows.filter((r) => r.is_active).sort((a, b) => a.min_sqft - b.min_sqft);
    for (let i = 1; i < active.length; i++) {
      const prev = active[i - 1];
      if (prev.max_sqft === null || prev.max_sqft >= active[i].min_sqft) {
        ctx.addIssue({ code: "custom", message: `Ranges "${prev.label}" and "${active[i].label}" overlap`, path: [i] });
      }
    }
  });

export const bathroomPricingSchema = z.array(
  z.object({ bathroom_count: z.coerce.number().int().min(1).max(4), label: z.string().trim().min(1).max(30), price_per_bathroom: money }),
);

export const discountSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(200).default(""),
    discount_type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.coerce.number().int().min(1),
    min_subtotal: money,
    max_discount: z.union([money, z.null()]),
    starts_on: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
    ends_on: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
    is_active: z.boolean(),
  })
  .refine((d) => d.discount_type !== "PERCENTAGE" || d.value <= 100, { message: "Percentage can't exceed 100", path: ["value"] });

export const staffSchema = z.object({
  id: z.uuid().optional(),
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9+\s-]{10,15}$/, "Enter a valid phone number"),
  status: z.enum(["AVAILABLE", "ON_JOB", "ON_LEAVE"]),
  service_area: z.string().trim().max(120).default(""),
  is_active: z.boolean(),
  notes: z.string().trim().max(300).optional().default(""),
});

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const refundStatusSchema = z.enum(REFUND_STATUSES).exclude(["NOT_APPLICABLE"]);
export const noteSchema = z.string().trim().max(500).optional().default("");
