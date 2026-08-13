# Economic Decision Engine

The economic decision engine turns current mining telemetry and financial projections into an auditable **advisory** decision: `run`, `do_not_run`, or `insufficient_data`.

It does not control a miner, issue a wallet transaction, or bypass Safeguard.

## Policy

- Missing gross/electricity economics => `insufficient_data`.
- Offline/unknown hardware => `insufficient_data`.
- Confidence below threshold => `insufficient_data`.
- Healthy hardware with net economics at or above the configured threshold => `run`.
- Otherwise => `do_not_run`.

Every result carries the observed inputs, reasons, confidence, and policy version so it can be persisted as an auditable recommendation.
