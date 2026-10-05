import type { Metadata } from "next";
import { Faq, FaqJsonLd } from "@/components/marketing/faq";
import { FinalCta, HowItWorks, SectionHeading } from "@/components/marketing/sections";
import { getPublicData } from "@/lib/data/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "How Home Deep Cleaning Booking Works",
  description: "Get an instant quote, pick a slot, pay securely by UPI on WhatsApp and enjoy a professionally deep-cleaned home in Bengaluru.",
  alternates: { canonical: "/how-it-works" },
};

const DETAIL = [
  { t: "1. Build your quote", d: "Pick your home type, enter the approximate size, choose bathrooms and add-ons. The price updates live as you choose." },
  { t: "2. Confirm your location", d: "Search your address or use your current location. We check it's inside our service area before you continue." },
  { t: "3. Choose a date and time", d: "Pick any available slot from tomorrow onwards. Slots that are full are clearly marked." },
  { t: "4. Book and get your booking ID", d: "Confirm your details and you'll get a booking ID instantly. Your booking starts as Requested with payment Pending." },
  { t: "5. Send it on WhatsApp", d: "Tap “Send Booking on WhatsApp”. The message is pre-filled — you just press send." },
  { t: "6. Pay by UPI", d: "We reply with our official UPI details. Pay directly and share your payment screenshot on WhatsApp or upload it in your dashboard." },
  { t: "7. We verify and confirm", d: "Our team verifies your payment and confirms your booking. Opening WhatsApp alone doesn't mark a booking as paid." },
  { t: "8. Team arrives and cleans", d: "Track progress in your dashboard: staff assigned, team on the way, cleaning, completed." },
];

export default async function HowItWorksPage() {
  const { settings } = await getPublicData();
  return (
    <>
      <div className="container-page pt-12 sm:pt-16">
        <SectionHeading
          as="h1"
          eyebrow="How it works"
          title="From quote to clean, step by step"
          description="Booking is quick, payment is simple, and you can follow every step from your dashboard."
        />
      </div>
      <HowItWorks />
      <div className="container-page grid gap-4 pb-8 md:grid-cols-2">
        {DETAIL.map((s) => (
          <div key={s.t} className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">{s.t}</h2>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>
      <section className="container-page py-16" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="display mb-6 text-3xl">Frequently asked questions</h2>
        <Faq settings={settings} />
        <FaqJsonLd settings={settings} />
      </section>
      <FinalCta />
    </>
  );
}
