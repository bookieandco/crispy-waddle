# CampaignOS Intelligence Contract

## Purpose

CampaignOS is an evidence-to-action operating layer for public-service problem solving. It aggregates public political and civic evidence, preserves source provenance, lets Jhadina explain what the evidence means, and converts validated problems into measurable improvement plans.

## Source classes

1. Polling and public opinion research
2. Election results and turnout
3. Government statistics and administrative data
4. Government budgets, audits, reports and legislation
5. Local reporting and public records
6. Public feedback submitted to the campaign or government
7. Field observations and campaign notes

## Ingestion rules

- Every observation has a source, URL or provenance identifier, publication/update time, geography, issue, and methodology/qualification when available.
- Primary sources are preferred over secondary summaries.
- Conflicting evidence is preserved rather than averaged away.
- Polls are never treated as ground truth; sample, weighting, likely-voter model, field dates and margin of error remain attached to the record.
- Jhadina must distinguish observed facts, estimates, interpretations and recommendations.
- No model-generated claim becomes an evidence record without provenance.

## Translation pipeline

`source -> normalized evidence -> corroboration -> issue assessment -> root-cause hypotheses -> intervention options -> improvement plan -> outcome measurement`

## Improvement plan requirements

Every proposed intervention should identify:

- problem statement
- baseline
- measurable objective
- authority/decision-maker
- intervention
- estimated resources/cost
- implementation deadline
- public outcome metric
- evidence supporting the proposal
- status and review date

## Governance boundary

CampaignOS may summarize public evidence and propose non-individualized policy/service improvements. It must not autonomously target individuals, infer sensitive personal attributes for persuasion, generate individualized political persuasion, or automatically execute consequential campaign actions. Human approval remains required for consequential actions.

## Initial official data integrations

- FEC/OpenFEC: federal candidate, committee, filing, receipts and spending data. FEC data is updated nightly and has API/bulk-download access.
- U.S. Census Bureau APIs: population, household, housing, income and other statistical datasets; current API access requires an API key.
- Additional polling, labor, economic, election and state/local sources should be added through the same normalized adapter contract.

## Definition of done for ingestion

An adapter is complete only when it has:

1. typed source metadata
2. deterministic normalization
3. provenance retention
4. duplicate detection
5. freshness tracking
6. failure/partial-data state
7. fixture tests
8. rate-limit handling
9. no credentials committed to the repository
10. a human-readable explanation path through Jhadina
