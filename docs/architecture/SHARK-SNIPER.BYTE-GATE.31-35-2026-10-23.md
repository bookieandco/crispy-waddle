# SHARK-SNIPER.BYTE-GATE.31–.35 — unsigned transaction inspection

Date: 2026-10-23 (America/Los_Angeles)
Branch: `build/shark-sniper-byte-audit-31-35-20261023`
Stack: #1505 → #1504 → #1503 → #1501 → #1499 → #1497 → #1457

**Scope: source-only, draft, no funded Solana execution.**
No secrets, wallets, provider credentials, signing, Jito relaying, Jupiter
execution requests, trading, DB migration, production deployment or paid
resource activation.

## .31 Independently inspect Jupiter transaction bytes
New `packages/money-core/src/sniper-transaction-byte-audit.ts` decodes a
bounded (<=1232-byte) unsigned Solana legacy / v0 wire transaction directly:
canonical compact-u16 counts, exactly one required signature, 64 zero
signature bytes, fee payer first and writable, static account count,
blockhash, compiled instruction indexes and lengths, and an explicit static
program allowlist. Exact original binary is SHA-256 hashed; this hash can
be compared to the selected Jupiter order under review.

**Fail closed:** missing/truncated/noncanonical base64 or wire bytes,
multi-signer transactions, pre-signed bytes, wrong fee payer, unknown
program, out-of-bounds accounts/data, unsigned-to-signed substitution,
address lookup table references or any unsupported wire version.

Official Solana documentation as of 2026-10-23 describes legacy, v0
(with address lookup tables), and v1 (a distinct wire format):
https://solana.com/docs/core/transactions/versioned-transactions
This deliberately does NOT support v1, and v0 transactions with ALTs
are rejected until exact onchain ALT state can be attested at the relevant
slot and all account privileges independently resolved.

## .32 No invented transaction semantics
A structural parser does NOT prove:
- the Solana transaction actually buys the intended mint, produces the
  promised minimum output, or does not perform an unexpected CPI;
- fee-priority effects, Jito bundles, output recipient/authority/ATA,
  writable-account risks, future blockhash validity or actual account deltas;
- the absence of token freezes, transfer hooks, mint/pool changes or
  sell restrictions.

Its output is always `semanticAuthorized:false`,
`canSign:false`, `canSubmit:false`, and `canTrade:false`.
A forged caller `transactionInstructionsVerified=true` remains
insufficient proof.

## .33 Harden canonical entry review
`reviewSniperLiveEntry` now requires independently inspected original
quote bytes with matching SHA-256, original Jupiter request ID and Coffer
fee payer. It fails closed for an absent or mismatched byte inspection.
Even after a structural success, the review adds
`TRANSACTION_SEMANTIC_DECODER_NOT_COMMISSIONED`, so **no input can
promote this source-only module into an executable trade**.
The prior synthetic `REVIEW_READY` test is intentionally replaced with
a BLOCKED test to avoid false engineering acceptance.

## .34 Adversarial certification tests
Added tests for v0 structural parsing, immutable hash, zero signatures,
wrong fee payer, multiple signers, unexpected programs, unsupported
wire versions, ALTs, tampering, malformed bytes and forged JSON
attestation. Both SHARK and Money R13B certification remain mandatory.

## .35 Live-canary handoff and independent gates
1. Reconcile the stacked PRs and complete exact-head SHARK, Money R13B and
   Jhadina Launch Gate checks. Do not merge or deploy this child early.
2. Build a **trusted semantic verifier** under a privileged isolated
   signer-proxy boundary using a maintained Solana library. It must decode
   legacy, v0 ALTs (from onchain state at a safe slot), and v1 only where
   supported, verify fee payer/signers/blockhash, program whitelist,
   instruction payloads and CPIs, token in/out ATA and destination
   authorities, fee/compute/tip caps and prohibited side transfers.
3. Recompute the exact message hash on the signer service immediately
   before signing; caller-supplied flags or checksums MUST NOT be trusted
   without independent provenance.
4. Preserve Money execution permit consumption, Coffer budget limits,
   onchain settlement reconciliation, unknown-attempt freeze, and exit
   sentinel. No second signer or second ledger.
5. Separately commission real Helius/chain delivery, canonical Shadow
   archive, isolated wallet/funding, owner-private iPhone QA, genuine
   buy-and-sell acceptance with verified receipts, kill and restart drill.
6. Only after explicit owner authorization can a tiny funded mainnet
   canary be considered. This PR neither requests nor grants it.

### Current blockers
The original default-locked Phantom state and absence of a commissioned
funded signer remain unchanged. SHARK paper code, Vercel private preview and
green unit tests do NOT prove a profitable strategy, end-to-end 0.6-second
latency or completed onchain fills.
