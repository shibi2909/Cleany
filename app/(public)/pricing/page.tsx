import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { Packages, SectionHeading, priceLabel } from "@/components/marketing/sections";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getPublicData } from "@/lib/data/catalog";
import { formatINR } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Deep Cleaning Prices in Bangalore",
  description: "Transparent home deep cleaning prices for 1, 2, 3 and 4 BHK homes in Bengaluru, plus bathroom and add-on pricing.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const { catalog, settings } = await getPublicData();
  if (!catalog) {
    return (
      <div className="container-page py-16">
        <SectionHeading as="h1" eyebrow="Pricing" title="Simple, transparent pricing" />
        <SetupNotice className="mt-8" />
      </div>
    );
  }
  const addons = catalog.services.filter((s) => s.pricing_type === "FIXED");
  const areas = catalog.areas.filter((a) => a.is_active);
  const c = settings.cancellation;
  const r = settings.reschedule;

  return (
    <>
      <div className="container-page pt-12 sm:pt-16">
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Prices below are what you pay — no surprise charges on the day. Your exact quote is calculated and locked when you book."
        />
        {catalog.discounts.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {catalog.discounts.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-2 rounded-full bg-honey-50 px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                <Tag className="size-4" aria-hidden /> {d.name}
                {d.min_subtotal > 0 ? ` · on orders above ${formatINR(d.min_subtotal)}` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <Packages catalog={catalog} />

      <div className="container-page grid gap-6 py-16 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft" aria-labelledby="size-heading">
          <h2 id="size-heading" className="text-lg font-semibold">Home size adjustment</h2>
          <p className="mt-1 text-sm text-muted">Applied to whole-home deep cleaning for larger homes.</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-2 font-medium">Approx. size</th>
                <th scope="col" className="py-2 text-right font-medium">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {areas.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5">{a.label}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{a.surcharge > 0 ? `+ ${formatINR(a.surcharge)}` : "Included"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft" aria-labelledby="bath-heading">
          <h2 id="bath-heading" className="text-lg font-semibold">Bathroom deep cleaning</h2>
          <p className="mt-1 text-sm text-muted">Priced per bathroom.</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-2 font-medium">Bathrooms</th>
                <th scope="col" className="py-2 text-right font-medium">Per bathroom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {catalog.bathrooms.map((b) => (
                <tr key={b.bathroom_count}>
                  <td className="py-2.5">{b.label}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{formatINR(b.price_per_bathroom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft lg:col-span-2" aria-labelledby="addon-heading">
          <h2 id="addon-heading" className="text-lg font-semibold">Add-on services</h2>
          <ul className="mt-4 grid gap-x-8 divide-y divide-line text-sm sm:grid-cols-2 sm:divide-y-0">
            {addons.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 py-2.5 sm:border-b sm:border-line">
                <span>{s.name}</span>
                <span className="text-right font-medium">{priceLabel(s, catalog)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-sand-50 p-6 lg:col-span-2" aria-labelledby="policy-heading">
          <h2 id="policy-heading" className="text-lg font-semibold">Rescheduling & cancellation</h2>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
            {r.enabled ? (
              <li>
                Reschedule up to {r.min_notice_hours} hours before your slot (up to {r.max_reschedules} times)
                {r.fee_type === "none" ? " — free of charge." : "."}
              </li>
            ) : (
              <li>To reschedule, contact us on WhatsApp.</li>
            )}
            {c.enabled ? <li>Cancel from your dashboard. Cancellations within {c.min_notice_hours} hours of the slot need approval.</li> : null}
            {c.refund_policy_text ? <li>{c.refund_policy_text}</li> : null}
          </ul>
        </section>
      </div>

      <div className="container-page">
        <Button asChild size="lg">
          <Link href="/book">
            Get your exact quote <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </>
  );
}
