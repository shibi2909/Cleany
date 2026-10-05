import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * The signed-in user and their profile, verified with Supabase Auth (not just
 * the cookie). Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await cookies(); // always request-time: auth depends on the visitor's cookies
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? "", profile: profile as Profile };
});

/** For pages: redirect to login when signed out. */
export async function requireUser(next = "/customer/dashboard") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For pages: only admins (role read from the database, never from the client). */
export async function requireAdminPage() {
  const user = await requireUser("/admin/dashboard");
  if (user.profile.role !== "admin") redirect("/customer/dashboard?notice=admin-only");
  return user;
}

/** For server actions: returns the admin or null (caller returns an error result). */
export async function getAdminUser() {
  const user = await getSessionUser();
  return user && user.profile.role === "admin" ? user : null;
}

/**
 * Service-role client for admin pages. Checks the admin role itself (not only in
 * the layout, which renders in parallel with the page).
 */
export async function adminDb() {
  await requireAdminPage();
  return createAdminClient();
}
