"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateQuote, type PricingCatalog } from "@/lib/pricing/quote";
import { todayIST } from "@/lib/booking/slots";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BhkType } from "@/types";

/** Homepage estimator: pick BHK + bathrooms and see the default package price live. */
export function QuickQuote({ catalog }: { catalog: PricingCatalog }) {
  const [bhk, setBhk] = useState<BhkType>(catalog.bhk.find((b) => b.bhk_type === "2BHK")?.bhk_type ?? catalog.bhk[0]?.bhk_type);
  const [baths, setBaths] = useState(2);
  const bhkRow = catalog.bhk.find((b) => b.bhk_type === bhk);
  const defaults = useMemo(() => catalog.services.filter((s) => s.is_default_selected).map((s) => s.id), [catalog]);

  const quote = useMemo(
    () =>
      calculateQuote(
        catalog,
        { bhkType: bhk, areaSqft: bhkRow?.typical_sqft ?? 1000, bathroomCount: baths, serviceIds: defaults },
        todayIST(),
      ),
    [catalog, bhk, baths, bhkRow, defaults],
  );

  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-lift sm:p-7">
      <p className="eyebrow">Instant estimate</p>
      <h3 className="mt-2 font-display text-2xl font-medium">What would it cost?</h3>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink-soft">Home type</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {catalog.bhk.filter((b) => b.is_active).map((b) => (
            <button
              key={b.bhk_type}
              type="button"
              aria-pressed={bhk === b.bhk_type}
              onClick={() => setBhk(b.bhk_type)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
                bhk === b.bhk_type ? "border-brand-700 bg-brand-900 text-cream" : "border-line bg-cream hover:border-brand-200",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink-soft">Bathrooms</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={baths === n}
              onClick={() => setBaths(n)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
                baths === n ? "border-brand-700 bg-brand-900 text-cream" : "border-line bg-cream hover:border-brand-200",
              )}
            >
              {n === 4 ? "4+" : n}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 rounded-2xl bg-sand-50 p-4">
        <ul className="flex flex-col gap-1.5 text-sm">
          {quote.lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-3">
              <span className="text-ink-soft">{l.displayName}</span>
              <span className="font-medium tabular-nums">{formatINR(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">
            Estimate · approx. {formatNumber(bhkRow?.typical_sqft ?? 0)} sq.ft
          </span>
          <span className="font-display text-3xl font-medium text-brand-900 tabular-nums" aria-live="polite">
            {formatINR(quote.total)}
          </span>
        </div>
      </div>

      <Button asChild size="lg" className="mt-5 w-full">
        <Link href={`/book?bhk=${bhk}&bathrooms=${baths}`}>
          Customise & book <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
