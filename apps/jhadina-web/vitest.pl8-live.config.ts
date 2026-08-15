import { defineConfig } from "vitest/config"
import path from "node:path"

/**
 * PL-8 live-run verification: a SEPARATE config from vitest.config.ts
 * (which `pnpm test` / the required "Install, type-check, lint, test,
 * build" Launch Gate CI check uses). vitest.config.ts is completely
 * untouched by this file. Byte-identical alias set to
 * vitest.pl7-live.config.ts — the same packages are in scope.
 *
 * This config's include is scoped to exactly one file —
 * pl8-live-plaid-verification.live.ts — which makes real calls
 * against Plaid's sandbox API. The only thing that ever points at this
 * config is .github/workflows/pl8-live-plaid-verification.yml, a
 * workflow_dispatch-only job a human must explicitly trigger; no
 * push, pull_request, or scheduled trigger ever runs it, and no other
 * script in this repo references this config file.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@jhadina/action-core", replacement: path.resolve(__dirname, "../../packages/jhadina-action-core/src") },
      { find: "@jhadina/security-core", replacement: path.resolve(__dirname, "../../packages/security-core/src") },
      { find: "@jhadina/checkout-orchestrator", replacement: path.resolve(__dirname, "../../packages/checkout-orchestrator/src") },
      { find: "@jhadina/payment-core", replacement: path.resolve(__dirname, "../../packages/payment-core/src") },
      { find: "@jhadina/order-fulfillment-core", replacement: path.resolve(__dirname, "../../packages/order-fulfillment-core/src") },
      { find: "@jhadina/money-core", replacement: path.resolve(__dirname, "../../packages/money-core/src") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  test: {
    include: ["src/lib/money/pl8-live-plaid-verification.live.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
