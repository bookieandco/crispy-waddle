# Kaggle NBA dataset integration

Dataset: `wyattowalsh/basketball`.

Public Kaggle material describes the dataset as an NBA SQLite database assembled from `nba_api`, with historical game, player, team, box-score, line-score, draft, career-stat and biometric data. The worker must inspect the downloaded database before relying on any particular table or column.

## Role in Jhadina Sports

This source is historical/tabular evidence. It can support historical context, roster cross-checking, post-inference box-score reconciliation and calibration datasets.

It is not physical perception. Rows from the database must never be converted into detector observations or used to claim that Jhadina saw a player, ball, shot, possession or event in video.

For NBA-RUNTIME.10, physical inference must be frozen before Kaggle/NBA reference data is used to score the blind run. This preserves the separation between what Jhadina observed and what an external data source reports.

## Runtime

Authentication is server-side through `KAGGLE_API_TOKEN`. The token is not stored in the repository.

The worker downloader writes a provenance receipt after download. A subsequent dataset-audit step must record the downloaded artifact hash, actual table inventory, schema and coverage before adapters are enabled.
