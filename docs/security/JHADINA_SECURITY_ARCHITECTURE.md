# JhadinaOS Security Architecture — Defense in Depth

Status: security baseline / implementation plan

## Security objective

Jhadina must assume that the UI, browser, network, remote compute host, dependencies, cloud services, external connectors, and even an AI model can be compromised. No single layer is trusted to authorize a consequential action.

The governing rule is **fail closed**:

> Observation -> validation -> identity -> policy -> approval -> execution -> verification -> immutable audit.

LLM output is never an authority. Capability discovery is never authorization. A network connection is never proof of identity. A successful tool call is never proof that the requested side effect was safe.

## Current Jhadina strengths observed in `main`

- Deterministic Security Core sits in front of action execution.
- Capability allowlisting and explicit denied capabilities exist.
- Approval-required capabilities are distinct from ordinary allow decisions.
- `policy.self_modify` is a hard deny and evolution is separated into proposal/merge stages.
- Action execution records a start event before policy/handler execution and uses fail-closed behavior when the start audit cannot be written.
- Approval receipts bind action ID, user ID, type, and a fingerprint and are single-use in the in-memory implementation.
- Capability classification, Values configuration, risk-boundary policy, capability registry, and event-bus work are already part of the architecture.

## Critical gaps found during this audit

1. **Actor identity is represented as a string.** A caller supplying `actorId` must not be treated as authenticated identity. Production identity must be established outside the LLM/action payload and bound to the session/device.
2. **Replay protection is process-local.** The existing Security Core nonce set disappears on restart and is not an atomic cross-node replay barrier. The new hardened boundary therefore requires a `ReplayGuard` abstraction; production must back it with a durable atomic store.
3. **Payload integrity is not intrinsically bound to the authorization request.** The hardened boundary hashes the canonical action payload before policy evaluation so an approval cannot be reused for a modified payload.
4. **Audit chaining is process-local.** The existing hash chain is useful as an integrity signal but cannot be the authoritative ledger if it resets on restart. Production audit storage must persist the previous hash and enforce append-only sequencing server-side.
5. **`AllowAllActionPolicy` exists.** It is acceptable for isolated tests, but production construction must make an allow-all policy impossible. CI should fail if production wiring references it.
6. **Approval storage has an in-memory implementation.** It is not sufficient for production because restart/concurrency can create authorization races. Production approval state must be durable and atomically consumed.
7. **Handlers are selected by a string capability.** The registry must reject duplicate/unknown capabilities and the executor must have exactly one registered handler for each production capability.
8. **Remote execution is a major trust boundary.** The compute host must not be reachable by an unrestricted public listener or have credentials that can directly mutate Jhadina's policy/ledger.

## Threat model

### Primary attacker goals

- Steal Jhadina credentials or session material.
- Turn an untrusted prompt, file, web page, GitHub issue, connector response, or model output into an authorized action.
- Modify an approved action after approval.
- Replay an old approval or command.
- Escalate from a low-risk connector to financial, credential, publishing, or self-modification capabilities.
- Poison memory or durable context.
- Exfiltrate secrets from logs, generated files, model context, browser storage, or the remote compute host.
- Compromise a dependency/build pipeline and ship malicious code.
- Compromise the remote worker and pivot into the control plane.
- Destroy or tamper with the audit trail.

### Required trust boundaries

`User device`
→ `authenticated control session`
→ `Jhadina Gateway / Enforcement Boundary`
→ `Security Core + capability registry`
→ `approval service`
→ `Action Executor`
→ `least-privilege handler sandbox`
→ `connector / remote worker`
→ `external service`

The reverse path is not implicitly trusted. Inbound data returns as **untrusted observations** and must pass validation before it can influence memory or actions.

## Remote-compute architecture

The remote computer is a **worker, not the OS authority**.

- No public inbound SSH/RDP/VNC listener.
- Control connection is outbound-only from worker to a gateway.
- Mutual device authentication is required for the control channel.
- The worker receives short-lived scoped jobs, not long-lived master credentials.
- Worker credentials are distinct from control-plane credentials.
- Worker can read/write only its assigned job workspace.
- Network egress is deny-by-default and explicitly allowlisted per job/capability.
- The worker cannot modify Security Core, Values Core, approval state, audit policy, or deployment configuration.
- Worker results are treated as untrusted artifacts and scanned/validated before ingestion.
- Worker compromise must not become control-plane compromise.

## Identity and access controls

