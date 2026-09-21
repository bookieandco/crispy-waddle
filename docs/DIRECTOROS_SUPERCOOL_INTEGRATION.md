# DirectorOS × SuperCool Integration

## Purpose

DirectorOS can use SuperCool as an optional production provider while keeping DirectorOS as the authority for:

- story and project state
- character and asset continuity
- cinematography decisions
- take lineage
- approval gates
- timeline governance

SuperCool is therefore a provider/crew behind the DirectorOS boundary, not the system of record.

## Why the integration is provider-neutral

SuperCool currently documents an all-in-one film workflow, third-party connectors, an API gateway for AI services, and MCP access. Its public material does not expose a stable movie-generation HTTP request/response contract that DirectorOS can safely hard-code against.

The repository therefore adds a typed SuperCool provider seam without guessing a private endpoint or response schema.

## Current implementation

`packages/director-core/src/supercool-provider.ts` provides:

- `toSuperCoolRequest()` — converts an approved DirectorOS `TakeRequest` into a provider payload.
- `createSuperCoolProvider()` — registers SuperCool under provider id `supercool`.
- `createSuperCoolHttpTransport()` — optional HTTP transport when a confirmed SuperCool endpoint/contract is available.

No SuperCool credential is committed to the repository.

## Human gate

Before enabling live generation, obtain the official SuperCool integration details for the account being used:

1. Confirm the supported MCP/API integration and its production endpoint.
2. Confirm authentication and required scopes.
3. Confirm the generation request and response contract.
4. Confirm whether generated media can be exported/consumed by an external application and under what plan/terms.
5. Configure the endpoint and secret in the host environment only.
6. Run a sandbox/low-cost test and verify the returned media maps cleanly to DirectorOS take lineage.

Until those items are confirmed, the provider remains an integration seam rather than a live production route.

## Intended flow

```text
DirectorOS approved take
        |
        v
SuperCool provider adapter
        |
        v
SuperCool production workflow
        |
        v
media + provider job id
        |
        v
DirectorOS review / continuity / timeline
        |
        v
human approval
```

## Safety boundary

The adapter must never allow a provider to bypass DirectorOS approval or continuity locks. Provider responses are treated as untrusted external results until validated and attached to a DirectorOS take.
