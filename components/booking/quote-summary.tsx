"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ShieldCheck } from "lucide-react";
import type { Quote } from "@/lib/pricing/quote";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface QuoteContext {
  bhkLabel: string | null;
  sqftLabel: string | null;
  bathrooms: number | null;
}

function Lines({ quote }: { quote: Quote }) {
  if (quote.lines.length === 0) return <p className="text-sm text-muted">Choose your home type and services to see your price.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {quote.lines.map((l) => (
        <li key={l.key} className="flex justify-between gap-3">
          <span className="text-ink-soft">{l.displayName}</span>
          <span className="font-medium tabular-nums">{formatINR(l.total)}</span>
        </li>
      ))}
      {quote.discount > 0 ? (
        <li className="flex justify-between gap-3 text-brand-700">
          <span>{quote.discountLabel ?? "Discount"}</span>
          <span className="font-medium tabular-nums">− {formatINR(quote.discount)}</span>
        </li>
      ) : null}
    </ul>
  );
}

export function QuoteSummaryCard({ quote, ctx }: { quote: Quote; ctx: QuoteContext }) {
  return (
    <aside aria-label="Your estimated quote" className="rounded-3xl border border-line bg-white p-6 shadow-soft">
      <p className="eyebrow">Your estimated quote</p>
      <dl className="mt-3 flex flex-col gap-0.5 text-sm text-ink-soft">
        {ctx.bhkLabel ? <dd className="font-display text-2xl font-medium text-ink">{ctx.bhkLabel}</dd> : null}
        {ctx.sqftLabel ? <dd>{ctx.sqftLabel}</dd> : null}
        {ctx.bathrooms ? <dd>{ctx.bathrooms >= 4 ? "4+" : ctx.bathrooms} Bathroom{ctx.bathrooms > 1 ? "s" : ""}</dd> : null}
      </dl>
      <div className="my-4 border-t border-dashed border-line" />
      <Lines quote={quote} />
      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
        <span className="text-sm font-semibold">Estimated Total</span>
        <span className="font-display text-3xl font-medium text-brand-900 tabular-nums" aria-live="polite">
          {formatINR(quote.total)}
        </span>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
        Final price is recalculated and locked when you confirm. Pay by UPI after booking — nothing is charged now.
      </p>
    </aside>
  );
}

/** Mobile: sticky bar with total + primary action, expandable breakdown. */
export function MobileQuoteBar({
  quote,
  ctx,
  action,
}: {
  quote: Quote;
  ctx: QuoteContext;
  action: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(15_59_46/0.18)] backdrop-blur-md lg:hidden">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-quote-details"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[45dvh] overflow-y-auto px-4 pb-2 pt-4">
              <p className="mb-2 text-sm font-semibold">
                {[ctx.bhkLabel, ctx.sqftLabel, ctx.bathrooms ? `${ctx.bathrooms >= 4 ? "4+" : ctx.bathrooms} bath` : null].filter(Boolean).join(" · ")}
              </p>
              <Lines quote={quote} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-quote-details"
          className="flex min-w-0 flex-1 flex-col items-start"
        >
          <span className="flex items-center gap-1 text-xs text-muted">
            Estimated total <ChevronUp className={cn("size-3.5 transition-transform", !open && "rotate-180")} aria-hidden />
          </span>
          <span className="font-display text-2xl font-medium text-brand-900 tabular-nums">{formatINR(quote.total)}</span>
        </button>
        {action}
      </div>
    </div>
  );
}

export function sqftLabelFor(sqft: number | null, approximate: boolean, rangeLabel: string | null) {
  if (approximate && rangeLabel) return `${rangeLabel} (approx.)`;
  return sqft ? `${formatNumber(sqft)} sq.ft` : null;
}
