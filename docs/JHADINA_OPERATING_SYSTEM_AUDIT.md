# Jhadina Operating System Connection Audit

Date: 2026-08-10
Branch: feat/jhadina-entertainment-intelligence

## Current end-to-end target

JANET approved context -> DELIA strategy -> MARISA execution request -> verified identity -> policy/security -> action handler -> durable audit -> Activity/Mission Control.

## Findings

### Fixed in this audit

- MARISA execution now depends on the governed executor contract rather than an unsafe concrete cast.
- MARISA execution IDs are unique per attempt; strategy IDs remain strategy identifiers.
- MARISA preserves governed executor errors in its execution result.
- Agent handoff audit now distinguishes CREATED, COMPLETED, and FAILED rather than reporting every handoff as CREATED.
- Action Core no longer converts a successful handler side effect into a handler failure when the completion audit append fails.
- GitHub codebase tree handling now matches the GitHub API response shape and fails closed on truncated trees.
- Codebase path ranking now ranks the full candidate tree before applying the file cap.
- Codebase graph now models `calls` edges, so call-path queries match the graph contract.
- Codebase graph tables have RLS enabled because they contain private implementation knowledge.
- Vercel's Director Core resolution is explicitly handled in Next webpack configuration for workspace source modules.

## Remaining blockers / missed connections

### 1. The operating endpoint is still not a real application composition root

`/api/agents/operate` intentionally returns `NOT_CONFIGURED`. It must receive the authenticated identity, real DELIA provider, real MARISA provider, and persistent audit sink from an application composition root.

### 2. No concrete DELIA implementation was found on the target branch

The operating loop exposes `DeliaStrategyProvider`, but the repository search did not locate a concrete implementation that can be injected into the live route. This is a contract with no confirmed production provider.

### 3. No registered `DELIA_STRATEGY_EXECUTION` action handler was found

MARISA can submit the governed request, but the Action Core requires a handler supporting the request type. Until one exists, execution correctly fails closed with `handler_not_found`.

### 4. Authentication is not connected to the operating endpoint

The route accepts `userId` from the request body. That is not an identity boundary. Production execution must derive user identity from the authenticated server session and let the identity verifier validate the request; a caller must never be able to select the actor by POST body alone.

### 5. JANET memory is still backed by InMemoryStorage

`MemoryRepository` currently operates on `InMemoryStorage`. That means approved memory is not durable across deployment/process restart. The architecture says memory is persistent, but the live web service still needs the persistent repository wired in.

### 6. GitHub codebase provider is not yet connected to the persistent graph

`JanetGitHubCodebaseProvider` currently fetches GitHub on demand. `JanetCodebaseIndex` and `SupabaseCodebaseIndexStore` exist, but there is no confirmed indexing composition that feeds GitHub snapshots into the persistent graph and makes JANET query the graph first.

### 7. Persistent graph writes are not transactional

The Supabase store deletes existing nodes/edges before inserting the replacement snapshot. A failed insert can leave a partial or empty graph. Production indexing should use a transaction/RPC or versioned snapshot swap.

### 8. Agent Activity and Action Ledger are separate audit streams

The Activity UI reads the in-process `SharedAgentAuditSink`; Action Core writes the durable action ledger. They need a unified event model or a server-side activity query that joins both streams. `globalThis` is not a durable/shared store across Vercel instances.

### 9. Codebase graph ingestion is still shallow

The current GitHub adapter extracts symbols/imports/API calls with regexes. It is useful as a fallback, but it is not equivalent to an AST/LSIF-style symbol graph. Production call paths should be derived from parsed symbols and resolved references, not strings alone.

### 10. Policy is generic at the Action Core layer

`AllowAllActionPolicy` exists as a development implementation. Production composition must prove that the actual policy/security core is injected and that capabilities are checked per action type before MARISA can execute anything.

## Recommended priority order

1. Build the authenticated application composition root.
2. Register a real DELIA strategy provider.
3. Register the first real MARISA action handler behind Policy/Security.
4. Replace request-body `userId` with authenticated identity.
5. Wire JANET's persistent memory repository.
6. Wire GitHub indexing -> Supabase graph -> JANET graph queries.
7. Make codebase snapshot replacement transactional/versioned.
8. Unify agent handoff audit and Action Ledger into one queryable activity stream.
9. Add end-to-end tests that execute the complete path with a fake handler and assert every audit event.
10. Only then mark `/api/agents/operate` production-ready.
