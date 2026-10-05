import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SupabaseNotConfiguredError } from "./env";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code, and only after
 * the caller has been authenticated and authorised. The key is read from a
 * server-only environment variable and is never sent to the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new SupabaseNotConfiguredError();
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
