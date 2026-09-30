# SAM award-neighbor provider discovery

## Goal

Use prior federal award wins as evidence-backed discovery seeds for finding similar companies that may be relevant to a current solicitation.

This is a discovery and ranking lane only. Similarity to a prior winner is not proof of current capability, capacity, price, eligibility, subcontractability, registration, or willingness to perform.

## Canonical flow

1. Find prior award winners from authoritative award history.
2. Preserve the award features that explain the match:
   - NAICS
   - PSC
   - award-description capability language
   - agency when present
   - award amount when present
   - recipient UEI when present
3. Build a bounded winner-cluster profile.
4. Run a second-pass search for *other* companies in that cluster.
5. Exclude the seed winners from the peer expansion itself.
6. Merge peers with the normal provider pool.
7. Re-verify identity/capability through independent sources such as SAM Entity.
8. Keep solicitation-specific subcontractability/origin/compliance gates.
9. Human-governed outreach, submission, contracting, and payment boundaries remain unchanged.

## Source priority

- USAspending remains the high-volume award-history discovery source.
- SAM.gov Contract Awards is a narrow corroboration source where quota permits.
- SAM.gov static award reports can support batch/historical cross-checks.
- SAM Entity remains an identity/registration evidence source, not proof of performance.

References:

- https://open.gsa.gov/api/contract-awards/
- https://sam.gov/reports/awards/static
- https://www.usaspending.gov/

## External repository references

The following user-supplied repositories were reviewed for ingestion/research patterns:

- https://github.com/webtruffle/us-federal-contract-awards
- https://github.com/corintxt/sam-contract-fetcher

They are reference implementations only. Jhadina does not create a second award authority or blindly copy third-party code/data.

## Scoring boundary

Award-neighbor provenance contributes only a small bounded similarity signal. It does not count as a distinct corroborating source when it comes from the same underlying award dataset.

A peer discovered only through award history remains `review_required`. It can reach the normal provider `candidate` state only after a distinct source corroborates it and the existing capability score is sufficient.
