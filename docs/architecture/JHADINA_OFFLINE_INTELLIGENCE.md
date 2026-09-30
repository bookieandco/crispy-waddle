# Jhadina Offline-First Intelligence

## Goal

Jhadina should remain useful without an Internet connection. Connectivity is an enhancement and synchronization channel, not a prerequisite for identity, memory, reasoning, or core workflows.

## Layers

1. **Local model runtime** — one or more appropriately sized local language models for private/offline inference.
2. **Local knowledge store** — approved memories, documents, embeddings, model metadata, tool schemas, and curated reference material.
3. **Local retrieval** — semantic + keyword retrieval over the local knowledge store.
4. **Local reasoning/orchestration** — deterministic policy and task routing decide which local capability can act.
5. **Connectivity Core** — discovers and scores authorized Wi-Fi, Ethernet, cellular, and satellite links when present.
6. **Sync engine** — queues outbound work while offline and reconciles it when connectivity returns.
7. **Cloud intelligence** — optional higher-capability models and fresh information when connected.

## Important boundary

Offline knowledge must not pretend to be current. Each local source carries provenance and freshness metadata. When a task depends on information that may have changed, Jhadina should explicitly mark the answer as potentially stale and queue a refresh for the next authorized connection.

## Model strategy

Use a local model tier for always-available inference, with larger remote models as optional escalation. Do not assume that a single local model can reproduce every capability of a frontier hosted model. Instead, preserve the useful *behavioral substrate*: routing, memory retrieval, tool schemas, structured reasoning, personalization, style/tone, and deterministic policy enforcement.

## Offline queue

All non-urgent network-dependent work is represented as an idempotent queue item. Items have stable IDs, creation timestamps, attempts, and sync status. Retries must be safe and deduplicated.

## Security

Only authorized networks and credentials may be used. The Connectivity Core must never bypass captive portals, authentication, encryption, billing, carrier controls, or access-control mechanisms.

## Target behavior

ONLINE -> DEGRADED -> OFFLINE -> LOCAL OPERATION -> QUEUED SYNC -> RECONNECTED -> RECONCILED

The user experience should remain continuous across those states.
