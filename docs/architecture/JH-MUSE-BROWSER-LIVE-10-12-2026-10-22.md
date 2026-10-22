# JH-MUSE-BROWSER.LIVE.10–.12 — current-main recovery and commissioning evidence

**Date:** 2026-10-22. **Status:** SOURCE / OFFLINE-ACCEPTANCE ONLY; no live host, network proof, external browser route or deployed provider verified.

## .10 Forward-port and upstream reconciliation
- Inspected open draft PR #1411 (skill + guard + crash replay), #1419 (pinned read-only HTTPS worker), #1444 (authenticated Action Core, consent, Scope and isolation ports), plus #1412 provenance review and #1413 iPhone Work dashboard.
- At recovery, `main` was `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`. It was 86 commits beyond original browser base `ad5830382d6c209dca63da41c93f2575d6ed2242`; comparison found no overlapping changes to the 18 browser source/test/workflow/document paths.
- Created `recovery/jh-muse-browser-live-10-12-20261022` from the exact main head, and copied those **18 exact Git blob SHAs** from #1444's full stacked head `8c5518bf220117da380dfec1b618b224fe1aba51` in two ordinary forward-moving commits. Preserved all current-main files and upstream completed work; no force push, squash, or merge into main.
- A single new draft PR to current `main` is the **selective consolidation review candidate**. Legacy draft PRs remain as auditable original evidence, not permission to merge all four PRs. Once reviewed, reconcile their status; avoid landing duplicate systems.
- This says nothing about current deployed main or currently active Supabase schema.

## .11 Real isolation attestation protocol (source, not live)
Adds `SignedBrowserIsolationVerifier` and a production-focused composition that requires an instance of it. It refuses an empty trust store. Operator Ed25519 public keys are explicitly supplied; private keys NEVER go in this application, source code, frontend, or browser worker.

The signed canonical claim includes issuer ID, one-time 128–256-bit nonce, **exact** action/owner/WorkSession/source URL, workload ID, receipt reference, observed/expiry times, and egress/filesystem/secrets/proxy posture. The verifier checks 30-second freshness, expiry and maximum lifetime, canonical detached Ed25519 signature, exact owner/URL scope, and **atomic durable consume-once nonce storage**. Missing signatures, key mismatch, altered fields, reused nonces and unavailable nonce ledger fail closed.

**Strong limitation:** an Ed25519 signature only proves that the operator's configured private key signed the stated fields. It does *not* independently demonstrate that a host has a deny-all firewall, network namespace, host TLS enforcement, secure kernel, absent credentials, RLS, or trustworthy issuer. A separate operator must configure and audit those. The source injects a fake signer and in-memory nonce store **only in tests**; no private key or replay store is commissioned in production.

## .12 Offline, signed full-path acceptance
`BrowserOfflineCommissioningAcceptance.test.ts` composes a fake credential-free public source, fake DNS/IP-pinned transport, in-memory Action Core single-use approval, fake authenticated identity, fake Supabase ActionAudit RPC, fake owner WorkSession verifier, signed fake host proof and fake nonce store through the real composition. Verifies:
- without explicit approval, it records STARTED + APPROVAL_REQUIRED and **never reaches the host/transport**;
- consented exact action → canonical Action Core audit STARTED → trusted-key Ed25519 verification / fresh nonce → approved public GET → untrusted source evidence with byte count and SHA-256 → canonical audit COMPLETED;
- replaying a consumed consent receipt cannot fetch again; no hostile web body is written to ActionAudit.

`SignedBrowserIsolationVerifier.test.ts` separately covers no trust anchor, malformed/unsupported key, tampered payload, wrong issuer, owner, action, WorkSession, URL, expired and weak isolation, replay and nonce backend failure. The Muse Source Gate also runs the earlier .01–.09 source tests.

These test fixtures involve NO network, wallet, provider, database, credential or real hosted service. They certify no actual isolated machine or signed host response.

## Live acceptance remains BLOCKED / operator owned
Before live browser reads can be described as usable:
1. Verify current `main` integration after exact-head CI and code review; no override of changed subprojects.
2. Operator provisions a physically/logically isolated worker with **external egress-deny** / DNS and IPv4/IPv6 firewall rules, no proxies or ambient secrets; validates real TLS, redirects, metadata service denial, DNS rebinding, resource ceilings, logging, and signed attestation issuer with locked-down private key.
3. Operator connects authenticated server-side Action Core and an independently checked durable, atomic **approval store, WorkSession task scope verifier, nonce ledger and Supabase ActionAudit**. Two-owner and anonymous isolation, terminal audit persistence, restart/replay, and duplicate attempts must be proven against the real environment.
4. Only after separate user approval, commission an exactly allowlisted public read-only source, run a controlled GET under a single use consent and independently reconcile host/network receipts, stored audit, digests and owner iPhone display. Confirm no publish, spend, wallet activity, login capture, DOM execution or unapproved scraping.
5. Preserve #1412 provenance and #1413 Work dashboard for separate eventual review. No speculative automatic background browsing or production claims.

**Merge/activation gate:** This PR remains DRAFT, not approved for production. CI success is SOURCE PASS only. No deploy, live network call, spending, provider registration, GitHub PR merge or Supabase mutation is included.
