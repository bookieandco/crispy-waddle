# SBA SUBNet Source Policy

SBA SUBNet is an official U.S. Small Business Administration listing where prime contractors publish subcontracting opportunities for small businesses.

Source:
https://legacy.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities

## Role in Opportunity Core

SUBNet is a **subcontracting-opportunity source**. It is not a provider-verification source.

A SUBNet record can establish that:
- a prime contractor publicly posted a subcontracting opportunity;
- SBA displayed the posted title, prime, closing date, place of performance, NAICS code, and point of contact.

A SUBNet record does **not** establish that:
- the prime or a separate supplier has been independently verified for capability;
- the user is eligible to perform the work;
- outreach has been approved;
- a quote, bid, contract, signature, or payment is authorized.

## Ingestion behavior

- Read only the public SBA listing and opportunity-detail links.
- Use bounded sequential pagination.
- Do not crawl unrelated SBA pages.
- Do not submit forms, post listings, or contact opportunity contacts.
- Store the SBA source URL and last-seen timestamp.
- Preserve public business contact details only as source evidence for human review.

## Authority boundary

Automated discovery is intelligence-only.

The runtime sets no authority for:
- email or phone outreach;
- quote submission;
- bid submission;
- contract signature;
- procurement/payment.

Those remain explicit human-governed actions.

## Relationship to SAM provider discovery

SUBNet answers: **"Which primes are currently looking for subcontractors?"**

SAM Entity / USAspending / other corroborated sources answer: **"Which companies appear capable of fulfilling a requirement?"**

Those evidence roles must remain separate.
