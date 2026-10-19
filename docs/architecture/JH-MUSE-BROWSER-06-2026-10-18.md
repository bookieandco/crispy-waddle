# JH-MUSE-BROWSER.06 — pinned, read-only browser worker contract
Date: 2026-10-18. Stacked on **draft** JH-MUSE.PARITY.01–.04 PR #1411, head at branch creation `32ff9e8899af4b64af5fb0ae3165b25fe08e1b10`.

## Boundary / architecture
- `GovernedBrowserSkillOperator` (from PR #1411) may only send `browser.fetch_read_only` through canonical `GovernedSkillCommandDispatcher` to **Jhadina Action Core**. Skills are never independent execution authority.
- New `BrowserReadOnlyWorker` is the **worker-side input and network contract**, not a handler registered with Action Core and not a complete browser. No Action Core executor, route, UI, credential binding, scheduler, queue or deployment is added.
- Owner identity, capability permission, approval lifetime, explicit WorkSession authority and audit receipt verification must be performed **by Action Core** before a production worker is called. The worker does not make authorization decisions.
- Original URL must be already allowed by independent Sentinel; worker additionally demands *exact* allowlisted origin AND pathname. It refuses query strings, fragments, credentials, non-HTTPS, non-GET, redirect allowance, cookies, and unknown payload fields.
- DNS preflight rejects empty, mixed, private, link-local, carrier NAT, documentation, loopback and reserved IPv4 answers. IPv6 deliberately unsupported. IP is pinned in Node HTTPS `lookup`; the original hostname remains TLS SNI and certificate-verification name, so later DNS changes cannot select the socket destination. Agent pooling and proxies are not used.
- Transport uses HTTPS GET only on 443, no cookie jar, form, arbitrary request headers, JS engine, WebDriver, DOM automation, authentication, external submission or redirects. It rejects 3xx, non-200, unsupported MIME, compressed payloads, non-UTF-8 decoding, excessive body length and timeout. Max 192 KiB; 8-second absolute timeout.
- Return a bounded receipt tagged `READ_ONLY_EVIDENCE` with requested URL, pinned IPv4, observed time and body. Body may contain prompt-injection attempts; **never** directly give it policy, credential, execution, trust or publication authority. No raw HTML/script rendering is provided here.

## Testing and evidence
`apps/jhadina-agent-runtime/src/governance/BrowserReadOnlyWorker.test.ts` checks exact-path and origin admission; HTTP/query/fragment/credentials/local-ip prohibition; unsafe method/cookies/headers/body; DNS mixed A records (169.254.169.254, private, loopback, IPv6-mapped), DNS failure; redirects, compression, binary and body limits; empty/unsafe policy.

`.github/workflows/jh-muse-parity-ci.yml` adds the targeted tests beside all prior #1411 tests and typecheck. Exact-head pass is **source** evidence only. Pure tests inject a fake resolver and transport, so they do **not** validate real DNS routing, TLS, remote server, firewall, cache/redirect interactions or deployed isolation.

## Stop/go and non-claims
- **NOT ACTIVATED.** No network request is made from GitHub branch creation, CI tests, or this chat. No live API/hostname in an allowlist is installed or configured; `BrowserReadOnlyWorker` has no registered provider handler.
- **Critical remaining runtime gates:** operator-owned isolated host/container or VM with **independent firewall egress deny**, no metadata endpoint, isolated secrets and process rights, TLS interception/host verification review, tenant separation, no private network, server-configured nonempty static allowlist, DNS resolver vetting, revocation/receipts, source terms, production-specific fault/cancellation tests and real iPhone owner acceptance. An in-process DNS check is *defense in depth*, not containment.
- At most public, explicitly allowed, genuinely read-only retrieval can be commissioned later; GET is not universally side-effect-free. External site rate limits and terms still apply. No purchases, signups, form submission, messages, posts, payments, trading or token actions.
- **No automatic merge or deployment** to `main`. PR #1411 and this branch must be selectively reconciled with current main and dependencies reviewed. All external credentials/hosting/paid services require separate owner approval.
