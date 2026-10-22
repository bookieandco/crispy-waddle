# SHARK-SNIPER.ACCEPT.06–.08 — CI recovery and Phantom ownership

**Status:** PR draft code, no deploy, no transaction or funding.

## .06 Risk-model CI regression
Corrected `sniper-live-risk-gate.test.ts` to distinguish two different safety conditions:
- VALID chronologically ordered but old observation: emits `EVIDENCE_FUTURE_OR_STALE` and hard-vetoes paper entry;
- IMPOSSIBLE observation (available before observed): throws `SNIPER_RISK_PROVENANCE_INVALID`.
Prior fixture used impossible chronology while expecting a stale status. The model remains strict; the test was repaired, not weakened.

## .07 Phantom ownership proof
Reuses existing Supabase `jhadina_wallet_challenges` and `jhadina_wallets` + canonical `money_wallet_connections` in Jhadina project. No new wallet ledger or private-key custody.

1. Signed-in user invokes `POST /api/money/wallet-connections/challenge` with a detected Phantom Solana public key.
2. Server validates the full 32-byte base58 key, generates 32 random bytes as a nonce, and stores a five-minute, account-specific, HTTPS-origin-specific message under the user id. No client-supplied message is accepted.
3. Phantom `signMessage(message, 'utf8')` is performed interactively in the user's wallet.
4. `POST /api/money/wallet-connections` verifies the saved user/address/challenge, expiry, cryptographic Ed25519 signature via Node crypto; atomically claims `consumed_at IS NULL AND expires_at > now()`; only then upserts the verified observation wallet and Money owner connection.
5. API returns no seed phrase, private key, signer lease, wallet spend permission or transfer authority.
6. Wrong signer, expired/replayed/mismatched challenge, malformed key or missing auth fails closed.
7. `GET /api/money/wallet-connections` reports only authenticated user's saved connection metadata. `DELETE` revokes the Money connection and disables observer state.

Signed proof is **not** a durable delegation to Jhadina and does not permit unattended signing. Signature may prove key possession once; current injected account availability must be checked separately on every device/session.

## .08 iPhone flow
- Canonical Money Command Center / Wallet pages share the same verified card.
- Safari without injected Phantom displays **Open in Phantom**, which uses Phantom's documented HTTPS in-app browser deep link. No localhost redirects for iPhone.
- The card distinguishes **Saved — reconnect required** from **Connected and verified** by comparing current Phantom provider public key with the server record.
- On trusted reconnect, use provider `connect({onlyIfTrusted:true})` for read-only address visibility; do **not** silently reauthorize or sign.
- Explicit Connect takes the user through: provider connect → server nonce → Phantom message confirmation → server signature verification → saved owner wallet.
- Provider account-change/disconnect events remove in-browser active state but never silently authorize the replacement address.
- Disconnect can revoke persistent server record even if wallet is no longer injected.
- Tests: real signed Ed25519 proof tampering/wrong wallet; API no-bare-address, invalid signature, expiry, replay and cross-user denial; mobile provider mocked trusted connection, account mismatch and deep link.

### Operator iPhone acceptance
1. After separate approval to deploy a private preview, open the real HTTPS Jhadina deployment in Phantom's **in-app browser**; sign in first.
2. Navigate to **Money → Command Center** or `/wallet`. Tap **Connect & verify Phantom**.
3. Confirm that Phantom asks you to **sign a message**, not sign/send a transaction. If the prompt references spending or network fees, cancel.
4. Accept, check **Connected and verified** and address suffix matching Phantom.
5. Reload the private Jhadina page; check trusted reconnect and persisted server state.
6. Change accounts in Phantom; old address must not remain active. Reconnect and approve a fresh challenge for any new account.
7. Test mobile Safari **Open in Phantom**, offline provider, expired challenge, rejected signature, logout, disconnect and reconnect.
8. Check `jhadina_wallet_challenges` has consumed nonce, `jhadina_wallets.ownership_verified=true`, `money_wallet_connections.status=ACTIVE` only for the authorized user.
9. No balance movement, wallet signing automation or live trade permitted.

**Not certified in this PR:** actual on-device Phantom approval, production deployment, end-to-end live API availability, zero defect proof until exact-head CI is complete, or live Coffer trading.
