import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { BRAND } from "@/lib/config/brand";
import { createSupportWhatsAppMessage } from "@/lib/whatsapp/messages";
import type { AppSettings } from "@/lib/settings/schema";
import { resolveWhatsAppNumber } from "@/lib/settings/schema";

export function SiteFooter({ settings }: { settings: AppSettings }) {
  const whatsapp = resolveWhatsAppNumber(settings);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-brand-950 text-brand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <Logo inverted />
          <p className="max-w-xs text-sm text-brand-200/80">{BRAND.tagline}</p>
          <p className="text-sm text-brand-200/70">
            Serving {settings.service_area.center_label} and up to {settings.service_area.radius_km} km around.
          </p>
        </div>

        <nav aria-label="Company" className="flex flex-col gap-2.5 text-sm">
          <p className="mb-1 font-semibold text-cream">Company</p>
          <Link className="hover:text-cream" href="/about">About us</Link>
          <Link className="hover:text-cream" href="/how-it-works">How it works</Link>
          <Link className="hover:text-cream" href="/service-area">Service area</Link>
          <Link className="hover:text-cream" href="/contact">Contact</Link>
        </nav>

        <nav aria-label="Services" className="flex flex-col gap-2.5 text-sm">
          <p className="mb-1 font-semibold text-cream">Book</p>
          <Link className="hover:text-cream" href="/book">Get instant quote</Link>
          <Link className="hover:text-cream" href="/services">All services</Link>
          <Link className="hover:text-cream" href="/pricing">Pricing</Link>
          <Link className="hover:text-cream" href="/customer/bookings">My bookings</Link>
        </nav>

        <div className="flex flex-col gap-3 text-sm">
          <p className="mb-1 font-semibold text-cream">Talk to us</p>
          {settings.business.phone ? (
            <a className="inline-flex items-center gap-2 hover:text-cream" href={`tel:${settings.business.phone}`}>
              <Phone className="size-4" aria-hidden /> {settings.business.phone}
            </a>
          ) : null}
          {settings.business.email ? (
            <a className="inline-flex items-center gap-2 hover:text-cream" href={`mailto:${settings.business.email}`}>
              <Mail className="size-4" aria-hidden /> {settings.business.email}
            </a>
          ) : null}
          <p className="inline-flex items-center gap-2">
            <MapPin className="size-4" aria-hidden /> {settings.business.address}
          </p>
          <WhatsAppButton phone={whatsapp} message={createSupportWhatsAppMessage("general")} size="sm" className="mt-2 w-fit">
            Chat on WhatsApp
          </WhatsAppButton>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-brand-200/60 sm:flex-row sm:justify-between">
          <p>© {year} {settings.business.legal_name || BRAND.name}. All rights reserved.</p>
          <p>Payments are made directly by UPI and verified by our team. We never ask for your UPI PIN.</p>
        </div>
      </div>
    </footer>
  );
}
