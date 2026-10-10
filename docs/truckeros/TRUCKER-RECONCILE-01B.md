# TRUCKER-RECONCILE.01B — web prototype admission safety
- Removed the hard-coded client-side DEMO_LOADS fixture from the Dispatcher screen. It now accepts only driver-entered offline/manual load terms and explicitly labels them as unverified, not live load-board results. No freight booking is enabled.
- Added a fail-closed Next middleware that blocks every legacy prototype /api route on NODE_ENV=production except /api/health. This includes shared-driver location, memory, Dispatcher and community endpoints. This is a temporary admission safeguard, not a substitute for per-driver auth or tenant authorization.
- New regression tests assert the production gate for known API families.
- The preview still uses a single in-memory demo driver and client-supplied economics. It must remain local development only until the canonical Dispatcher source, verified identity and cross-repo integrations are in place.
- Independent TruckerOS freight components remain in the private repository. Do not copy them wholesale into this public monorepo or unintentionally expose private source.
