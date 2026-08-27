# Booking Preparation Core v1

## Contract

`OPEN Offer -> ACCEPTED Offer -> deterministic BookingPackage -> PENDING_APPROVAL`

The service prepares a complete dispatch package only after the offer is explicitly accepted. An `OPEN` offer cannot be prepared.

## Safety boundary

This package is preparation-only. It does not:

- book freight
- accept offers
- contact a shipper or carrier
- move money
- change ELD state
- invoke transportation providers

The resulting package always has `approvalRequired: true` and `executionStarted: false`.

## Required package contents

- offer/load identity
- shipper, carrier, truck, and driver identity
- origin/destination lane
- pickup/delivery schedule
- agreed rate and currency
- immutable preparation timestamp
- deterministic source marker (`ACCEPTED_OFFER`)

The human/compliance approval layer remains the only boundary capable of advancing the package into execution.
