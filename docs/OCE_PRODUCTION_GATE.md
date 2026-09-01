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
| 6.74 Watchlist/alerts | CONFIRMED | Watchlist contract + tests | Domain contract exists; durable tables were previously absent |
| 6.75 Alert delivery | CONFIRMED | Delivery contract + tests | Domain contract exists; durable delivery tables were previously absent |
| 6.76 Feedback | CONFIRMED | Feedback contract + tests | Domain contract exists; durable feedback tables were previously absent |

## Database audit — concrete finding

The connected Jhadina Supabase project is healthy, but its public schema did **not** contain OCE-specific watchlist, alert-delivery, feedback, or assessment tables. It does contain the corporate-intelligence entity/evidence/relationship tables used by the OCE persistence adapter.

A second concrete mismatch was found: the repository adapter calls `upsert(..., { onConflict: "entity_id,fingerprint" })` for corporate evidence and `onConflict: "from_entity_id,to_entity_id,relationship_type,source,source_reference"` for relationships, while the inspected database schema exposed no corresponding unique constraints. Those upserts therefore require schema support before they can be considered production-safe.

## Remediation added to branch

Migration added:
`supabase/migrations/20260901000000_oce_watchlist_delivery_feedback.sql`

It adds:
- unique indexes required by the corporate evidence/relationship upserts;
- `oce_watchlist_entries`;
- `oce_alert_events` with watchlist/fingerprint uniqueness;
- `oce_alert_deliveries` with idempotency uniqueness;
- `oce_feedback_events`;
- `oce_versioned_assessments`;
- RLS enabled on all new OCE tables.

**The migration has NOT been applied to the connected production database.** It is intentionally left as a reviewed migration until schema application is explicitly authorized.

## Remaining blockers

1. Apply and verify the OCE persistence migration in the intended environment.
2. Wire the 6.74–6.76 domain contracts to repositories/services.
3. Verify 6.66–6.73 runtime paths against the persistence layer.
4. Add delivery provider/router, retry/backoff/max-attempt/dead-letter policy.
5. Harden feedback event IDs against same-timestamp collisions.
6. Replace the 32-bit alert fingerprint with a collision-resistant digest or enforce a sufficiently strong database identity strategy.
7. Execute build/tests/CI against the branch.

## Separate security finding

The connected Supabase project has a **critical RLS advisory**: `public.jhadina_research_source_performance_policy` has RLS disabled. This is outside OCE's immediate migration and was **not automatically changed** because enabling RLS without deliberate policies can block intended access. The remediation should be designed and applied separately.

## Conclusion

OCE is no longer a missing-stage problem. It is now an **integration-hardening problem**: the code is substantially present, but the database contract, durable alert/feedback persistence, delivery runtime, and executable verification still need to be closed before the production gate can pass.
