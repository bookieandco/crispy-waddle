# @jhadina/payment-core

Provider-agnostic payment domain contract for marketplace commerce.

## Design principles

- Commerce OS owns orders and the internal financial ledger.
- Payment providers are adapters behind `PaymentProvider`.
- Provider references never become the primary business identifiers.
- Merchant payout, platform fee, tax, refund, and reconciliation are first-class records.
- Seller-of-record and payment-policy decisions are explicit and jurisdiction-aware.
- No provider is assumed to support regulated products; eligibility must come from the applicable provider and jurisdiction policy.

## Flow

```text
Order
  -> PaymentIntentRequest
  -> PaymentProvider adapter
  -> Payment event
  -> Internal financial ledger
  -> Payout / refund / reconciliation
```

## Important boundary

This package intentionally does not contain Stripe-specific types or SDK calls. Stripe, a regulated-commerce payment provider, or another processor can implement the adapter only when its terms and the applicable law permit the transaction.

The package also does not decide tax rates, seller-of-record status, or whether a payment method is legally available. Those are policy/configuration concerns outside the provider adapter.
