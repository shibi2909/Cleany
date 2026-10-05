import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/marketing/sections";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { getPublicData } from "@/lib/data/catalog";
import { resolveWhatsAppNumber } from "@/lib/settings/schema";
import { createSupportWhatsAppMessage } from "@/lib/whatsapp/messages";
import { BRAND } from "@/lib/config/brand";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${BRAND.name} for home deep cleaning in Bengaluru. Chat with us on WhatsApp for bookings, payments and support.`,
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const { settings } = await getPublicData();
  const wa = resolveWhatsAppNumber(settings);
  const b = settings.business;
  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Contact"
        title="We're a message away"
        description="WhatsApp is the fastest way to reach us for bookings, payments, rescheduling and support."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5 rounded-3xl bg-brand-900 p-8 text-cream">
          <h2 className="font-display text-3xl font-medium text-cream">Chat on WhatsApp</h2>
          <p className="text-brand-100/80">Support hours: {settings.whatsapp.support_hours}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton phone={wa} message={createSupportWhatsAppMessage("general")} size="lg">
              Contact Support
            </WhatsAppButton>
            <WhatsAppButton phone={wa} message={createSupportWhatsAppMessage("booking")} size="lg" variant="secondary">
              Help with a booking
            </WhatsAppButton>
          </div>
          {!wa ? <p className="text-sm text-amber-200">WhatsApp number not configured yet (Admin → Settings).</p> : null}
        </div>
        <ul className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-8 shadow-soft">
          {b.phone ? (
            <li className="flex items-center gap-3">
              <Phone className="size-5 text-brand-700" aria-hidden />
              <a href={`tel:${b.phone}`} className="font-medium hover:underline">{b.phone}</a>
            </li>
          ) : null}
          {b.email ? (
            <li className="flex items-center gap-3">
              <Mail className="size-5 text-brand-700" aria-hidden />
              <a href={`mailto:${b.email}`} className="font-medium hover:underline">{b.email}</a>
            </li>
          ) : null}
          <li className="flex items-center gap-3">
            <MapPin className="size-5 text-brand-700" aria-hidden />
            <span>{b.address}</span>
          </li>
          <li className="flex items-center gap-3">
            <Clock className="size-5 text-brand-700" aria-hidden />
            <span>{b.hours}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
