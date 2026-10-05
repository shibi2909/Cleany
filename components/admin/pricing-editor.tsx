"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { saveAreaPricingAction, saveBathroomPricingAction, saveBhkPricingAction, upsertDiscountAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Switch } from "@/components/ui/form-controls";
import { formatINR } from "@/lib/format";
import type { PricingCatalog } from "@/lib/pricing/quote";
import type { AreaPricing, Discount } from "@/types";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Couldn't save");
      toast.success(res.message ?? "Saved");
      router.refresh();
    });
  return { pending, save };
}

const num = (v: string) => (v === "" ? 0 : Number(v));

export function PricingEditor({ catalog }: { catalog: PricingCatalog }) {
  return (
    <div className="flex flex-col gap-6">
      <BhkEditor catalog={catalog} />
      <div className="grid gap-6 xl:grid-cols-2">
        <AreaEditor rows={catalog.areas} />
        <BathroomEditor catalog={catalog} />
      </div>
      <DiscountEditor discounts={catalog.discounts} />
    </div>
  );
}

function BhkEditor({ catalog }: { catalog: PricingCatalog }) {
  const [rows, setRows] = useState(catalog.bhk.map((b) => ({ ...b, duration_label: b.duration_label ?? "" })));
  const { pending, save } = useSave();
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Home type (BHK) base prices</CardTitle>
        <p className="text-sm text-muted">Price for “Deep Home Cleaning” by home type. Typical sq.ft pre-fills the size step.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="hidden grid-cols-[5rem_1fr_1fr_2fr_1fr_4rem] gap-3 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Type</span>
          <span>Base price ₹</span>
          <span>Typical sq.ft</span>
          <span>Description</span>
          <span>Duration</span>
          <span>Active</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.bhk_type} className="grid grid-cols-2 gap-3 rounded-xl bg-sand-50 p-3 md:grid-cols-[5rem_1fr_1fr_2fr_1fr_4rem] md:items-center md:bg-transparent md:p-0">
            <span className="font-semibold">{r.label}</span>
            <Input aria-label={`${r.label} base price`} type="number" min={0} value={r.base_price} onChange={(e) => set(i, { base_price: num(e.target.value) })} />
            <Input aria-label={`${r.label} typical sq.ft`} type="number" min={100} value={r.typical_sqft} onChange={(e) => set(i, { typical_sqft: num(e.target.value) })} />
            <Input aria-label={`${r.label} description`} value={r.description} onChange={(e) => set(i, { description: e.target.value })} />
            <Input aria-label={`${r.label} duration`} value={r.duration_label} onChange={(e) => set(i, { duration_label: e.target.value })} />
            <Switch aria-label={`${r.label} active`} checked={r.is_active} onCheckedChange={(v) => set(i, { is_active: v })} />
          </div>
        ))}
        <Button className="mt-2 w-fit" loading={pending} onClick={() => save(() => saveBhkPricingAction(rows))}>
          Save BHK prices
        </Button>
      </CardContent>
    </Card>
  );
}

type AreaRow = Omit<AreaPricing, "id" | "sort_order"> & { id?: string; key: string };

function AreaEditor({ rows: initial }: { rows: AreaPricing[] }) {
  const [rows, setRows] = useState<AreaRow[]>(initial.map((r) => ({ ...r, key: r.id })));
  const { pending, save } = useSave();
  const set = (i: number, patch: Partial<AreaRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Home size adjustments</CardTitle>
        <p className="text-sm text-muted">Surcharge added to whole-home cleaning. Leave max empty for “and above”. Ranges must not overlap.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-2 gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center">
            <Input aria-label="Label" value={r.label} onChange={(e) => set(i, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
            <Input aria-label="Min sq.ft" type="number" min={0} value={r.min_sqft} onChange={(e) => set(i, { min_sqft: num(e.target.value) })} />
            <Input
              aria-label="Max sq.ft"
              type="number"
              min={0}
              placeholder="∞"
              value={r.max_sqft ?? ""}
              onChange={(e) => set(i, { max_sqft: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Input aria-label="Surcharge ₹" type="number" min={0} value={r.surcharge} onChange={(e) => set(i, { surcharge: num(e.target.value) })} />
            <Switch aria-label={`${r.label} active`} checked={r.is_active} onCheckedChange={(v) => set(i, { is_active: v })} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setRows((r) => [...r, { key: crypto.randomUUID(), label: "New range", min_sqft: 0, max_sqft: null, surcharge: 0, is_active: false }])}
          >
            <Plus aria-hidden /> Add range
          </Button>
          <Button loading={pending} onClick={() => save(() => saveAreaPricingAction(rows.map(({ key: _k, ...r }) => r)))}>
            Save size pricing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BathroomEditor({ catalog }: { catalog: PricingCatalog }) {
  const [rows, setRows] = useState(catalog.bathrooms);
  const { pending, save } = useSave();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bathroom pricing</CardTitle>
        <p className="text-sm text-muted">Price per bathroom for “Bathroom Deep Cleaning”, by number of bathrooms.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.bathroom_count} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
            <span className="font-medium">{r.label}</span>
            <Input
              aria-label={`${r.label} price per bathroom`}
              type="number"
              min={0}
              value={r.price_per_bathroom}
              onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, price_per_bathroom: num(e.target.value) } : y)))}
            />
            <span className="w-24 text-right text-sm text-muted">= {formatINR(r.price_per_bathroom * r.bathroom_count)}</span>
          </div>
        ))}
        <Button className="w-fit" loading={pending} onClick={() => save(() => saveBathroomPricingAction(rows))}>
          Save bathroom prices
        </Button>
      </CardContent>
    </Card>
  );
}

