# Jhadina Sports Intelligence — NFL case #001
**Event:** Buffalo Bills at Los Angeles Rams, Oct 12, 2026 (NFL regular-season Week 5). Kickoff 2026-10-13 00:15 UTC (5:15 PM Pacific).

## Status and scope
Research/learning only. One-game sample, no validated betting edge and no authority to place wagers.
- `pregame.case.json`: preserved ORIGINAL conversational forecast **LAR 31–27, P(LAR)=0.60**, market reference LAR -3.5, total 54.5. The original chat issuance time is unknown; the durable GitHub capture was confirmed **before kickoff** at commit `5b6e6cb7ba799d36b437735fe498b128e3f6a74c`.
- `pregame.availability-001.json`: an additional pregame evidence snapshot, with information cutoff 2026-10-12 23:56:16 UTC. Never backfill the original prediction with this evidence.
- Jhadina's broader prediction/shadow/calibration architecture already exists in `packages/money-core/src/` (`sports-prediction-reality.ts`, `sports-learning-memory.ts`, `sports-simulation-calibration.ts`). This case is a *research-case* with a full-score baseline, **not** a fake `SportsForwardShadowPrediction` nor a `SHADOW_WAGER`.
- Database audit: `Swlc` project reports ACTIVE_HEALTHY but `transaction_read_only=on`. The new study-table migration could not be applied; see `../sql/jhadina_sports_study_events.pending.sql`. Do not write arbitrary payloads into existing structured `sports_shadow_decisions` or pre-label a pending game as a learning episode.

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
