import type { Metadata } from "next";
import { FinalCta, SectionHeading, WhyChooseUs } from "@/components/marketing/sections";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = {
  title: "About Us",
  description: `${BRAND.name} is a Bengaluru home deep cleaning company built on transparent pricing, trained teams and friendly WhatsApp support.`,
  alternates: { canonical: "/about" },
};

const VALUES = [
  { t: "Honest pricing", d: "Clear quotes before you book, calculated by our system and locked at booking. No upselling at your door." },
  { t: "Respect for your home", d: "Our teams arrive on time, work carefully around your belongings and leave nothing behind but a clean home." },
  { t: "Accountability", d: "Every booking has a full history — from payment verification to completion — so nothing gets lost." },
];

export default function AboutPage() {
  return (
    <>
      <div className="container-page py-12 sm:py-16">
        <SectionHeading
          as="h1"
          eyebrow={`About ${BRAND.name}`}
          title="We make deep cleaning simple, honest and dependable."
          description={`${BRAND.name} started with a simple idea: booking a home deep clean in Bengaluru should be as easy as sending a message — with a price you can trust and a team you're glad to let in.`}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.t} className="rounded-3xl bg-sand-50 p-6">
              <h2 className="font-display text-2xl font-medium">{v.t}</h2>
              <p className="mt-2 text-muted">{v.d}</p>
            </div>
          ))}
        </div>
      </div>
      <WhyChooseUs />
      <FinalCta />
    </>
  );
}
