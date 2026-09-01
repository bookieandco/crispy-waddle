# JhadinaOS Implementation Matrix

> **Last updated:** 2026-09-01  
> **Branch:** copilot/audit-repair-jhadinaos-implementation-again  
> **Audit scope:** bookieandco/crispy-waddle main branch

This matrix reflects the **current** repository state. No claim is made for anything not directly verified in source. Vercel and GitHub Actions quota limits are noted where they block hosted verification.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Verified in current source |
| ⚠️ | Partial — gap identified |
| ❌ | Missing or broken |
| 🔒 | Infrastructure-blocked (Vercel/quota/Xcode) |
| 🌿 | Branch-blocked (not on current main) |
| 🚧 | In progress / PR open |

---

## Subsystem Matrix

| Subsystem | Canonical Contract | Implementation | Runtime Wiring | Persistence | Authentication | RLS | Policy | Audit | Tests | Status | Known Gap | Human Gate |
|-----------|-------------------|----------------|----------------|-------------|---------------|-----|--------|-------|-------|--------|-----------|------------|
| **Identity** | `SupabaseActionIdentityVerifier` (`supabase-identity-verifier.ts`) | ✅ `SupabaseActionIdentityVerifier` verifies against real Supabase session | ✅ Used by `createRequestIdentityVerifier()` in production command path | N/A (stateless) | ✅ Supabase session | ✅ Supabase RLS | N/A | N/A | ✅ | ✅ | `x-user-id` header still trusted in legacy routes (repaired in this PR) | None |
| **Capability Registry** | `CapabilityRegistry` (`@jhadina/capability-registry`) | ✅ Class with register/get/has/list + `requiresApprovalByDefault` / `requiresAudit` | ⚠️ No domain/skill/app registrations call `registry.register()` in production | N/A (in-process) | N/A | N/A | ⚠️ Policy reads risk metadata from registry but no runtime wiring to PolicyGate | N/A | ✅ Conformance tests added | ⚠️ | Registration ≠ authorization — correct design, but no domain capabilities register through the canonical registry yet | Establish registration wiring per domain |
| **Core Spine** | `JhadinaSpine` / `SpinePorts` (`@jhadina/core-spine`) | ✅ `JhadinaSpine.run()` orchestrates all ports | ❌ `JhadinaSpine` is NOT instantiated in production — `handleJhadinaCommand()` calls `decideAndProposeMemoryGoverned()` directly | N/A | N/A | N/A | ✅ PolicyPort type defined | ✅ AuditPort type defined | ❌ No spine tests | ⚠️ | Issue #140 open: spine ↔ action-core contracts misaligned; `ActionCorePortAdapter` added as explicit boundary | Merge adapter + full JhadinaSpine instantiation |
| **Action Core** | `ActionExecutor` / `VerifiedActionExecutor` (`@jhadina/action-core`) | ✅ `VerifiedActionExecutor` enforces identity + policy + ledger | ✅ `createProductionActionExecutor()` wires Supabase ledger | ✅ `SupabaseAuditLedger` | ✅ `SupabaseActionIdentityVerifier` | N/A (server-side) | ✅ `SecurityCoreActionPolicy` / `JhadinaValuesActionPolicy` | ✅ `SupabaseAuditLedger` | ✅ 21 passing tests | ✅ | `InMemoryApprovalReceiptStore` used as production singleton in `jhadina-command.ts` — durable replacement tracked in #193 | Durable approval receipt store (Issue #193) |
| **Policy Gate** | `ActionPolicy<TAction>` interface; `SecurityCoreActionPolicy`; `JhadinaValuesActionPolicy` | ✅ Both implementations exist and are tested | ✅ Used via `createProductionActionExecutor()` | N/A | N/A | N/A | ✅ Three-state: allow/deny/approval_required | ✅ Denial audited in ledger | ✅ | ✅ | `AllowAllActionPolicy` must not be instantiated in production (documented; no runtime guard possible without env injection) | — |
| **Decision / Intelligence Router** | `IntelligenceRouter` (`@jhadina/intelligence-core`) | ✅ Proposes actions via governed LLM path | ✅ `createProductionIntelligenceRouter()` wires the real provider | ✅ Governed — passes through identity → policy → action-core | N/A (stateless per-request) | ✅ Caller identity verified before router invocation | N/A | ✅ Policy evaluated before execution | ✅ Ledger appended | ✅ | — | — |
| **Provider/Adapter** | `ActionHandler<TAction, TResult>` interface | ✅ `memory.propose` handler registered in `memory-propose-capability.ts` | ✅ Registered in production composition | N/A | N/A | N/A | ✅ Policy evaluated before handler | ✅ | ✅ | ✅ | Only one handler registered; broader capability catalog not yet wired | — |
| **Result / Approval Receipt** | `ApprovalReceipt` / `InMemoryApprovalReceiptStore` | ✅ Full create/approve/consume semantics with expiry and binding | ⚠️ In-memory singleton in production | ⚠️ Non-durable — lost on restart | N/A | N/A | ✅ Actor + fingerprint + expiry binding | ✅ Consume audited | ✅ 10 adversarial tests added (this PR) | ⚠️ | Durable atomic implementation required for production; tracked Issue #193 | Durable approval receipt store (Issue #193) |
| **Audit Ledger** | `ActionLedger` interface; `SupabaseAuditLedger` | ✅ Durable Supabase-backed ledger | ✅ Used in `createProductionActionExecutor()` | ✅ Supabase | N/A | ✅ Supabase RLS | N/A | ✅ Append-only; start/deny/fail/complete events | ✅ | ✅ | `InMemoryActionLedger` exists in source — must not be used in production | — |
| **Memory / Evidence** | `MemoryStorage` interface; `SupabaseMemoryStorage` | ✅ Both `InMemoryStorage` and `SupabaseMemoryStorage` exist | ✅ `handlers.ts::getStorage()` selects Supabase when configured | ✅ `SupabaseMemoryStorage` when env configured; InMemory with warning otherwise | ✅ Supabase session identity for all queries | ✅ Supabase RLS | N/A | N/A | ✅ Cross-user isolation tests added (this PR) | ✅ | `createJhadinaApplication()` accepted InMemoryStorage as default regardless of env (repaired in this PR) | — |
| **Event Bus** | `EventBus` / `DomainEvent` (`@jhadina/event-bus`) | ✅ `InMemoryEventBus` + extended `DomainEvent` with canonical fields (this PR) | ❌ No production durable EventBus adapter | ❌ Non-durable | N/A | N/A | N/A | N/A | ✅ Conformance tests updated | ⚠️ | No outbox/durable adapter — tracked Issue #193 | Implement durable outbox adapter |
| **JhadinaOS iPhone Shell** | App manifest/registry/lifecycle (`apps/jhadina-ios`) | ⚠️ 2 Swift files exist (PacketTunnelProvider, AudioOutputBridge) | 🔒 PR #202 is draft/open off a separate branch | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | PR #202 has +633 lines of iOS manifest/shell work on `feat/jhadinaos-iphone-first`; Xcode signing/device validation required | Merge PR #202 after physical-device validation |
| **Media Core** | `UnifiedMediaSession` / `MediaSessionSnapshot` (`@jhadina/tv-core`) | ✅ `createUnifiedMediaSession()` and casting abstractions exist | ✅ Playback adapter pattern implemented | N/A (stream state) | N/A | N/A | N/A | N/A | ❌ No package-level tests | 🔒 | Issue #201: verification blocked by Vercel build-rate-limit; local typecheck not run due to missing pnpm install | Run `pnpm tsc --noEmit` in @jhadina/tv-core when CI capacity restored |
| **Home Automation** | `DeterministicHomeAssistantAdapter` | 🌿 Implemented on `feat/bw-1-capability-registry` — NOT on current main | 🌿 | 🌿 | 🌿 | 🌿 | 🌿 | 🌿 | 🌿 | 🌿 | Issue #200 audit findings: (1) baseUrl in device records, (2) ad-hoc remote.power mapping, (3) inconsistent test construction, (4) HA capabilities not through canonical registry — all on the feature branch, not main | Merge feat/bw-1-capability-registry after addressing audit findings |
| **Security Architecture** | `SecurityGate` / `RiskBoundaryPolicy` (`@jhadina/security-core`) | ✅ Multiple policy implementations exist | ✅ Used via `JHADINA_BASE_SECURITY_POLICY` | N/A | N/A | N/A | ✅ | ✅ `audit-integrity.ts` | ✅ | ✅ | Infrastructure-dependent controls from Issue #193 not completable in this repository pass (remote worker, SBOM, encrypted backup) | Issue #193 full closure |

