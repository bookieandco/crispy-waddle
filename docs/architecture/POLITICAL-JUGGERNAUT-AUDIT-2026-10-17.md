# Political Juggernaut — recovered presidential plan, source audit and build handoff

Audit date: October 17, 2026 (America/Los_Angeles). Owner: Dorian Morris / Atwood Bookie.
Baseline: `bookieandco/crispy-waddle@5d2f8ed87265157536495a7164cefcb6c5b68ea0`.
Build branch: `feat/political-juggernaut-01-04`.

## Decision

Build Political Juggernaut as the political research and preparation workspace inside **existing CampaignOS**. Preserve the canonical JANET → DELIA → MARISA responsibilities, shared evidence/knowledge infrastructure, and Action Core. Do not create a parallel operating system, campaign automation service, or new identity registry.

The existing main-branch political product was a descriptive polling function and a static demonstration page. The richer intelligence branch remains unmerged. This report recovers the original intent, identifies source defects, and delivers a bounded first implementation. It does not certify an operating presidential campaign.

## What was actually audited

- Four focused historical-chat retrieval passes, including the requested late-2025 window and earlier presidential intent. Retrieved summaries distinguish user statements from prior assistant proposals. This is **not an exhaustive export of all chats**.
- Library title/content searches for CampaignOS, presidential and political records; relevant current excerpts of `JHADINAOS-DEEP-AUDIT-HANDOFF-2026-10-16.md` and `JHADINA-UXUI-DEEP-AUDIT-HANDOFF-2026-10-17.md` were read. No dedicated presidential handoff surfaced; a failed search is not proof none exists.
- Complete non-truncated GitHub tree at the pinned baseline; local shallow clone of that exact main; searches across docs, packages and web source for campaign/presidential terminology.
- All main CampaignOS implementation files, world registry, shell navigation, root layout, authentication middleware and canonical spine documentation.
- Fresh GitHub PR metadata for #7, #55 and #148, PR #7 file patches, and the 38-path #148 inventory. Detailed review of its campaign roles, issue model, sources, brief, social signals, corroboration, ingestion, intervention evaluation and outcome tracking.
- Current official IRS and FEC guidance relevant to recovered plans.
- New implementation: targeted regression tests, full web TypeScript check, changed-file lint and whitespace validation.

Not performed: full historical message export, every unrelated repository/file review, live database probe, legal-status verification, provider connection, filing, account creation, whole-repo test suite, production build/deployment, physical iPhone walkthrough, voter-contact operation, donation, spending or publishing.

## Recovered plan: preserve these distinctions

| Date (source timestamp) | Recovered record | Evidence class and treatment |
|---|---|---|
| 2024-12-21 | Low-cost, effective presidential campaign with a “Blair Witch Project” style and a slow-burn start | User preference recovered from chat. Interpret as original, low-budget storytelling; do not infer consent to deception or fabricated grassroots activity. |
| 2025-01-14 | Asked to run for president in the next election and what to start that day | User intent. Eligibility, party route, candidacy status and filings remain unverified. |
| 2025-10-01/02 | **From the Block to the Ballot** nonprofit/umbrella organization | User-described organization; not independent proof of incorporation or tax exemption. UTC October 2 timestamps can fall on October 1 in California. |
| 2025-10-02 | Mission: “Building dignity, justice, and opportunity across generations through service, advocacy, and political power” | Recovered user mission. Preserve its wording; organizational implementation requires the separation below. |
| 2025-10-02 | Six pillars: **Roots Rising; The Dignity Project; United for Us; People’s Platform; Veterans Rising; From the Block to the Ballot campaign arm** | Recovered names. Detailed original program-to-population mappings were not recovered; do not invent them. |
| 2025-10-02 | Draft bylaws: minimum three unrelated directors, President/Secretary/Treasurer, quarterly meetings, majority quorum/vote, two-thirds amendments, fiscal year December 31; blank leadership slots | Prior assistant draft, not adopted bylaws or a populated board. Earlier retrieval also described two-officer financial approval; verify the original before treating it as binding. |
| 2026-01-24 | 24-month service/visibility/advocacy/campaign roadmap; seniors, housing, youth, healthcare, justice and veterans | Prior assistant proposal. Useful research domains, not automatically the candidate’s adopted platform. |
| 2026-03-27 | User said most initial foundation work was completed or being tied up; next period involved visibility and impact documentation | Historical user report, not fresh proof. Prior assistant suggested website, events, newsletters and grants; their actual execution remains unknown. |
| 2026-07-31 | Presidential Project Room; policy, research, speeches, outreach and compliance; AI Cabinet concept | Earlier architecture proposal. Preserve analysis and accountability responsibilities within the current shared spine. |
| 2026-10-13 | Supplied conversation memory says the presidential run was renewed “starting today,” with urgency and systemic-analysis requests | Context reference only: targeted retrieval did not recover that original conversation. Keep in backlog; do not invent a detailed policy platform from it. |

