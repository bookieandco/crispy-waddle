# Jhadina personal Growth — Ryze feature delta (2026-10-18)

## Owner decision
This is **an internal upgrade to the existing Jhadina Growth/Opportunity/Social/Director stack**.
There is no independent agency, customer SaaS, public scanner, pricing, signup, payment,
tenant or subscription implementation. Reuse the canonical Growth Core exports.

## Evidence-based comparison
Ryze describes live SEO audits, speed monitoring, internal/broken link repair,
content optimization, search keyword/AI citation monitoring, scheduled reporting,
and approval-based CMS changes on its public product pages:
- https://www.get-ryze.ai/seo
- https://www.get-ryze.ai/ai-visibility-tool
- https://www.get-ryze.ai/changelog

Do not adopt unverified traffic/revenue guarantees, mass-produced low-quality pages,
automated backlink exchanges, Reddit astroturfing, or implied AI ranking guarantees.

## Existing work preserved
- `business-growth-gsc.ts`: read-only Google Search Console provider adapter
- `business-growth-search-content.ts`: metadata/canonical/product schema audit,
  existing-page-first action prioritization and governed original content handoffs
- `business-growth-evidence-discovery.ts`: provider-shaped SERP intent and sampled
  AI mentions/citations; browser input is unverified
- `business-growth-live-certification.ts`: evidence-based live release gates
- Existing Growth/Social/Director approvals, Marisa missions and Commerce outcome learning
- Merged Growth PRs #1304 and #1305 remain authoritative

## Additions in this PR (source-only)
1. `auditObservedInternalLinks`: inspect bounded owned-page observations for
   evidence-backed broken internal links (when 4xx/5xx has actually been observed),
   redirects, noindex links, empty anchor text, unobserved internal targets, and
   pages with no *observed* inbound links. Explicit uncertainty: unobserved is
   not necessarily broken or orphaned. No crawling or repair.
2. `fetchOwnedPageSpeed`: fixed Google PageSpeed Insights v5 read-only GET,
   exact HTTPS business-domain check, mobile/desktop Lighthouse lab category scores
   and bounded low-score diagnostics. No arbitrary target hosts or credentials
   in result. Scores are laboratory observations, **not** field CWV, SEO rankings,
   sales attribution, or an authorization to change a site.
3. Unit tests covering cross-site rejection, zero-write invariants, incomplete
   observations, invalid targets, and provider output limits.
4. Exports through existing `@jhadina/growth-core`; no duplicate product or DB.

## Next ordered completion (not implemented here)
`JH-PERSONAL-SEO.03`: server-owned domain registry and approved read-only crawling;
enforce robots and SSRF / DNS protections, per-site concurrency limits, sitemaps,
schema extraction, proof of inspected page status and source timestamps.

`JH-PERSONAL-SEO.04`: owner-authorized Google Search Console OAuth and property map;
real, bounded query/page observations, source receipts, expiry handling and polling.

`JH-PERSONAL-SEO.05`: run new link/technical and PageSpeed adapters against a
trusted one-site canary; optional server API key and provider quota budget; persist
source freshness only through canonical authorized storage.

`JH-PERSONAL-SEO.06`: recommendations in existing Growth UI (mobile first) with
severity, source links, impact hypothesis, approval and verified outcome difference.

`JH-PERSONAL-SEO.07`: CMS-specific draft/preview, human approval, bounded write,
checksum, post-write verification, safe rollback; reuse Action Core authorities.

`JH-PERSONAL-SEO.08`: recurring owned-site technical change detection and weekly
owner digest, sampled AI search visibility, relevant keyword drift, first-party
traffic and conversion attribution. Admit automation only with a running worker,
validated provider access, persistent receipts, and real phone acceptance.

## Safety and release truth
This PR is **not live monitoring** and not a deployed crawler or authorization to
publish. Inputs to pure functions must have trusted server-side lineage before
they are recorded as verified evidence. A user's paste or browser-provided source
claim must be marked unverified. CI on the exact PR head and iPhone/provider
canaries are required before claiming production readiness. No paid API plans,
subscriptions, credential writes, posting, campaign spending or SEO alterations.
