# SAM-SAFETY-LEDGER.12–.16 — Read-only external receipt adapters and signed coverage handoff

## Scope and code status
Stacked on PR #1342 → #1337 → #1336. This is SOURCE-ONLY implementation. SWLC database recovery, independent provider/portal/processor feeds, authoritative trust anchor provisioning and a complete cross-channel live audit are still external evidence blockers.

**.12** `packages/opportunity-core/src/domain/sam-readonly-receipt-feed.ts`: source-typed readPage interface; fixed `SamExternalSource` enumeration from canonical safety inventory; no send, sign, submit, write or money interface. A bounded seven-day scope is required.

**.13** Exhaustive bounded keyset traversal (default 100, max 250/page, hard ceiling 5,000 receipts), stable snapshot token, count and scope consistency, row timestamps, duplicate IDs, cursor loops and missing pages all fail closed. Fixed-origin HTTPS **GET-only** adapter rejects dynamic redirects, credentialed URLs, untrusted path injection and non-JSON responses. This is an operator-configurable reader with no production endpoint, credential or polling scheduled.

**.14** `packages/opportunity-core/src/domain/sam-receipt-checkpoint.ts` (Node/server-only package subpath, not the browser-facing root) computes SHA-256 digest over canonical ordered receipts and verifies actual Ed25519 signatures over source, declared window, snapshot token, total, digest, read-fence reference, signer and validity dates. Public keys must come from independently provisioned trusted operator configuration, **not** from the same snapshot; a made-up self-signed certificate is not accepted. Signatures do not independently prove that all external sends, portal operations and fallback paths were captured.

**.15** `assessSamReceiptCoverage` checks all seven required sources for single, matching observations and verified checkpoints. Even apparently complete signed coverage returns `status:'blocked'`, `safetyEvidenceComplete:false`, `productionAuthority:false` until independent instrumented-transport scope and off-host provenance/authorization correlation are proven. SAM commissioning reports `signedCoveragePreflight` with **empty** observations/checkpoints, instead of inventing a production check.

**.16** Domain regression tests exercise pagination, malformed scopes, duplicates, wrong source, snapshot changes, cursor loops, absent rows, caps, GET-only safety, digest tampering, different signing key, expired signatures, duplicate/missing source witnesses and a full fixture that **still cannot PASS**. Web commissioning boundary test verifies that no signed evidence is fabricated.

## What remains blocked (not code-provable)
1. Recover SWLC and verify its read-only SAM OIDC gateway in production (issue #1110). Do not perform destructive writes or disable RLS for testing.
2. Inventory every actual SAM-capable transport/integration, and get vendor or independent observer's fully ordered read-only receipts for provider outreach, bid portal, signature, disbursements and fallback bypass. Action Core domain logs alone are insufficient.
3. Configure audited, pinned off-host public keys and checkpoint read fences through approved operator secret/config deployment. No first-use trust, no private keys in repo, no provider keys pasted into code.
4. Independently attest source completeness across each time window, provider/portal API read semantics, instrumentation blind spots, page scope, callback retries, and authoritative actor/approval correspondence. A signed false statement is still false.
5. Only then wire an authenticated read-only provider in commissioning, run constrained shadow receipts and reconcile using `reconcileSamExternalSafety`. Never set `safetyEvidenceComplete` from an unsigned or internally consistent record alone.
6. Resolve branches in order #1336 → #1337 → #1342 → this PR, rebase on current `main` with careful selective conflict resolution, and re-run exact-head CI.
   
## Absolute authority boundary
No new SMTP/email send, bid submission, contract signature, card/bank/crypto transfer, unapproved provider outreach, data cleanup, emergency fail-open, or production customer access. This sequence never represents a full live commissioning pass.
