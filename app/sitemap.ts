import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/services", "/pricing", "/how-it-works", "/service-area", "/about", "/contact", "/book"];
  return pages.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" || p === "/pricing" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/book" ? 0.9 : 0.7,
  }));
}
