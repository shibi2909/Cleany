import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, SupabaseNotConfiguredError, isSupabaseConfigured } from "./env";

/**
 * Supabase client bound to the signed-in user's session (RLS applies).
 * Use in Server Components, Server Actions and Route Handlers.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Cookie-less anonymous client for public catalogue data (services, pricing,
 * settings). Lets marketing pages be statically rendered and revalidated.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
