"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SITE_URL } from "@/lib/config/brand";
import { loginSchema, signupSchema } from "@/lib/validation/booking";
import type { ActionResult } from "@/types";

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: unknown, fallback = "/customer/dashboard") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already been registered/i.test(message)) return "An account with this email already exists. Please log in.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/fetch failed|network/i.test(message)) return "We couldn't reach the server. Please check your connection.";
  return "Something went wrong. Please try again.";
}

export async function signInAction(input: z.input<typeof loginSchema> & { next?: string }): Promise<ActionResult<{ next: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Sign-in isn't available until the database is configured." };
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: authError(error.message) };

  // Admins land on the admin dashboard unless they were heading somewhere specific.
  let next = safeNext(input.next, "");
  if (!next) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    next = profile?.role === "admin" ? "/admin/dashboard" : "/customer/dashboard";
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { next } };
}

export async function signUpAction(
  input: z.input<typeof signupSchema> & { next?: string },
): Promise<ActionResult<{ next: string; needsConfirmation: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Sign-up isn't available until the database is configured." };
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const next = safeNext(input.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Role is never taken from here — the database always creates customers.
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: authError(error.message) };
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: "An account with this email already exists. Please log in." };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { next, needsConfirmation: !data.session } };
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
