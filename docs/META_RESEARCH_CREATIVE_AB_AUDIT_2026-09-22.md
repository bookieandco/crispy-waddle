# META-RESEARCH-CREATIVE.1 — Research -> Director -> Experiment Audit

Date: 2026-09-22

## Purpose

Turn one product idea plus competitor-ad observations into multiple original Meta ad concepts, route them through Director for production, and promote only first-party tested creative signals back into Growth.

## Canonical workflow

```
Product truth
-> Meta Ad Library observations
-> competitor creative patterns
-> evidence-ranked hypothesis
-> original ad concepts
-> Social Content Projects
-> Director production briefs
-> Director generation / QC / review
-> governed paid-ad campaign
-> control/treatment experiment
-> delivery / conversion / contribution evidence
-> statistically supported learning
-> first-party creative evidence
-> next Big Idea / control
```

## Important evidence rule

An active Meta Ad Library entry proves that an ad is observable/active in the library. It does not prove ordinary commercial ROAS, CAC, profitability, or conversion performance. Competitor observations are therefore classified as `competitor_pattern` evidence and cannot become validated first-party performance without Jhadina's own experiment data.

## Originality / rights rule

Competitor creative is pattern evidence only:
- hooks, message categories, offer structures, formats, landing-page patterns, and recurring concepts may be studied;
- competitor logos, copy, layouts, photography, video frames, branded assets, or protected creative may not be reused without rights;
- product features, claims, testimonials, prices, endorsements, and guarantees must come from product truth/evidence.

## Director ownership

Growth produces the research-backed plan.
Social creates the governed Content Project.
Director owns media production, continuity, provider selection, generated-asset provenance, QC, and review.
Director approval does not grant campaign or publication authority.
Meta spend remains behind `paid-ad.publish`.

## A/B experiment reference

Reference:
- `sayakpaul/A-B-testing-with-Machine-Learning`

Useful patterns:
- explicit control vs experiment datasets;
- downstream outcomes such as clicks, enrollments, and payments;
- covariate/stratum-aware feature rows for regression/ML analysis;
- model error measurement instead of assuming a model is correct.

Jhadina adaptation:
- minimum exposures and conversions before evaluation;
- two-proportion significance test for binary conversion outcomes;
- 95% confidence interval;
- practical relative-lift threshold;
- contribution-per-exposure guardrail;
- partial/early results remain inconclusive;
- ML/regression may explain heterogeneity or improve prediction, but random assignment/experiment evidence remains the causal basis.

No license file was found in the supplied repository during this audit, so it is used as a conceptual reference rather than a code source.

## Higgsfield

The repository already emits Higgsfield-compatible prompts through Shotlist/Director. Higgsfield also currently exposes a developer API for image/video generation.

Production admission remains separate:
- credentials must remain server-side;
- Director's automatic execution requires a recoverable/idempotent submission path;
- current public TypeScript examples document asynchronous subscribe/polling, but this audit did not verify a durable idempotency-key recovery guarantee compatible with Director's leased execution invariant;
- therefore Higgsfield is a generation target/provider candidate, not yet certified for unattended Director auto-submit.

The ChatGPT/Codex Higgsfield app can also be connected for operator-assisted creative generation without changing Jhadina's production provider boundary.

## New contracts

### ResearchBackedMetaAdPlan
Stores:
- product truth;
- observed competitor pattern IDs;
- source observation IDs;
- original concepts;
- differentiation requirement;
- experiment hypothesis;
- `UNPROVEN_UNTIL_FIRST_PARTY_TEST` performance state;
- `FORBIDDEN_WITHOUT_RIGHTS` competitor creative reuse state.

### MetaResearchCreativeProductionJob
For every original concept:
- creates a conversion-oriented Social Content Project;
- attaches product, competitor-pattern, observation, and approved brand-POV evidence;
- compiles a Director image/video production brief;
- grants no campaign execution authority.

### BinaryCreativeExperiment
Compares one treatment against one control using:
- minimum sample gates;
- conversion-rate difference;
- two-sided z test;
- approximate p-value;
- 95% confidence interval;
- minimum practical relative lift;
- contribution economics.

A treatment is promoted for the next test only when evidence is statistically supported, practically meaningful, and economically acceptable.

### First-party feedback loop
A supported treatment can become a `first_party_performance` CreativeEvidenceSignal, which then outranks external competitor inspiration in the Big Idea engine.

## Final invariant

```
competitor research != winner proof
generated creative != approved ad
Director approval != spend authority
statistical lift != profitable lift
ML prediction != causal treatment evidence
```
