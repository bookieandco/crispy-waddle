# JLLM-FABRIC-RECONCILE.08 — progressive native voice hardening

2026-10-17. Old September 22 certification claiming no streaming is stale. Progressive NDJSON chunks, canonical voice identity verification and the authenticated proxy already exist.

Source additions: bounded NDJSON with terminal done required, canonical voice metadata/MIME validation, abort-triggered reader cancellation, audio handler cleanup, no second playback on barge-in, cooperative between-chunk worker predicate and tests.

**Not established:** real iPhone first-audio timing, physical microphone interruption, provider acoustic identity/quality, approval of a final voice, or hard preemption of in-flight synchronous TTS provider calls. HTTP TTS remains synchronous; cancelling a client request may not stop already-running upstream inference. These require separately dated provider/device receipts. Do not promote this feature to LIVE CERTIFIED from source tests.
