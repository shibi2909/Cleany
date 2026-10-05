import { ChevronDown } from "lucide-react";
import type { AppSettings } from "@/lib/settings/schema";

export function getFaqs(settings: AppSettings) {
  const c = settings.cancellation;
  const r = settings.reschedule;
  return [
    {
      q: "What is included in a deep home cleaning?",
      a: "Every room is cleaned top to bottom: dusting of reachable surfaces and fans, cobweb removal, switchboards, doors and handles, window sills, floor scrubbing and mopping. Bathrooms and kitchen get specialised deep cleaning when you add them to your quote.",
    },
    {
      q: "How is the price calculated?",
      a: "Your quote is based on home type (BHK), approximate size, number of bathrooms and the services you add. You see the full breakdown before booking, and our system recalculates and locks the price when you confirm.",
    },
    {
      q: "How do I pay?",
      a: "After booking, send your booking to us on WhatsApp. We reply with our official UPI details. Pay directly by UPI and share the screenshot or reference on WhatsApp (or upload it in your dashboard). Your booking is confirmed once our team verifies the payment.",
    },
    {
      q: "Do I need to be at home during the cleaning?",
      a: "We recommend that someone is present at the start to walk the team through the home and at the end to review the work.",
    },
    {
      q: "Can I reschedule or cancel?",
      a: `Yes. ${r.enabled ? `You can request a new slot up to ${r.min_notice_hours} hours before your service${r.approval_required ? ", subject to confirmation from our team" : ""}.` : "Please contact us on WhatsApp to reschedule."} ${c.enabled ? `Cancellations can be made from your dashboard; cancellations within ${c.min_notice_hours} hours of the slot need approval.` : ""} ${c.refund_policy_text}`.trim(),
    },
    {
      q: "Which areas do you serve?",
      a: `We serve ${settings.service_area.center_label} and everywhere within ${settings.service_area.radius_km} km. You can check your exact address on our service area page.`,
    },
    {
      q: "Do you bring your own equipment and supplies?",
      a: "Yes. Our team brings professional equipment and cleaning products. We only need access to water and electricity.",
    },
  ];
}

export function Faq({ settings }: { settings: AppSettings }) {
  const faqs = getFaqs(settings);
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
      {faqs.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-semibold text-ink transition hover:bg-sand-50 sm:px-6 [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="px-5 pb-5 text-muted sm:px-6">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** FAQPage structured data for search engines. */
export function FaqJsonLd({ settings }: { settings: AppSettings }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getFaqs(settings).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
