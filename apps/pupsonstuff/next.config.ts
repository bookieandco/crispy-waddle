import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Boutique photo and future product mockups are served from /public
    // today. Add remotePatterns here once artwork/mockups move to Supabase
    // Storage or another CDN in Phase 2.
    formats: ["image/avif", "image/webp"],
  },
  // Shared Jhadina workspace packages ship TypeScript source with native-ESM
  // ".js" specifiers. Transpile the compute package and let webpack map those
  // specifiers back to TypeScript source during the app build.
  transpilePackages: ["@jhadina/compute-core"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
