# PS-CLOSE.7 launch certification

PupsonStuff remains fail-closed until every item below is completed in the target environment. Code completion is not permission to enable live fulfillment.

## Automated release gate

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff test
pnpm --filter @jhadina/pupsonstuff build
```

All four commands must pass on the exact commit being deployed.

## Environment gate

- Supabase migration `pupsonstuff_closeout_core` applied.
- All three storage buckets are private.
- `SUPABASE_SERVICE_ROLE_KEY` exists only in the server environment.
- Stripe secret and webhook secret use the same test/live mode.
- Admin username, password, and session secret are long production values.
- Printify key and shop ID point at the intended shop.
- Printify webhook callback includes the configured shared secret.
- `PUPSON_PUBLIC_ORIGIN` is the canonical HTTPS production origin.
- `PUPSON_FULFILLMENT_MODE=dry_run` until physical samples pass.

## Catalog gate

For each launch variant, use the authenticated `/api/admin/catalog/certify` endpoint to persist:

- product and variant identity;
- Printify product/variant, blueprint, and print-provider IDs;
- print-area name;
- base cost and retail price;
- `sandbox_verified` or `sample_verified` certification.

Checkout rejects inactive, missing, uncertified, non-Printify, or unapproved lines. Start with canvas, mug, and one apparel family.

## End-to-end test matrix

1. Upload one photo and five photos; reject unsupported, corrupt, oversized, and under-512px files.
2. Run deterministic ASCII generation without an AI key.
3. Run one OpenAI and one Muapi generation with non-production credentials.
4. Confirm originals, outputs, and print files are private and ownership scoped.
5. Approve an output, add it to the cart, then verify tampered price/product/output IDs are rejected.
6. Complete Stripe test Checkout and replay the paid webhook twice; expect one order, one set of line items, and one fulfillment order.
7. Submit fulfillment in dry-run mode; expect `blocked` plus a `dry_run_validated` event and no provider purchase.
8. In the Printify test shop, enable `live` for one sample order and verify submission, reconciliation, webhook replay, shipment, and tracking.
9. Verify the authenticated admin shows the real order, failures, and retry action; verify anonymous `/admin` access redirects to `/staff-login`.
10. Delete a test pet and its assets under the retention procedure, then confirm signed URLs expire.

## Physical sample gate

Order one sample of each launch product. Inspect identity fidelity, crop, bleed, DPI, color, placement, packaging, tracking, and delivered condition. Only set `sample_verified` after the physical sample passes. Switch `PUPSON_FULFILLMENT_MODE=live` only when all launch variants are certified and the exception queue is staffed.

## Rollback

Set `PUPSON_FULFILLMENT_MODE=dry_run` to stop new provider submissions without disabling payment history or the admin ledger. Mark affected catalog variants `suspended`/inactive, investigate queued paid orders, and either repair/retry or refund them manually. Never delete payment, creative provenance, fulfillment events, or audit evidence.