The user’s preference for free/open-source reuse remains part of the build contract. No new subscription is needed for this slice. The historical 2028 ambition is not a verified ballot-access plan.

## Critical correction: charity and candidate operations

The old proposed 501(c)(3) umbrella plus a candidate campaign arm cannot be carried forward as written. IRS guidance says section 501(c)(3) organizations may not intervene for or against candidates. A software workspace boundary alone does not resolve organizational, accounting or legal questions.

Required design: keep charitable program records, funds, staff-time records and communications purposes distinct from candidate campaign operations; establish actual entity status and appropriate professional review before implementing transfers, shared resource arrangements or campaign operations. Do not automatically move charity donors, beneficiaries or contact lists into a campaign audience.

FEC guidance separately addresses testing-the-waters recordkeeping and candidate registration. Historic “planning” labels do not decide present legal status; actual conduct, decisions and financial activity matter. This build neither determines registration obligations nor invents deadlines or completed filings.

Official references checked during this audit:

- https://www.irs.gov/charities-non-profits/charitable-organizations/restriction-of-political-campaign-intervention-by-section-501c3-tax-exempt-organizations
- https://www.fec.gov/help-candidates-and-committees/registering-candidate/testing-the-waters-possible-candidacy/
- https://www.fec.gov/help-candidates-and-committees/filing-reports/registering-candidate/

## Repository reconciliation

| Reference | Fresh disposition | Preserve / action |
|---|---|---|
| PR #55, JH-030 | Merged August 13, 2026; head `122dcd3376c6405dae554c3bc437b4aa355be201` | Preserve `summarizePolls` API and descriptive-only boundary. Repair defects in place. |
| PR #7, Growth Engine | Open, unmerged; head `34f4930fe0599d364104413467176160cc21e49a` | Its polling files match the old donor implementation. Do not merge stale Growth code to recover already-landed polling. |
| PR #148, intelligence fabric | Open, unmerged; head `d471c88df02474d08ce595689949c2660780db6c` | All 38 listed changed paths absent at pinned main. Preserve as donor; selectively reconcile to current canonical infrastructure, not a blind merge. |
| Current main | `5d2f8ed...` includes #1353 ads readiness | Commercial ad readiness is not political campaign commissioning. No inherited political publication or spending authority. |
| Oct 16 system handoff | CampaignOS / Block2Ballot listed as polling present, complete workflow uncertified | Confirmed by this narrower fresh source audit. Older broader runtime findings are historical; no new DB status inferred. |

GitHub references:

- https://github.com/bookieandco/crispy-waddle/pull/55
- https://github.com/bookieandco/crispy-waddle/pull/7
- https://github.com/bookieandco/crispy-waddle/pull/148
- https://github.com/bookieandco/crispy-waddle/tree/5d2f8ed87265157536495a7164cefcb6c5b68ea0

## Findings and disposition

