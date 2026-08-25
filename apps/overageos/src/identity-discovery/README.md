# OverageOS Identity Discovery

This package boundary is for corroborating person/claimant candidates from public or authorized sources. It does **not** establish legal entitlement and does not authorize outreach.

## Evidence sources

- public/government records
- authorized people-search / skip-trace providers
- public-web discovery
- public-social / username discovery (for example Sherlock- or Maigret-style enumerators)
- additional authorized OSINT sources configured by the application

## Confidence

The resolver should expose a deterministic percentage from 0–100 representing **identity-evidence confidence**, not probability of legal entitlement. The percentage must be accompanied by the evidence and conflicts that produced it.

## Contact surface

A candidate packet may contain currently observed contact channels:

- phone numbers
- email addresses
- physical/mailing addresses
- public social profiles
- public websites/business profiles

Each contact observation must retain source, provenance, observed-at/freshness, and confidence. Do not silently promote stale or conflicting contacts to current.

## Related contacts

The resolver may return a ranked `relatedContacts` collection representing people/entities connected by corroborated public evidence. This is **not** a recommendation to contact them. Each relationship requires provenance and a relationship type; weak or inferred relationships remain review-only.

## Human gates

`CANDIDATE` and `REVIEW_REQUIRED` never authorize outreach.

`VERIFIED` requires evidence-supported entitlement in the OverageOS verification layer.

Even a verified claimant remains subject to the separate outreach/use policy gate. Commercial solicitation or other restricted uses must remain human-reviewed/restricted as required by policy.

No adapter should fabricate live results. Test fixtures must be clearly marked as controlled/synthetic.
