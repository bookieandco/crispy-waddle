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


## Implementation continuation — JH-PERSONAL-SEO.03–.08 (October 18)

This continuation builds on the first two pure diagnostics on the *same PR branch*.
It is source code and a proposed scheduled workflow, **not proof of live
Google authorization, actual crawls or commissioned Jhadina deployment**.

| Step | Source completed | Real-world commissioning |
| --- | --- | --- |
| .03 | \`personal-seo-crawler.ts\`: HTTPS socket with public DNS pinning, no redirects, robots check, bounded sitemap/HTML reads, existing metadata and link diagnostics | Verify real registered canonical HTTPS origin, real TLS, robots and site response on live runtime |
| .04 | \`personal-seo-runtime.ts\`: server-side site↔owner↔Venture gate and refresh-token route to Google OAuth provider; pre-existing GSC API adapter verifies a real property permission | Obtain owner consent for \`webmasters.readonly\`, store refresh/client secrets privately and confirm live property |
| .05 | \`/api/growth/seo\`: authenticated, same-origin read-only scan modes; fixed-host PageSpeed adapter with optional key | Provider quota/budget, live fetch, observed site and PageSpeed canary |
| .06 | \`/growth/seo\` linked from Growth; owner-only results grouped by technical, link, PageSpeed, Search Console, with explicit incomplete coverage | iPhone UI QA, deployed auth and verified actual scan |
| .07 | \`business-growth-repair-plan.ts\` and \`/api/growth/seo/fix-preview\`: compare-before-write digest, current owned page re-observation, text allowlist and no-write owner preview | **No CMS write integration added**; canonical Action approval/actual CMS adapter/rollback/canary still required for execution |
| .08 | \`/api/internal/growth/personal-seo/watch\`: \`authorizedSchedulerRequest\`, opt-in \`JHADINA_PERSONAL_SEO_WATCH_ENABLED\`, read-only crawl, insert-only blocked Venture review work item and observed finding-count delta; \`/api/growth/seo/history\`; \`jhadina-personal-seo-weekly.yml\` | Exact runtime reachable, GitHub Actions secrets, real host and worker execution, baseline and second observation. No push alert or verified rankings. |

### Runtime setup required (never commit secrets)

- \`JHADINA_PERSONAL_SEO_SITES_JSON\`: JSON array of **owner-approved** registrations, for example
  \`[{"ownerUserId":"<auth-uid>","ventureId":"<existing-venture>","website":"https://www.example.com/","gscProperty":"sc-domain:example.com"}]\`.
  This is a server/private deployment secret, not browser local storage. It must
  identify an existing active Venture belonging to that exact Supabase owner.
  Account access alone does not verify legal/technical website ownership;
  independently verify control of the site before registering it.
- \`JHADINA_GSC_OAUTH_CLIENT_ID\`, \`JHADINA_GSC_OAUTH_CLIENT_SECRET\`, and
  \`JHADINA_GSC_REFRESH_TOKEN\` from **previous explicit owner Google OAuth consent**
  for the GSC **read-only** scope. This code does not generate consent, store
  tokens, or grant permission on behalf of the user.
- \`JHADINA_PAGESPEED_API_KEY\` optional, private, provider quota still applies.
- \`JHADINA_PERSONAL_SEO_WATCH_ENABLED=true\` deliberately opts into weekly
  site polling after user approval and real server/provider acceptance.
- GitHub Actions repository secrets \`JHADINA_PERSONAL_SEO_RUNTIME_URL\`
  (the deployed app base HTTPS URL) and
  \`JHADINA_PERSONAL_SEO_CRON_SECRET\` (same value as deployment's \`CRON_SECRET\`).
  GitHub scheduled workflows run in UTC and may be delayed. Production may
  be behind SSO; a READY Vercel build does not prove this route is reachable.

### Critical operational boundaries

- Zero new marketing SaaS, customer accounts, subscriptions or advertising budget.
- No site scans from arbitrary pasted URLs, no cross-owner scan, no credentials
  in browser output, no submission to CMS, no automated backlink trading.
- A page not observed is **unknown**, not broken; no observed inbound links does
  not establish that a page is globally orphaned. Sitemap samples and GSC
  query rows can be incomplete.
- Weekly count changes are **observed count changes**, not ranking,
  conversion or profitability changes; differing crawl coverage is a caveat.
- All scheduled work items remain \`blocked\` with \`authorizationEffect: NONE\`.
  Scheduler permission is only permission to read configured websites and
  record internal review; it conveys no publish/spend authority.
- CMS execute, exact Action Core approvals and rollback are intentionally
  outside this feature branch until a real provider-specific versioned
  adapter and independently certified owner approval exist.
- GitHub CI and preview build passing only prove build/test evidence, not live
  provider acceptance, owner authorization, or production deployment.

### Additional .07 transport hardening

`personal-seo-cms-executor.ts` adds a private versioned CMS adapter executor:
trusted Action Core approval lookup with exact owner/account/proposal hash,
fresh compare-before-write check, conditional revision-checked write, post-write
verification, and conditional rollback after unexpected provider output.
It has isolated mock-adapter tests. **No live CMS provider is wired to this
executor** and it has no public API route or browser-controlled write capability.
Deployment requires a real canonical approval reader, provider account binding,
a compare-and-set-capable CMS transport, idempotency/receipt storage, canary
write/restore evidence and independent review. A passing isolated fixture does
not prove any of those external requirements.
