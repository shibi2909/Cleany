"use client";

import { Building, Building2, Check, Home, House } from "lucide-react";
import { ServiceIcon } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/form-controls";
import { findAreaRange, type PricingCatalog } from "@/lib/pricing/quote";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BhkType, Service } from "@/types";

const BHK_ICONS = { "1BHK": Home, "2BHK": House, "3BHK": Building, "4BHK": Building2 } as const;

export function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="display text-2xl sm:text-3xl">{title}</h2>
      {description ? <p className="mt-1.5 text-muted">{description}</p> : null}
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  children,
  className,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex rounded-2xl border bg-white text-left transition hover:border-brand-300 hover:shadow-soft",
        selected ? "border-brand-700 ring-2 ring-brand-700/15" : "border-line",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-brand-900 text-cream">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function HomeTypeStep({ catalog, value, onChange }: { catalog: PricingCatalog; value: BhkType | null; onChange: (v: BhkType) => void }) {
  return (
    <>
      <StepHeading title="What type of home do you have?" description="Choose the closest match. You can fine-tune the size next." />
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Home type">
        {catalog.bhk
          .filter((b) => b.is_active)
          .map((b) => {
            const Icon = BHK_ICONS[b.bhk_type];
            return (
              <SelectCard key={b.bhk_type} selected={value === b.bhk_type} onClick={() => onChange(b.bhk_type)} className="flex-col gap-3 p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-2xl font-medium">{b.label}</span>
                <span className="text-sm text-muted">
                  from <span className="font-semibold text-ink">{formatINR(b.base_price)}</span>
                </span>
              </SelectCard>
            );
          })}
      </div>
    </>
  );
}

export function HomeSizeStep({
  catalog,
  mode,
  sqft,
  rangeId,
  onChange,
}: {
  catalog: PricingCatalog;
  mode: "exact" | "range";
  sqft: number | null;
  rangeId: string | null;
  onChange: (v: { mode: "exact" | "range"; sqft: number | null; rangeId: string | null }) => void;
}) {
  const areas = catalog.areas.filter((a) => a.is_active);
  const detected = mode === "exact" && sqft ? findAreaRange(catalog.areas, sqft) : null;
  const tooSmall = mode === "exact" && sqft !== null && sqft > 0 && sqft < 150;
  return (
    <>
      <StepHeading title="What is the approximate size of your home?" description="Carpet or built-up area is fine — an estimate is okay." />
      {mode === "exact" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="sqft">Home size</Label>
          <div className="flex max-w-xs items-center gap-3">
            <Input
              id="sqft"
              type="number"
              inputMode="numeric"
              min={150}
              max={20000}
              step={10}
              value={sqft ?? ""}
              onChange={(e) => onChange({ mode, sqft: e.target.value ? Number(e.target.value) : null, rangeId: null })}
              className="h-14 text-2xl font-semibold"
              aria-describedby="sqft-hint"
              aria-invalid={tooSmall || undefined}
            />
            <span className="text-lg font-medium text-muted">sq.ft</span>
          </div>
          <p id="sqft-hint" className={cn("text-sm", tooSmall ? "text-red-700" : "text-muted")}>
            {tooSmall ? "That looks too small — please check the number." : detected ? `Falls in ${detected.label}` : "Typical 2 BHK homes are 1,000–1,300 sq.ft"}
          </p>
          <button
            type="button"
            onClick={() => onChange({ mode: "range", sqft: null, rangeId: null })}
            className="mt-2 w-fit text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            I don&apos;t know my exact area
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink-soft">Pick the closest range</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Home size range">
            {areas.map((a) => (
              <SelectCard key={a.id} selected={rangeId === a.id} onClick={() => onChange({ mode, sqft: null, rangeId: a.id })} className="items-center justify-between p-4 pr-12">
                <span className="font-semibold">{a.label}</span>
                {a.surcharge > 0 ? <span className="text-sm text-muted">+{formatINR(a.surcharge)}</span> : null}
              </SelectCard>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ mode: "exact", sqft: null, rangeId: null })}
            className="mt-2 w-fit text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            I know my exact area
          </button>
        </div>
      )}
    </>
  );
}

export function BathroomStep({ catalog, value, onChange }: { catalog: PricingCatalog; value: number | null; onChange: (v: number) => void }) {
  return (
    <>
      <StepHeading title="How many bathrooms?" description="Bathroom deep cleaning is priced per bathroom." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Bathrooms">
        {[1, 2, 3, 4].map((n) => {
          const price = catalog.bathrooms.find((b) => b.bathroom_count === n)?.price_per_bathroom;
          return (
            <SelectCard key={n} selected={value === n} onClick={() => onChange(n)} className="flex-col items-center gap-1 px-4 py-6" label={`${n === 4 ? "4 or more" : n} bathrooms`}>
              <span className="font-display text-4xl font-medium">{n === 4 ? "4+" : n}</span>
              <span className="text-xs text-muted">{price ? `${formatINR(price)} each` : "bathroom"}</span>
            </SelectCard>
          );
        })}
      </div>
    </>
  );
}

function servicePrice(s: Service, catalog: PricingCatalog, bhk: BhkType | null, baths: number | null) {
  if (s.pricing_type === "BHK_BASE") {
    const row = catalog.bhk.find((b) => b.bhk_type === bhk);
    return row ? formatINR(row.base_price) : "";
  }
  if (s.pricing_type === "PER_BATHROOM") {
    const n = Math.min(baths ?? 1, 4);
    const unit = catalog.bathrooms.find((b) => b.bathroom_count === n)?.price_per_bathroom ?? 0;
    return `${formatINR(unit)} × ${n}`;
  }
  return formatINR(s.price);
}

export function ServicesStep({
  catalog,
  bhk,
  bathrooms,
  value,
  onChange,
}: {
  catalog: PricingCatalog;
  bhk: BhkType | null;
  bathrooms: number | null;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <>
      <StepHeading title="Choose your services" description="Deep home and bathroom cleaning are recommended. Add anything else you need." />
      <ul className="flex flex-col gap-3">
        {catalog.services.map((s) => {
          const on = value.includes(s.id);
          return (
            <li key={s.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-2xl border bg-white p-4 transition hover:border-brand-300",
                  on ? "border-brand-700 ring-2 ring-brand-700/15" : "border-line",
                )}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <ServiceIcon name={s.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.name}
                    {s.is_default_selected ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.7rem] font-semibold text-brand-700">Recommended</span>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted">{s.description}</span>
                  <span className="mt-1 text-sm font-semibold text-ink">{servicePrice(s, catalog, bhk, bathrooms)}</span>
                </span>
                <span className="relative mt-1 inline-flex">
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(s.id)} />
                  <span
                    aria-hidden
                    className="h-6 w-11 rounded-full bg-sand-300 transition peer-checked:bg-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600"
                  />
                  <span aria-hidden className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {value.length === 0 ? <p className="mt-3 text-sm text-red-700">Select at least one service to continue.</p> : null}
    </>
  );
}
