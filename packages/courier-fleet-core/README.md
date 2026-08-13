# @jhadina/courier-fleet-core

Provider-neutral dispatch and delivery contract for regulated marketplace fulfillment.

## Boundary

The Commerce OS owns the delivery job, order relationship, manifest reference, policy version, and durable delivery events. A fleet provider owns driver dispatch, routing, and its own operational telemetry.

The adapter does not grant custody merely because a driver is assigned. Custody changes only through an explicit handoff confirmation referencing the manifest and evidence.

## Flow

```text
Order + Manifest
      -> Dispatch
      -> Courier Assigned
      -> Merchant Arrival
      -> Verified Handoff
      -> In Transit
      -> Customer Arrival
      -> Verified Delivery
```

## Provider neutrality

Fleetbase, an internal fleet service, or an authorized delivery partner can implement `CourierFleetAdapter`. The marketplace should not depend on a specific fleet vendor.

## Compliance boundary

`FleetPolicy` is jurisdiction-aware. The adapter does not decide whether a delivery is lawful; it enforces the active policy supplied by the Commerce OS. Identity, age/eligibility, delivery-zone, product, and custody requirements should be validated before dispatch and again at the applicable handoff/delivery gates.
