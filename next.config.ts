import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (service images uploaded by admins)
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Payment proof screenshots are uploaded through a server action.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
