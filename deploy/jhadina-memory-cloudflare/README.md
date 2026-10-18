# Jhadina Memory Core — Cloudflare D1 (opt-in, source-only)

This is a **separate, private D1 database** for canonical Jhadina Memory, not the SHARK/market database. The existing iPhone app remains on Vercel. MemoryStorage's current server-side `VercelOidcMemoryStorage` protocol is reused, so no raw Facebook ZIP, credential, or browser-to-D1 access is introduced.

## Status / limits

- Draft PR #1351: schema, Worker, Vercel OIDC signature verification, a full gateway action handler and synthetic tests are committed. Source CI is required for proof.
- **No D1 database, binding, live Worker, production variable, backup, import or user identity has been commissioned.** No paid resource has been created.
- Existing SWLC Postgres outage `57P03` still blocks Supabase Auth and any other subsystems using it. **D1 replaces only Memory storage, not Supabase Auth.** Moving login requires a separate, explicit identity architecture and approval.
- Existing non-Cloudflare Memory data remains wherever it was. **Do not automatically copy, replace or claim recovered memories.**
- The source repository is NOT a backup. Keep personal content and secret tokens out of GitHub, CI, logs and preview URLs.

## Staging cutover, after an owner-controlled Cloudflare account is authorized

1. In the Cloudflare dashboard, create a new private D1 database dedicated to Jhadina Memory, rather than sharing SHARK tables. Record its generated ID **privately**. Cloudflare D1 Free has daily query and storage caps; hitting caps is a read/write outage, not an auto-upgrade.
2. Copy `wrangler.example.jsonc` to a private `wrangler.jsonc` and fill the actual D1 binding. Discover the installed Wrangler commands with `wrangler --help`, `wrangler d1 --help`, and `wrangler d1 migrations --help` before running them. Apply `migrations/0001_memory.sql` to a **staging** D1 database only after review.
3. Configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_SUBJECT`, `OIDC_PROJECT_ID`, and `OIDC_ENVIRONMENT` to exact values from the authorized Vercel deployment's verified OIDC configuration. Never derive trusted values from the submitted JWT itself. The Worker rejects missing, expired, wrong-audience, wrong-project and bad-signature tokens.
4. Deploy the Worker on an authorized Cloudflare account and test the `POST /memory` endpoint with a valid **server-generated** Vercel workload token. No public GET or browser CORS endpoints exist. Use a custom domain only with an explicitly pinned `JHADINA_MEMORY_CLOUDFLARE_HOST`.
5. In the **Vercel staging environment only**, explicitly set:
   - `JHADINA_MEMORY_STORAGE_PROVIDER=cloudflare_d1`
   - `JHADINA_MEMORY_GATEWAY_URL=https://<your-worker-host>/memory`
   - `JHADINA_MEMORY_CLOUDFLARE_HOST=<your-worker-host>` for a custom domain
   The adapter never silently falls back to Supabase or volatile memory if the D1 Worker is unavailable.
6. Use two separate authenticated staging owners and synthetic private notes to test: proposal PENDING; second owner denied; approval; new-session Context; correction; forget; old timeline not recalled; Worker unavailable -> 503; on restart persistence verified. Ensure MemoryRepository's two-step approval is concurrency-safe before public scale.
7. Inspect Cloudflare D1's Time Travel support and prove independent encrypted off-host **export and restore**, including a routine longer than the Free plan's seven-day Time Travel window. Do not treat seven-day Time Travel alone as an archival backup.
8. Only after owner acceptance and explicit operator approval, consider a production switch and a separately reconciled migration of any prior records. Do not disable old storage, shut down Supabase, or change Supabase Auth as part of this feature.

## Security / known acceptance gaps

- Vercel **workload OIDC** authorizes the trusted Jhadina backend to reach the Worker. It is not an end-user identity, and end-user scoping is still enforced by the authenticated application server and MemoryRepository.
- All D1 SQL is parameter bound; the repository validates owner for correction/retirement and prevents unreviewed direct `createMemory`. Legacy `getMemory(id)` and `removeCandidate(id)` lack a user argument in the canonical protocol; these ID-only operations are accessible only to the authorized server workload, **not** to arbitrary browsers.
- The Worker now atomically creates an approved memory and consumes its pending candidate in a single D1 batch; the legacy client’s follow-up `removeCandidate` is a harmless no-op. Multi-request retries, cross-user RLS-equivalence, provider failover, audit retention and backup/restore still require staging review. D1 does not have Postgres RLS; Worker authorization replaces it.
- `wrangler.example.jsonc` contains deliberate placeholders. Never inject production database IDs or secrets into source.
- Cloudflare Worker CPU and request limits are separate from D1 limits. No live sizing, throughput or cost measurement has yet been taken.
- No Facebook old posts, third-party comments or Messenger transcripts are part of this gateway. The importer still produces only local previews and owner-approved short notes.
