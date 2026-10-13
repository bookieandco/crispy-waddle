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

## Milestone 003: live evidence / cross-artifact admission
- `live.observation-001.json` stores the provider-reported Buffalo 3, Los Angeles 0 snapshot with Q1 11:00 remaining at 2026-10-13T00:25:00Z. **Provisional only**; it is not an official final score, cannot update weights, and is not a second pregame forecast. Its capture stamp is 2026-10-13T00:27:20.114399Z.
- `training/sports/nfl/validate-live.mjs` validates the exact event, cutoff after kickoff, capture ordering, provisional status, score/clock sanity, and research-only authority. Its tests live in `validate-live.test.mjs`.
- `training/sports/nfl/admit-reviewed-case.mjs` verifies the pinned original GitHub blob, recomputes the scorecard against a supplied officially verified final, and requires a review that actually cites the result source. It emits a review receipt with content hashes and a **candidate awaiting owner approval**, not a memory write or model update. Its tests live in `admit-reviewed-case.test.mjs`.
- Neither the research-only scorecard nor the admission candidate can establish that an official website was independently fetched; the reviewing worker/operator must verify the final source contents and URL. An `https://nfl.com/...` URL by itself is not proof of a real final.
- Confirmed isolated JavaScript harness results from connector-fetched source: 7/7 new admission assertions and 6/6 live-validator assertions. These checks used controlled substitutes where the harness did not have the Node runtime; the **full native Node test suite and GitHub Actions run have not yet been independently observed as passing**.

### Postgame validation order
1. Retrieve real league/team result; do not reuse a score from a live scoreboard as final.
2. Create and verify `postgame.final-001.json` and `postgame.scorecard-001.json`.
3. Obtain official box score/play-by-play and review T1–T4 (plus missing data) in `postgame.review-001.json`.
4. Run the pinned-case integrity check, live-observation check, scorer, and `admit-reviewed-case.mjs` to produce `postgame.admission-receipt-001.json`.
5. Owner reviews proposed lessons; only after separate explicit approval may existing JANET memory admission add a durable knowledge record. Do not add a synthetic wager or training episode to the existing sports shadow tables.
6. Supabase repair remains separate: Swlc reported `transaction_read_only=on`, and `public.jhadina_sports_study_events` does not yet exist. The pending SQL is in `training/sports/nfl/sql/`; never claim durable database learning before a write+readback+restart proof.

## Milestone 004: independent-source audit and two-snapshot replay
- The exact original **Rams 31–27** score and some matching rationale were published by NFL.com analyst **Dan Parr**, in an article dated October 8 (updated October 9). This is **not proof of copying**. The assistant's original source inputs are unknown; mark **independence unverified** and do not count the forecast as an independent prediction against that same published analyst. This investigation is preserved in `audit.source-overlap-001.json` and cannot change the original pregame pick.
- The source GitHub commit `5b6e6cb7ba799d36b437735fe498b128e3f6a74c` is independently timestamped **2026-10-12T23:55:32Z**, before the 2026-10-13T00:15:00Z kickoff. The original record's earlier **23:55:05Z** figure was a database-clock probe, not the Git commit's creation time. See `audit.provenance-amendment-001.json`; the pinned original JSON must not be changed.
- `audit.market-benchmark-001.json` contains published October 8 FanDuel lines reported by NFL.com: LAR -176, BUF +148. Their no-margin normalized Rams baseline is approximately **61.2621%**. It is a **retrospective archive captured after kickoff of an earlier publication**, not a contemporaneous executable quote or a known original model input.
- `compare-probabilities.mjs` produces the `pregame.baseline-comparison-001.json` research report. It computes the 60% versus 61.2621% gap and can compare Brier/log-loss *after* an official result is separately verified. The current report is `AWAITING_FINAL`.
- The live dataset now includes two independent provider-sourced Q1 checkpoints: `live.observation-001.json` and `live.observation-002.json`. No independently verified play-by-play cause is established by either.
- `export-study-events.mjs` accepts one or more chronological live observations, sorts them deterministically, and rejects duplicate IDs, provider-game drift, and score regression. Corrected live scores must be represented with separate explicit correction evidence rather than quietly overwriting a prior snapshot. Use:
  `node training/sports/nfl/export-study-events.mjs PREGAME.json AVAILABILITY.json LIVE-001.json LIVE-002.json --out replay.json`.
