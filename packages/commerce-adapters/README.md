# @jhadina/commerce-adapters

Provider-agnostic POS and inventory contracts for connecting a merchant's existing back office to Commerce OS.

## Boundary

The merchant remains the system of record for its POS/inventory data. Commerce OS maintains a normalized marketplace read model and references the merchant's external identifiers.

The adapter layer:

- connects an authorized merchant account;
- reads catalog and inventory;
- creates or cancels marketplace orders in the merchant POS when supported;
- reserves/releases inventory idempotently;
- confirms fulfillment;
- accepts signed provider webhooks/events.

It does **not** require Commerce OS to replace the merchant POS.

## Recommended flow

```text
Merchant POS / Inventory
          |
      Adapter
          |
   Normalize + verify
          |
   Commerce read model
          |
   Offer / availability engine
          |
       Customer
          |
      Marketplace order
          |
   Reservation / POS order
          |
      Fulfillment
```

## Important design rules

1. `externalId` is retained for reconciliation but is never the marketplace primary key.
2. Inventory is reserved through an idempotent operation; checkout should not infer availability from a stale read alone.
3. Provider webhooks are treated as untrusted input until signature verification, schema validation, and authorization checks pass.
4. Adapter failures must not silently mutate the marketplace's authoritative order state.
5. Regulated-product eligibility, jurisdiction rules, custody, identity verification, taxes, and payment authorization remain outside the adapter.
6. The adapter should request only the provider scopes necessary for its declared capabilities.
