/** @type {import('next').NextConfig} */
import path from "node:path"

const nextConfig = {
  reactStrictMode: true,
  // The workspace package is part of the monorepo but is intentionally not
  // duplicated in this app's lockfile importer. Resolve it directly to the
  // source tree for the Next.js bundle while the root TypeScript paths provide
  // type resolution.
  transpilePackages: ["@jhadina/music-core"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@jhadina/music-core": path.resolve(process.cwd(), "../../packages/music-core/src/index.ts"),
    }
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

export default nextConfig
