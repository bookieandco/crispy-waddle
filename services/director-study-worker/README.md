# Director Study Worker

Runtime service for `DIRECTOR-REPLICATE.FINAL`.

It exposes:

- `POST /study` — ingests a real YouTube/web reference and emits evidence-bound `process-step` observations back to Jhadina.
- `POST /jobs`, `GET /jobs/:id`, `GET /jobs/:id/output` — deterministic FFmpeg smoke-video provider used only for live runtime certification.
- `GET /cert/reference.png` — stable synthetic reference asset for certification.
- `GET /health`.

The smoke video endpoint proves duration, provider submission/reconciliation, ingestion, storage, and project lineage. It makes **no cinematic-quality claim** and must not be selected for ordinary production traffic.
