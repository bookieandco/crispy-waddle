/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @jhadina/music-core ships TS source with native-ESM-style ".js"
  // extension imports (e.g. "./types.js" resolving to types.ts). `tsc`
  // resolves that correctly, but webpack does not do that remapping for
  // workspace packages by default.
  //
  // transpilePackages makes Next run the package through its own
  // compiler instead of treating it as pre-built - necessary, but not
  // sufficient on its own: webpack still needs to be told that a
  // requested ".js" specifier may resolve to a ".ts"/".tsx" file on
  // disk. extensionAlias is that second half of the fix. (Verified: with
  // transpilePackages alone, the build still fails with "Module not
  // found: Can't resolve './types.js'" etc.)
  transpilePackages: ["@jhadina/music-core"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

export default nextConfig
