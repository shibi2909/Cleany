import type { Metadata } from "next";
import {
  BookingSettingsForm,
  BusinessSettingsForm,
  CancellationSettingsForm,
  PaymentSettingsForm,
  RescheduleSettingsForm,
  WhatsAppSettingsForm,
} from "@/components/admin/settings-forms";
import { AdminPageHeader } from "@/components/admin/ui";
import { Alert } from "@/components/ui/feedback";
import { loadSettings } from "@/lib/data/catalog";
import { adminDb } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await loadSettings(await adminDb());
  const envWhatsapp = process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP_NUMBER ?? "";
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Settings" description="Business details, payments, WhatsApp, booking slots and policies." />
      {!settings.whatsapp.number && !envWhatsapp ? (
        <Alert tone="warning" title="WhatsApp number missing">
          Set the business WhatsApp number below so customers can send bookings and payment proof.
        </Alert>
      ) : null}
      {settings.payment.upi_id === "cleaningbusiness@upi" ? (
        <Alert tone="warning" title="Placeholder UPI ID">
          Replace the example UPI ID with your real business UPI ID before accepting bookings.
        </Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <BusinessSettingsForm initial={settings.business} />
        <WhatsAppSettingsForm initial={settings.whatsapp} envFallback={envWhatsapp} />
        <PaymentSettingsForm initial={settings.payment} />
        <BookingSettingsForm initial={settings.booking} />
        <CancellationSettingsForm initial={settings.cancellation} />
        <RescheduleSettingsForm initial={settings.reschedule} />
      </div>
    </div>
  );
}
