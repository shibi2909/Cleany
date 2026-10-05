import { z } from "zod";

/**
 * Business settings stored in the `settings` table (one JSON document per key).
 * Each schema supplies defaults so the app keeps working if a key is missing.
 */

export const feeTypeSchema = z.enum(["none", "fixed", "percentage"]);
export type FeeType = z.infer<typeof feeTypeSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const timeSlotSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  start: hhmm,
  end: hhmm,
});
export type TimeSlot = z.infer<typeof timeSlotSchema>;

export const businessSettingsSchema = z.object({
  name: z.string().min(1).default("Cleany"),
  legal_name: z.string().default("Cleany Services"),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default("Bengaluru, Karnataka"),
  hours: z.string().default("8:00 AM – 8:00 PM, all days"),
});

export const whatsappSettingsSchema = z.object({
  number: z.string().default(""),
  support_hours: z.string().default("8:00 AM – 8:00 PM"),
});

export const paymentSettingsSchema = z.object({
  upi_id: z.string().default(""),
  payee_name: z.string().default(""),
  payment_number: z.string().default(""),
  instructions: z.string().default(""),
});

export const serviceAreaSettingsSchema = z.object({
  center_label: z.string().default("Bengaluru"),
  center_lat: z.coerce.number().min(-90).max(90).default(12.9716),
  center_lng: z.coerce.number().min(-180).max(180).default(77.5946),
  radius_km: z.coerce.number().positive().max(500).default(50),
});

export const bookingSettingsSchema = z.object({
  time_slots: z.array(timeSlotSchema).min(1).default([
    { id: "morning", label: "9 AM – 12 PM", start: "09:00", end: "12:00" },
    { id: "afternoon", label: "12 PM – 3 PM", start: "12:00", end: "15:00" },
    { id: "evening", label: "3 PM – 6 PM", start: "15:00", end: "18:00" },
  ]),
  slot_capacity: z.coerce.number().int().min(1).max(100).default(3),
  min_lead_hours: z.coerce.number().min(0).max(168).default(12),
  max_advance_days: z.coerce.number().int().min(1).max(365).default(45),
});

export const cancellationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  min_notice_hours: z.coerce.number().min(0).max(720).default(12),
  approval_required: z.boolean().default(false),
  fee_type: feeTypeSchema.default("none"),
  fee_value: z.coerce.number().min(0).default(0),
  fee_window_hours: z.coerce.number().min(0).max(720).default(24),
  refund_policy_text: z.string().default(""),
});

export const rescheduleSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  min_notice_hours: z.coerce.number().min(0).max(720).default(12),
  max_reschedules: z.coerce.number().int().min(0).max(20).default(2),
  approval_required: z.boolean().default(true),
  fee_type: feeTypeSchema.default("none"),
  fee_value: z.coerce.number().min(0).default(0),
});

export const settingsSchemas = {
  business: businessSettingsSchema,
  whatsapp: whatsappSettingsSchema,
  payment: paymentSettingsSchema,
  service_area: serviceAreaSettingsSchema,
  booking: bookingSettingsSchema,
  cancellation: cancellationSettingsSchema,
  reschedule: rescheduleSettingsSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;

export interface AppSettings {
  business: z.infer<typeof businessSettingsSchema>;
  whatsapp: z.infer<typeof whatsappSettingsSchema>;
  payment: z.infer<typeof paymentSettingsSchema>;
  service_area: z.infer<typeof serviceAreaSettingsSchema>;
  booking: z.infer<typeof bookingSettingsSchema>;
  cancellation: z.infer<typeof cancellationSettingsSchema>;
  reschedule: z.infer<typeof rescheduleSettingsSchema>;
}

export type ServiceAreaSettings = AppSettings["service_area"];
export type BookingSettings = AppSettings["booking"];
export type CancellationSettings = AppSettings["cancellation"];
export type RescheduleSettings = AppSettings["reschedule"];
export type PaymentSettings = AppSettings["payment"];

/** Parses raw rows from the settings table, falling back to defaults per key. */
export function parseSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingsKey, unknown>;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    const parsed = settingsSchemas[key].safeParse(byKey.get(key) ?? {});
    out[key] = parsed.success ? parsed.data : settingsSchemas[key].parse({});
  }
  return out as unknown as AppSettings;
}

/** WhatsApp number: admin setting wins, then the environment variable. */
export function resolveWhatsAppNumber(settings: Pick<AppSettings, "whatsapp">) {
  return settings.whatsapp.number || process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP_NUMBER || "";
}