- `admit-reviewed-case.mjs` now **requires** the source-overlap file and adds unverified independence to every admitted learning candidate. Run with `PREGAME AVAILABILITY OFFICIAL_FINAL SCORECARD REVIEW SOURCE_OVERLAP [OUTPUT]`. This remains a research candidate, not active model training.
- `templates/postgame-review.template.json` contains T1–T4 investigation prompts, evidence needs and separate MAKE IT MAKE SENSE votes for coherence and evidentiary truth. The template is intentionally invalid as a completed review.

### Verification and unresolved blockers
- 10/10 isolated function checks passed for archived probability baseline; 8/8 for two-live-snapshot replay; and 8/8 for source-overlap-aware admission. Tests use fake results for after-game branches; **none of those fixture scores are official 2026 Bills–Rams outcomes**.
- A GitHub Actions workflow with the .test.mjs suite was committed; completed native Node Actions/CI results have not been observed in these tools. Do not claim full CI certification.
- Supabase `Swlc` continues responding to read-only SQL, while its `transaction_read_only=on` prevents creating the new study table. No database writes, persistent runtime case ingestion, or deployed-Jhadina retraining have been verified.
- Existing October 13 postgame review automation should verify a real final score, preserve the archived forecast, grade, compare to market, and create candidate-only learnings. Do not manufacture an outcome before the official final.


## Prop study added — numeric Over/Under, touchdowns and public splits

The original whole-game pick stays sealed. A separate prop-research track contains:
- `props.archived-dk-splits-001.json`: **104** published numeric thresholds, **18** named players, **14** statistical categories, across `FULL`, `FIRST_HALF`, and `Q1`. The DraftKings Network article published on October 12 has no exact verified quote timestamp in the archived record, so its prices are unavailable and it cannot substantiate a real pregame wager or model pick.
- `props.context-and-alternative-lines-001.json`: **16** additional line records from other published references plus **7** historical player performance averages / recent-game baselines. The prop coverage audit finds **7** player/stat pairs with different reported lines. Variations are not proof of actual time-sequenced line movement.
- `props.public-over-under-splits-001.json`: **32** selected DraftKings handle and ticket over/under split observations linked to the numeric markets; these percentages are **bettor activity, never success probabilities**. This is a sample, not an exhaustive export of all 104 split records.
- `props.touchdown-odds-001.json`: **32** first / anytime touchdown scorer binary observations for **16 players** from a published BetMGM article. These are not standard two-sided yardage overs; the odds contain margin and their snapshot timestamp/timezone is not authenticated. A player credited with passing TD throws has not necessarily scored a touchdown themselves.
- `training/sports/nfl/grade-props.mjs` classifies each numeric line using only independently reviewed official player metrics and period-matched evidence into `OVER_RESULT`, `UNDER_RESULT`, `PUSH_RESULT`, `OFFICIAL_STAT_MISSING`, or `DNP_OR_INACTIVE_SETTLEMENT_REVIEW`. A missing stat is **not** zero and an inactive player is **not** an automatic Under or loss. It does not infer winning bets, odds returns, or forecast accuracy.
- `training/sports/nfl/grade-touchdowns.mjs` requires verified official TD events and play-by-play for the FIRST scorer. Inactive/DNP settlement remains unresolved without bookmaker terms.
- `training/sports/nfl/audit-prop-coverage.mjs` verifies archive relationships, source semantics, TD price math, split totals, and contradictory line reports. Full sportsbook market coverage is **not claimed**: defensive sacks/tackles, kicking, team/quarter/alternate and various miscellaneous props remain unsupported without sources.
- `training/sports/nfl/templates/official-prop-player-stats.template.json` and `training/sports/nfl/templates/official-td-outcomes.template.json` are deliberately **invalid, unfilled templates** until the official postgame evidence is reviewed.
- `handoff.prop-study-001.json` preserves all paths and the next review requirements.

After an official FINAL, run the numeric and binary graders against the independently verified sources. Each player/market is a **descriptive line-versus-result observation**; without a genuinely timestamped pre-kickoff prop forecast, it does not count as a forward pick, model backtest, or betting success. For future games, create genuine sealed, timestamped player prop forecasts before kickoff and benchmark those against archived market expectations out of sample.

Isolated function testing: numeric grading 11/11, TD grading 8/8, and prop coverage audit 8/8 passed using synthetic stat fixtures. Native GitHub Actions completion, write-enabled Supabase, and real Bills–Rams postgame statistics remain unverified as of these notes.
