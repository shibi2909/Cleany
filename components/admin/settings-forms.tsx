"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/actions/admin";
import { MapView } from "@/components/maps/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import type { AppSettings, SettingsKey } from "@/lib/settings/schema";

function useSettingsSave<K extends SettingsKey>(key: K, initial: AppSettings[K]) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const set = <F extends keyof AppSettings[K]>(field: F, v: AppSettings[K][F]) => setValue((s) => ({ ...s, [field]: v }));
  const save = () =>
    start(async () => {
      const res = await updateSettingsAction(key, value);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Saved");
      router.refresh();
    });
  return { value, set, setValue, save, pending };
}

function Section({ title, description, children, onSave, pending }: { title: string; description?: string; children: React.ReactNode; onSave: () => void; pending: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        <Button className="mt-5" onClick={onSave} loading={pending}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

const n = (v: string) => (v === "" ? 0 : Number(v));

export function BusinessSettingsForm({ initial }: { initial: AppSettings["business"] }) {
  const s = useSettingsSave("business", initial);
  return (
    <Section title="Business" description="Shown in the footer, contact page and messages." onSave={s.save} pending={s.pending}>
      <Field label="Display name" htmlFor="b-name">
        <Input id="b-name" value={s.value.name} onChange={(e) => s.set("name", e.target.value)} />
      </Field>
      <Field label="Legal name" htmlFor="b-legal">
        <Input id="b-legal" value={s.value.legal_name} onChange={(e) => s.set("legal_name", e.target.value)} />
      </Field>
      <Field label="Phone" htmlFor="b-phone">
        <Input id="b-phone" value={s.value.phone} onChange={(e) => s.set("phone", e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="b-email">
        <Input id="b-email" type="email" value={s.value.email} onChange={(e) => s.set("email", e.target.value)} />
      </Field>
      <Field label="Address" htmlFor="b-address">
        <Input id="b-address" value={s.value.address} onChange={(e) => s.set("address", e.target.value)} />
      </Field>
      <Field label="Working hours" htmlFor="b-hours">
        <Input id="b-hours" value={s.value.hours} onChange={(e) => s.set("hours", e.target.value)} />
      </Field>
    </Section>
  );
}

export function WhatsAppSettingsForm({ initial, envFallback }: { initial: AppSettings["whatsapp"]; envFallback: string }) {
  const s = useSettingsSave("whatsapp", initial);
  return (
    <Section title="WhatsApp" description="Customers' booking, payment and support messages open a chat with this number." onSave={s.save} pending={s.pending}>
      <Field
        label="Business WhatsApp number"
        htmlFor="w-number"
        hint={envFallback ? `Leave empty to use the environment value (${envFallback}).` : "International format, e.g. 919876543210"}
      >
        <Input id="w-number" inputMode="tel" value={s.value.number} onChange={(e) => s.set("number", e.target.value.replace(/[^\d+]/g, ""))} />
      </Field>
      <Field label="Support hours" htmlFor="w-hours">
        <Input id="w-hours" value={s.value.support_hours} onChange={(e) => s.set("support_hours", e.target.value)} />
      </Field>
    </Section>
  );
}

export function PaymentSettingsForm({ initial }: { initial: AppSettings["payment"] }) {
  const s = useSettingsSave("payment", initial);
  return (
    <Section
      title="UPI payment details"
      description="Used in the payment instructions message sent to customers on WhatsApp. Double-check these — customers pay directly to this account."
      onSave={s.save}
      pending={s.pending}
    >
      <Field label="UPI ID" htmlFor="p-upi">
        <Input id="p-upi" value={s.value.upi_id} onChange={(e) => s.set("upi_id", e.target.value.trim())} placeholder="business@upi" />
      </Field>
      <Field label="Payee name" htmlFor="p-name">
        <Input id="p-name" value={s.value.payee_name} onChange={(e) => s.set("payee_name", e.target.value)} />
      </Field>
      <Field label="UPI / payment phone number (optional)" htmlFor="p-number">
        <Input id="p-number" value={s.value.payment_number} onChange={(e) => s.set("payment_number", e.target.value)} />
      </Field>
      <Field label="Instructions" htmlFor="p-instr" className="sm:col-span-2">
        <Textarea id="p-instr" rows={3} value={s.value.instructions} onChange={(e) => s.set("instructions", e.target.value)} />
      </Field>
    </Section>
  );
}

export function BookingSettingsForm({ initial }: { initial: AppSettings["booking"] }) {
  const s = useSettingsSave("booking", initial);
  const slots = s.value.time_slots;
  const setSlot = (i: number, patch: Partial<(typeof slots)[number]>) => s.set("time_slots", slots.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Section title="Booking slots" description="Time slots, capacity per slot and how far ahead customers can book." onSave={s.save} pending={s.pending}>
      <div className="flex flex-col gap-2 sm:col-span-2">
        {slots.map((slot, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
            <Input aria-label="Slot label" value={slot.label} onChange={(e) => setSlot(i, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
            <Input
              aria-label="Start time"
              type="time"
              value={slot.start}
              onChange={(e) => setSlot(i, { start: e.target.value, id: slot.id || e.target.value.replace(":", "") })}
            />
            <Input aria-label="End time" type="time" value={slot.end} onChange={(e) => setSlot(i, { end: e.target.value })} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove slot"
              disabled={slots.length <= 1}
              onClick={() => s.set("time_slots", slots.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => s.set("time_slots", [...slots, { id: `slot-${Date.now()}`, label: "6 PM – 8 PM", start: "18:00", end: "20:00" }])}
        >
          <Plus aria-hidden /> Add slot
        </Button>
      </div>
      <Field label="Bookings per slot (team capacity)" htmlFor="bk-cap">
        <Input id="bk-cap" type="number" min={1} value={s.value.slot_capacity} onChange={(e) => s.set("slot_capacity", n(e.target.value))} />
      </Field>
      <Field label="Minimum hours before slot" htmlFor="bk-lead" hint="e.g. 12 means same-night bookings for tomorrow morning are blocked">
        <Input id="bk-lead" type="number" min={0} value={s.value.min_lead_hours} onChange={(e) => s.set("min_lead_hours", n(e.target.value))} />
      </Field>
      <Field label="Book up to (days ahead)" htmlFor="bk-adv">
        <Input id="bk-adv" type="number" min={1} value={s.value.max_advance_days} onChange={(e) => s.set("max_advance_days", n(e.target.value))} />
      </Field>
    </Section>
  );
}

type FeeType = AppSettings["cancellation"]["fee_type"];

function FeeFields({ prefix, feeType, feeValue, onChange }: { prefix: string; feeType: FeeType; feeValue: number; onChange: (v: { fee_type: FeeType; fee_value: number }) => void }) {
  return (
    <>
      <Field label="Fee type" htmlFor={`${prefix}-fee-type`}>
        <Select id={`${prefix}-fee-type`} value={feeType} onChange={(e) => onChange({ fee_type: e.target.value as FeeType, fee_value: feeValue })}>
          <option value="none">No fee</option>
          <option value="fixed">Fixed amount (₹)</option>
          <option value="percentage">Percentage of total</option>
        </Select>
      </Field>
      <Field label={feeType === "percentage" ? "Fee (%)" : "Fee (₹)"} htmlFor={`${prefix}-fee`}>
        <Input
          id={`${prefix}-fee`}
          type="number"
          min={0}
          disabled={feeType === "none"}
          value={feeValue}
          onChange={(e) => onChange({ fee_type: feeType, fee_value: n(e.target.value) })}
        />
      </Field>
    </>
  );
}

export function CancellationSettingsForm({ initial }: { initial: AppSettings["cancellation"] }) {
  const s = useSettingsSave("cancellation", initial);
  return (
    <Section title="Cancellation policy" description="Applied automatically when customers cancel online, and shown to customers." onSave={s.save} pending={s.pending}>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <Switch checked={s.value.enabled} onCheckedChange={(v) => s.set("enabled", v)} /> Customers can cancel online
      </label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <Switch checked={s.value.approval_required} onCheckedChange={(v) => s.set("approval_required", v)} /> Every cancellation needs admin approval
      </label>
      <Field label="Minimum notice (hours)" htmlFor="c-notice" hint="Cancellations with less notice need admin approval">
        <Input id="c-notice" type="number" min={0} value={s.value.min_notice_hours} onChange={(e) => s.set("min_notice_hours", n(e.target.value))} />
      </Field>
      <Field label="Fee applies within (hours)" htmlFor="c-window" hint="Cancelling earlier than this is free">
        <Input id="c-window" type="number" min={0} value={s.value.fee_window_hours} onChange={(e) => s.set("fee_window_hours", n(e.target.value))} />
      </Field>
      <FeeFields prefix="c" feeType={s.value.fee_type} feeValue={s.value.fee_value} onChange={(v) => s.setValue((x) => ({ ...x, ...v }))} />
      <Field label="Refund policy text" htmlFor="c-text" className="sm:col-span-2">
        <Textarea id="c-text" rows={3} value={s.value.refund_policy_text} onChange={(e) => s.set("refund_policy_text", e.target.value)} />
      </Field>
    </Section>
  );
}

export function RescheduleSettingsForm({ initial }: { initial: AppSettings["reschedule"] }) {
  const s = useSettingsSave("reschedule", initial);
  return (
    <Section title="Rescheduling policy" description="Controls the customer “Reschedule Booking” flow." onSave={s.save} pending={s.pending}>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <Switch checked={s.value.enabled} onCheckedChange={(v) => s.set("enabled", v)} /> Customers can reschedule online
      </label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <Switch checked={s.value.approval_required} onCheckedChange={(v) => s.set("approval_required", v)} /> Requests need admin approval
      </label>
      <Field label="Minimum notice (hours)" htmlFor="r-notice">
        <Input id="r-notice" type="number" min={0} value={s.value.min_notice_hours} onChange={(e) => s.set("min_notice_hours", n(e.target.value))} />
      </Field>
      <Field label="Maximum reschedules per booking" htmlFor="r-max">
        <Input id="r-max" type="number" min={0} value={s.value.max_reschedules} onChange={(e) => s.set("max_reschedules", n(e.target.value))} />
      </Field>
      <FeeFields prefix="r" feeType={s.value.fee_type} feeValue={s.value.fee_value} onChange={(v) => s.setValue((x) => ({ ...x, ...v }))} />
    </Section>
  );
}

export function ServiceAreaForm({ initial }: { initial: AppSettings["service_area"] }) {
  const s = useSettingsSave("service_area", initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service centre & radius</CardTitle>
        <p className="text-sm text-muted">Bookings are only accepted within this radius. Click the map to move the centre.</p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-4">
          <Field label="Centre label" htmlFor="sa-label">
            <Input id="sa-label" value={s.value.center_label} onChange={(e) => s.set("center_label", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="sa-lat">
              <Input id="sa-lat" type="number" step="0.0001" value={s.value.center_lat} onChange={(e) => s.set("center_lat", Number(e.target.value))} />
            </Field>
            <Field label="Longitude" htmlFor="sa-lng">
              <Input id="sa-lng" type="number" step="0.0001" value={s.value.center_lng} onChange={(e) => s.set("center_lng", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Radius (km)" htmlFor="sa-radius">
            <Input id="sa-radius" type="number" min={1} max={500} value={s.value.radius_km} onChange={(e) => s.set("radius_km", Number(e.target.value))} />
          </Field>
          <Button onClick={s.save} loading={s.pending} className="w-fit">
            Save service area
          </Button>
        </div>
        <MapView
          center={{ lat: s.value.center_lat, lng: s.value.center_lng }}
          centerLabel={s.value.center_label}
          radiusKm={s.value.radius_km || 1}
          onPick={(p) => s.setValue((v) => ({ ...v, center_lat: Math.round(p.lat * 1e5) / 1e5, center_lng: Math.round(p.lng * 1e5) / 1e5 }))}
          className="h-80"
        />
      </CardContent>
    </Card>
  );
}