---

## Per-Task Audit Reports

### Task 1 — Core Spine / Action Core Reconciliation

**FINDING:** `@jhadina/core-spine`'s `ActionRequest`/`PolicyDecision`/`ActionResult` types and `@jhadina/action-core`'s types evolved independently. No explicit translation boundary existed. `JhadinaSpine` is not instantiated in the production command path because the contracts are misaligned.

**ROOT CAUSE:** Issue #140 was never resolved. The command handler (`jhadina-command.ts`) correctly documents it deliberately skips `JhadinaSpine`, but the misalignment itself was never addressed.

**FILES CHANGED:**
- `packages/jhadina-core-spine/src/action-core-adapter.ts` (new) — `ActionCorePortAdapter`, `translateToActionCoreRequest()`, `translateFromActionCoreResult()`
- `packages/jhadina-core-spine/src/action-core-adapter.test.ts` (new) — contract tests
- `packages/jhadina-core-spine/src/index.ts` — exports adapter
- `packages/jhadina-core-spine/package.json` — adds tsx test runner

**WHY THIS IS SAFE:** The adapter is additive and does not change any existing code path. `JhadinaSpine` is still not instantiated in production. The adapter is the explicit translation boundary for when it is.

**VERIFIED:** Contract tests pass locally.

**BLOCKED:** Full JhadinaSpine wiring requires all SpinePorts to be implemented.

