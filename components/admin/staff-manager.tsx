"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { upsertStaffAction } from "@/app/actions/admin";
import { TableShell, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import type { Staff } from "@/types";

type Draft = Pick<Staff, "full_name" | "phone" | "status" | "service_area" | "is_active"> & { id?: string; notes: string };
const EMPTY: Draft = { full_name: "", phone: "", status: "AVAILABLE", service_area: "", is_active: true, notes: "" };
const STATUS_TONE = { AVAILABLE: "success", ON_JOB: "info", ON_LEAVE: "neutral" } as const;

export function StaffManager({ staff, jobs }: { staff: Staff[]; jobs: Record<string, number> }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function save(d: Draft) {
    start(async () => {
      const res = await upsertStaffAction(d);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message ?? "Saved");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setErrors({});
            setDraft({ ...EMPTY });
          }}
        >
          <Plus aria-hidden /> Add staff
        </Button>
      </div>
      {staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet." description="Add your cleaning team to assign them to bookings." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Service area</Th>
              <Th>Status</Th>
              <Th className="text-right">Upcoming jobs</Th>
              <Th>Active</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.is_active ? "" : "opacity-60"}>
                <Td>
                  <span className="font-medium">{s.full_name}</span>
                  {s.is_demo ? <span className="ml-1 rounded bg-sand-100 px-1 text-[0.65rem] text-muted">DEMO</span> : null}
                  {s.notes ? <span className="block max-w-56 truncate text-xs text-muted">{s.notes}</span> : null}
                </Td>
                <Td>
                  <a href={`tel:${s.phone}`} className="hover:underline">
                    {s.phone}
                  </a>
                </Td>
                <Td>{s.service_area || "—"}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ").toLowerCase()}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{jobs[s.id] ?? 0}</Td>
                <Td>
                  <Switch
                    checked={s.is_active}
                    disabled={pending}
                    aria-label={`${s.full_name} active`}
                    onCheckedChange={(v) => save({ ...s, notes: s.notes ?? "", is_active: v })}
                  />
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setErrors({});
                      setDraft({ ...s, notes: s.notes ?? "" });
                    }}
                  >
                    <Pencil aria-hidden /> Edit
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit staff member" : "Add staff member"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4">
              <Field label="Full name" htmlFor="st-name" error={errors.full_name?.[0]} required>
                <Input id="st-name" value={draft.full_name} onChange={(e) => set("full_name", e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="st-phone" error={errors.phone?.[0]} required>
                <Input id="st-phone" type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Service area" htmlFor="st-area" hint="e.g. East Bengaluru, Whitefield">
                <Input id="st-area" value={draft.service_area} onChange={(e) => set("service_area", e.target.value)} />
              </Field>
              <Field label="Status" htmlFor="st-status">
                <Select id="st-status" value={draft.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
                  <option value="AVAILABLE">Available</option>
                  <option value="ON_JOB">On a job</option>
                  <option value="ON_LEAVE">On leave</option>
                </Select>
              </Field>
              <Field label="Notes" htmlFor="st-notes">
                <Textarea id="st-notes" rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={draft.is_active} onCheckedChange={(v) => set("is_active", v)} /> Active
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={() => draft && save(draft)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
