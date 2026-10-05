"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Home, MapPin, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createBookingAction } from "@/app/actions/booking";
import { LocationPicker, type PickedLocation } from "@/components/maps/location-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { DateSlotPicker } from "./date-slot-picker";
import { DETAILS_FORM_ID, DetailsStep, LoginGate, type CustomerDetails } from "./details-step";
import { MobileQuoteBar, QuoteSummaryCard, sqftLabelFor, type QuoteContext } from "./quote-summary";
import { BathroomStep, HomeSizeStep, HomeTypeStep, ServicesStep, StepHeading } from "./steps";
import { calculateQuote, representativeSqft, type PricingCatalog } from "@/lib/pricing/quote";
import { findSlot, todayIST } from "@/lib/booking/slots";
import { formatDate, formatINR } from "@/lib/format";
import type { AppSettings } from "@/lib/settings/schema";
import type { BhkType } from "@/types";

const STEPS = ["Home type", "Home size", "Bathrooms", "Services", "Location", "Date & time", "Your details", "Review"] as const;
const STORAGE_KEY = "cleany.booking-draft.v1";
const DRAFT_TTL_MS = 24 * 3_600_000;

interface Draft {
  step: number;
  bhkType: BhkType | null;
  areaMode: "exact" | "range";
  areaSqft: number | null;
  areaRangeId: string | null;
  bathroomCount: number | null;
  serviceIds: string[];
  location: PickedLocation | null;
  date: string | null;
  slotId: string | null;
  customer: Partial<CustomerDetails> | null;
  savedAt: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return Date.now() - d.savedAt < DRAFT_TTL_MS ? d : null;
  } catch {
    return null;
  }
}

function saveDraft(d: Draft) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable (private mode) — the wizard still works */
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface WizardProps {
  catalog: PricingCatalog;
  settings: AppSettings;
  signedIn: boolean;
  profile: { fullName: string; phone: string; email: string } | null;
  initial: { bhk: BhkType | null; bathrooms: number | null };
}

