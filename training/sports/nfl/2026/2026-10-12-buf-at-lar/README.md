# Jhadina Sports Intelligence — NFL case #001
**Event:** Buffalo Bills at Los Angeles Rams, Oct 12, 2026 (NFL regular-season Week 5). Kickoff 2026-10-13 00:15 UTC (5:15 PM Pacific).

## Status and scope
Research/learning only. One-game sample, no validated betting edge and no authority to place wagers.
- `pregame.case.json`: preserved ORIGINAL conversational forecast **LAR 31–27, P(LAR)=0.60**, market reference LAR -3.5, total 54.5. The original chat issuance time is unknown; the durable GitHub capture was confirmed **before kickoff** at commit `5b6e6cb7ba799d36b437735fe498b128e3f6a74c`.
- `pregame.availability-001.json`: an additional pregame evidence snapshot, with information cutoff 2026-10-12 23:56:16 UTC. Never backfill the original prediction with this evidence.
- Jhadina's broader prediction/shadow/calibration architecture already exists in `packages/money-core/src/` (`sports-prediction-reality.ts`, `sports-learning-memory.ts`, `sports-simulation-calibration.ts`). This case is a *research-case* with a full-score baseline, **not** a fake `SportsForwardShadowPrediction` nor a `SHADOW_WAGER`.
- Database audit: `Swlc` project reports ACTIVE_HEALTHY but `transaction_read_only=on`. The new study-table migration could not be applied; see `../../sql/jhadina_sports_study_events.pending.sql`. Do not write arbitrary payloads into existing structured `sports_shadow_decisions` or pre-label a pending game as a learning episode.

## Postgame workflow
1. Wait for official game status `FINAL` and capture official source URL, both teams' scores, and verification time **after** kickoff.
2. Append a NEW `postgame.final-001.json`, conforming to:
   `{"schema_version":"jhadina.sports.study_case.final_input.v1","case_id":"JH-SPORTS-NFL-2026-001","event_id":"nfl-2026-reg-week05-buf-at-lar","status":"FINAL","source_class":"OFFICIAL_FINAL","source_url":"<verified official result URL>","verified_final_at_utc":"<ISO time after final>","final_home_points":0,"final_away_points":0}`.
   Replace placeholders with verified real data. Do not create this file before final.
3. Score with Node >=18:
   `node training/sports/nfl/grade-case.mjs training/sports/nfl/2026/2026-10-12-buf-at-lar/pregame.case.json training/sports/nfl/2026/2026-10-12-buf-at-lar/postgame.final-001.json training/sports/nfl/2026/2026-10-12-buf-at-lar/postgame.scorecard-001.json`.
   The scorer does not fetch sources and should only be used after human/agent official-source verification. It writes with exclusive creation (`wx`) and refuses overwriting an existing grade.
4. Append `postgame.review-001.json` with verified sources for: Stafford/Nacua passing matchup; Oliver absence and offensive line/pressure effects; Josh Allen rushing/efficiency/turnovers; turnovers, special teams and injury-driven personnel; weather/refereeing if material and sourced. For each original thesis assign SUPPORTED, MIXED, CONTRADICTED or INSUFFICIENT_EVIDENCE. Do not infer causality solely from the final score.
5. Record winner Brier/log-loss, team score errors, total/margin error, ATS and O/U *descriptive* outcomes. Contrast judgment forecast to the reported market; no moneyline-based expected value without contemporaneous comparable odds.
6. Send review to JANET memory candidate / B-70.13 admission as **research-only**, with provenance and human approval. Do not self-promote anecdotal lessons to model weights. Maintain holdout future games and out-of-sample evaluation.
7. For multiple games, track per-model win rate, baseline Brier vs forecast and bookmaker consensus, log loss, error distributions by team/context, probability-bin calibration, and ablation performance with a minimum real sample threshold. Do not claim proven accuracy from one result.

## Before making corrections
Add a new timestamped `correction-NNN.json` linked to the superseded record; do not mutate the original committed forecast or its GitHub SHA. Changes issued after kickoff are never pregame forecasts.

## Milestone 002: reproducible integrity and governed study memory
- `training/sports/nfl/verify-case.mjs` independently checks the pinned original Git blob SHA `78957b73845b8f93bb162ae52df4de28ecd18725`, recorded pregame capture, and availability cutoff. The forecast was not rebuilt using live-game information.
- `training/sports/nfl/grade-case.test.mjs`: regression tests for winner correctness, probabilities, score errors, tied results, mismatched event IDs, and contradictory stored fields. No real outcome is entered by these tests.
- `training/sports/nfl/compile-lessons.mjs`: once an official final scorecard **and** separately verified review exist, compile a `jhadina.sports.learning_candidate.v1` file. The result remains `AWAITING_OWNER_REVIEW`, never silently promoted into Jhadina's permanent memory.
- `.github/workflows/jhadina-sports-study.yml` runs integrity and regression tests on relevant commits. A committed workflow is not evidence that GitHub Actions has passed; verify actual runs separately.
- Tested 13 scorer/candidate assertions directly in an isolated JavaScript harness on October 12; Node/GitHub CI completion remains separately unverified.

### Reviewed postgame lesson input
Write a new `postgame.review-001.json` with schema `jhadina.sports.study_case.review.v1`, matching `case_id` and `event_id`, `reviewed_at_utc` after official final verification, `reviewer_id`, an `evidence_items` array, a `hypothesis_reviews` entry for each original T1–T4, and optional `lessons` with traceable evidence IDs. Supported/contradicted/mixed verdicts **require linked evidence**; insufficient-evidence verdicts must explain why the record cannot establish the claim.

Then run (after sources and scorecard are verified):
`node training/sports/nfl/compile-lessons.mjs training/sports/nfl/2026/2026-10-12-buf-at-lar/pregame.case.json training/sports/nfl/2026/2026-10-12-buf-at-lar/postgame.scorecard-001.json training/sports/nfl/2026/2026-10-12-buf-at-lar/postgame.review-001.json training/sports/nfl/2026/2026-10-12-buf-at-lar/postgame.learning-candidate-001.json`

Do not create the review or learning candidate from invented game statistics. The candidate is a review proposal, not a training execution receipt or evidence that Jhadina's deployed agent is automatically consuming this data.
