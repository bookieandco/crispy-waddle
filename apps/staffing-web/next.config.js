/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @staffing/core ships TS source with native-ESM-style ".js" extension
  // imports (e.g. "./staffing.js" resolving to staffing.ts). `tsc` resolves
  // that correctly, but webpack does not do that remapping for workspace
  // packages by default.
  //
  // transpilePackages makes Next run the package through its own compiler
  // instead of treating it as pre-built - necessary, but not sufficient on
  // its own: webpack still needs to be told that a requested ".js" specifier
  // may resolve to a ".ts"/".tsx" file on disk. extensionAlias is that
  // second half of the fix (same pattern as apps/jhadina-web/next.config.js).
  transpilePackages: ["@staffing/core"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

module.exports = nextConfig