export function BookingWizard({ catalog, settings, signedIn, profile, initial }: WizardProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const topRef = useRef<HTMLDivElement>(null);
  const defaultServices = useMemo(() => catalog.services.filter((s) => s.is_default_selected).map((s) => s.id), [catalog]);

  const [draft, setDraft] = useState<Draft>(() => ({
    step: initial.bhk ? 1 : 0,
    bhkType: initial.bhk,
    areaMode: "exact",
    areaSqft: initial.bhk ? (catalog.bhk.find((b) => b.bhk_type === initial.bhk)?.typical_sqft ?? null) : null,
    areaRangeId: null,
    bathroomCount: initial.bathrooms,
    serviceIds: defaultServices,
    location: null,
    date: null,
    slotId: null,
    customer: null,
    savedAt: Date.now(),
  }));
  const [hydrated, setHydrated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Restore a saved draft (e.g. after logging in mid-booking).
  useEffect(() => {
    const saved = loadDraft();
    if (saved && !initial.bhk) {
      // Only keep services that still exist.
      const ids = saved.serviceIds.filter((id) => catalog.services.some((s) => s.id === id));
      setDraft({ ...saved, serviceIds: ids.length ? ids : defaultServices });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) saveDraft({ ...draft, savedAt: Date.now() });
  }, [draft, hydrated]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const range = draft.areaRangeId ? (catalog.areas.find((a) => a.id === draft.areaRangeId) ?? null) : null;
  const effectiveSqft = draft.areaMode === "range" ? (range ? representativeSqft(range) : null) : draft.areaSqft;

  const quote = useMemo(
    () =>
      !draft.bhkType
        ? { lines: [], subtotal: 0, discount: 0, discountLabel: null, total: 0, bhk: null, areaRange: null, errors: [] }
        : calculateQuote(
        catalog,
        {
          bhkType: draft.bhkType ?? "1BHK",
          areaSqft: effectiveSqft ?? catalog.bhk.find((b) => b.bhk_type === draft.bhkType)?.typical_sqft ?? 800,
          bathroomCount: draft.bathroomCount ?? 1,
          serviceIds: draft.serviceIds,
        },
        todayIST(),
      ),
    [catalog, draft.bhkType, draft.bathroomCount, draft.serviceIds, effectiveSqft],
  );

  const ctx: QuoteContext = {
    bhkLabel: catalog.bhk.find((b) => b.bhk_type === draft.bhkType)?.label ?? null,
    sqftLabel: sqftLabelFor(effectiveSqft, draft.areaMode === "range", range?.label ?? null),
    bathrooms: draft.bathroomCount,
  };

  const slot = draft.slotId ? findSlot(settings.booking, draft.slotId) : null;

  function canContinue(step: number) {
    switch (step) {
      case 0:
        return Boolean(draft.bhkType);
      case 1:
        return draft.areaMode === "range" ? Boolean(range) : Boolean(draft.areaSqft && draft.areaSqft >= 150 && draft.areaSqft <= 20000);
      case 2:
        return Boolean(draft.bathroomCount);
      case 3:
        return draft.serviceIds.length > 0 && quote.errors.length === 0;
      case 4:
        return Boolean(draft.location?.serviceability.serviceable);
      case 5:
        return Boolean(draft.date && draft.slotId);
      case 6:
        return signedIn;
      default:
        return true;
    }
  }

  function goTo(step: number) {
    update({ step });
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  }

  function next() {
    if (!canContinue(draft.step)) return;
    goTo(Math.min(draft.step + 1, STEPS.length - 1));
  }

  function onDetails(values: CustomerDetails) {
    update({ customer: values, step: 7 });
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function confirm() {
    const c = draft.customer;
    if (!draft.bhkType || !effectiveSqft || !draft.bathroomCount || !draft.location || !draft.date || !draft.slotId || !c) {
      setSubmitError("Some booking details are missing. Please review each step.");
      return;
    }
    setSubmitError(null);
    startSubmit(async () => {
      try {
        const res = await createBookingAction({
          home: {
            bhkType: draft.bhkType!,
            areaSqft: effectiveSqft,
            areaIsApproximate: draft.areaMode === "range",
            bathroomCount: draft.bathroomCount!,
            serviceIds: draft.serviceIds,
          },
          location: { lat: draft.location!.lat, lng: draft.location!.lng, formattedAddress: draft.location!.formattedAddress },
          schedule: { date: draft.date!, slotId: draft.slotId! },
          customer: {
            fullName: c.fullName ?? "",
            phone: c.phone ?? "",
            email: c.email ?? "",
            address: c.address ?? "",
            landmark: c.landmark ?? "",
            pincode: c.pincode ?? "",
            instructions: c.instructions ?? "",
          },
        });
        if (!res.ok) {
          setSubmitError(res.error);
          toast.error(res.error);
          if (/slot/i.test(res.error)) update({ slotId: null, step: 5 });
          return;
        }
        clearDraft();
        toast.success(`Booking ${res.data.bookingNumber} created`);
        router.push(`/booking/success?id=${res.data.id}`);
      } catch {
        const msg = "We couldn't reach the server. Please check your connection and try again.";
        setSubmitError(msg);
        toast.error(msg);
      }
    });
  }

  const step = draft.step;
  const detailsDefaults = {
    fullName: draft.customer?.fullName ?? profile?.fullName ?? "",
    phone: draft.customer?.phone ?? profile?.phone ?? "",
    email: draft.customer?.email ?? profile?.email ?? "",
    address: draft.customer?.address ?? draft.location?.formattedAddress ?? "",
    landmark: draft.customer?.landmark ?? "",
    pincode: draft.customer?.pincode ?? draft.location?.pincode ?? "",
    instructions: draft.customer?.instructions ?? "",
  };

  const primaryAction =
    step === 6 ? (
      signedIn ? (
        <Button type="submit" form={DETAILS_FORM_ID} size="lg">
          Review <ArrowRight aria-hidden />
        </Button>
      ) : null
    ) : step === 7 ? (
      <Button size="lg" onClick={confirm} loading={submitting}>
        Confirm & Book Service
      </Button>
    ) : (
      <Button size="lg" onClick={next} disabled={!canContinue(step)}>
        Continue <ArrowRight aria-hidden />
      </Button>
    );

  return (
    <div ref={topRef} className="scroll-mt-24 pb-32 lg:pb-0">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> Back
            </button>
          ) : null}
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand-200"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Booking progress"
        >
          <motion.div className="h-full rounded-full bg-brand-700" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 rounded-3xl border border-line bg-white/60 p-5 sm:p-8" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <HomeTypeStep catalog={catalog} value={draft.bhkType} onChange={(v) => update({ bhkType: v, areaSqft: draft.areaSqft ?? catalog.bhk.find((b) => b.bhk_type === v)?.typical_sqft ?? null })} />}
              {step === 1 && (
                <HomeSizeStep
                  catalog={catalog}
                  mode={draft.areaMode}
                  sqft={draft.areaSqft}
                  rangeId={draft.areaRangeId}
                  onChange={(v) => update({ areaMode: v.mode, areaSqft: v.sqft, areaRangeId: v.rangeId })}
                />
              )}
              {step === 2 && <BathroomStep catalog={catalog} value={draft.bathroomCount} onChange={(v) => update({ bathroomCount: v })} />}
              {step === 3 && (
                <ServicesStep
                  catalog={catalog}
                  bhk={draft.bhkType}
                  bathrooms={draft.bathroomCount}
                  value={draft.serviceIds}
                  onChange={(v) => update({ serviceIds: v })}
                />
              )}
              {step === 4 && (
                <>
                  <StepHeading
                    title="Where should we come?"
                    description={`We serve ${settings.service_area.center_label} + ${settings.service_area.radius_km} km. Search your address, use your current location, or tap the map.`}
                  />
                  <LocationPicker area={settings.service_area} value={draft.location} onChange={(loc) => update({ location: loc })} />
                  {draft.location && !draft.location.serviceability.serviceable ? (
                    <p className="mt-3 text-sm text-muted">Booking is disabled for locations outside our service area.</p>
                  ) : null}
                </>
              )}
              {step === 5 && (
                <>
                  <StepHeading title="Pick a date and time" description="Future dates only. Full slots are marked unavailable." />
                  <DateSlotPicker settings={settings.booking} date={draft.date} slotId={draft.slotId} onChange={(v) => update({ date: v.date, slotId: v.slotId })} />
                </>
              )}
              {step === 6 && (signedIn ? <DetailsStep defaults={detailsDefaults} onSubmit={onDetails} /> : <LoginGate />)}
              {step === 7 && (
                <ReviewStep
                  ctx={ctx}
                  quoteTotal={quote.total}
                  lines={quote.lines.map((l) => ({ key: l.key, name: l.displayName, total: l.total }))}
                  discount={quote.discount}
                  location={draft.location}
                  address={draft.customer?.address ?? ""}
                  date={draft.date}
                  slotLabel={slot?.label ?? null}
                  customer={draft.customer}
                  onEdit={goTo}
                  error={submitError}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 hidden items-center justify-between border-t border-line pt-6 lg:flex">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            ) : (
              <span />
            )}
            {primaryAction}
          </div>
        </section>

        <div className="hidden lg:sticky lg:top-24 lg:block">
          <QuoteSummaryCard quote={quote} ctx={ctx} />
        </div>
      </div>

      <MobileQuoteBar quote={quote} ctx={ctx} action={primaryAction} />
    </div>
  );
}

function ReviewStep({
  ctx,
  quoteTotal,
  lines,
  discount,
  location,
  address,
  date,
  slotLabel,
  customer,
  onEdit,
  error,
}: {
  ctx: QuoteContext;
  quoteTotal: number;
  lines: { key: string; name: string; total: number }[];
  discount: number;
  location: PickedLocation | null;
  address: string;
  date: string | null;
  slotLabel: string | null;
  customer: Partial<CustomerDetails> | null;
  onEdit: (step: number) => void;
  error: string | null;
}) {
  const Row = ({ icon: Icon, label, value, step }: { icon: typeof Home; label: string; value: React.ReactNode; step: number }) => (
    <div className="flex items-start gap-3 py-3.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
        <dd className="mt-0.5 font-medium text-ink">{value}</dd>
      </div>
      <button type="button" onClick={() => onEdit(step)} className="rounded-full p-2 text-muted hover:bg-sand-100 hover:text-ink" aria-label={`Edit ${label}`}>
        <Pencil className="size-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <>
      <StepHeading title="Review your booking" description="Check everything before you confirm. You'll pay by UPI after booking." />
      <dl className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
        <Row icon={Home} label="Home" value={`${ctx.bhkLabel} · ${ctx.sqftLabel} · ${ctx.bathrooms && ctx.bathrooms >= 4 ? "4+" : ctx.bathrooms} bathroom(s)`} step={0} />
        <Row
          icon={Sparkles}
          label="Services"
          value={
            <ul className="flex flex-col gap-1">
              {lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-3 text-sm font-normal">
                  <span>{l.name}</span>
                  <span className="tabular-nums">{formatINR(l.total)}</span>
                </li>
              ))}
            </ul>
          }
          step={3}
        />
        <Row
          icon={MapPin}
          label="Location"
          value={
            <>
              {address || location?.formattedAddress}
              {location ? <span className="block text-sm font-normal text-muted">{location.serviceability.distanceKm.toFixed(1)} km from service centre ✓</span> : null}
            </>
          }
          step={4}
        />
        <Row icon={CalendarDays} label="Date" value={date ? formatDate(date, { year: true, weekday: true }) : "—"} step={5} />
        <Row icon={Clock} label="Time" value={slotLabel ?? "—"} step={5} />
        {customer ? (
          <Row icon={Pencil} label="Contact" value={`${customer.fullName} · ${customer.phone} · ${customer.email}`} step={6} />
        ) : null}
      </dl>

      <div className="mt-5 flex items-end justify-between rounded-2xl bg-brand-900 p-5 text-cream">
        <div>
          <p className="text-sm text-brand-100">Total price</p>
          {discount > 0 ? <p className="text-xs text-brand-200">Includes {formatINR(discount)} discount</p> : null}
        </div>
        <p className="font-display text-3xl font-medium tabular-nums">{formatINR(quoteTotal)}</p>
      </div>

      <p className="mt-4 text-sm text-muted">
        After you confirm, you&apos;ll get a booking ID and can send it to us on WhatsApp. We&apos;ll share our official UPI details there.
        Your booking is confirmed once we verify your payment.
      </p>
      {error ? (
        <Alert tone="danger" title="Booking failed" className="mt-4">
          {error}
        </Alert>
      ) : null}
    </>
  );
}