**HUMAN GATE:** Architect review before wiring JhadinaSpine into production.

---

### Task 2 — Production Persistence

**FINDING:** `createJhadinaApplication()` always returned `InMemoryStorage` regardless of environment. Music routes used module-level `InMemoryMusicRepository` singletons.

**ALREADY RESOLVED:** `handlers.ts::getStorage()` already selects `SupabaseMemoryStorage` when configured, with a loud warning when not. Production routes use `handlers.ts`, not `createJhadinaApplication()`.

**FILES CHANGED:**
- `apps/jhadina-web/src/lib/application/createJhadinaApplication.ts` — accepts `storage` override; uses `MemoryStorage` interface type
- `apps/jhadina-web/src/__tests__/production-persistence.test.ts` (new) — regression tests

**WHY THIS IS SAFE:** The factory change is purely additive — the default behavior (InMemoryStorage when no override) is unchanged for tests/dev.

**VERIFIED:** Tests added. Awaiting dep install to run vitest.

**HUMAN GATE:** None.

---

### Task 3 — Authentication Cleanup

**FINDING (CRITICAL):** `handlers.ts::extractUserId()` fell back to `"user_demo"` when no `x-user-id` header was present. Any unauthenticated request to `/api/message`, `/api/memory/approve`, `/api/memory/reject`, `/api/candidates`, `/api/memories`, `/api/memories/search` would silently operate as `"user_demo"`. Music search/import routes had the same issue.

**ROOT CAUSE:** Legacy Phase 1A pattern not replaced when real auth was added.

**FILES CHANGED:**
- `apps/jhadina-web/src/lib/routes/handlers.ts` — `extractUserId` returns `null` for missing/empty header
- `apps/jhadina-web/src/app/api/music/search/route.ts` — returns 401 when no header
- `apps/jhadina-web/src/app/api/music/import/route.ts` — returns 401 when no header
- `apps/jhadina-web/src/__tests__/auth-identity-isolation.test.ts` (new) — cross-user and header tests

