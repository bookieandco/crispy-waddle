# @jhadina/merchant-onboarding-core

Merchant onboarding and connection boundary for dispensaries and other regulated merchants.

## What the merchant keeps

The merchant retains its existing POS, inventory, payment, catalog, and back-office systems. Commerce OS stores connection metadata and normalized marketplace state rather than requiring a replacement system.

## Onboarding flow

```text
Application
   ↓
Merchant + Locations
   ↓
License Verification
   ↓
Location / Jurisdiction Verification
   ↓
Connection Setup
   ├── POS
   ├── Inventory
   ├── Payments
   ├── Catalog
   └── Fleet
   ↓
Approval / Restriction
   ↓
Marketplace Activation
```

The connection object contains provider, external account reference, capabilities, and lifecycle status. Secrets/tokens should remain in a dedicated credential vault or provider connection service and are intentionally absent from the application contract.

## Governance

Jhadina can help prepare an onboarding packet, identify missing information, compare merchant performance, and recommend remediation. It cannot approve a merchant by itself. Verification and activation remain deterministic/application-controlled actions.
