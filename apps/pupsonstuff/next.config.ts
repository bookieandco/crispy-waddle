import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Boutique photo and future product mockups are served from /public
    // today. Add remotePatterns here once artwork/mockups move to Supabase
    // Storage or another CDN in Phase 2.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
