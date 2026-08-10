/** @type {import('next').NextConfig} */
import path from 'node:path'

const directorRoot = path.resolve(process.cwd(), "../../packages/director-core/src")

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
      "@jhadina/director-core": path.join(directorRoot, "index.ts"),
      "@jhadina/director-core/timeline-command": path.join(directorRoot, "timeline-command.ts"),
      "@jhadina/director-core/timeline-model": path.join(directorRoot, "timeline-model.ts"),
    }
    return config
  },
}

export default nextConfig
