# JHADINA-KNOWLEDGE.WIKIPEDIA.01–.05 — research adapter / Ask composition

Prepared: 2026-10-22. Scope: source-only, read-only Wikipedia research in Jhadina's existing Ask/JLLM pipeline.
**Not** deployment or owner-verified acceptance. Work is intentionally isolated from open Ask recovery PR #1479.

## What ships

| Gate | Implemented | Evidence / boundary |
| --- | --- | --- |
| .01 Research connector | MediaWiki Action API `https://en.wikipedia.org/w/api.php` via bounded server-side fetch | Explicit informational prompts only; no credentials, owner context, artifacts, personal details or bulk crawl |
| .02 Article retrieval | Search generator, extract, canonical URL, latest revision ID/timestamp | Up to 3 read-only extracts; no invented citations; page-specific revision permalink |
| .03 Context Builder | Read-only adapter composes into existing canonical KnowledgeContextProvider mounted by `handleJhadinaCommand` | Uses existing Context Builder, identity verification, audit, policy, decision and approval paths; no competing LLM/router |
| .04 Verification | Wikipedia marked `UNVERIFIED`; model context carries citation, revision, retrieval date, community-edit warning | Original references / primary-source corroboration required for consequential claims. No automated independent cross-check is claimed |
| .05 Caching / Memory | Process-local 15-minute / 40-entry cache for public queries | **Never** persists encyclopedia text to owner Memory, canonical K-1.5, Supabase, or long-term personalization |

## Trust, privacy, attribution and API requirements

- Wikipedia text is an attributed, lower-trust external source. The model must not follow instructions embedded in an excerpt. Public encyclopedia excerpts cannot authorize execution, modify memory, bypass approval, or claim verification.
- External search is **opt-in by intent**, not arbitrary web search: only explicit Wikipedia/encyclopedia queries or narrow encyclopedic question forms reach Wikimedia. A privacy filter rejects first-person references, familial/private terms, email addresses, phone-like strings, oversized prompts and multiline/markup content. This is a conservative safeguard, **not** a complete DLP system.
- Fixed HTTPS host. No user-controlled fetch destinations, external links, dynamic language hosts, edit actions, credential use, or OAuth.
- Wikimedia requires a meaningful `User-Agent` with contact information; requests identify this repository as the contact. Requests are serial per active lookup with a 4.5s timeout, finite response/body limits, no retries on 429/503, and bounded `Retry-After` cooldown. **Multi-instance global throttling is not commissioned**; deploy with appropriate request volume and consider a shared limiter if scaled.
- Source: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits and https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy
- RESTBase behind `/api/rest_v1/` is being retired; do not add a new dependency on it. Stable Action API is used here; the modern MediaWiki REST API at `/w/rest.php/v1/` can be added later if needed. See https://www.mediawiki.org/wiki/RESTBase/deprecation .
- Wikipedia pages are typically licensed under Creative Commons Attribution-ShareAlike; the retrieved citation includes title, article link, revision permalink and licensing notice. If copied outside JLLM, preserve license attribution and any share-alike obligations.

## Files

- `apps/jhadina-web/src/lib/research/wikipedia-research-provider.ts`: query extraction, transport, bounded cache, normalized provenance, evidence conversion.
- `apps/jhadina-web/src/lib/research/wikipedia-knowledge-context-provider.ts`: composite public/canonical provider.
- `apps/jhadina-web/src/lib/intelligence/jhadina-command.ts`: existing verified Ask composition point, one wrapper only.
- `apps/jhadina-web/src/lib/research/wikipedia-research-provider.test.ts`: deterministic mocked transport and privacy/governance cases.

## Verification checklist

1. Run `pnpm --filter @jhadina/jhadina-web test -- src/lib/research/wikipedia-research-provider.test.ts`.
2. Run `pnpm --filter @jhadina/jhadina-web type-check` and the existing Ask command/Context Builder regression tests.
3. Review exact branch head, CI, and the diff against main (PR #1479 remains separate).
4. In an **owner-authenticated private preview**, ask "Who was Ada Lovelace?" and check evidence and citation; ask "Continue working on my projects" and confirm no Wikimedia request; simulate upstream 429 and confirm fail-closed answer.
5. Obtain separate approval to merge/deploy. Verify production User-Agent acceptance, effective shared rate limits, live reference fidelity, UI citation display and mobile Safari. Until then, **do not claim runtime acceptance**.

## Explicit non-goals

Wikipedia is **not** a general browsing engine, academic/primary-source validator, citation-generation guarantee, durable research archive, knowledge-graph admission pipeline, or memory-ingestion job. Real live provider service, rate quota, restored login/Ask navigation, and owner-device acceptance have not been established by source changes alone.
