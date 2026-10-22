# JH-MUSE-BROWSER.07–.09 — source-only approval, containment and evidence composition

Date: 2026-10-21. Base: draft PR #1419 / commit `895d2b27b10b8062b87539d71721b4aed3171086`. PR #1419 itself is stacked on draft PR #1411. **Not current main; do not merge as a standalone patch.**

## 0. Canonical reuse
Source reviewed:
- `packages/jhadina-action-core/src/{verified-action-executor,action-executor,approval-receipt,production-action-executor,supabase-audit-ledger}.ts`
- `apps/jhadina-agent-runtime/src/governance/{OutboundSentinel,GovernedBrowserSkillOperator,BrowserReadOnlyWorker}.ts`
- `docs/DO_NOT_BUILD.md`, `docs/JHADINA_ONE_RUNTIME_FOUNDATION.md`

The implementation adds **no new** action executor, audit ledger, identity provider, approval system, background scheduler or policy authority. All browser reads flow through:
`VerifiedActionExecutor -> canonical Security/Values ActionPolicy -> required fingerprinted approval receipt -> existing Supabase ActionAudit STARTED -> scoped read-only handler -> server-side WorkSession scope verifier -> independent isolation verifier -> pinned HTTPS worker -> COMPLETED audit`.

Existing Action Core owns all real approvals, audit writes and authenticated-session verification. An LLM, community `SKILL.md`, response HTML, unverified dashboard value, task lease or capability health never grants permission.

## .07 Isolation and network admission (SOURCE ONLY)
`BrowserIsolationVerifier` is an integration port for an **external operator-owned trusted host control plane** that proves current workload sandbox/network constraints. Its returned proof must match exact action/user/WorkSession, have unexpired 30-second freshness and maximum 120-second lifetime, and confirm all of:
- egress-deny except pinned HTTPS:443,
- ephemeral read-only filesystem,
- no ambient credentials mounted,
- no proxy,
- nonempty specific workload identity and source proof reference.

A prompt, request payload, GitHub README, model assertion or static `true` is **not** attestation. Tests use injected fake proofs; those are *not* live host evidence. Real network isolation still requires a deny-by-default egress firewall, dedicated namespace/VM, operator-signed verifiable receipts, trust anchor, anti-replay, private-IP denial at the network layer, TLS/redirect fault drills, worker process identity, service credentials isolation and owner-verified commissioning. No such host is created here.

## .08 Canonical authentication, scope and explicit approval
`createGovernedBrowserResearchExecutor` is an opt-in **composition factory**, not any registered route, provider, automatic consumer or live executor.
It depends on:
- `ActionIdentityVerifier` tied to authenticated server-side session;
- canonical ActionPolicy, further restricted by a domain overlay: deny non-browser type, preserve canonical DENY; turn even canonical ALLOW into `approval_required`;
- `ApprovalReceiptStore` from existing Action Core, composed by the factory with canonical `createApprovalReceiptVerifier`; `browserReadApprovalFingerprint` binds exact action ID, owner, timestamp, type, URL/payload, WorkSession, task and idempotency key. Receipts are single-use and must be durably/atomically consumed in real production (in-memory store is test-only);
- existing `SupabaseAuditLedger` RPC, which must append STARTED before work and COMPLETED after work;
- an operator-provided `BrowserWorkScopeVerifier` whose backend must validate owner-bound canonical WorkSession/task/version/lease/idempotency against durable data, rather than trust client-supplied lineage;
- `BrowserIsolationVerifier`, described above.

Actions missing WorkSession/task/correlation/approved receipt, or lacking isolation and scope, fail **closed**. This implementation does not expose any new public URL route or register the worker, so no browser request can occur just because this source is present. No secret or private-network address is read from environment. This is a stricter consent path even for public GET: GET requests can themselves have side effects.

## .09 Provenanced untrusted source output and replay safety
The read result carries exact action, owner, WorkSession/task and idempotency lineage; resolved requested URL, observed timestamp, byte count, MIME type, SHA-256 body digest, isolation proof reference and the raw text as **`untrustedBody`** with marker `EXTERNAL_UNTRUSTED_READ_ONLY_EVIDENCE`. Browser HTML is NEVER executable UI, tool instruction, system policy, memory correction, social post or spend authority. No external body is sent to the ActionAudit RPC by this composition.

Action Core consumes the approval receipt *before* the handler and writes the STARTED event *before* policy execution. Duplicate use of the same approval is denied. A completed fetch followed by audit failure returns `ACTION_COMPLETED_AUDIT_FAILED`, not a fictitious fetch failure; retrying with the consumed receipt does not repeat the fetch. Multi-worker durable idempotency beyond single-use approval must be validated on actual Supabase and provider storage and never inferred from a mocked unit test.

## CI / code proof
`apps/jhadina-agent-runtime/src/governance/BrowserReadActionComposition.test.ts` exercises canonical ALLOW still requiring explicit receipt; verified identity; approved first read and digest; consumed-receipt replay denial; policy DENY; changed-URL, WorkSession/task/idempotency/timestamp fingerprint rejection; scope failure; missing/stale/forged isolation; wrong action domain; missing task lineage; started audit failure; completed-read audit failure. Uses fake DNS/transport/host attestation/Supabase audit RPC: **no live external network or account operation**.

The existing `.github/workflows/jh-muse-parity-ci.yml` includes the new test alongside prior `.01–.06` tests. Exact-head CI is required, not an older SHA's green check. Tests do not establish live Supabase RLS, network jail, DNS rebind, secure identity verifier, trusted attestation issuer, isolated deployment or physical iPhone acceptance.

## Required next commissioning gates (not covered by this PR)
1. Reconcile #1411 -> #1419 -> this branch with current `main` selectively and pass relevant exact-head regression; do not force a merge of stale branches.
2. Recover and verify SWLC Supabase access, owner-only RLS, ActionAudit RPC, authentic verifier, durable approval receipts, task lease/idempotency; two-owner and anonymous negative probes.
3. Deploy only after separate approval an isolated worker host with deny-by-default network egress, TLS/certificate/redirect validation and independent signed isolation/health proofs; bind its permission to a specific WorkSession action and approved origin/path.
4. Perform sanctioned public read-only acceptance on a controlled test source through the real executor; verify action proof, byte hash, durable start/completed audit, no secret forwarding, revocation and restart; then physical iPhone owner testing.
5. Keep posting, purchases, subscriptions, transfers, tokens, arbitrary browser automation and background execution disabled. No operator approval for live activation was provided here.

**Completion here means source-only, reviewable implementation and CI, not operational parity with Meta Muse or a working browsing session.**
