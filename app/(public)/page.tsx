import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Faq, FaqJsonLd } from "@/components/marketing/faq";
import { QuickQuote } from "@/components/marketing/quick-quote";
import {
  FinalCta,
  Hero,
  HowItWorks,
  Packages,
  SectionHeading,
  ServiceAreaTeaser,
  ServicesGrid,
  Testimonials,
  WhyChooseUs,
} from "@/components/marketing/sections";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { BRAND, SITE_URL } from "@/lib/config/brand";
import { getPublicData } from "@/lib/data/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `Home Deep Cleaning Service in Bangalore | ${BRAND.name}` },
  description:
    "Professional home deep cleaning in Bengaluru. Instant quotes for 1–4 BHK homes, kitchen, bathroom and sofa cleaning. Easy WhatsApp booking, transparent pricing.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const { settings, catalog } = await getPublicData();
  const fromPrice = catalog ? Math.min(...catalog.bhk.filter((b) => b.is_active).map((b) => b.base_price)) : null;

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "HouseCleaningService",
    name: BRAND.name,
    description: BRAND.description,
    url: SITE_URL,
    areaServed: { "@type": "City", name: "Bengaluru" },
    address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" },
    ...(settings.business.phone ? { telephone: settings.business.phone } : {}),
    priceRange: "₹₹",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness).replace(/</g, "\\u003c") }} />
      <Hero settings={settings} fromPrice={Number.isFinite(fromPrice) ? fromPrice : null} />
      <HowItWorks />

      {catalog ? (
        <>
          <Packages catalog={catalog} />
          <section className="container-page py-16 lg:py-24" aria-labelledby="services-heading">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <SectionHeading
                eyebrow="Services"
                title={<span id="services-heading">Deep cleaning for every corner</span>}
                description="Book a whole-home clean or just the rooms that need it most."
              />
              <Button asChild variant="outline" className="w-fit">
                <Link href="/services">
                  All services <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="mt-10">
              <ServicesGrid catalog={catalog} limit={6} />
            </div>
          </section>
          <section className="bg-brand-50/60 py-16 lg:py-24" aria-labelledby="quote-heading">
            <div className="container-page grid items-center gap-10 lg:grid-cols-2">
              <SectionHeading
                eyebrow="Instant quote"
                title={<span id="quote-heading">Know your price before you book</span>}
                description="Choose your home type and bathrooms to see an instant estimate. Add kitchen, sofa, balcony and more in the full quote."
              />
              <QuickQuote catalog={catalog} />
            </div>
          </section>
        </>
      ) : (
        <SetupNotice className="container-page py-10" />
      )}

      <WhyChooseUs />
      <ServiceAreaTeaser settings={settings} />
      <Testimonials />

      <section className="container-page py-16 lg:py-24" aria-labelledby="faq-heading">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading eyebrow="FAQ" title={<span id="faq-heading">Questions, answered</span>} />
          <Faq settings={settings} />
        </div>
        <FaqJsonLd settings={settings} />
      </section>

      <FinalCta />
    </>
  );
}
