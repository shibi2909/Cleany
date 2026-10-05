import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  Check,
  HeartHandshake,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/ui/icon";
import { WhatsAppIcon } from "@/components/whatsapp/whatsapp-button";
import { Reveal } from "./reveal";
import { formatINR, formatNumber } from "@/lib/format";
import type { PricingCatalog } from "@/lib/pricing/quote";
import type { AppSettings } from "@/lib/settings/schema";
import type { Service } from "@/types";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/config/brand";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", align === "center" && "mx-auto items-center text-center")}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Tag className={cn("display", Tag === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl")}>{title}</Tag>
      {description ? <p className="text-base text-muted sm:text-lg">{description}</p> : null}
    </div>
  );
}

export const TRUST_POINTS = [
  "Transparent Pricing",
  "Professional Cleaning Team",
  "Easy WhatsApp Booking",
] as const;

export function Hero({ settings, fromPrice }: { settings: AppSettings; fromPrice: number | null }) {
  const trust = [...TRUST_POINTS, `${settings.service_area.center_label.split(" (")[0]} + ${settings.service_area.radius_km} KM Service Area`];
  return (
    <section className="relative overflow-hidden">
      <div className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
            <Sparkles className="size-3.5" aria-hidden /> Home deep cleaning · Bengaluru
          </p>
          <h1 className="display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.1rem]">
            Professional Deep Cleaning for Your <span className="italic text-brand-700">Home</span>
          </h1>
          <p className="max-w-xl text-lg text-muted">Reliable home deep cleaning services across Bengaluru.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/book">
                Get Instant Quote <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/service-area">
                <MapPin aria-hidden /> Check Service Area
              </Link>
            </Button>
          </div>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2" aria-label="Why customers trust us">
            {trust.map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
                <span className="grid size-5 place-items-center rounded-full bg-brand-900 text-cream">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-sand-100 bg-weave" aria-hidden />
          <Image
            src="/images/hero-living-room.svg"
            alt="A bright, freshly cleaned living room with a green sofa, plant and sunlit window"
            width={640}
            height={560}
            priority
            className="h-auto w-full rounded-[2.25rem] shadow-lift"
          />
          {fromPrice !== null ? (
            <div className="absolute -bottom-5 left-4 rounded-2xl border border-line bg-white px-4 py-3 shadow-lift sm:left-6">
              <p className="text-xs text-muted">Deep cleaning from</p>
              <p className="font-display text-2xl font-medium text-brand-900">{formatINR(fromPrice)}</p>
            </div>
          ) : null}
          <div className="absolute -top-4 right-4 flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold shadow-soft sm:right-6">
            <ShieldCheck className="size-4 text-brand-600" aria-hidden /> Payment verified by our team
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: BadgeIndianRupee, title: "Get an instant quote", text: "Tell us your home type, size and add-ons. See the price instantly — no hidden charges." },
  { icon: CalendarDays, title: "Pick a slot", text: "Choose a date and time that suits you. We confirm your location is inside our service area." },
  { icon: WhatsAppIcon, title: "Pay via UPI on WhatsApp", text: "Send your booking on WhatsApp. We share our official UPI details and verify your payment." },
  { icon: Sparkles, title: "Enjoy a spotless home", text: "Our trained team arrives with professional equipment and leaves your home sparkling." },
];

export function HowItWorks() {
  return (
    <section className="container-page py-16 lg:py-24" aria-labelledby="how-heading">
      <SectionHeading eyebrow="How it works" title={<span id="how-heading">Booked in minutes. Cleaned by pros.</span>} />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal
            as="li"
            key={s.title}
            delay={i * 0.06}
            className="relative flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-6 shadow-soft"
          >
            <span className="absolute right-5 top-4 font-display text-4xl text-sand-200" aria-hidden>
              {i + 1}
            </span>
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <s.icon className="size-5" />
            </span>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-muted">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export function Packages({ catalog }: { catalog: PricingCatalog }) {
  const deep = catalog.services.find((s) => s.pricing_type === "BHK_BASE");
  return (
    <section className="bg-sand-50 py-16 lg:py-24" aria-labelledby="packages-heading">
      <div className="container-page">
        <SectionHeading
          eyebrow="Popular packages"
          title={<span id="packages-heading">Deep cleaning packages by home size</span>}
          description="Whole-home deep cleaning priced by BHK. Add bathrooms, kitchen and more in the quote."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.bhk
            .filter((b) => b.is_active)
            .map((b, i) => (
              <Reveal key={b.bhk_type} delay={i * 0.05}>
                <article
                  className={cn(
                    "relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
                    b.bhk_type === "2BHK" ? "border-brand-600 ring-1 ring-brand-600" : "border-line",
                  )}
                >
                  {b.bhk_type === "2BHK" ? (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand-900 px-3 py-1 text-xs font-semibold text-cream">Most booked</span>
                  ) : null}
                  <h3 className="font-display text-3xl font-medium">{b.label}</h3>
                  <p className="mt-1 text-sm text-muted">{b.description}</p>
                  <p className="mt-5 text-xs uppercase tracking-wider text-muted">Starting at</p>
                  <p className="font-display text-4xl font-medium text-brand-900">{formatINR(b.base_price)}</p>
                  <ul className="mt-5 flex flex-col gap-2 text-sm text-ink-soft">
                    <li className="flex gap-2"><Check className="size-4 shrink-0 text-brand-600" aria-hidden /> {deep?.name ?? "Deep home cleaning"}</li>
                    <li className="flex gap-2"><Check className="size-4 shrink-0 text-brand-600" aria-hidden /> Up to ~{formatNumber(b.typical_sqft)} sq.ft</li>
                    {b.duration_label ? (
                      <li className="flex gap-2"><Timer className="size-4 shrink-0 text-brand-600" aria-hidden /> {b.duration_label}</li>
                    ) : null}
                  </ul>
                  <Button asChild variant={b.bhk_type === "2BHK" ? "primary" : "outline"} className="mt-6">
                    <Link href={`/book?bhk=${b.bhk_type}`}>Get quote</Link>
                  </Button>
                </article>
              </Reveal>
            ))}
        </div>
      </div>
    </section>
  );
}

export function priceLabel(s: Service, catalog: PricingCatalog) {
  if (s.pricing_type === "BHK_BASE") {
    const min = Math.min(...catalog.bhk.filter((b) => b.is_active).map((b) => b.base_price));
    return Number.isFinite(min) ? `from ${formatINR(min)}` : "";
  }
  if (s.pricing_type === "PER_BATHROOM") {
    const min = Math.min(...catalog.bathrooms.map((b) => b.price_per_bathroom));
    return Number.isFinite(min) ? `from ${formatINR(min)} / bathroom` : "";
  }
  return `${formatINR(s.price)}${s.unit_label ? ` · ${s.unit_label}` : ""}`;
}

export function ServiceCard({ service, catalog }: { service: Service; catalog: PricingCatalog }) {
  return (
    <article className="flex h-full gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:border-brand-200">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <ServiceIcon name={service.icon} className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold">{service.name}</h3>
        <p className="text-sm text-muted">{service.description}</p>
        <p className="mt-1 text-sm font-semibold text-brand-800">{priceLabel(service, catalog)}</p>
      </div>
    </article>
  );
}

export function ServicesGrid({ catalog, limit }: { catalog: PricingCatalog; limit?: number }) {
  const list = limit ? catalog.services.slice(0, limit) : catalog.services;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {list.map((s, i) => (
        <Reveal key={s.id} delay={Math.min(i, 6) * 0.04}>
          <ServiceCard service={s} catalog={catalog} />
        </Reveal>
      ))}
    </div>
  );
}

