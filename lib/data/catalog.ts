import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseSettings, type AppSettings } from "@/lib/settings/schema";
import type { PricingCatalog } from "@/lib/pricing/quote";
import type { AreaPricing, BathroomPricing, BhkPricing, Discount, Service } from "@/types";

export async function loadSettings(client: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await client.from("settings").select("key, value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return parseSettings(data ?? []);
}

export async function loadCatalog(client: SupabaseClient, opts: { includeInactive?: boolean } = {}): Promise<PricingCatalog> {
  const services = client.from("services").select("*").order("sort_order");
  const discounts = client.from("discounts").select("*").order("created_at");
  const [bhk, areas, bathrooms, svc, disc] = await Promise.all([
    client.from("bhk_pricing").select("*").order("sort_order"),
    client.from("area_pricing").select("*").order("sort_order"),
    client.from("bathroom_pricing").select("*").order("bathroom_count"),
    opts.includeInactive ? services : services.eq("is_active", true),
    opts.includeInactive ? discounts : discounts.eq("is_active", true),
  ]);
  const err = bhk.error || areas.error || bathrooms.error || svc.error || disc.error;
  if (err) throw new Error(`Could not load pricing: ${err.message}`);
  return {
    bhk: (bhk.data ?? []) as BhkPricing[],
    areas: (areas.data ?? []) as AreaPricing[],
    bathrooms: (bathrooms.data ?? []) as BathroomPricing[],
    services: (svc.data ?? []) as Service[],
    discounts: (disc.data ?? []) as Discount[],
  };
}

export type PublicData = { configured: true; settings: AppSettings; catalog: PricingCatalog } | { configured: false; settings: AppSettings; catalog: null };

/**
 * Catalogue + settings for public pages. When Supabase isn't configured (fresh
 * checkout) or temporarily unreachable, pages render a friendly setup notice
 * instead of crashing. Prices are never hardcoded as a fallback.
 */
export const getPublicData = cache(async (): Promise<PublicData> => {
  if (!isSupabaseConfigured()) return { configured: false, settings: parseSettings([]), catalog: null };
  try {
    const client = createPublicClient();
    const [settings, catalog] = await Promise.all([loadSettings(client), loadCatalog(client)]);
    return { configured: true, settings, catalog };
  } catch (err) {
    console.error("[catalog] failed to load public data", err);
    return { configured: false, settings: parseSettings([]), catalog: null };
  }
});
