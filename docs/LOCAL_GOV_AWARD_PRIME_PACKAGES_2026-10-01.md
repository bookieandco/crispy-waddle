# LOCAL-GOV.5 — Awarded Prime Intelligence + Subcontract Work Packages

## Purpose

Turn verified local/public award observations into reusable prime-contractor intelligence and evidence-backed subcontract work packages that feed the existing Jhadina Provider Graph.

## Award miner

`/api/internal/opportunities/public/awards`

The worker reads only active public-opportunity inbox rows whose canonical stage is `award`.

An award is accepted only when the source signal contains:

- awarded prime name;
- official evidence reference;
- source provenance;
- jurisdiction/buyer context.

Accepted awards become durable `jhadina_public_awards` rows.

## Prime intelligence

Award history is grouped into `jhadina_public_prime_profiles` with:

- provider identity;
- observed award count;
- observed award value;
- states;
- buyers;
- NAICS;
- PSC;
- capability keywords;
- evidence references.

Verified local/public award evidence is admitted into the same Provider Graph evidence union as SAM/USASpending/FPDS evidence, but it is explicitly labeled `local_public_award`.

The award-neighbor engine now accepts local/public award seeds without describing them as federal awards.

## Work-package compiler

Detailed subcontract packages are created only when the upstream adapter/research layer supplies explicit scope requirements with evidence.

The compiler does **not** infer or invent trades from a vague award title.

Each scope requirement can carry:

- label and description;
- category;
- NAICS/PSC;
- keywords;
- geography;
- required licenses;
- required certifications;
- estimated share of award value;
- evidence references.

The compiler produces canonical `BrokerRequirement` objects and durable `jhadina_public_work_packages`.

Every package remains human-review-required and carries:

- `automaticPrimeContactAuthorized=false`;
- `automaticProviderOutreachAuthorized=false`;
- `bidSubmissionAuthorized=false`.

## Provider discovery

`/api/internal/opportunities/public/work-package-providers`

Provider discovery uses existing reusable provider rails instead of fabricating a SAM notice:

- Exa broad-company discovery when configured;
- FMCSA for relevant logistics scopes;
- FSIS for relevant food scopes.

Candidates are scored with the existing Broker scorer.

Observed local/public prime profiles are converted into previous-win fingerprints and used as discovery similarity evidence. Similarity never establishes current capability, price, eligibility, capacity, licensing, or willingness.

Provider results persist in `jhadina_public_package_provider_candidates`.

## Scheduler

The production OIDC sequence now includes:

- minute 55: read-only adapter shadow/certification;
- minute 05: award/prime miner;
- minute 10: work-package provider discovery.

Source discovery remains at minute 45.

## Durable tables

- `jhadina_public_awards`
- `jhadina_public_prime_profiles`
- `jhadina_public_work_packages`
- `jhadina_public_package_provider_candidates`

All are service-role-only.

## Authority boundary

LOCAL-GOV.5 automates discovery, normalization, package compilation, provider discovery and ranking only.

It does not authorize:

- prime contact;
- provider outreach;
- quote requests;
- bid submission;
- teaming commitments;
- contract acceptance or execution;
- payment or money movement.

## Next

- LOCAL-GOV.6 — state-specific compliance packs and package gating;
- LOCAL-GOV.FINAL — hydrate national coverage, live evidence, production metrics and end-to-end certification.
