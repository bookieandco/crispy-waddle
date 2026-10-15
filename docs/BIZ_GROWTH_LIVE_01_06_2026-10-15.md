# BIZ-GROWTH-LIVE.01–.06 commissioning, October 15, 2026

**Parent:** PR #1305 (base branch `feat/biz-growth-02-08-evidence-loop-20261015`), itself stacked on PR #1304.

## Live commissioning truth

A complete **software certification evaluator** has been added at
`packages/growth-core/src/intelligence/business-growth-live-certification.ts`.
It is a pure read-only six-gate receipt assessor with dedicated negative and
positive fixture tests. It is **not a live provider connector, not a publication
engine, and not an authorization grant**.

| Gate | What source is mandatory | Actual result October 15 |
| --- | --- | --- |
| LIVE.01 Owner/site binding | Server-confirmed venture+business+HTTPS origin registry receipt | BLOCKED: owner-owned website ↔ Venture proof not connected |
| LIVE.02 Search Console first-party canary | Google OAuth `webmasters.readonly`, real verified property, fresh query/page data | BLOCKED: no Google consent-bound access token or property in Jhadina's runtime; PR #1305 read-only adapter is code-ready |
| LIVE.03 Site and content canary | Owned-domain crawler evidence, actual source/rights and exact canonical content approval | BLOCKED: no audited live site, claim rights review or approval receipt |
| LIVE.04 Provider publication canary | Actual provider delivery ID tied to exact asset/campaign/approval | BLOCKED: no certified provider connection or owner-approved publication |
| LIVE.05 Commerce attribution canary | Real settled order linked to same asset/campaign plus refunds, fulfillment, fees, acquisition cost | BLOCKED: PupsonStuff has zero orders and zero fulfillment orders in connected Supabase as of the query; no real settlement |
| LIVE.06 End-to-end certification | All five gates and full receipt lineage; no future/stale/cross-business records | BLOCKED: no valid real receipts; evaluator can produce PROVEN_END_TO_END only with trusted evidence |

## Verified infrastructure inspection

- `Pupsonstuff` Supabase project `ztjyewacsmttkzktnyxl`: `ACTIVE_HEALTHY`, read-only SQL confirmed `pupson_orders`, `pupson_order_items`, `pupson_fulfillment_orders`, product variants. `pupson_orders = 0`; `pupson_fulfillment_orders = 0`. No real order outcome.
- Same Pupsonstuff Supabase public schema contains **zero `jhadina_venture_%` tables**. Do not misrepresent this project as the Jhadina venture ledger. The other available `Swlc` project database refused connections in read-only check, so its readiness is unknown.
- Vercel project `crispy-waddle-jhadina-web`: latest production deployment `dpl_7E4thYhHFggcKzgSzx9pbXEhjFXB` is `READY` but sourced from **main commit `1f26873b422a0e10af1a77093dd1087fb91d1b5c`**, not draft #1304 or #1305. Vercel reports project `live:false` and SSO protection. Treat the two Growth branches as **not live**.
- The public canonical PupsonStuff URL `https://www.pupsonstuff.com` could not be retrieved in this turn's public web check. Site crawl and canonical visibility **not proven**.
- GitHub PR #1305 exact head `abac2f2...` passed Growth, Opportunity, Social, Media, UX and filtered web-build checks, but failed **Jhadina Launch Gate** in a Director Core end-to-end test `keeps a long provider submission fenced by a renewing lease`. Failure: expected one provider submit, saw two. This is not a passed global launch gate. Preserve as independent repair; do not weaken security or suppress the test.
- Google Search Console official authorization requires OAuth 2.0; no connected Search Console OAuth credential was confirmed. ChatGPT's optional Windsor.ai integration may read GSC after user connection, but it does **not** automatically provision Jhadina's server-side OAuth, site registry or CMS authority.
- No prices, authorizations, new cloud resources, Stripe charges or marketing publication were created as part of this audit.

## Commissioning evaluator guarantees

- Evidence is bound to **one venture, one business, one canonical HTTPS origin**.
- Each of six receipt kinds has an exact canonical trusted source and freshness window.
- Missing, untrusted, stale and future-dated receipts fail closed.
- Exact owner-approved asset and campaign must match provider-delivered asset and campaign **after approval**.
- Provider settlement must link to the same delivered asset/campaign/order. Negative contribution yields no XP; duplicate orders cannot be rescored.
- **No caller can derive posting, spending, unattended publishing or any external-action authority from this evaluator**. It only evaluates evidence. Strings saying `serverVerified` or `source` are not cryptographic truth; construct them only inside trusted server adapters, never from request bodies.
- Tests include a simulated fully-linked receipt fixture; it proves contract logic, **not actual commerce**.

## Concrete next actions that require external authorization or data

1. Confirm Jhadina's owner-approved canonical Venture storage and site registry; do not substitute PupsonStuff's standalone DB without a tenant mapping.
2. Connect Google Search Console using consent-bound read-only OAuth and verify property ownership.
3. Establish reachable owned site and a bounded no-write audit canary.
4. Obtain exact Creative/Director approval then schedule **one** provider post through canonical Social/CMS authority; save native delivery receipt.
5. Obtain one actual settled commerce order with matching asset/campaign attribution and complete costs; otherwise record `INCOMPLETE`.
6. Re-run launch gate on a supported exact commit; investigate Director lease renewal test race before any broad production promotion. Only merge #1304 → #1305 → this PR in that order after CI and product approval.

**Release verdict:** `SOFTWARE_CONTRACT_READY / LIVE_NOT_CERTIFIED / NO_EXTERNAL_ACTION`.
