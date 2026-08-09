/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @jhadina/music-core ships TS source with native-ESM-style ".js"
  // extension imports (e.g. "./types.js" resolving to types.ts). `tsc`
  // resolves that correctly, but webpack does not do that remapping for
  // workspace packages by default - transpilePackages tells Next to run
  // this package through its own compiler instead of treating it as
  // pre-built, which does.
  transpilePackages: ["@jhadina/music-core"],
}

export default nextConfig