1. Phishing-resistant MFA/passkeys for the owner account.
2. Device-bound credentials for the control device and worker.
3. Separate identities for owner, service, worker, CI, and deployment.
4. No shared administrator account.
5. Short-lived session tokens; rotate/revoke on sensitive events.
6. Least-privilege service accounts with separate credentials per connector.
7. No credentials in prompts, source code, logs, action payloads, or generated artifacts.
8. Sensitive operations require an owner approval receipt bound to the exact action payload hash, resource, capability, and expiry.

## Cryptography policy

Use established platform cryptography and modern authenticated encryption rather than implementing cryptography inside Jhadina.

- TLS 1.3 for network transport where available.
- Mutual TLS or an equivalent device-authenticated channel for control-plane traffic.
- AES-256-GCM or XChaCha20-Poly1305 for application-level encrypted blobs where application encryption is required.
- Ed25519 or an equivalent modern signature system for artifact/action signing where supported by the selected platform.
- Envelope encryption with a managed/root key and short-lived data-encryption keys for high-value persistent secrets.
- Key rotation with versioned key IDs and revocation.
- Never invent a custom cipher, nonce scheme, password hashing scheme, or key-exchange protocol.

## Memory and context protection

- External content is untrusted data, never instructions.
- Prompt injection screening happens before content reaches privileged tool selection.
- Unicode normalization and homoglyph/zero-width detection are part of the input gate.
- Tool outputs are labeled by provenance and trust level.
- Durable Memory Core requires provenance, verification/approval, privacy classification, staleness/revocation handling, and contradiction preservation.
- Secrets are never eligible for ordinary memory persistence.
- Memory writes use `memory.propose` then approval/commit for sensitive classes.

## AI-agent controls

The AgentGuard source was evaluated for defensive concepts: command-injection detection, prompt-injection detection, Unicode bypass detection, encoding/obfuscation detection, GitHub issue screening, rate limiting, and local processing are useful concepts. Its pattern engine must not become the sole security boundary; deterministic authorization remains authoritative.

For Jhadina:

- Model output is always untrusted.
- A model cannot approve, merge, rotate credentials, or change security policy.
- A model cannot select an arbitrary executable or arbitrary network destination.
- Tool arguments are schema-validated and capability-scoped.
- High-risk actions require explicit owner approval.
- Tool output cannot directly create an executable command without passing the same policy boundary.

## Supply-chain controls

- Frozen lockfile in CI.
- Dependency review and vulnerability scanning on every change.
- Pin critical build/action dependencies and verify provenance where available.
- Generate an SBOM for release artifacts.
- Reject unexpected install scripts or postinstall behavior for high-risk packages unless explicitly reviewed.
- Separate build and deploy credentials.
- Protected main branch; security-sensitive changes require review.
- Reproducible or attestable builds where practical.
- Never run downloaded source code automatically on the production worker.

## Network controls

- Default-deny inbound firewall.
- Default-deny worker egress.
- No direct worker-to-database access unless explicitly required and narrowly scoped.
- No direct worker access to GitHub write APIs.
- Separate control-plane, data-plane, and management-plane networks.
- Rate limits and connection limits at the gateway.
- DDoS protection at the network edge; XDP/eBPF may be considered only as a host-level optimization after a conventional firewall/gateway baseline is correct.

## Data protection

Classify data as: public, internal, sensitive, secret, financial, credential, or security-root.

- Encrypt sensitive/secret data at rest.
- Encrypt backups separately from primary storage.
- Maintain immutable/offline recovery copies for the most critical audit and configuration data.
- Minimize retention of raw connector responses and credentials.
- Redact secrets before logging.
- Treat generated media, archives, PDFs, ZIPs, and model outputs as potentially hostile files.

## Detection and response

Security telemetry must survive application compromise.

Record at minimum:

- authentication and device events;
- authorization decisions;
- approval creation/approval/consumption;
- capability registration changes;
- connector credential use;
- remote worker job lifecycle;
- policy/evolution proposals;
- security configuration changes;
- unexpected egress and denied actions;
- integrity failures and replay attempts.

Critical security events should be shipped to an append-only external sink that Jhadina cannot delete using its normal service identity.

## Breach containment assumptions

The design explicitly assumes a breach can happen.

### If the web/UI is compromised
Attacker still cannot execute high-risk actions without the owner/device authorization path.

### If the worker is compromised
Attacker gets only worker-scoped data/jobs and cannot reach control-plane secrets or modify policy.

### If the database is stolen
Encrypted sensitive blobs and separated keys limit plaintext exposure; audit integrity can be verified independently.

### If an API credential is stolen
Credentials are connector-scoped, short-lived where supported, rotated/revoked, and unable to modify Jhadina policy.