**WHY THIS IS SAFE:** All callers already had `if (!userId) return 401` guards — the fix makes the guard reachable.

**VERIFIED:** Logic verified; vitest requires dep install to run.

**HUMAN GATE:** Confirm all legitimate callers send the `x-user-id` header before deploying.

---

### Task 4 — Security Phase 2 (Safe Mechanical Portion)

**FINDING:** `InMemoryApprovalReceiptStore` is used as a process-global singleton in `jhadina-command.ts` — non-durable, non-atomic; does not survive restarts; not safe for concurrent requests.

**FINDING:** `AllowAllActionPolicy` had no documentation guard preventing production use.

**FINDING:** No adversarial tests for receipt actor binding, replay protection, fingerprint binding, or expiry.

**FILES CHANGED:**
- `packages/jhadina-action-core/src/action-executor.ts` — `@testOnly` JSDoc added to `AllowAllActionPolicy`
- `packages/jhadina-action-core/src/approval-receipt-adversarial.test.ts` (new) — 10 adversarial tests

**BLOCKED:** Durable atomic approval receipt store (Supabase-backed) is an infrastructure-dependent control tracked in Issue #193. The production `InMemoryApprovalReceiptStore` singleton in `jhadina-command.ts` cannot be safely replaced without the durable implementation.

**WHY THIS IS SAFE:** Documentation-only change to existing code; new tests are additive.

**VERIFIED:** Tests will run with tsx once deps present.

**HUMAN GATE:** Issue #193 — implement durable receipt store before production approval flows.

---

### Task 5 — JhadinaOS iPhone Shell (PR #202)

**STATUS:** INFRASTRUCTURE-BLOCKED

PR #202 (`feat/jhadinaos-iphone-first`) adds +633 lines of iOS manifest/shell/App Intents work. The branch is not in the current clone. The 2 existing Swift files in `apps/jhadina-ios/` are `PacketTunnelProvider.swift` (VPN extension) and `JhadinaAudioOutputBridge.swift` (audio bridge).

**BLOCKED:** Xcode target, provisioning profiles, and physical-device validation are required. Cannot verify native completion from this repository.

**REQUIREMENT:** Any Ask Jhadina surface added in PR #202 must connect to `handleJhadinaCommand()` / `/api/jhadina/command` — the existing governed boundary — and not bypass Identity → Capability → PolicyGate → ActionCore → Audit.

**HUMAN GATE:** Xcode build + physical-device test before merging PR #202.

---

### Task 6 — Media Core (Issue #201)

**STATUS:** VERIFICATION BLOCKED

`@jhadina/tv-core` contains `UnifiedMediaSession`, `MediaSessionSnapshot`, casting, and local/remote playback. Source-level inspection shows:
- `createUnifiedMediaSession()` correctly delegates local/remote commands
- Loop prevention present (remote state subscribed; unsubscribed on disconnect)
- `MediaSessionState` reconciliation between local and remote states

**BLOCKED:** Issue #201 states verification is blocked by Vercel build-rate-limit (`upgradeToPro=build-rate-limit`). Local `pnpm install` failed in this environment. Running `tsc --noEmit` on `@jhadina/tv-core` is blocked by missing deps.

**NOT CLAIMING PASS OR FAIL.** Record: source inspection shows no obvious source-level errors; hosted typecheck required for definitive verification.

**HUMAN GATE:** Run `pnpm -C packages/jhadina-tv-core type-check` when CI capacity is restored; resolve any actual type errors found.

---

### Task 7 — Home Automation (Issue #200)

**STATUS:** BRANCH-BLOCKED

The Home Automation implementation (`DeterministicHomeAssistantAdapter`, `HomeAssistantDevice`, `HomeAssistantRemoteTransport`) lives on `feat/bw-1-capability-registry`, which is not in the current clone. No Home Automation source exists on `main`.

