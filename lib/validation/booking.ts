import { z } from "zod";
import { BHK_TYPES } from "@/types";
import { CANCELLATION_REASONS } from "@/lib/cancellation/policy";

const INDIAN_MOBILE = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/;

/** Normalises "+91 98765-43210" → "9876543210". */
export function normalizeIndianPhone(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits.slice(-10);
}

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => INDIAN_MOBILE.test(v.replace(/[\s-]/g, "")), { message: "Enter a valid 10-digit Indian mobile number" })
  .transform(normalizeIndianPhone);

export const homeSchema = z.object({
  bhkType: z.enum(BHK_TYPES, { message: "Choose your home type" }),
  areaSqft: z.coerce
    .number({ message: "Enter your home size" })
    .int("Use whole numbers")
    .min(150, "Size looks too small — please check")
    .max(20000, "For homes above 20,000 sq.ft please contact us"),
  areaIsApproximate: z.boolean().default(false),
  bathroomCount: z.coerce.number().int().min(1, "Choose bathrooms").max(4),
  serviceIds: z.array(z.uuid()).min(1, "Select at least one service").max(20),
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  formattedAddress: z.string().max(400).optional().default(""),
});

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneSchema,
  email: z.email("Enter a valid email address").max(120),
  address: z.string().trim().min(8, "Enter your full address (house/flat no., street, area)").max(300),
  landmark: z.string().trim().max(120).optional().default(""),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  instructions: z.string().trim().max(500).optional().default(""),
});

export const scheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  slotId: z.string().min(1, "Choose a time slot").max(40),
});

export const createBookingSchema = z.object({
  home: homeSchema,
  location: locationSchema,
  schedule: scheduleSchema,
  customer: customerDetailsSchema,
});
export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type CustomerDetailsInput = z.input<typeof customerDetailsSchema>;

export const rescheduleRequestSchema = z.object({
  bookingId: z.uuid(),
  date: scheduleSchema.shape.date,
  slotId: scheduleSchema.shape.slotId,
  reason: z.string().trim().max(300).optional().default(""),
});

export const cancellationRequestSchema = z.object({
  bookingId: z.uuid(),
  reason: z.enum(CANCELLATION_REASONS, { message: "Please choose a reason" }),
  comment: z.string().trim().max(500).optional().default(""),
});

export const paymentProofSchema = z.object({
  bookingId: z.uuid(),
  reference: z.string().trim().max(60).optional().default(""),
});

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneSchema,
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});
