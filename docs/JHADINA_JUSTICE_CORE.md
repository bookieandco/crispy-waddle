# Jhadina Justice Core

## Purpose

Justice Core is Jhadina's governed legal-information and public-records subsystem. It is not a law firm, legal representative, or autonomous legal-advice engine.

Its job is to retrieve, structure, verify, compare, and explain legal evidence while preserving jurisdiction, effective-date, provenance, citation, and uncertainty information.

## Operating path

User question -> authenticated identity -> JANET approved context -> Justice evidence retrieval -> citation/provenance validation -> DELIA analysis -> MARISA only for explicitly authorized operational actions -> Policy/Security Core -> Action Handler -> durable audit.

Justice Core must never bypass the normal Action Executor.

## Source hierarchy

1. Primary authority: enacted statutes, regulations, rules, judicial opinions, and official court/agency records.
2. Official guidance: government explanations and administrative guidance.
3. Public records: official records obtained through lawful public-record workflows.
4. Secondary analysis: legal analytics, research, and educational resources.
5. Discovery-only sources: scrapers, aggregators, lists, and search-oriented datasets.

Discovery-only material can locate evidence but cannot by itself support a high-confidence legal conclusion.

## Initial source adapters

- `statedecoded/statedecoded`: state legislation/data discovery.
- `freelawproject/citation-regexes`: citation recognition and normalization support.
- `davidawad/statedb`: state/jurisdiction data discovery.
- `ankane/awesome-legal`: resource discovery only.
- `Liquid-Legal-Institute/Legal-Text-Analytics`: legal text analytics research.
- `evolsb/claude-legal-skill`: workflow/prompt reference, never authority.
- `PSLmodels/Tax-Calculator`: tax-policy modeling/reference.
- `GSA/digitalgov-pra`: public-records/PRA workflow reference.
- `nischalbasuti/justia_scraper`: case-law discovery only; retrieved material must be independently verified against authoritative sources before being treated as evidence.

## Non-negotiable invariants

- Every finding has provenance.
- Every citation has a verification state.
- Jurisdiction is explicit.
- Effective dates are explicit when relevant.
- Evidence cannot be silently upgraded from secondary/discovery to primary authority.
- `isLegalAdvice` is always false in the Justice Core contract.
- Conflicting authorities are surfaced, not averaged away.
- The system says `UNKNOWN` when evidence is insufficient.
- User identity comes from the authenticated application boundary, never from an untrusted `userId` field.
- Justice-related external actions go through Policy/Security and the Action Ledger.

## Integration with the kernel

Justice Core is a domain subsystem, not a second operating system. It consumes JANET context and returns evidence/finding packets to DELIA. MARISA may request actions such as preparing a records request or creating an internal case task, but execution is governed by the same VerifiedActionExecutor used by every other Jhadina subsystem.

## Next implementation stages

1. Persistent Justice evidence tables with RLS.
2. Source adapters and immutable evidence snapshots.
3. Citation extraction/verification pipeline.
4. Jurisdiction and effective-date resolver.
5. Conflict/authority resolver.
6. Justice-specific DELIA strategy provider.
7. Read-only research actions first; operational actions only after policy definitions exist.
8. End-to-end audit tests.
