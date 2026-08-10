# Jhadina Security Baseline

Security work pauses feature expansion until the core boundary is hardened.

## Threat model

Jhadina handles private projects, media, credentials, generated content, memories, external providers and potentially consequential actions. Treat browsers, uploaded files, third-party APIs, model providers and automation runtimes as untrusted inputs.

## Non-negotiable boundaries

1. **Authentication before application access.** Protected Jhadina routes require a verified Supabase Auth identity. Do not trust a client-supplied `userId`.
2. **Authorization is deterministic.** LLM output may recommend an action but never grants permission to execute it.
3. **Capability allowlist.** Action Executor can run only explicitly registered domain/capability pairs.
4. **Short-lived capability grants.** Sensitive capabilities use scoped, expiring grants and one-time nonces.
5. **Approval gate.** Public publishing, paid ads, affiliate publishing, consequential outreach, financial execution, credential changes and memory commits require explicit approval according to policy.
6. **Server-only secrets.** Supabase secret/service-role keys, model credentials, provider tokens and encryption keys never enter browser bundles or `NEXT_PUBLIC_*` variables. Supabase documents that secret/service-role keys bypass RLS and must remain backend-only. 
7. **RLS + grants.** Every exposed Supabase table/view must have deliberate grants and RLS. Do not treat `TO authenticated` as ownership authorization; pair it with an ownership predicate. 
8. **Private media by default.** Creator assets, scripts, takes, WAVs, project packages and generated media live in private Storage buckets. Use RLS and short-lived signed URLs for controlled access.
9. **Upload quarantine.** Uploaded media is untrusted until MIME/type, size, hash and malware/safety scanning succeed. Failed scans remain quarantined.
10. **No uploaded-code execution.** User media and project files are data, never executable programs.
11. **Audit every decision.** Denied, approval-required, completed and failed actions receive audit records. Security events use a hash chain so tampering is detectable.
12. **Least privilege.** Providers receive only the credentials and capability scope required for one job. Never hand an LLM a master credential.
13. **Idempotency and replay protection.** Action requests carry unique IDs and short-lived nonces. Retries must not duplicate consequential actions.
14. **Egress minimization.** Context sent to external models is explicitly selected and filtered. Private memory and unrelated project assets are not automatically exported.
15. **Kill switch.** Jhadina must be able to disable generation, external actions, publishing, and provider access independently.

## Supabase hardening

Use Supabase Auth for identity and server-side `getUser`/claims verification for protected operations. Keep publishable keys in browser code only; keep secret/service-role keys server-side. Supabase recommends RLS for exposed data and warns that service keys bypass RLS.

Storage buckets containing project media should be private. Storage access is controlled with policies on `storage.objects`; public buckets bypass read access control and therefore should not be used for private production assets.

## Security architecture

```text
Browser / iPhone / CPU
          |
          v
      Supabase Auth
          |
          v
     Request Boundary
          |
     identity + ownership
     schema + rate limits
          |
          v
   Policy / Security Core
          |
     allow / deny /
   approval required
          |
          v
     Action Executor
          |
   scoped adapter only
          |
    +-----+-----+
    |           |
    v           v
 provider     database/storage
    |           |
    +-----+-----+
          |
          v
      Audit Ledger
          |
          v
    Version / Memory
```

## External references supplied for this hardening pass

- `bluesentry/bucket-antivirus-function`: reference pattern for scanning/quarantining uploaded bucket objects.
- `opensearch-project/security`: reference pattern for explicit roles, permissions and security boundaries.
- `numirias/security`: reference only; do not import its authorization model blindly.
- `simbiose/Encryption`: reference only; cryptography must use maintained platform primitives/libraries and key management rather than custom cryptography.

These projects are **references/adapters, not trusted code to copy wholesale**.

## Current status

The deterministic Security Core and media-security boundary are now present in the repository. The remaining production hardening work is wiring them to the existing Supabase Auth branch, real RLS policies, private Storage buckets, rate limiting, provider-secret storage, antivirus scanning, and the existing Action Executor.

Do not call Jhadina production-secure until those runtime controls are verified in the deployed environment.