| ID | Finding | Disposition |
|---|---|---|
| PJ-F01 | Poll page displayed fictional “You” support around 43% without an unmistakable demonstration heading | Removed examples from normal route. Honest no-connected-source state now shown. |
| PJ-F02 | With fewer than four polls the old recent/older windows overlap; one poll reports “stable” by comparison to itself | Repaired: six observations minimum across disjoint three-observation windows; otherwise insufficient data. This is a descriptive heuristic, not a significance test. |
| PJ-F03 | Count alone produces high confidence; invalid/nonfinite values, reversed dates and duplicates are not rejected; surveyed populations can mix | Repaired structural validation, duplicate IDs/exact source-period checks, explicit as-of, population separation, historical warning. Legacy confidence remains low for compatibility, never an inferred probability. |
| PJ-F04 | PR #148 issue assessment averages poll and social numbers together and averages government measures without unit/method matching | Do not port as-is. Retain the problem/condition/policy structure; partition metrics by definition, unit, population, geography and period. |
| PJ-F05 | PR #148 corroboration assumes distinct sourceId means independence, boosts confidence by source/domain count, and still weights repeated copies in its average | Require source-family provenance, original observations, contradiction records and calibrated uncertainty before any stronger assertion. |
| PJ-F06 | PR #148 social signals call five posts on two platforms “accelerating” without a temporal comparison; brief does not filter posts to supplied window | Retain observational scope; rewrite time-window handling and prohibit representativeness claims. |
| PJ-F07 | PR #148 source ingestion derives authoritative status from domain strings, although normal intelligence domains are campaign/social/money/etc. | Source authority belongs to verified provenance and adapters, not domain labels. Reconcile with current knowledge admission. |
| PJ-F08 | PR #148 outcomes use a fixed 50% threshold rather than time-aware milestones; no rejection of future observations or proof they are post-intervention | Keep outcome contracts as donor concepts; validate chronology, units, baseline and attribution before adoption. |
| PJ-F09 | PR #148 role registry contains approve classes for some AI roles while also describing human approval | Role descriptions must not confer executable capabilities. Bind to existing Action Core, never infer approval from a title. |
| PJ-F10 | Historical nonprofit/candidate structure needs correction | Recorded above; no charity→campaign data, funds or execution integration added. |
| PJ-F11 | No main-branch issue notebook, policy evidence workspace, live ingestion or authenticated persistent campaign records found | Added local-only notebook and home. Live integrations remain explicit next stages. |

Remaining polling limits: a syntactically valid HTTPS URL is not authenticated provenance; deduplication cannot discover syndicated copies on different URLs; field dates/population do not establish identical question wording or methodology. It is not a scientific poll-of-polls or forecast. No import endpoint was added.

## Delivered: POLITICAL-JUGGERNAUT.01–.04

1. **.01 — Audit and reconciliation:** recover original intent, pin baseline, map donor branches and distinguish implementation from plans.
2. **.02 — Truthful polling repair:** remove fictional candidate numbers and add regression coverage for invalid, overlapping, mixed-population, duplicate and future observations.
3. **.03 — Research workspace:** `/campaign` now hosts Political Juggernaut within CampaignOS, with policy, polling and administrative-readiness entry points. Existing world ID `campaign` remains stable; navigation points to the new home.
4. **.04 — Policy notebook:** owner-entered topic, problem, source notes, alternatives, costs/trade-offs, counterevidence and outcome criteria. Export JSON carries unverified-draft provenance and no adoption/execution authority. Notes are browser memory only, not localStorage or database records. No chat-history personal details are embedded in the app.

Responsive CSS uses cream/green, compact cards, a large readable title, dark-mode support, labeled controls, visible keyboard focus and minimum 48px inputs/buttons. The notebook does not generate or approve a platform. The three Jhadina role descriptions are integration intent, clearly labeled pending rather than running agents.

### Verification

- 24/24 targeted tests pass: 19 polling cases, one complete notebook-export contract test, four existing world-registry tests.
- Full `jhadina-web` `tsc --noEmit`: passed.
- ESLint across campaign pages/library and changed shell/registry files: passed.
- `git diff --check`: passed.
- Dependencies installed with repo-pinned pnpm 8.15.9, frozen lockfile, scripts disabled. No dependency or lockfile changes.
- Production build, authenticated deployed route and actual iPhone rendering/export: not yet verified. CI status must be checked on the eventual exact PR head; this report makes no CI-success claim.

## Product architecture to finish

