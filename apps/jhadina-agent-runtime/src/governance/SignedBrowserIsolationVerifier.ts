import { createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";
import type {
  BrowserIsolationAttestation,
  BrowserIsolationVerifier,
  BrowserResearchCompositionOptions,
} from "./BrowserReadActionComposition";
import { createGovernedBrowserResearchExecutor } from "./BrowserReadActionComposition";

export type SignedBrowserIsolationClaim = BrowserIsolationAttestation & Readonly<{
  /** The approved exact URL, not merely its hostname or an arbitrary origin. */
  sourceUrl: string;
  /** Operator-owned issuer, never derived from tool output or a site. */
  issuerId: string;
  /** Fresh 128–256-bit lowercase hex one-time nonce. */
  nonce: string;
}>;
export type SignedBrowserIsolationProof = Readonly<{
  claim: SignedBrowserIsolationClaim;
  /** Canonical base64 Ed25519 detached signature. */
  signatureBase64: string;
}>;
export interface BrowserIsolationProofReader {
  read(input: Readonly<{
    actionId: string;
    ownerUserId: string;
    workSessionId: string;
    sourceUrl: string;
  }>): Promise<SignedBrowserIsolationProof | null>;
}
export interface BrowserIsolationReplayLedger {
  /**
   * Atomic, DURABLE insert-if-absent under a unique index with expiry beyond
   * proof expiry; returns false for any reuse or storage failure.
   */
  consumeOnce(key: string, expiresAt: string): Promise<boolean>;
}
export type TrustedBrowserIsolationIssuer = Readonly<{
  issuerId: string;
  publicKeyPem: string;
}>;

/** No implicit trust: every field is signed, including intended recipient. */
export function canonicalBrowserIsolationClaim(claim: SignedBrowserIsolationClaim): string {
  return JSON.stringify([
    "JH-BROWSER-ISOLATION-v1",
    claim.issuerId, claim.nonce, claim.actionId,
    claim.ownerUserId, claim.workSessionId, claim.sourceUrl,
    claim.workloadId, claim.proofRef, claim.checkedAt, claim.expiresAt,
    claim.networkPolicy, claim.filesystemPolicy, claim.secretsPolicy,
    claim.proxyPolicy,
  ]);
}

/**
 * Strict trusted-issuer adapter. Only a host control plane holding an
 * independently provisioned Ed25519 private key may supply evidence.
 *
 * Signature != host certification: a separately inspected issuer, firewall
 * and namespace are still mandatory. No issuer/proof/nonce store is configured
 * by default, and this module never performs network I/O on its own.
 */
export class SignedBrowserIsolationVerifier implements BrowserIsolationVerifier {
  private readonly keys = new Map<string, KeyObject>();

  constructor(
    issuers: readonly TrustedBrowserIsolationIssuer[],
    private readonly reader: BrowserIsolationProofReader,
    private readonly replayLedger: BrowserIsolationReplayLedger,
  ) {
    if (issuers.length < 1 || issuers.length > 8 || !reader || !replayLedger) {
      throw new Error("BROWSER_SIGNED_ISOLATION_NOT_COMMISSIONED");
    }
    for (const issuer of issuers) {
      if (!/^[a-zA-Z0-9_-]{3,64}$/.test(issuer.issuerId) ||
          this.keys.has(issuer.issuerId)) {
        throw new Error("BROWSER_SIGNED_ISOLATION_ISSUER_INVALID");
      }
      let key: KeyObject;
      try { key = createPublicKey(issuer.publicKeyPem); }
      catch { throw new Error("BROWSER_SIGNED_ISOLATION_KEY_INVALID"); }
      if (key.asymmetricKeyType !== "ed25519") {
        throw new Error("BROWSER_SIGNED_ISOLATION_KEY_INVALID");
      }
      this.keys.set(issuer.issuerId, key);
    }
  }

  async verify(input: Readonly<{
    actionId: string;
    ownerUserId: string;
    workSessionId: string;
    sourceUrl: string;
  }>): Promise<BrowserIsolationAttestation | null> {
    const proof = await this.reader.read(input);
    if (!proof || !proof.claim || typeof proof.signatureBase64 !== "string") return null;
    const claim = proof.claim;
    const key = this.keys.get(claim.issuerId);
    if (!key || claim.actionId !== input.actionId ||
        claim.ownerUserId !== input.ownerUserId ||
        claim.workSessionId !== input.workSessionId ||
        claim.sourceUrl !== input.sourceUrl ||
        !/^[0-9a-f]{32,64}$/.test(claim.nonce)) return null;
    const now = Date.now();
    const checked = Date.parse(claim.checkedAt);
    const expires = Date.parse(claim.expiresAt);
    if (!Number.isFinite(checked) || !Number.isFinite(expires) ||
        checked > now || checked < now - 30_000 ||
        expires <= now || expires > checked + 120_000 ||
        claim.networkPolicy !== "egress-deny-except-pinned-https-443" ||
        claim.filesystemPolicy !== "ephemeral-read-only" ||
        claim.secretsPolicy !== "no-credentials-mounted" ||
        claim.proxyPolicy !== "disabled" ||
        !/^[a-zA-Z0-9:_./-]{4,256}$/.test(claim.workloadId) ||
        !/^[a-zA-Z0-9:_./-]{8,256}$/.test(claim.proofRef)) return null;

    // Require canonical base64 encoding, an exact Ed25519 64-byte signature,
    // and a valid signature over the complete bounded attestation.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(proof.signatureBase64)) return null;
    const signature = Buffer.from(proof.signatureBase64, "base64");
    if (signature.length !== 64 ||
        signature.toString("base64") !== proof.signatureBase64 ||
        !verifySignature(null,
          Buffer.from(canonicalBrowserIsolationClaim(claim), "utf8"),
          key, signature)) return null;

    // A signed proof is still single-use. Without an atomic durable
    // consume-once ledger it cannot become execution permission.
    const nonceKey = [claim.issuerId, claim.nonce].join(":");
    try {
      if (await this.replayLedger.consumeOnce(nonceKey, claim.expiresAt) !== true) return null;
    } catch {
      return null;
    }
    // Drop issuer and signature fields from evidence returned to Action Core.
    const { sourceUrl: _url, issuerId: _issuer, nonce: _nonce, ...attestation } = claim;
    return Object.freeze({ ...attestation });
  }
}

/**
 * Production-focused composition entry point. Typed to require an explicitly
 * constructed signed verifier; callers cannot pass an arbitrary mock through
 * this API. The legacy generic factory remains for offline unit testing.
 */
export function createSignedGovernedBrowserResearchExecutor(
  options: Omit<BrowserResearchCompositionOptions, "isolationVerifier"> & {
    isolationVerifier: SignedBrowserIsolationVerifier;
  },
) {
  if (!(options.isolationVerifier instanceof SignedBrowserIsolationVerifier)) {
    throw new Error("BROWSER_SIGNED_ISOLATION_NOT_COMMISSIONED");
  }
  return createGovernedBrowserResearchExecutor(options);
}
