/**
 * Promote an existing account to admin. Run from a trusted machine:
 *   npm run make-admin -- owner@example.com
 * Uses the service role key from .env.local. Admin rights can never be granted
 * from the website itself.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("profiles").update({ role: "admin" }).ilike("email", email).select("id, email, role");
  if (error) throw error;
  if (!data?.length) {
    console.error(`No account found for ${email}. Sign up on the website first, then run this again.`);
    process.exit(1);
  }
  console.log(`✓ ${data[0].email} is now an admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
