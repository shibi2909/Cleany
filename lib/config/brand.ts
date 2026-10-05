/**
 * Central brand configuration. Change the name, tagline or colours here and the
 * whole site, emails and WhatsApp messages follow. Colour tokens live in
 * app/globals.css (`--color-brand-*`).
 */
export const BRAND = {
  name: "Cleany",
  /** Logo wordmark: first part bold, second part italic accent. */
  wordmark: ["Clean", "y"] as const,
  tagline: "Professional cleaning. A home you'll love.",
  city: "Bengaluru",
  cityAlt: "Bangalore",
  bookingPrefix: "CLN",
  description:
    "Professional home deep cleaning services across Bengaluru. Transparent pricing, trained cleaning teams and easy WhatsApp booking.",
} as const;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
