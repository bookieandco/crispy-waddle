# OPP-AUDIT.1–6 — Handoff and GitHub Reconciliation

## Scope

This audit reconciles the current Opportunity stack against prior Jhadina handoff notes and the historical GitHub work for side-income, SAM, OverageOS, POD, affiliate, creator/content, staffing/placement, and experimental energy/compute opportunities.

`@jhadina/opportunity-core` is the canonical Opportunity domain. Growth, Money, Placement, Commerce, Director, PupsonStuff, and OverageOS retain their own domain truth and execution boundaries.

## Historical reconciliation

| Historical work | OPP-AUDIT decision |
| --- | --- |
| PR #158 Money Opportunity OS | Preserve provenance/economics/scoring intent under Opportunity Core. |
| PR #159–#160 SAM scoring/partner routing | Reuse current deterministic SAM scoring and capability-gap partner disposition. |
| PR #161 / #174 research persistence | Restore stable-ID idempotency and prevent completed research tasks from regressing. |
| PR #176–#179 OPP-1.1–1.4 | Superseded by dedicated Opportunity Core + authenticated Supabase persistence; do not revive the Growth-owned duplicate aggregate. |
| PR #180 OCE-2 | Reuse current deterministic capability/NAICS/set-aside/timing signals; do not manufacture full SBA legal eligibility. |
| PR #181 information-broker blueprint | Keep `contract_only`; historical blueprint is not a live source. |
| PR #182–#184 OCE commercial/queue/projection | Restore commercial normalization and OCE-4 queue behavior in Opportunity Core; keep projection downstream. |
| PR #165 affiliate intelligence | Growth remains affiliate experimentation/learning owner; external feed remains unbound. |
| PR #189 SH-1 | Absorb provider/economics/risk/attribution concepts; do not create a third Opportunity contract authority. |
| PR #199 general AI POD | Keep separate from PupsonStuff and `contract_only` until production-bound. |
| PR #279 PupsonStuff PS-CLOSE | PupsonStuff remains POD execution owner; Opportunity Core does not own checkout/Stripe/Printify/fulfillment. |
| JH-022/023/024 energy/compute | Keep disabled while the architecture fork remains unresolved; no mining/signing/wallet/hardware execution. |

## Provider/readiness truth

- SAM.gov: adapter-ready; server-side discovery, authenticated user binding, canonical persistence, deterministic scoring/economics/partner planning.
- OverageOS: adapter-ready; consumes the versioned recovery-candidate handoff without reading OverageOS provider/storage internals.
- Placement external jobs: contract-only; Placement owns pursuit after handoff, but no live job-board feed is claimed.
- Affiliate: contract-only external feed; Growth owns experiments and realized learning.
- PupsonStuff POD: adapter-ready execution owner with separate production gates.
- General AI POD: contract-only and separate from PupsonStuff.
- Dropshipping: contract-only until supplier/product feeds are bound through Commerce.
- Creator/faceless content: Growth opportunity intelligence → DirectorOS approved production.
- Digital products/services and information broker: contract-only.
- Energy/compute: disabled experiment.

## OPP-AUDIT.3 — queue and provider truth

The canonical queue restores OCE-4's useful behavior: stable-ID deduplication, newest-version retention, deterministic ranking/filtering, and evidence freshness. It does not restore the historical duplicate Growth Opportunity aggregate.

## OPP-AUDIT.4 — vertical convergence

Employment and commercial adapters normalize AI jobs/gigs, affiliate, POD, dropshipping, creator, digital-product, and service candidates. SAM preserves the existing deterministic score, planning economics, advisory action queue, and partner plan. `PARTNER_REQUIRED` becomes a `capabilityGap` and adds a `find_partner` research task; it never contacts anyone.

OverageOS remains decoupled. `RecoveryOpportunityCandidate` is translated into canonical evidence, while Overage verification level stays metadata and cannot manufacture claimant/entitlement verification.

