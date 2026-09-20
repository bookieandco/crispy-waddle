# G15-X PlayStation Experimental Lab Certification

Status: COMPLETE FOR G15-X.1 THROUGH G15-X.5 SCOPE

## Scope

G15-X is an isolated experimental PlayStation research lane. It does not replace the supported PlayStation runtime path and it does not grant exploit or arbitrary payload execution authority.

### G15-X.1 — governed PS5 research catalog
- Records provenance for PS5 Linux, emulator, payload-catalog, home-integration, and controller-library references.
- Linux loader and payload-manager references are non-automatic.
- Kyty is the only current reference eligible for managed emulator evaluation.

### G15-X.2 — explicit experimental capability gate
- Requires experimental mode plus explicit user approval for allowed experimental actions.
- Permanently denies payload execution, exploit execution, privilege escalation, and automatic payload loading through this control plane.
- Metadata sources cannot masquerade as executable runtimes.

### G15-X.3 — safe adapters
- PS5-MQTT is observation/home-integration only.
- Kyty enters the existing managed emulator lifecycle rather than a PS5-specific bypass.
- Payload-mirror ingestion is sanitized metadata only; executable/download fields are not represented by the adapter.

### G15-X.4 — provenance receipts
- Every control-plane authorization produces an immutable receipt with reference, repository, action, decision, approval flag, and timestamp.
- Receipts deliberately exclude account credentials, tokens, payload bytes, and executable artifacts.

### G15-X.5 — acceptance boundary
Acceptance proves:
1. exploit execution is denied even with experimental mode and explicit approval;
2. PS5 state observation can be explicitly authorized;
3. payload-catalog metadata can be explicitly authorized and sanitized;
4. Kyty emulator launch can be explicitly authorized;
5. the emulator then runs inside the normal UnifiedGamingSession managed-runtime lifecycle;
6. session stop releases all managed runtime resources;
7. audit receipts preserve provenance and authorization outcomes without executable/payload or secret material.

## Adjacent Steam reference

The user-supplied `gibbed/SteamAchievementManager` reference is registered separately as a Steam/PC utility.

- It is not part of the PlayStation execution plane.
- It requires a running Steam client and logged-in Steam account according to the upstream project documentation.
- Achievement/stat mutation is never automatic in Jhadina and requires explicit user approval.
- Steam permissions do not inherit PS5 experimental permissions and vice versa.

## Isolation invariants

- No payload catalog entry can become an automatic executor.
- No exploit/Linux-loader reference can become an automatic runtime.
- No arbitrary ELF/payload download or auto-load path is exposed by G15-X.
- Experimental actions cannot bypass the normal Gaming runtime/session lifecycle.
- Emulator process teardown remains owned by the unified session.
- Supported PlayStation integration and experimental research remain separate authorization domains.
- LLM output cannot directly grant experimental capability.
- Experimental receipts cannot contain secrets or raw payload bodies.

## Certification requirement

The exact G15-X.5 head must pass the dedicated Gaming Core Certification:
- frozen pnpm install;
- strict TypeScript;
- full Gaming Core Vitest suite;
- Turbo build/test/type-check for `@jhadina/gaming-core`.

The final workflow run and counts are recorded after GitHub Actions certification succeeds.
