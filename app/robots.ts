import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/customer", "/booking/", "/api/", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