## OPP-AUDIT.5 — governed pursuit

The first user approval means approve for research. It creates one stable durable research case, idempotent tasks, and an outbox event. Completed tasks require evidence and cannot regress. Evidence-complete research may move a general opportunity to `ready`; recovery additionally requires complete claimant identity and entitlement verification.

`ready` does not apply, bid, contact, publish, spend, transfer, mine, or fulfill. Consequential execution remains separately governed by the owning subsystem. Recovery verification is bound to the exact canonical opportunity ID; a complete decision from one claim cannot certify another claim.

## OPP-AUDIT.6 — outcome learning

Realized outcome lineage preserves source owner, evidence refs, transaction refs, action/execution refs, gross revenue, refunds, direct costs, fees, net revenue, total costs, profit, margin, hours, and realized dollars per hour.

Money Core remains financial truth. Opportunity Core derives deterministic metrics/lineage; Growth consumes the resulting learning signal without rewriting financial actuals. The public outcome endpoint is user-reported and forces `sourceOwner = user`, so clients cannot impersonate Money/Commerce/Placement/OverageOS. Growth consumes the resulting learning signal; it is not a financial-truth producer. The database ignores caller-supplied learning payloads and derives both the closed canonical Opportunity payload and learning signal from the persisted Opportunity plus the reconciled outcome receipt; margin and realized dollars/hour are rechecked in SQL.

## Explicit follow-on work

Live external AI-job feeds, affiliate-network feeds, dropshipping supplier/catalog feeds, general AI-POD production completion, information-broker discovery, full SBA legal eligibility/source coverage, and any energy/compute mining execution are not claimed complete. The forward-only Supabase Opportunity migration also still requires production application and end-to-end runtime acceptance; the already-merged PR #310 base migration remains immutable.

These are provider/runtime follow-ons, not reasons to create another Opportunity architecture.


## Production acceptance

Production acceptance completed against the connected Supabase project after PR #316 merged.

- The pre-canonical `jhadina_opportunities` table was confirmed empty, archived as `jhadina_opportunities_legacy_20260828`, and removed from client-role access.
- Canonical migrations are recorded as `20260920030000_jhadina_canonical_opportunities` and `20260920033000_opportunity_pursuit_outcome`.
- Production-only drift/repair migrations are recorded as `20260920133625_reconcile_legacy_opportunity_table` and `20260920134244_fix_opportunity_outcome_type_column`.
- Runtime acceptance found and repaired an outcome-learning SQL bug where the RPC read `v_existing.type` instead of the canonical `opportunity_type` column.
- Authenticated lifecycle smoke passed: ingest → triage → research → evidence-complete ready → user-reported outcome.
- Recovery smoke passed: public recovery promotion blocked → exact-ID complete verification → service-only ready promotion → trusted OverageOS outcome.
- Cross-user isolation smoke passed: another authenticated user could neither see nor mutate the first user's Opportunity.
- All smoke tests used synthetic users inside transactions and intentionally rolled back; no test users or Opportunity rows remain.
- Caller-supplied learning payloads were proven ignored; the database derives learning and closed Opportunity payloads from persisted truth.
- `anon` has no Opportunity table or RPC access; authenticated users have read-only table access plus the six intended user RPCs; trusted recovery/outcome RPCs are service-role-only.

Supabase Security Advisor intentionally flags the six authenticated Opportunity write RPCs because they are `SECURITY DEFINER`. The current design keeps these as narrow validated write boundaries: direct authenticated table writes are revoked, every user RPC binds to `auth.uid()`, execute grants are explicit, and cross-user runtime isolation passed. Treat a move to a non-exposed internal RPC architecture as a future hardening option, not a reason to weaken current RLS/grants.

A separate project-wide security finding remains outside Opportunity scope: `public.jhadina_research_source_performance_policy` has RLS disabled. Do not silently enable RLS without first defining its intended access policy.
