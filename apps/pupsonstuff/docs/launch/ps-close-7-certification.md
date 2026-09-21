# PS-CLOSE.7 / PS-RECON launch certification

PupsonStuff remains fail-closed until every item below is completed in the target environment. Code completion is not permission to enable live fulfillment.

## Automated release gate

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @jhadina/pupsonstuff type-check
pnpm --filter @jhadina/pupsonstuff test
pnpm --filter @jhadina/pupsonstuff build
```

All four commands must pass on the exact commit being deployed. PupsonStuff is certified on Node 22 or newer.

Then run the credential-safe environment/provider preflight from the app directory:

```bash
pnpm launch:preflight
```

The command reports presence and validity but never prints credential values. It must remain blocked at `catalog.samples` until every required physical sample has actually been received, inspected, and recorded.

## Environment gate

- Supabase PS-CLOSE and PS-RECON migrations applied.
- `pupson-originals`, `pupson-creative`, and `pupson-print-ready` exist and are private.
- `SUPABASE_SERVICE_ROLE_KEY` exists only in the server environment.
- Stripe secret and webhook secret use test mode during certification.
- Admin username, password, and session secret are long production values.
- Printify key and shop ID point at the intended shop.
- Printify webhook callback includes the configured shared secret.
- `PUPSON_PUBLIC_ORIGIN` is the canonical HTTPS PupsonStuff deployment origin.
- A server-side background-removal provider is configured.
- A print-resolution AI upscaler is configured.
- `CRON_SECRET` protects the durable creative worker.
- `PUPSON_FULFILLMENT_MODE=dry_run` until every prototype sample passes.

## Prototype catalog gate

The PS-RECON prototype matrix is deliberately small and explicit:

| Product | Storefront ID | Variant |
| --- | --- | --- |
| 12×16 canvas | `frame1` | `canvas-12x16` |
| 11oz white mug | `mugWhite` | `mug-11oz` |
| Medium concert tee | `concertShirt` | `tee-concert-m` |

For each variant, use the authenticated `/api/admin/catalog/certify` endpoint to persist the real Printify product/variant, blueprint, print-provider, and print-area IDs. The source storefront remains provider-neutral.

A variant may become `sandbox_verified` after its mapping is checked. Promotion to `sample_verified` requires the **same mapping** to have already passed sandbox certification plus a received provider-order receipt and passing placement, color, material, and damage inspection evidence. The launch gate passes only when all three prototype variants reach the required status.

## End-to-end test matrix

1. Upload one strong pet photo and then three references; reject unsupported, corrupt, oversized, and under-512px files. Explicit shopper photo-processing consent is required.
2. Confirm all admitted Pet Identity references reach generation: OpenAI receives individual references; single-image providers receive the provider-neutral identity sheet.
3. Exercise Remove, Keep, and Generate background intent. Remove is the default and the saved generated asset must retain real transparency.
4. Run deterministic ASCII generation, one OpenAI generation, and one Muapi generation with non-production credentials.
5. Approve artwork for each prototype product. Confirm the exact product/variant print master, placement transform, source-resolution check, transparency check when required, and quality score are persisted.
6. Confirm originals, generated outputs, and print files remain private and ownership scoped.
7. Add approved artwork to the cart and verify tampered price/product/output IDs are rejected. The Stripe line item must carry the exact signed print-asset and Printify mapping snapshot used at checkout.
8. Complete Stripe test Checkout and replay the paid webhook twice. Expect one order, one set of line items, and one fulfillment order. Historical order persistence must use the signed checkout snapshot, not mutable catalog pointers.
9. Submit fulfillment in `dry_run`. Expect `blocked` plus a `dry_run_validated` event and no provider purchase. A changed/suspended catalog mapping must produce `catalog_gate_blocked`.
10. Verify the authenticated admin shows the real order, failures, catalog certification state, and retry action; anonymous `/admin` access must redirect to `/staff-login`.
11. Exercise the creative cron worker against a queued job and a stale running job; stale unknown provider submissions must fail closed rather than auto-resubmit.
12. Delete a test pet and its assets under the retention procedure and confirm signed URLs expire.

## Physical sample gate

Obtain one physical sample for each of the three prototype variants **outside the customer fulfillment path** (for example, an operator-created Printify sample order). Inspect identity fidelity, crop/bleed, source detail, color, placement, material, packaging, tracking, and delivered condition.

Record the provider order ID, received timestamp, operator identity, and passing inspection evidence through `/api/admin/catalog/certify`. Only then promote that exact mapping to `sample_verified`.

Customer fulfillment must never be temporarily switched to live just to obtain a sample. Set `PUPSON_FULFILLMENT_MODE=live` only after the complete prototype matrix is sample verified and the exception queue is staffed. In live mode, checkout and provider submission both require `sample_verified`.

## Rollback

Set `PUPSON_FULFILLMENT_MODE=dry_run` to stop new provider submissions without disabling payment history or the admin ledger. Mark affected catalog variants `suspended`/inactive, investigate queued paid orders, and either repair/retry or refund them manually. Never delete payment, creative provenance, fulfillment events, certification receipts, or audit evidence.
