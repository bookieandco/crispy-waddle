/** @type {import('next').NextConfig} */
import path from 'node:path'

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@jhadina/music-core", "@jhadina/director-core"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "@jhadina/director-core": path.resolve(process.cwd(), "../../packages/director-core/src/index.ts"),
    }
    return config
  },
}

export default nextConfig
