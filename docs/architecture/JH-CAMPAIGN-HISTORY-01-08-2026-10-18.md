# JH-CAMPAIGN.HISTORY.01–.08 — Comparative civic history

Date: 2026-10-18. Base: Political Juggernaut draft PR #1359, head e1c74bbfffc06e8a93a034752afb47e626141e3e (unmerged during preparation). Status: SOURCE-ONLY; stacked review.

## Scope

A read-only, source-linked civic-history desk inside canonical CampaignOS. Compare historical public participation, institutions and democratic failure. Explicitly prohibit political persuasion optimization, voter profiling, protected-attribute inference, fake grassroots activity, intimidation, fundraising, spending, filing, outreach, publication and policy adoption.

The October 18 owner-supplied video transcript is historical commentary, not an authoritative record. It is not copied to the repo. Included facts are narrowed and attributed to separately reviewed institutional references. Cases are not presented as causally matched experiments or morally equivalent movements.

## Completed targets

| Step | Implemented deliverable |
|---|---|
| HISTORY.01 | Reuse existing CampaignOS identity and the draft Political Juggernaut workspace without another system. |
| HISTORY.02 | Reviewed source ledger with publisher, provenance family, HTTPS URLs, date and historical/current distinction. |
| HISTORY.03 | Weimar chronology: 1932 voting, 1933 appointment and coerced Enabling Act; distinguish legal form from democratic legitimacy. |
| HISTORY.04 | Civic comparisons: Montgomery bus boycott and women's suffrage, including limitations and exclusions. |
| HISTORY.05 | Historical media, organizational and institutional questions rather than manipulation instructions. |
| HISTORY.06 | Democratic safeguard register, National Archives / FEC / IRS sources and explicit current-record verification. |
| HISTORY.07 | Responsive read-only selector, source cards and history navigation in CampaignOS. |
| HISTORY.08 | Static evidence audit and deterministic regression tests; no new API, migration, external collector or automated actions. |

## Institutional sources — reviewed 2026-10-18

- https://encyclopedia.ushmm.org/content/en/article/the-nazi-rise-to-power
- https://encyclopedia.ushmm.org/content/en/article/hitler-comes-to-power
- https://encyclopedia.ushmm.org/content/en/article/the-enabling-act
- https://www.nps.gov/places/bricklayers-hall.htm
- https://www.nps.gov/subjects/womenshistory/19th-amendment.htm
- https://www.fec.gov/help-candidates-and-committees/registering-candidate/house-senate-president-candidate-registration/
- https://www.archives.gov/electoral-college/provisions
- https://www.irs.gov/charities-non-profits/charitable-organizations/restriction-of-political-campaign-intervention-by-section-501c3-tax-exempt-organizations

Sources are NOT all independent: the museum pages share a source family and NPS pages share another. These are manually reviewed references, not a continuous feed. Dataset integrity checks do not certify external truth, primary-source independence or modern electoral forecasts.

## Historical correction ledger

1. The Nazi Party received about 37% of the parliamentary vote in July 1932 and about 33% in November. Neither was a majority.
2. Hitler was appointed chancellor by Hindenburg after political negotiations, not directly elected chancellor.
3. The March 1933 Enabling Act was passed through intimidation and exclusion; a merely legalistic description misrepresents the violent suppression of opposition.
4. The Montgomery bus boycott was a civil rights campaign involving community organizations and litigation, not an electoral candidate campaign.
5. The Nineteenth Amendment followed decades of organizing but did not end discriminatory voting barriers.

## Data and authority

Each case has an outcome, guardrail, documented events, interpretive questions, date/period, region, original source links and limitations. An audit rejects missing support, duplicate claims, unknown sources, invalid/non-HTTPS links, missing review dates and omitted context. No factual confidence scores, candidate predictions, political audience data, social publishing, payments or external actions.

All FEC, IRS and constitutional information is general reference only. Actual candidacy, committee, tax-exempt status and ballot access must be checked through original documents and official procedures.

## Local validation and remaining gates

Commands from repository root:
- pnpm --filter @jhadina/jhadina-web test -- src/lib/campaign/history.test.ts
- pnpm --filter @jhadina/jhadina-web type-check
- pnpm --filter @jhadina/jhadina-web lint

Do not claim passing CI, a successful production build, an authenticated live route, a signed-in iPhone acceptance test, source synchronization or filing. Those require distinct exact-head evidence. No Supabase modifications are included.

This sequence stacks on PR #1359 intentionally. Reconcile that base with current main and review both PRs before merge. Intelligence PR #148 remains an unmerged donor, not an authorized code dependency. A historical notebook never grants permission to carry out campaign operations.
