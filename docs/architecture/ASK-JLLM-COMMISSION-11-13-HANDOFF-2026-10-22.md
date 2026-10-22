# ASK-JLLM.COMMISSION.11–.13 — source handoff
Date: 2026-10-22
Status: new stacked draft, no production deployment, model installation or paid activity.

## .11 — verified merge/CI reconciliation
Repo: `bookieandco/crispy-waddle`
Current main at inspection: `dbb6b99c970451f89de2ebe7cddf9fdeccb113c2`.
Do not silently fast-forward production or merge draft PRs as a side effect of source acceptance.
Merge order:
1. [#1479](https://github.com/bookieandco/crispy-waddle/pull/1479) from `dbb6b99c` to `d38f300b` (navigation and WorkSession repair); 15/15 checks passed.
2. [#1481](https://github.com/bookieandco/crispy-waddle/pull/1481) `d38f300b` -> `025a0439` (safe GPT-6-inspired visuals and model readiness); 17/17 checks passed.
3. [#1484](https://github.com/bookieandco/crispy-waddle/pull/1484) `025a0439` -> `20bd2769` (existing model fabric reused; local-first Ollama; fixed canary; local cache; opt-in Wikipedia). 15/16 workflow controllers completed success at inspection; 16th Spatial Conformance job success with controller not yet marked completed. Re-read exact-head workflow status before any merge.
4. Current COMMISSION.11–.13 branch should be reviewed *on top of* #1484, never alongside a blind merge from old divergent JLLM PR #1364. Everything recovered from #1364 is selective and already in #1484.
The full combined code is ahead of main with no behind commits at the initial reconciliation. Preserve current #1475 UI freeze fix, identity/session verifier, canonical tool registry, Action Core policy, Memory governance, and model-selection approval boundaries.

## .12 — M1 Mac local model commissioning (zero paid API calls)
An iPhone or a Vercel server alone cannot host the Mac's model weights. Need Mac runtime and enough RAM/disk. **No model has been installed or run remotely from this repo change.**

Read-only hardware check on your Mac (run from the repo directory):
```sh
node scripts/jllm-mac-model-check.mjs --preflight
```
This reports architecture/RAM and whether `ollama --version` is present, without installing or downloading. Initial candidate sizes from the Ollama Qwen3 registry:
- RAM below 8 GiB: `qwen3:1.7b` (weights ~1.4 GB).
- 8–23 GiB: `qwen3:4b` (weights ~2.5 GB).
- >=24 GiB: `qwen3:8b` (weights ~5.2 GB).
**These thresholds are starting hypotheses, not benchmarks**. Working memory includes KV cache/context and other apps. Choose a smaller model if thermal, RAM or latency results are poor.

After separately approving a local model download, install Ollama from the official distribution and pull the selected tag on the Mac, e.g. `ollama pull qwen3:4b`. Run `ollama list` to confirm the exact local tag. The local Ollama daemon must stay bound to loopback `127.0.0.1:11434`; disable Ollama cloud inference and do not proxy it directly to the internet. Then, only when the model is present:
```sh
node scripts/jllm-mac-model-check.mjs --benchmark qwen3:4b
```
It makes six fixed, harmless localhost requests to the configured model, returning JSON schema success rate, p95 latency and tokens. No chat or private memory is sent. The current JLLM transport has a 20-second request timeout: p95 >20s means that route will need an explicit latency/timeout review. Follow by the existing owner-authorized `POST /api/jhadina/model-canary` and real governed multi-turn acceptance after connection.

## .13 — private iPhone-to-model path
```text
iPhone Safari (Jhadina sign-in)
  -> protected Ask Jhadina on Vercel
  -> server-side IntelligenceRouter + CapabilityAwareModelRouter
  -> optional Cloudflare Access service-auth, HTTPS (outbound-only Tunnel)
  -> Mac loopback-only bearer-auth gateway 127.0.0.1:8787
  -> Ollama 127.0.0.1:11434
```
**Never** put the private gateway bearer or Access client secret in `NEXT_PUBLIC_` variables, the iPhone app, a link, or Git history. Do not make Ollama itself reachable through a public hostname.

To prepare a Mac gateway *after* model preflight and separate network approval:
- Generate an unpredictable token locally using a password manager or `openssl rand -hex 32`. Do not paste it into ChatGPT.
- Set `JHADINA_LOCAL_MODEL_NAME` to the exact installed model and `JHADINA_LOCAL_MODEL_GATEWAY_TOKEN` to the token in the Mac process environment. Never commit values.
- Run `node services/jhadina-local-model-gateway/server.mjs`. It accepts only loopback HTTP, only authenticated `GET /health` and `POST /api/chat`, exactly one allowlisted model, JSON-only, bounded prompt/reply, rate limited and serializes inference. The `/health` receipt **does not** claim model readiness.
- If using Cloudflare: first create the Access application with a **Service Auth** policy and create a service token. Configure a managed outbound Cloudflare Tunnel to forward the approved hostname to `http://127.0.0.1:8787` *not* `11434`. Verify unauthenticated access is denied and token revocation works. DNS/domain ownership or paid plans may have costs; do not assume permanent free hosting.
- Store only in the separately approved server-side Vercel environment: `JHADINA_REASONING_PROVIDER=local`, `JHADINA_LOCAL_MODEL_URL=https://<approved-host>`, `JHADINA_LOCAL_MODEL_ALLOWED_HOST=<approved-host>`, `JHADINA_LOCAL_MODEL_NAME=<exact-tag>`, `JHADINA_LOCAL_MODEL_GATEWAY_TOKEN`, optionally `JHADINA_LOCAL_MODEL_ACCESS_CLIENT_ID` and `JHADINA_LOCAL_MODEL_ACCESS_CLIENT_SECRET`. Those two Access fields must be configured as a pair.
- Never grant external publishing, purchases, wallet signing, trading or deployments to a model just because inference passed.

Sources: Ollama API local behavior https://github.com/ollama/ollama/blob/main/docs/api/introduction.mdx ; model tags https://registry.ollama.com/library/qwen3/tags ; Cloudflare Tunnel https://developers.cloudflare.com/tunnel/get-started/ ; Access service tokens https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/

## Validation and explicit blockers
Source CI:
- `node --check scripts/jllm-mac-model-check.mjs services/jhadina-local-model-gateway/server.mjs`
- `node --test scripts/jllm-mac-model-check.test.mjs services/jhadina-local-model-gateway/server.test.mjs`
- exact-head JLLM web TypeScript/unit/build checks already provided by parent CI.

Not established by code alone: actual M1 RAM/disk/free energy, Ollama installed, weights downloaded, real latency, private domain and Access policy deployed, secrets provisioned, production route activated, owner-authenticated iPhone Face ID and session readback, or always-on uptime. Leave these as real-world acceptance tasks until verified.

Safe rollback: do not edit main or production during this phase; disabling the approved private tunnel and unsetting server-only model gateway configuration must return Ask to explicit non-generative DEFER with no silent cloud fallback. Keep PRs draft until full consent to merge and private preview.