| Workspace | Purpose | Existing owner / integration |
|---|---|---|
| Command desk | Today’s evidence, pending decisions, real blockers and review dates | CampaignOS world, shared work/activity projections |
| Policy workshop | Problem → original evidence → alternatives → costs/authority → outcome review | DELIA and canonical knowledge/research admission; PR #148 contracts selectively repaired |
| Public evidence | Government indicators, public records and descriptive polling | Shared source adapters and provenance; no parallel scheduler |
| Candidate administration | Original candidacy/committee documents, jurisdiction deadlines, filing receipts | Owner-reviewed records; official election/FEC sources and qualified legal review |
| Public communications | Broad public statements, fact checks, accessibility and approved releases | Existing Director/Social/Action Core, with explicit political-domain review; no automatic activation |
| Service impact | Program activities, resources and measured outcomes | Separate charitable workspace/records and purpose limitation |
| Review desk | Contradictions, corrections, expense/approval records and audit history | Shared Safeguard/Values, immutable receipts and owner decisions |

No individual political preference inference, voter persuasion scoring, sensitive-trait targeting, covert grassroots activity or automated personalized persuasion is part of this design. Aggregate policy research does not need a voter-profile database.

Systemic analysis should compare incentives, budgets, institutions, documented relationships, competing explanations and disconfirming evidence. “Green men” or conspiracy framing is not an evidentiary source. Urgency can prioritize tasks; it cannot upgrade an unsupported claim or skip verification.

## Smallest ordered next sequence

| Target | Concrete deliverable | Acceptance / blocker |
|---|---|---|
| **PJ-RECONCILE.05** | Selectively port useful #148 issue-brief/source/role contracts into existing canonical knowledge and Action interfaces | No second fabric, no donor confidence heuristics, no automatic approve capability; exact-head tests and review |
| **PJ-EVIDENCE.06** | A source-backed policy brief schema with claim kind, source family, URL, timestamp, unit, geography, method, contradiction and reviewer fields | Reject mismatched measures, unverifiable provenance promotion and future/stale evidence; retain uncertainty |
| **PJ-SOURCES.07** | One public official-data read adapter and one manually reviewed poll-import path | Original raw response + normalized record + freshness/duplicate/failure tests; no paid source required by default |
| **PJ-ENTITY.08** | Separate organizational workspaces and original-record register | Need actual entity, board, tax-status/candidate/committee records. No automatic assumptions from old drafts |
| **PJ-STORAGE.09** | Private drafts and evidence persistence through canonical authenticated storage | Mark **SUPABASE_AUDIT_REPAIR_REQUIRED**. Resolve correct project, query health, migrations, two-owner/anonymous isolation, optimistic updates, backup/restore; do not apply to an assumed project |
| **PJ-ASK.10** | Ask Jhadina reads the selected political notebook/evidence and produces a cited analytical brief | Owner scope, correct domain routing, citations, contradictions, no silent policy adoption, no “campaign” misrouting into commercial ads |
| **PJ-ADMIN.11** | Official-source deadline register and document checklist | Verify intended office/election/ballot route and jurisdiction; owner/legal review of dates; no filing submission implied |
| **PJ-COMMS.12** | Draft-only broad public explanation/speech workflow | Claims linked to evidence; owner revision/adoption; existing Social/Director lineage; any later publication separately authorized |
| **PJ-PHONE.13** | Signed-in iPhone portrait walkthrough, notebook recovery/export and unavailable-state acceptance | Real device evidence and cross-owner denial, not only build or mocked tests |
| **PJ-RESEARCH.FINAL** | Demonstrate one complete issue journey: source → review → options → owner decision → later outcome review | Durable receipts, contradictions and correction history; explicitly research-ready, not a certified campaign or legal filing status |

Immediate next coding batch: **PJ-RECONCILE.05 → PJ-EVIDENCE.06**, then the first read-only source adapter. This advances substance without waiting for campaign finance, social credentials or database recovery. Storage and original organizational records are independent external gates.

## Outstanding original records

- Original full 2025 nonprofit/presidential conversation or exported documents, if deeper program definitions are needed.
- Actual adopted bylaws, incorporation/tax-status documents and board appointments; not just earlier generated templates.
- Any current candidate/committee filing IDs, treasurer appointment, financial records and intended election/party/ballot route.
- Original October 13 presidential restart conversation and any actual approved issue positions.

These gaps do not block source-level research tools. They do block claims that the old plan was fully implemented, legally classified, registered, funded or publicly launched.
