# PupsonStuff launch progression — 2026-09-20

## Outcome

The launch progression has reached the physical-sample gate while remaining
fail-closed. Database preparation is complete. Catalog certification, provider
end-to-end testing, and sample submission remain blocked by missing deployment
and provider credentials; no Printify purchase was submitted.

## 1. Staging/database preparation — complete

- Restored and targeted the Supabase project named `Pupsonstuff`
  (`ztjyewacsmttkzktnyxl`).
- Applied `pupsonstuff_closeout_core`.
- Applied `pupsonstuff_post_apply_hardening`.
- Reconciled five incompatible legacy tables only after confirming every one
  contained zero rows. The migration now aborts if legacy data exists.
- Verified `pupson-originals`, `pupson-creative`, and `pupson-print-ready` are
  private. The older `pupson-assets` bucket is also private.
- Verified browser roles cannot select from PS-CLOSE tables and `service_role`
  retains access.
- Removed browser execution rights from the legacy privileged trigger and set
  immutable search paths on all PupsonStuff trigger functions flagged by the
  security advisor.
- Added covering indexes for every PS-CLOSE foreign key flagged by the
  performance advisor.
- Executed a rollback-only persistence exercise across the full database graph:
  media → pet identity → creative job/attempt → approved output → print asset →
  catalog → paid order/item → blocked dry-run fulfillment/event.

The remaining Supabase `rls_enabled_no_policy` notices are intentional for the
server-only PS-CLOSE tables: RLS is enabled, browser grants are revoked, and only
the service role is admitted. No PupsonStuff security-advisor warnings remain.

## 2. Catalog certification — blocked on operator credentials

- Certified active catalog variants: **0**.
- `PRINTIFY_API_KEY` and `PRINTIFY_SHOP_ID` are not available in the current
  environment.
- The repository now exposes `pnpm printify:sync` for read-only live catalog
  discovery once the key is supplied.
- Do not invent or copy placeholder IDs. Persist reviewed mappings through the
  authenticated catalog-certification route as `sandbox_verified` first.

## 3–4. End-to-end and failure-path testing — partially complete

- Type-check: passed.
- Automated tests: 27/27 passed.
- Production build: passed; 18 routes generated.
- Added tests proving queue idempotency, dry-run no-purchase behavior, and
  missing-shop fail-closed behavior.
- Added `pnpm launch:preflight`, which checks configuration and read-only
  provider connectivity without printing secrets.
- Current local preflight: 7 checks pass and 16 configuration checks are
  blocked because no `.env.local` exists.
- No dedicated PupsonStuff Vercel project exists in the connected account; the
  only visible project is `crispy-waddle-jhadina-web`.

Real Stripe test checkout/webhook replay, OpenAI/Muapi generation, live Printify
catalog discovery, and deployed browser testing require the intended deployment
plus its non-production credentials.

## 5. Physical sample gate — reached, not executed

A physical sample order requires a reviewed catalog mapping, a real print-ready
asset, the intended Printify shop, a shipping recipient, and authorization for
the charge. None were guessed, and no order was placed. Keep
`PUPSON_FULFILLMENT_MODE=dry_run` until the delivered sample passes identity,
crop, bleed, DPI, color, placement, packaging, tracking, and condition review.
