# OCE Production Gate — 6.x

**Branch audited:** `feat/oce-6.74-watchlist-alerts-v11`

**Gate status:** `BLOCKED`

> Earlier audit correction: 6.66–6.73 are present on v11. The remaining work is integration and production verification.

## Stage evidence

| Stage | Status | Evidence | Gate note |
|---|---|---|---|
| 6.66 Principal enrichment | CONFIRMED | Principal provider, evidence persistence, orchestrator, OpenCorporates adapter | Implementation exists; runtime/provider verification remains |
| 6.67 Opportunity discovery/evidence | CONFIRMED | Procurement discovery, source registries, evidence/provenance/lifecycle | Implementation exists; end-to-end ingestion verification remains |
| 6.68 Identity resolution | CONFIRMED | Principal identity resolver + tests | Implementation/test surface present |
| 6.69 Confidence/role engine | CONFIRMED | Confidence/role engine + tests | Implementation/test surface present |
| 6.70 Principal↔corporate graph | CONFIRMED | Corporate relationship/owner/control graph layers | Implementation exists; persistence/runtime verification remains |
| 6.71 Multi-source enrichment | CONFIRMED | Multi-source business enrichment + tests | Implementation exists; live adapter coverage remains |
| 6.72 Opportunity↔principal | CONFIRMED | Principal intelligence + matching/tests | Implementation exists; end-to-end persistence remains |
| 6.73 Ranking | CONFIRMED | Opportunity/principal ranking + tests | Implementation exists; below-threshold policy integration remains to verify |
| 6.74 Watchlist/alerts | CONFIRMED | Watchlist contract + tests + repository contract/in-memory implementation | Durable persistence still depends on unapplied migration |
| 6.75 Alert delivery | CONFIRMED | Delivery contract + tests + repository contract/in-memory implementation | Durable persistence/provider runtime still missing |
| 6.76 Feedback | CONFIRMED | Feedback contract + tests + repository contract/in-memory implementation | Durable persistence/runtime still missing |

## Persistence hardening added in this pass

The core package now defines dependency-inverted repository contracts for all five persistence boundaries:
- `WatchlistRepository`
- `AlertEventRepository`
- `AlertDeliveryRepository`
- `FeedbackRepository`
- `VersionedAssessmentRepository`

It also includes in-memory implementations that establish the intended semantics before a Supabase adapter is added:
- explicit watchlist ownership filtering;
- alert deduplication by `(watchlistEntryId, fingerprint)`;
- delivery idempotency by `idempotencyKey`;
- append-only feedback with duplicate-ID rejection;
- assessment version-chain validation via `supersedesId`;
- defensive cloning so callers cannot mutate stored state through returned references.

The watchlist domain was aligned with the database contract by adding explicit `userId` ownership rather than deriving ownership from an ID naming convention.

Feedback event generation was hardened so repeated otherwise-identical events receive unique IDs unless an explicit ID is supplied. This closes the previously identified same-timestamp collision risk.

## Database audit — concrete finding

The connected Jhadina Supabase project is healthy, but its public schema does **not** currently contain the OCE-specific watchlist, alert-delivery, feedback, or assessment tables. It does contain the corporate-intelligence entity/evidence/relationship tables used by the OCE persistence adapter.

A second concrete mismatch was found: the repository adapter calls `upsert(..., { onConflict: "entity_id,fingerprint" })` for corporate evidence and `onConflict: "from_entity_id,to_entity_id,relationship_type,source,source_reference"` for relationships. Those upserts require the staged migration's unique indexes before they can be considered production-safe.

## Remediation staged on branch

Migration:
`supabase/migrations/20260901000000_oce_watchlist_delivery_feedback.sql`

It adds:
- unique indexes required by the corporate evidence/relationship upserts;
- `oce_watchlist_entries`;
- `oce_alert_events` with watchlist/fingerprint uniqueness;
- `oce_alert_deliveries` with idempotency uniqueness;
- `oce_feedback_events`;
- `oce_versioned_assessments`;
- RLS enabled on all new OCE tables.

**The migration has NOT been applied to the connected production database.** It remains staged pending explicit authorization.

## Remaining blockers

1. Apply and verify the OCE persistence migration in the intended environment.
2. Add Supabase implementations for the five repository contracts and wire them into 6.74–6.76 services.
3. Verify 6.66–6.73 runtime paths against the persistence layer.
4. Add delivery provider/router, retry/backoff/max-attempt/dead-letter policy.
5. Replace the 32-bit alert fingerprint with a collision-resistant digest or enforce a sufficiently strong database identity strategy.
6. Execute package/app build, tests, and CI against the branch.

## Separate security findings

The connected Supabase project has a **critical RLS advisory**: `public.jhadina_research_source_performance_policy` has RLS disabled. This was **not automatically changed** because enabling RLS without deliberate policies can block intended access. It must be designed and applied separately.

Supabase security advisors also report several `public` tables with RLS enabled but no policies, plus several `SECURITY DEFINER` functions executable by `anon`/`authenticated`. These are broader Jhadina security findings and remain separate audit/repair items.

## Conclusion

OCE is no longer a missing-stage problem. The persistence boundary is now defined and testable in the core package. The production gate remains **BLOCKED** until the Supabase adapter/runtime wiring, migration application, delivery runtime, broader security findings, and executable CI verification are closed.
