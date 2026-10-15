# BUSINESS-GROWTH-INTEL.01–.05 — Source review and non-duplicating adoption

Reviewed: 2026-10-15. Parent stack `#1304 → #1305 → #1308 → #1309`.

## Source review — what each reference actually provides

| Reference | Source-grounded ideas | Adoption decision | Limits / cautions |
| --- | --- | --- | --- |
| https://github.com/danishashko/geo-aeo-tracker | AI-engine prompt hub, brand aliases, mention/citation sampling, competitor cited domains, country scope, citation opportunities, 13-tab dashboard and time-series/drift analysis | **Adopt concepts** into Growth Core sampled AI-answer research reducer; no separate dashboard/service. | README says Bright Data keys drive live queries, OpenRouter and Gemini keys power analyses, demo data otherwise. "Free software" does **not** mean free provider calls. Repo has MIT license; no code copied. A snapshot of selected prompts is not an objective universal AI ranking. |
| https://github.com/brightdata/competitive-intelligence | Researcher → Analyst → Writer segmentation; competitive SWOT and provenance. | **Defer the service**, keep role separation inside existing Jhadina Research/Opportunity/Director agents and model grounded reviews. | README calls code MIT but no root LICENSE file was found at reviewed head; do not copy code without confirming rights. Bright Data and Gemini credentials may incur spend; no blanket scraping permission. |
| https://github.com/mrdasdeveloper/free-online-seo-tools | README links to manual metadata, schema, redirect, robots.txt, sitemap, hreflang, SEO audit and UTM utilities on author's website. | **Reference checklist only** for existing `inspectOwnedWebsite` and manual previews. | Root contains README only: **not a copyable tools implementation**; no license file. Avoid claiming integrated utilities. |
| https://github.com/RaGR/SEO-Content-Automation-Pipeline-with-AI | Modular keyword research → structured draft → heuristic QA → CMS export; explicit config and steps. | **Adopt staged review logic** already present in Growth, Director and Social; preserve citations, original evidence, rights and human approval. | Apache-2.0 repository, no code copied. Keyword density / article score cannot stand in for business quality or settled revenue. OpenRouter key required for live text generation; no provider paid requests or direct CMS export admitted. |
| https://github.com/MowlandCodes/intention-seo | SERP/PAA/related query grounding, buyer-intent categories, competitor gap review, structured results. | **Adopt read-only source-shaped SERP intent review**; existing-page-first and verified-offer guardrails. | README and source show Serper.dev and Gemini APIs; no root LICENSE found. Do not copy. SERP results and snippets are mutable/untrusted, no guarantee of Google ranking completeness or real buyer demand; user/browser input cannot authenticate provider. |
| https://seonix.ai/alternatives/babylovegrowth | Comparison highlights technical site audits and existing-page fixes vs blind article quantity, AI citation measurement and no-card auditing claims. | **Use as vendor comparison context**, not ranking, revenue or price proof for Jhadina's mission scores. | Seonix is promoting Seonix, so comparisons are not independent vendor performance evidence. No subscription or one-click production mutation. |

The separately supplied Google `aclk` URLs are advertising redirects, not direct documented integrations. Do not infer vendor, paid status, security or permissions from those links. Supplied YouTube URL included concatenated/trailing parameters and did not yield a verified accessible transcript in this review; no claims based on the video are implemented.

## Implemented in PR #1309

- `reviewAiVisibilitySamples`: accepts bounded sample observations for five AI engines, prompts and locale, counts exact-ish brand/alias mentions and citation of the owned HTTPS domain, highlights external cited domains without interpreting mentions as recommendations or ranks; rejects stale/future/duplicate entries, lookalike site domains, invalid URLs and excessive samples.
- `reviewSerpBuyerIntent`: consumes an existing SERP provider-shaped snapshot with source provenance, bounded ordered results, PAA questions and related queries; classifies query **heuristically**, spots owned-site SERP pages, prioritizes existing-page review, and only suggests a new brief for provider-reported commercial/transactional research with an already validated offer. No publish authority.
- `POST /api/business-growth/research-preview`: authenticated, no-cost, read-only manual preview. Server **unconditionally downgrades** browser-claimed provider assertions to `MANUAL_UNVERIFIED`; provider/offer verification cannot be self-asserted in the browser. No persistence, XP, payouts, crawler, social posts, subscriptions, backlink buys or account changes.
- Existing `/opportunity/growth-missions`: manual AI answer/citation preview and buyer-search preview within the existing business growth game, with explicit evidence caveats.
- `business-growth-evidence-discovery.test.ts`: lookalike domain, duplicate/stale future observation, brand false positives, verified-vs-manual source separation, existing-page-first, no offer or informational churn and cross-business URL gates.

## Non-negotiable admission gates for future live data

1. Bind an **owner-authorized** site and canonical venture first; avoid substituting PupsonStuff's standalone Supabase project for Jhadina's tenant ledger.
2. Connect Google Search Console read-only via server-side OAuth; do not confuse it with Serper.dev or scrape rank data without separate permissions.
3. If using Bright Data/Serper, require vendor terms review, a bounded billing budget authorized by the owner, safe provider-side secrets, and exact per-query rate limits. No API connections are made by #1309.
4. Verify source timestamps, prompt/provider/locale scope and extract citations with native provider receipts. Never call selected-answer counts universal AI rankings or synthetic data live traffic.
5. Reuse existing Growth `prepareGrowthContentBrief` and Social/Director approvals for any actionable draft. Untrusted competitor content must not become instructions.
6. Match an actual approved content asset to delivered provider receipt and finally settled net contribution before awarding XP or teaching the Opportunity ranking loop.

## Unresolved upstream live blockers

- #1304, #1305 and #1308 remain draft/unmerged at review time.
- #1305 had a Jhadina Launch Gate Director Core lease-renewal test failure, separate from Growth Core.
- No confirmed server-side Search Console property/credentials, consented SERP provider, verified live website crawl, approved publication receipt, or genuine attributed PupsonStuff commerce settlement.
- #1308 exact-head checks were still being polled at review time. #1309 requires its own exact-head CI evidence before any merging.

**Status:** source study and zero-authority code integration; **not** live SEO/GEO monitoring and **not** production-ready unattended publishing.
