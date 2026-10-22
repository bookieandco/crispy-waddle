import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  canonicalBrowserIsolationClaim,
  SignedBrowserIsolationVerifier,
  createSignedGovernedBrowserResearchExecutor,
  type SignedBrowserIsolationClaim,
  type SignedBrowserIsolationProof,
} from "./SignedBrowserIsolationVerifier";

const input = {
  actionId: "browser-action-a",
  ownerUserId: "owner-a",
  workSessionId: "work-a",
  sourceUrl: "https://example.com/docs",
};
const privatePair = generateKeyPairSync("ed25519");
const wrongPair = generateKeyPairSync("ed25519");
const trustedIssuer = {
  issuerId: "host-controller-1",
  publicKeyPem: privatePair.publicKey.export({ format: "pem", type: "spki" }).toString(),
};
function claim(overrides: Partial<SignedBrowserIsolationClaim> = {}): SignedBrowserIsolationClaim {
  const now = Date.now();
  return {
    ...input,
    issuerId: trustedIssuer.issuerId,
    nonce: "0123456789abcdef0123456789abcdef",
    workloadId: "isolated-worker-1",
    proofRef: "operator:isolation:host-receipt-001",
    checkedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    networkPolicy: "egress-deny-except-pinned-https-443",
    filesystemPolicy: "ephemeral-read-only",
    secretsPolicy: "no-credentials-mounted",
    proxyPolicy: "disabled",
    ...overrides,
  };
}
function envelope(
  value: SignedBrowserIsolationClaim = claim(),
  key = privatePair.privateKey,
): SignedBrowserIsolationProof {
  return {
    claim: value,
    signatureBase64: sign(
      null,
      Buffer.from(canonicalBrowserIsolationClaim(value)),
      key,
    ).toString("base64"),
  };
}
function setup(
  proof: SignedBrowserIsolationProof | null = envelope(),
  consume = vi.fn().mockResolvedValue(true),
) {
  const reader = { read: vi.fn().mockResolvedValue(proof) };
  const ledger = { consumeOnce: consume };
  return {
    verifier: new SignedBrowserIsolationVerifier([trustedIssuer], reader, ledger),
    reader, ledger,
  };
}
describe("JH-MUSE-BROWSER.LIVE.11 signed isolation commissioning", () => {
  it("rejects unconfigured, duplicate or non-Ed25519 host trust anchors", () => {
    const reader = { read: async () => null };
    const ledger = { consumeOnce: async () => true };
    expect(() => new SignedBrowserIsolationVerifier([], reader, ledger)).toThrow("NOT_COMMISSIONED");
    expect(() => new SignedBrowserIsolationVerifier([trustedIssuer, trustedIssuer], reader, ledger)).toThrow("ISSUER_INVALID");
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => new SignedBrowserIsolationVerifier([{
      issuerId: "host-controller-2",
      publicKeyPem: rsa.publicKey.export({ format: "pem", type: "spki" }).toString(),
    }], reader, ledger)).toThrow("KEY_INVALID");
  });

  it("returns attestation only after a fresh trusted signature and atomic nonce claim", async () => {
    const t = setup();
    const result = await t.verifier.verify(input);
    expect(result).toMatchObject({
      actionId: input.actionId,
      ownerUserId: input.ownerUserId,
      workSessionId: input.workSessionId,
      networkPolicy: "egress-deny-except-pinned-https-443",
    });
    expect(result).not.toHaveProperty("signatureBase64");
    expect(result).not.toHaveProperty("nonce");
    expect(t.ledger.consumeOnce).toHaveBeenCalledWith(
      "host-controller-1:0123456789abcdef0123456789abcdef",
      expect.any(String),
    );
  });

  it("rejects wrong issuer key, missing proof, mangled signature and unsigned changes", async () => {
    for (const proof of [
      null,
      envelope(claim(), wrongPair.privateKey),
      { ...envelope(), signatureBase64: "%%%!" },
      { ...envelope(), claim: { ...claim(), networkPolicy: "allow-everything" as never } },
      { ...envelope(), claim: { ...claim(), sourceUrl: "https://example.com/admin" } },
    ]) {
      const t = setup(proof);
      expect(await t.verifier.verify(input)).toBeNull();
      expect(t.ledger.consumeOnce).not.toHaveBeenCalled();
    }
  });

  it("denies exact owner/action/URL mismatches, expired proof and weak environment", async () => {
    const cases: Array<Partial<SignedBrowserIsolationClaim>> = [
      { actionId: "other-action" },
      { ownerUserId: "owner-b" },
      { workSessionId: "work-b" },
      { sourceUrl: "https://example.com/other" },
      { checkedAt: new Date(Date.now() - 45_000).toISOString() },
      { expiresAt: new Date(Date.now() - 10).toISOString() },
      { nonce: "lowentropy" },
      { proxyPolicy: "enabled" as never },
      { secretsPolicy: "secret-mounted" as never },
      { filesystemPolicy: "readwrite" as never },
      { networkPolicy: "all-egress" as never },
    ];
    for (const change of cases) {
      const t = setup(envelope(claim(change)));
      expect(await t.verifier.verify(input), JSON.stringify(change)).toBeNull();
      expect(t.ledger.consumeOnce).not.toHaveBeenCalled();
    }
  });

  it("prevents replay using only an atomic durable nonce consume-once port", async () => {
    const consumed = new Set<string>();
    const ledger = {
      consumeOnce: vi.fn(async (key: string) => {
        if (consumed.has(key)) return false;
        consumed.add(key);
        return true;
      }),
    };
    const t = setup(envelope(), ledger.consumeOnce);
    expect(await t.verifier.verify(input)).not.toBeNull();
    expect(await t.verifier.verify(input)).toBeNull();
    expect(ledger.consumeOnce).toHaveBeenCalledTimes(2);
  });

  it("fails closed when signed nonce ledger is unavailable", async () => {
    const t = setup(envelope(), vi.fn().mockRejectedValue(new Error("disk failed")));
    expect(await t.verifier.verify(input)).toBeNull();
  });

  it("does not accept a mock or unsigned verifier in the production-focused composition", () => {
    // Even though JS callers can bypass TS types, a runtime constructor
    // identity check will protect this commissioning entry point.
    expect(() => createSignedGovernedBrowserResearchExecutor({
      isolationVerifier: { verify: async () => claim() } as never,
    } as never)).toThrow("BROWSER_SIGNED_ISOLATION_NOT_COMMISSIONED");
  });
});
