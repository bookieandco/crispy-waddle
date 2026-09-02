# OCE Deployment Check

This marker exists to trigger a fresh Vercel deployment after repairing the stale `packages/director-core` lockfile importer mismatch.

The repair removed the stale `vitest` package declaration from `packages/director-core/package.json`, restoring parity with the existing pnpm-lockfile importer.
