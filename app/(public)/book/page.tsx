import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth";
import { getPublicData } from "@/lib/data/catalog";
import { BHK_TYPES, type BhkType } from "@/types";

export const metadata: Metadata = {
  title: "Get an Instant Quote",
  description: "Get an instant deep cleaning quote for your Bengaluru home and book a slot in minutes.",
  alternates: { canonical: "/book" },
};

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [{ catalog, settings }, user] = await Promise.all([getPublicData(), getSessionUser()]);

  const bhkParam = typeof sp.bhk === "string" ? sp.bhk : null;
  const bhk = BHK_TYPES.includes(bhkParam as BhkType) ? (bhkParam as BhkType) : null;
  const bathsParam = Number(sp.bathrooms);
  const bathrooms = Number.isInteger(bathsParam) && bathsParam >= 1 && bathsParam <= 4 ? bathsParam : null;

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow">Instant quote</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Book your deep cleaning</h1>
      </div>
      {catalog ? (
        <BookingWizard
          catalog={catalog}
          settings={settings}
          signedIn={Boolean(user)}
          profile={
            user
              ? { fullName: user.profile.full_name ?? "", phone: user.profile.phone ?? "", email: user.profile.email ?? user.email }
              : null
          }
          initial={{ bhk, bathrooms }}
        />
      ) : (
        <SetupNotice />
      )}
    </div>
  );
}
