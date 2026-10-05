"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { setServiceActiveAction, uploadServiceImageAction, upsertServiceAction } from "@/app/actions/admin";
import { TableShell, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import { SERVICE_ICON_NAMES, ServiceIcon } from "@/components/ui/icon";
import { formatINR } from "@/lib/format";
import type { Service } from "@/types";

type Draft = Omit<Service, "id" | "image_url" | "duration_minutes" | "unit_label"> & {
  id?: string;
  unit_label: string;
  duration_minutes: number | "";
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  description: "",
  category: "Home",
  icon: "Sparkles",
  pricing_type: "FIXED",
  price: 0,
  unit_label: "",
  duration_minutes: "",
  is_active: true,
  is_default_selected: false,
  is_popular: false,
  sort_order: 50,
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function ServicesManager({ services }: { services: Service[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  function open(s?: Service) {
    setErrors({});
    setEditing(
      s
        ? { ...s, unit_label: s.unit_label ?? "", duration_minutes: s.duration_minutes ?? "" }
        : { ...EMPTY, sort_order: (services.at(-1)?.sort_order ?? 0) + 1 },
    );
  }

  function save() {
    if (!editing) return;
    start(async () => {
      const res = await upsertServiceAction({ ...editing, duration_minutes: editing.duration_minutes === "" ? undefined : editing.duration_minutes });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Saved");
      setEditing(null);
      router.refresh();
    });
  }

  function toggle(s: Service) {
    start(async () => {
      const res = await setServiceActiveAction(s.id, !s.is_active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Updated");
      router.refresh();
    });
  }

  function upload(s: Service, file: File) {
    const fd = new FormData();
    fd.set("serviceId", s.id);
    fd.set("file", file);
    start(async () => {
      const res = await uploadServiceImageAction(fd);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Uploaded");
      router.refresh();
    });
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((d) => (d ? { ...d, [k]: v } : d));
  const err = (k: string) => errors[k]?.[0];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open()}>
          <Plus aria-hidden /> Add service
        </Button>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th>Service</Th>
            <Th>Category</Th>
            <Th>Pricing</Th>
            <Th className="text-right">Price</Th>
            <Th>Flags</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className={s.is_active ? "" : "opacity-60"}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <ServiceIcon name={s.icon} className="size-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block max-w-72 truncate text-xs text-muted">{s.description}</span>
                  </span>
                </div>
              </Td>
              <Td>{s.category}</Td>
              <Td className="text-xs">{s.pricing_type === "BHK_BASE" ? "By BHK" : s.pricing_type === "PER_BATHROOM" ? "Per bathroom" : "Fixed"}</Td>
              <Td className="text-right tabular-nums">{s.pricing_type === "FIXED" ? formatINR(s.price) : <span className="text-xs text-muted">see Pricing</span>}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {s.is_default_selected ? <Badge tone="info" dot={false}>Default</Badge> : null}
                  {s.is_popular ? <Badge tone="neutral" dot={false}>Popular</Badge> : null}
                  {s.image_url ? <Badge tone="neutral" dot={false}>Image</Badge> : null}
                </div>
              </Td>
              <Td>
                <label className="inline-flex items-center gap-2 text-xs">
                  <Switch checked={s.is_active} onCheckedChange={() => toggle(s)} disabled={pending} aria-label={`${s.name} active`} />
                  {s.is_active ? "Active" : "Inactive"}
                </label>
              </Td>
              <Td>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => open(s)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-sand-100">
                    <ImageUp className="size-4" aria-hidden /> Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(s, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit service" : "Add service"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="s-name" error={err("name")} required>
                <Input
                  id="s-name"
                  value={editing.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!editing.id) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="Slug" htmlFor="s-slug" error={err("slug")} required>
                <Input id="s-slug" value={editing.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
              </Field>
              <Field label="Description" htmlFor="s-desc" error={err("description")} className="sm:col-span-2">
                <Textarea id="s-desc" rows={3} value={editing.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Category" htmlFor="s-cat" error={err("category")} required>
                <Input id="s-cat" list="service-categories" value={editing.category} onChange={(e) => set("category", e.target.value)} />
                <datalist id="service-categories">
                  {["Home", "Kitchen", "Bathroom", "Furniture", "Appliances", "Outdoor"].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Icon" htmlFor="s-icon">
                <Select id="s-icon" value={editing.icon} onChange={(e) => set("icon", e.target.value)}>
                  {SERVICE_ICON_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Pricing type" htmlFor="s-ptype" hint="By BHK and per-bathroom prices are set on the Pricing page.">
                <Select id="s-ptype" value={editing.pricing_type} onChange={(e) => set("pricing_type", e.target.value as Draft["pricing_type"])}>
                  <option value="FIXED">Fixed price</option>
                  <option value="BHK_BASE">By BHK (whole home)</option>
                  <option value="PER_BATHROOM">Per bathroom</option>
                </Select>
              </Field>
              <Field label="Price (₹)" htmlFor="s-price" error={err("price")}>
                <Input
                  id="s-price"
                  type="number"
                  min={0}
                  value={editing.price}
                  disabled={editing.pricing_type !== "FIXED"}
                  onChange={(e) => set("price", Number(e.target.value))}
                />
              </Field>
              <Field label="Unit label" htmlFor="s-unit" hint="e.g. per sofa, up to 5 seats">
                <Input id="s-unit" value={editing.unit_label} onChange={(e) => set("unit_label", e.target.value)} />
              </Field>
              <Field label="Sort order" htmlFor="s-sort">
                <Input id="s-sort" type="number" min={0} value={editing.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
              </Field>
              <div className="flex flex-col gap-3 sm:col-span-2">
                {(
                  [
                    ["is_active", "Active (visible to customers)"],
                    ["is_default_selected", "Pre-selected in the quote"],
                    ["is_popular", "Mark as popular"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-3 text-sm">
                    <Switch checked={editing[k]} onCheckedChange={(v) => set(k, v)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={pending}>
              Save service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
