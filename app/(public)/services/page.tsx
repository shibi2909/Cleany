import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FinalCta, SectionHeading, ServiceCard } from "@/components/marketing/sections";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getPublicData } from "@/lib/data/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Deep Cleaning Services in Bangalore",
  description:
    "Home deep cleaning, kitchen, bathroom, sofa, mattress, window, balcony, chimney, fridge, washing machine and carpet cleaning across Bengaluru.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const { catalog } = await getPublicData();
  const categories = catalog ? [...new Set(catalog.services.map((s) => s.category))] : [];

  return (
    <>
      <div className="container-page py-12 sm:py-16">
        <SectionHeading
          as="h1"
          eyebrow="Services"
          title="House cleaning services for every room"
          description="Combine a whole-home deep clean with the add-ons you need. Every service is done by our trained team with professional equipment."
        />
        {catalog ? (
          <div className="mt-12 flex flex-col gap-12">
            {categories.map((cat) => (
              <section key={cat} aria-labelledby={`cat-${cat}`}>
                <h2 id={`cat-${cat}`} className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  {cat}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {catalog.services
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <ServiceCard key={s.id} service={s} catalog={catalog} />
                    ))}
                </div>
              </section>
            ))}
            <Button asChild size="lg" className="w-fit">
              <Link href="/book">
                Build your quote <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <SetupNotice className="mt-10" />
        )}
      </div>
      <FinalCta />
    </>
  );
}