type DiscountDraft = Omit<Discount, "id"> & { id?: string };
const NEW_DISCOUNT: DiscountDraft = {
  name: "",
  description: "",
  discount_type: "PERCENTAGE",
  value: 10,
  min_subtotal: 0,
  max_discount: null,
  starts_on: null,
  ends_on: null,
  is_active: true,
};

function DiscountEditor({ discounts }: { discounts: Discount[] }) {
  const [draft, setDraft] = useState<DiscountDraft | null>(null);
  const { pending, save } = useSave();
  const set = <K extends keyof DiscountDraft>(k: K, v: DiscountDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discounts</CardTitle>
        <p className="text-sm text-muted">Active discounts apply automatically. When several qualify, the customer gets the largest one.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {discounts.length === 0 ? <p className="text-sm text-muted">No discounts yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {discounts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-50 p-3 text-sm">
              <span>
                <span className="font-semibold">{d.name}</span> ·{" "}
                {d.discount_type === "PERCENTAGE" ? `${d.value}%` : formatINR(d.value)}
                {d.min_subtotal ? ` on ${formatINR(d.min_subtotal)}+` : ""}
                {d.max_discount ? ` (max ${formatINR(d.max_discount)})` : ""}
                {d.starts_on || d.ends_on ? ` · ${d.starts_on ?? "…"} → ${d.ends_on ?? "…"}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Inactive"}</Badge>
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...d })}>
                  Edit
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {draft ? (
          <div className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input aria-label="Name" placeholder="Name (e.g. Festive offer)" value={draft.name} onChange={(e) => set("name", e.target.value)} className="sm:col-span-2" />
            <Select aria-label="Type" value={draft.discount_type} onChange={(e) => set("discount_type", e.target.value as DiscountDraft["discount_type"])}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed ₹</option>
            </Select>
            <Input aria-label="Value" type="number" min={1} value={draft.value} onChange={(e) => set("value", num(e.target.value))} />
            <Input aria-label="Minimum order ₹" type="number" min={0} placeholder="Min order ₹" value={draft.min_subtotal} onChange={(e) => set("min_subtotal", num(e.target.value))} />
            <Input
              aria-label="Maximum discount ₹"
              type="number"
              min={0}
              placeholder="Max discount ₹ (optional)"
              value={draft.max_discount ?? ""}
              onChange={(e) => set("max_discount", e.target.value === "" ? null : Number(e.target.value))}
            />
            <Input aria-label="Starts on" type="date" value={draft.starts_on ?? ""} onChange={(e) => set("starts_on", e.target.value || null)} />
            <Input aria-label="Ends on" type="date" value={draft.ends_on ?? ""} onChange={(e) => set("ends_on", e.target.value || null)} />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.is_active} onCheckedChange={(v) => set("is_active", v)} /> Active
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button loading={pending} onClick={() => save(async () => {
                const res = await upsertDiscountAction(draft);
                if (res.ok) setDraft(null);
                return res;
              })}>
                Save discount
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-fit" onClick={() => setDraft({ ...NEW_DISCOUNT })}>
            <Plus aria-hidden /> Add discount
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
