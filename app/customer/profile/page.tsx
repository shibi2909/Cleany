import type { Metadata } from "next";
import { ProfileForm } from "./profile-form";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser("/customer/profile");
  return (
    <div className="max-w-xl">
      <h1 className="display text-3xl sm:text-4xl">Profile</h1>
      <p className="mt-1 text-muted">
        {user.email} · member since {formatDate(user.profile.created_at.slice(0, 10))}
      </p>
      <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-soft">
        <ProfileForm defaults={{ fullName: user.profile.full_name ?? "", phone: user.profile.phone ?? "" }} />
      </div>
    </div>
  );
}
