import { defineConfig } from "vitest/config"
import path from "node:path"

// jhadina-web consumes @jhadina/action-core (and, transitively,
// @jhadina/security-core) for the first time via the governed Growth
// approval path, @jhadina/{checkout-orchestrator,payment-core,
// order-fulfillment-core} via the Commerce spine proof,
// @jhadina/money-core via the Money/Plaid spine proof, and
// @jhadina/{core-spine,intelligence-core} via the Intelligence Router
// (Phase 1 Step 3) — the router implements core-spine's DecisionPort
// rather than a duplicate shape. Next.js resolves
// the tsconfig "paths" mapping for webpack automatically; Vitest does
// not, so it needs the same mapping here. Some of these packages use
// Node-ESM-style ".js" extension imports that resolve to ".ts" files
// (e.g. "./action-executor.js") — matched by the resolve.extensions
// fallback below, the same accommodation next.config.js's
// extensionAlias makes for webpack.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@jhadina/action-core", replacement: path.resolve(__dirname, "../../packages/jhadina-action-core/src") },
      { find: "@jhadina/security-core", replacement: path.resolve(__dirname, "../../packages/security-core/src") },
      { find: "@jhadina/core-spine", replacement: path.resolve(__dirname, "../../packages/jhadina-core-spine/src") },
      { find: "@jhadina/intelligence-core", replacement: path.resolve(__dirname, "../../packages/jhadina-intelligence-core/src") },
      { find: "@jhadina/checkout-orchestrator", replacement: path.resolve(__dirname, "../../packages/checkout-orchestrator/src") },
      { find: "@jhadina/payment-core", replacement: path.resolve(__dirname, "../../packages/payment-core/src") },
      { find: "@jhadina/order-fulfillment-core", replacement: path.resolve(__dirname, "../../packages/order-fulfillment-core/src") },
      { find: "@jhadina/money-core", replacement: path.resolve(__dirname, "../../packages/money-core/src") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
})
