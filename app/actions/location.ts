"use server";

import { z } from "zod";
import { getPublicData } from "@/lib/data/catalog";
import { checkServiceability, type ServiceabilityResult } from "@/lib/maps/distance";
import type { ActionResult } from "@/types";

const schema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Server-side serviceability check using the admin-configured centre and radius. */
export async function checkServiceabilityAction(lat: number, lng: number): Promise<ActionResult<ServiceabilityResult>> {
  const parsed = schema.safeParse({ lat, lng });
  if (!parsed.success) return { ok: false, error: "That location doesn't look valid. Please pick it again on the map." };
  const { settings } = await getPublicData();
  return { ok: true, data: checkServiceability(settings.service_area, parsed.data.lat, parsed.data.lng) };
}
