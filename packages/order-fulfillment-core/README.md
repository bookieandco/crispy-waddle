# @jhadina/order-fulfillment-core

Order, merchant handoff, manifest, and custody contracts for regulated marketplace fulfillment.

## Boundary

The Commerce OS owns the normalized order. The merchant remains the system of record for its back-office fulfillment workflow through `MerchantOrderAdapter`. A manifest creates an auditable handoff object. `CustodyLedger` records control transitions.

## Flow

```text
Paid Checkout
    -> Merchant Order
    -> Picking
    -> Ready for Handoff
    -> Manifest Sealed
    -> Courier Handoff
    -> Courier Control
    -> Delivery
```

Policy evaluation happens before acceptance and handoff. This package does not decide the law itself; it consumes a jurisdiction-specific policy version produced by the authoritative policy layer.

## Custody principle

A successful customer payment does not imply physical custody. Inventory remains under merchant control until a verified handoff is recorded. A courier does not become the custodian merely because a route was assigned.

The custody ledger is append-only in the intended production implementation and should be linked to the order, manifest, actor, policy version, timestamp, and evidence references.

## Adapter principle

A merchant can keep its existing POS/back-office system. The marketplace calls the adapter; the adapter translates the normalized contract into that merchant's provider API. External IDs remain references for reconciliation and never replace internal order IDs.
