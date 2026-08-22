# PupsonStuff order persistence

## What changed

Milestone 9 established real Stripe Checkout. The next pass adds the durable order boundary without pretending fulfillment is complete.

1. `/api/checkout` treats the browser cart as untrusted.
2. Product, variant, style, quantity, and price are resolved against `data/hotspots.ts` on the server.
3. Stripe line-item product metadata carries the stable PupsonStuff product/variant/style identifiers.
4. `/api/stripe/webhook` verifies Stripe's signature and listens for paid Checkout Session events.
5. The webhook retrieves the authoritative Stripe line items and writes an idempotent order + item snapshot to Supabase.
6. Duplicate Stripe delivery is safe because `stripe_session_id` and `stripe_line_item_id` are unique.

## Deliberate boundary

The order item has a nullable `preview_path`, but the generated artwork is currently a browser `data:` URL stored in localStorage. That image is **not** written into the database and is not yet durable for fulfillment.

The next human-gated infrastructure step is a private Supabase Storage bucket plus a server-side preview upload path. Only after that should Printful/Printify submission be wired to the paid order.

## Required environment

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase service-role key is server-only and must never be exposed through a `NEXT_PUBLIC_` variable.

## Human gate

The repository now contains the migration and webhook code, but the connected `Pupsonstuff` Supabase project is currently inactive. Applying the migration and configuring the Stripe webhook requires access to the live project/dashboard and real secrets; those steps are intentionally not fabricated or claimed complete.
