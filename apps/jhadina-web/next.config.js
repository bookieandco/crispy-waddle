/** @type {import('next').NextConfig} */
import path from "node:path"

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@jhadina/music-core"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
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
