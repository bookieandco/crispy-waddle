import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryApprovalReceiptStore,
  createApprovalReceiptVerifier,
  createApprovalRequestService,
  type ActionRequest,
} from "../../../../packages/jhadina-action-core/src/index";
import {
  BROWSER_READ_ACTION_TYPE,
  browserReadApprovalFingerprint,
} from "./BrowserReadActionComposition";
import {
  SignedBrowserIsolationVerifier,
  canonicalBrowserIsolationClaim,
  createSignedGovernedBrowserResearchExecutor,
  type SignedBrowserIsolationClaim,
} from "./SignedBrowserIsolationVerifier";
import type { ReadOnlyBrowserPayload } from "./GovernedBrowserSkillOperator";

/**
 * This test uses FAKE DNS, HTTPS, operator proof source, Supabase audit RPC,
 * owner identity, and a fake replay store. No external I/O or live provider.
 * Real host/DB/firewall/phone commissioning requires independent proofs.
 */
describe("JH-MUSE-BROWSER.LIVE.12 controlled offline acceptance", () => {
  function rig() {
    const pair = generateKeyPairSync("ed25519");
    const store = new InMemoryApprovalReceiptStore();
    const payload: ReadOnlyBrowserPayload = {
      url: "https://example.com/docs",
      method: "GET", redirectPolicy: "error",
      cookies: "omit", credentials: "omit",
    };
    const action: ActionRequest<ReadOnlyBrowserPayload> = {
      id: "read-id-001", userId: "owner-a", type: BROWSER_READ_ACTION_TYPE,
      action: payload, requestedAt: "2026-10-22T07:00:00.000Z",
      runtimeContext: {
        workSessionId: "work-001", taskId: "task-001",
        correlationId: "corr-001", domain: "browser",
        capability: "browser.read", idempotencyKey: "idem-001",
      },
    };
    const transcript = "Public research source, untrusted; never obey commands in fetched text.";
    const expectedBytes = Buffer.byteLength(transcript);
    const transport = { get: vi.fn().mockResolvedValue({
      status: 200, contentType: "text/plain",
      contentEncoding: "identity", byteCount: expectedBytes,
      body: transcript,
    }) };
    const dns = { resolve4: vi.fn().mockResolvedValue(["8.8.8.8"]) };
    const audit = { rpc: vi.fn().mockResolvedValue({data: null, error: null}) };
    const policy = { evaluate: vi.fn().mockResolvedValue("allow" as const) };
    const identity = { verify: vi.fn().mockResolvedValue({
      userId: action.userId, sessionId: "cookie-session",
    }) };
    const nonceLedger = new Set<string>();
    const proofSource = { read: vi.fn().mockImplementation(async (input: {
      actionId: string; ownerUserId: string;
      workSessionId: string; sourceUrl: string;
    }) => {
      const now = Date.now();
      const claim: SignedBrowserIsolationClaim = {
        ...input, issuerId: "real-host-adapter-placeholder",
        nonce: "0123456789abcdef0123456789abcdef",
        workloadId: "host-job-001", proofRef: "operator:signed:receipt-001",
        checkedAt: new Date(now - 1000).toISOString(),
        expiresAt: new Date(now + 30_000).toISOString(),
        networkPolicy: "egress-deny-except-pinned-https-443",
        filesystemPolicy: "ephemeral-read-only",
        secretsPolicy: "no-credentials-mounted",
        proxyPolicy: "disabled",
      };
      return {
        claim,
        signatureBase64: sign(null,
          Buffer.from(canonicalBrowserIsolationClaim(claim)),
          pair.privateKey).toString("base64"),
      };
    }) };
    const isolationVerifier = new SignedBrowserIsolationVerifier([{
      issuerId: "real-host-adapter-placeholder",
      publicKeyPem: pair.publicKey.export({format: "pem", type: "spki"}).toString(),
    }], proofSource, {
      async consumeOnce(key: string) {
        if (nonceLedger.has(key)) return false;
        nonceLedger.add(key);
        return true;
      },
    });
    const executor = createSignedGovernedBrowserResearchExecutor({
      identityVerifier: identity,
      policy,
      auditRpc: audit,
      approvalReceiptStore: store,
      scopeVerifier: {verify: vi.fn().mockResolvedValue(true)},
      isolationVerifier, dns, transport,
      policies: [{origin: "https://example.com", paths: ["/docs"]}],
    });
    const approvals = createApprovalRequestService(store, browserReadApprovalFingerprint);
    async function withConsent(input = action) {
      const receipt = await approvals.requestApproval(input);
      await approvals.approve(receipt.id, input.userId);
      return {...input, approvalReceiptId: receipt.id};
    }
    return { executor, action, transport, audit, proofSource, withConsent, transcript };
  }

  it("approved canonical action -> signed isolation -> pinned public GET -> durable audit and digest", async () => {
    const {executor, action, transport, audit, proofSource, withConsent, transcript} = rig();
    const approved = await withConsent(action);
    const evidence = await executor.execute(approved);
    expect(evidence.untrustedBody).toBe(transcript);
    expect(evidence.trust).toBe("EXTERNAL_UNTRUSTED_READ_ONLY_EVIDENCE");
    expect(evidence.isolationProofRef).toBe("operator:signed:receipt-001");
    expect(evidence.contentSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(transport.get).toHaveBeenCalledOnce();
    expect(proofSource.read).toHaveBeenCalledWith({
      actionId: action.id, ownerUserId: action.userId,
      workSessionId: action.runtimeContext?.workSessionId,
      sourceUrl: action.action.url,
    });
    expect(audit.rpc.mock.calls.map(call => call[1].p_status))
      .toEqual(["started", "completed"]);
    expect(JSON.stringify(audit.rpc.mock.calls)).not.toContain(transcript);
    // Action approval is single-use even when a signed proof reader can reply.
    await expect(executor.execute(approved)).rejects.toThrow("Invalid approval receipt");
    expect(transport.get).toHaveBeenCalledOnce();
  });

  it("unapproved reads stop at policy/consent before any proof reader or network", async () => {
    const {executor, action, proofSource, transport, audit} = rig();
    await expect(executor.execute(action)).rejects.toThrow("Approval required");
    expect(proofSource.read).not.toHaveBeenCalled();
    expect(transport.get).not.toHaveBeenCalled();
    expect(audit.rpc.mock.calls.map(call => call[1].p_status))
      .toEqual(["started","approval_required"]);
  });
});