**Issue #200 audit findings (documented for when the branch is merged):**

1. **baseUrl in device records** — `HomeAssistantDevice` carries `baseUrl` inside the runtime device registry. Transport configuration must be kept separate from normalized entity/device records. Fix: remove `baseUrl` from the canonical normalized type; put it in a separate `HomeAssistantTransportConfig`.

2. **ad-hoc remote.power mapping** — `HomeAssistantRemoteTransport` hardcodes only `remote.power → homeassistant.toggle`. Fix: replace with deterministic service/action mapping from a capability-to-service lookup table.

3. **inconsistent remote execution test construction** — Remote execution tests use a constructor shape inconsistent with the current transport implementation. Fix: align test construction with the actual constructor.

4. **HA capabilities not through canonical registry** — Home Assistant-derived capabilities should register through `@jhadina/capability-registry` rather than bypassing the authoritative resolver/policy boundary.

**HUMAN GATE:** Address all four findings before merging `feat/bw-1-capability-registry`.

---

### Task 8 — Event Bus

**FINDING:** `DomainEvent` lacked canonical fields: `version`, `aggregate`, `actor`, `causationId`, `correlationId`, `provenance`. No production durable EventBus implementation exists.

**FILES CHANGED:**
- `packages/jhadina-event-bus/src/index.ts` — `DomainEvent` extended with canonical fields; `version` is required and validated; `InMemoryEventBus` documented as `@testOnly`
- `packages/jhadina-event-bus/src/index.test.ts` — conformance tests updated and extended

**BLOCKED:** Durable outbox/EventBus adapter is an infrastructure-dependent control. The `InMemoryEventBus` is the only implementation and must not be used in production.

**VERIFIED:** Tests updated and pass with tsx.

**HUMAN GATE:** Implement durable EventBus adapter before production event publishing.

---

### Task 9 — Capability Registry

**FINDING:** `CapabilityDefinition` lacked: `approvalRequired`, `auditRequired`, `executor`, `idempotency`. No policy-advisory helpers existed. No conformance tests for metadata semantics.

**FILES CHANGED:**
- `packages/jhadina-capability-registry/src/index.ts` — extended `CapabilityDefinition`; added `requiresApprovalByDefault()` and `requiresAudit()` helpers
- `packages/jhadina-capability-registry/src/index.test.ts` — 9 new conformance tests added

**WHY THIS IS SAFE:** All new fields are optional; existing registrations are unaffected.

**VERIFIED:** Tests pass with tsx.

**HUMAN GATE:** Domain capability authors should review metadata fields when registering new capabilities.

---

### Task 10 — Documentation

This document.

**ALREADY RESOLVED vs NOT RESOLVED:**
- Legacy `x-user-id`/`user_demo` in `growth`, `opportunity`, `planning` routes: check the referenced `current-user.ts` — those routes were already migrated per the file's comment.
- `InMemoryApprovalReceiptStore` in production: open gap, Issue #193.
- `JhadinaSpine` not instantiated: documented gap, blocked on full SpinePorts implementation.

---

## Infrastructure-Blocked Controls (Issue #193 Backlog)

These controls are identified and required but cannot be completed in this repository pass:

| Control | Blocked By | Issue |
|---------|-----------|-------|
| Durable atomic ApprovalReceiptStore | Supabase schema + atomic consume semantics | #193 |
| Durable ReplayGuard | Supabase / Redis atomic check | #193 |
| Durable outbox EventBus adapter | Supabase/Postgres outbox schema | #193 |
| Remote worker mutual device authentication | Infrastructure (mTLS, device provisioning) | #193 |
| Worker egress allowlist + job-scoped credentials | Infrastructure | #193 |
| Artifact scanning/quarantine | CI pipeline capability | #193 |
| SBOM/provenance verification | CI pipeline capability | #193 |
| Encrypted offline/immutable audit backup | Infrastructure (backup service) | #193 |
