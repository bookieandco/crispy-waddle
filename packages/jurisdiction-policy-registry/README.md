# @jhadina/jurisdiction-policy-registry

Versioned, evidence-backed policy registry for jurisdiction-specific commerce and delivery rules.

## Design

The registry is authoritative for policy configuration. Jhadina can analyze policies and recommend changes, but it cannot silently publish or activate them.

Each active policy has:

- jurisdiction and version
- effective dates
- delivery permissions and zones
- merchant/customer/product/courier requirements
- payment constraints
- seller-of-record setting
- evidence references
- approval metadata

## Resolution

At runtime, the Compliance Gate resolves the policy that was active for the relevant jurisdiction and timestamp. The resolved policy version is carried into the compliance result and downstream events so historical decisions remain reproducible.

## Governance

```text
Evidence
   ↓
Policy Draft
   ↓
Human/authorized approval
   ↓
Active Policy
   ↓
Compliance Gate
   ↓
Dispatch / Checkout / Payment decisions
```

No policy should be inferred from a model response or an unverified web snippet. The production registry should use authoritative legal/regulatory sources and an explicit approval workflow.