### If the model is prompt-injected
The model can produce hostile proposals, but the deterministic security boundary treats them as untrusted requests.

### If GitHub/CI is compromised
Protected main, review gates, dependency scanning, artifact verification, and deployment separation prevent a repository compromise from automatically becoming a production compromise.

## Source audit decisions

| Source | Decision | Jhadina use |
|---|---|---|
| `MohamedSelimMah/Trojan_Calculator_Simulator` | **Do not integrate** | Use only as a benign malware-behavior test reference: persistence, fake files, keylogging simulation. Never import its code into production. |
| `m00s3c/awesome-breach-intelligence` | **Use as intelligence reference** | Build defensive exposure monitoring around legitimate breach-notification/intelligence services. Do not ingest stolen credential datasets into Jhadina memory. |
| `D0n9X1n/hexo-blog-encrypt` | **Reference only** | Client-side content encryption concept; not a security foundation for Jhadina secrets. |
| `stefankueng/CryptSync` | **Reference only** | Useful model for encrypted-at-rest synchronization. Do not treat folder encryption as a substitute for key management or access control. |
| `soyersoyer/SwCrypt` | **Do not integrate directly** | Demonstrates RSA/ECC/AES/GCM/key-store primitives. Prefer maintained platform crypto APIs and modern authenticated encryption. |
| `saturneric/GpgFrontend` | **Reference / optional tooling** | Strong model for local encryption, profiles, secure-memory handling, GnuPG/rPGP separation, and local-only privacy. Prefer established GnuPG/OS key stores over custom crypto. |
| `ByteSizedLaw/Military-Grade-Security-API` | **Conceptual reference only** | PFS and authenticated session design are useful concepts. The repository explicitly describes itself as WIP; do not copy its cryptographic protocol into production. |
| `exfil0/ad_takeover_wizard` | **Never integrate** | Offensive red-team source. Defensive lessons: scope gates, sandboxing, redaction, auditability. Do not import credential harvesting, spraying, stealth/evasion, or privilege-escalation code. |
| `numbergroup/AgentGuard` | **Defense concepts worth adopting** | Prompt/command injection, Unicode, obfuscation, GitHub issue screening, rate limits, and local analysis. Keep deterministic policy as final authority. |
| `ngageoint/mgrs-java` | **Not security-related** | No direct security value for the core; use only if Jhadina later needs MGRS/geospatial functionality. |
| `dailker/dragons-vault` | **Reference only** | Server-blind encrypted storage and 2FA are useful concepts, but its README should not be treated as evidence of a production-grade crypto design. |
| `R00tS3c/XDP-eBPF-Anti-DDoS-Firewall` | **Reference only** | Early packet filtering and adaptive rate limits are useful host/network-defense concepts. Must sit behind a correctly configured firewall/gateway. |
| `serversanaa/XDP-eBPF-Anti-DDoS-Firewall` | **Do not integrate** | The repository distributes a downloadable archive and is not an appropriate trust anchor for a security boundary. |
| `malware-samples` / `anti-virus` / `banking-security` topics | **Research only** | Use topics to discover defensive test cases and standards; never execute or vendor unreviewed malware samples into Jhadina. |

## Security acceptance gate

Jhadina is not production-security complete until all of these are true:

- [ ] Owner/device authentication is phishing-resistant.
- [ ] Production replay guard is durable and atomic.
- [ ] Production approval store is durable and atomic.
- [ ] Action approval is bound to canonical payload hash and resource.
- [ ] No production path uses `AllowAllActionPolicy`.
- [ ] Security audit chain is persisted outside the process and independently verifiable.
- [ ] Worker has no inbound public management port.
- [ ] Worker cannot modify policy, approval, or deployment state.
- [ ] Worker egress is allowlisted.
- [ ] Connector credentials are isolated and rotatable.
- [ ] Secrets are absent from source, logs, prompts, and artifacts.
- [ ] CI performs frozen-lockfile, dependency, static-security, and test gates.
- [ ] Releases have verified provenance/SBOM.
- [ ] Backups are encrypted and recovery-tested.
- [ ] Incident response can revoke sessions, credentials, worker identity, and capability grants quickly.

## Why this design is intentionally strict

Recent incidents repeatedly demonstrate that perimeter-only security is insufficient: a breach of one standalone system can still expose sensitive information, compromised credentials can bypass weak access controls, and AI-assisted attacks can accelerate intrusion. Jhadina therefore assumes compromise at every layer and limits the blast radius instead of assuming a perfect perimeter.
