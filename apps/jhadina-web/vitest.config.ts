import { defineConfig } from "vitest/config"
import path from "node:path"

// jhadina-web consumes @jhadina/action-core (and, transitively,
// @jhadina/security-core) for the first time via the governed Growth
// approval path. Next.js resolves the tsconfig "paths" mapping for
// webpack automatically; Vitest does not, so it needs the same mapping
// here. action-core's own source uses Node-ESM-style ".js" extension
// imports that resolve to ".ts" files (e.g. "./action-executor.js") —
// matched by the resolve.extensions fallback below, the same
// accommodation next.config.js's extensionAlias makes for webpack.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@jhadina/action-core", replacement: path.resolve(__dirname, "../../packages/jhadina-action-core/src") },
      { find: "@jhadina/security-core", replacement: path.resolve(__dirname, "../../packages/security-core/src") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
})