const WHY = [
  { icon: Users, title: "Trained, background-verified team", text: "Every cleaner is trained on our checklist and supervised on the job." },
  { icon: BadgeIndianRupee, title: "Transparent, upfront pricing", text: "The price you see is the price you pay. It's recalculated and locked when you book." },
  { icon: Leaf, title: "Safe, effective products", text: "Professional-grade, surface-appropriate cleaners that are safe for kids and pets once dry." },
  { icon: ShieldCheck, title: "Pay safely by UPI", text: "Pay only to our official UPI ID shared on WhatsApp. Our team verifies every payment." },
  { icon: CalendarDays, title: "Flexible rescheduling", text: "Plans change. Request a new slot or cancel from your dashboard, per our clear policy." },
  { icon: HeartHandshake, title: "Friendly WhatsApp support", text: "Real people on WhatsApp for bookings, payments and anything else you need." },
];

export function WhyChooseUs() {
  return (
    <section className="container-page py-16 lg:py-24" aria-labelledby="why-heading">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionHeading
          eyebrow={`Why ${BRAND.name}`}
          title={<span id="why-heading">Care you can see. Service you can trust.</span>}
          description={`We built ${BRAND.name} around the things that matter when you let someone into your home: reliability, honesty and a genuinely clean result.`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={(i % 2) * 0.05}>
              <div className="flex h-full flex-col gap-2 rounded-2xl bg-white p-5 ring-1 ring-line">
                <w.icon className="size-5 text-brand-700" aria-hidden />
                <h3 className="font-semibold">{w.title}</h3>
                <p className="text-sm text-muted">{w.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServiceAreaTeaser({ settings }: { settings: AppSettings }) {
  const area = settings.service_area;
  return (
    <section className="container-page py-16 lg:py-20" aria-labelledby="area-heading">
      <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-brand-900 p-8 text-cream sm:p-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">Service area</p>
          <h2 id="area-heading" className="display text-3xl text-cream sm:text-4xl">
            All of Bengaluru, plus {area.radius_km} km around
          </h2>
          <p className="text-brand-100/80">
            From Whitefield to Kengeri and Yelahanka to Electronic City — if you&apos;re within {area.radius_km} km of{" "}
            {area.center_label}, we&apos;ll come to you. Check your exact address on the map.
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-2 w-fit">
            <Link href="/service-area">
              <MapPin aria-hidden /> Check your location
            </Link>
          </Button>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-sm" aria-hidden>
          <div className="absolute inset-0 rounded-full border border-brand-400/40 bg-brand-800/60" />
          <div className="absolute inset-[18%] rounded-full border border-brand-400/40" />
          <div className="absolute inset-[36%] rounded-full border border-brand-400/40" />
          <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-honey ring-8 ring-honey/25" />
          {[
            [22, 30], [70, 24], [78, 62], [30, 72], [55, 82], [16, 52], [62, 40],
          ].map(([x, y]) => (
            <span key={`${x}-${y}`} className="absolute size-2.5 rounded-full bg-brand-200" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-950/70 px-3 py-1 text-xs text-brand-100">
            {area.radius_km} km radius
          </span>
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { name: "Ananya R.", area: "HSR Layout", home: "2 BHK", text: "The kitchen tiles look new again. The team was on time, polite and very thorough. Booking on WhatsApp was so easy." },
  { name: "Karthik S.", area: "Whitefield", home: "3 BHK", text: "Clear pricing before booking and no surprises after. They even cleaned the balcony grills properly." },
  { name: "Meera & Arjun", area: "Jayanagar", home: "2 BHK", text: "We booked a move-in clean. Bathrooms were spotless and the sofa shampoo made a visible difference." },
];

export function Testimonials() {
  return (
    <section className="bg-sand-50 py-16 lg:py-24" aria-labelledby="reviews-heading">
      <div className="container-page">
        <SectionHeading
          eyebrow="Reviews"
          title={<span id="reviews-heading">Homes we&apos;ve made happy</span>}
          description={
            <span className="text-sm">
              Sample testimonials for demonstration — replace with verified customer reviews before launch.
            </span>
          }
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <figure className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft">
                <div className="flex gap-0.5 text-honey" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="size-4 fill-current" aria-hidden />
                  ))}
                </div>
                <blockquote className="text-ink-soft">&ldquo;{t.text}&rdquo;</blockquote>
                <figcaption className="mt-auto text-sm">
                  <span className="font-semibold text-ink">{t.name}</span>
                  <span className="text-muted"> · {t.home}, {t.area}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="container-page py-16 lg:py-20">
      <div className="flex flex-col items-center gap-5 rounded-[2rem] border border-line bg-white px-6 py-14 text-center shadow-soft">
        <h2 className="display max-w-2xl text-3xl sm:text-5xl">A home you&apos;ll love is one quote away.</h2>
        <p className="max-w-xl text-muted">Get your price in under a minute, pick a slot, and we&apos;ll handle the rest.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/book">
              Get Instant Quote <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
