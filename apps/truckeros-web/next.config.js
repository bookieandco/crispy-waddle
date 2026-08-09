/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @jhadina/truckeros-core ships TS source with native-ESM-style ".js"
  // extension imports (e.g. "./types.js" resolving to types.ts). `tsc`
  // resolves that correctly, but webpack does not remap that for workspace
  // packages by default. See apps/jhadina-web/next.config.js for the same
  // fix applied to @jhadina/music-core — this mirrors it.
  transpilePackages: ["@jhadina/truckeros-core"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

export default nextConfig
