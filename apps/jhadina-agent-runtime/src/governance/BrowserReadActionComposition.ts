import { createHash } from "node:crypto";
import {
  createProductionActionExecutor,
  createApprovalReceiptVerifier,
  type ActionHandler,
  type ActionIdentityVerifier,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
  type ApprovalRequestLike,
  type ActionRuntimeContext,
} from "../../../../packages/jhadina-action-core/src/index";
import type { AuditRpcClient } from "../../../../packages/jhadina-action-core/src/supabase-audit-ledger";
import {
  BrowserReadOnlyWorker,
  type BrowserDnsResolver,
  type BrowserPinnedTransport,
  type BrowserReadPolicy,
  type BrowserReadReceipt,
} from "./BrowserReadOnlyWorker";
import type { ReadOnlyBrowserPayload } from "./GovernedBrowserSkillOperator";

export const BROWSER_READ_ACTION_TYPE = "browser.fetch_read_only" as const;

/** A trusted, server-side WorkSession repository adapter must verify these facts. */
export interface BrowserWorkScopeVerifier {
  verify(input: Readonly<{
    actionId: string;
    ownerUserId: string;
    workSessionId: string;
    taskId: string;
    idempotencyKey: string;
  }>): Promise<boolean>;
}

/**
 * This is an operator-control-plane finding, NEVER content supplied by
 * the model, browser response, request payload or in-process worker.
 * It must be freshly verified against real host firewall/network namespace,
 * workload identity and mounted secrets. These fields are source contracts,
 * not evidence that a production isolation layer has been commissioned.
 */
export interface BrowserIsolationAttestation {
  actionId: string;
  ownerUserId: string;
  workSessionId: string;
  workloadId: string;
  proofRef: string;
  checkedAt: string;
  expiresAt: string;
  networkPolicy: "egress-deny-except-pinned-https-443";
  filesystemPolicy: "ephemeral-read-only";
  secretsPolicy: "no-credentials-mounted";
  proxyPolicy: "disabled";
}
export interface BrowserIsolationVerifier {
  verify(input: Readonly<{
    actionId: string;
    ownerUserId: string;
    workSessionId: string;
    sourceUrl: string;
  }>): Promise<BrowserIsolationAttestation | null>;
}

/** Untrusted external source content; this is NOT a policy instruction. */
export type BrowserGovernedEvidence = Readonly<{
  actionId: string;
  ownerUserId: string;
  workSessionId: string;
  taskId: string;
  idempotencyKey: string;
  observedAt: string;
  sourceUrl: string;
  contentType: BrowserReadReceipt["mediaType"];
  bytes: number;
  contentSha256: string;
  isolationProofRef: string;
  /** Not admitted to memory, policy, tool calls, UI HTML, or autonomous actions. */
  untrustedBody: string;
  trust: "EXTERNAL_UNTRUSTED_READ_ONLY_EVIDENCE";
}>;

export type BrowserResearchCompositionOptions = {
  /** Must validate authenticated server-side session, never a raw user header. */
  identityVerifier: ActionIdentityVerifier;
  /** The existing canonical Security/Values action policy. */
  policy: ActionPolicy<ReadOnlyBrowserPayload>;
  /** Existing DURABLE, atomic Action Core approval store. Never an LLM-produced grant. */
  approvalReceiptStore: ApprovalReceiptStore;
  /** Existing Supabase audit RPC; no alternate action ledger. */
  auditRpc: AuditRpcClient;
  /** Verifies owner-bound canonical WorkSession task row and idempotency. */
  scopeVerifier: BrowserWorkScopeVerifier;
  /** Independently verifies a live operator-owned isolation receipt. */
  isolationVerifier: BrowserIsolationVerifier;
  /** Deliberate operator-provisioned exact origin/path list; no defaults. */
  policies: readonly BrowserReadPolicy[];
  /** Injected only in tests; production uses the pinned HTTPS implementation. */
  dns?: BrowserDnsResolver;
  transport?: BrowserPinnedTransport;
};

function verifyIsolation(
  evidence: BrowserIsolationAttestation | null,
  request: ActionRequest<ReadOnlyBrowserPayload>,
  now = Date.now(),
): asserts evidence is BrowserIsolationAttestation {
  const context = request.runtimeContext;
  if (!evidence || !context ||
      evidence.actionId !== request.id || evidence.ownerUserId !== request.userId ||
      evidence.workSessionId !== context.workSessionId ||
      !/^[a-zA-Z0-9:_./-]{4,256}$/.test(evidence.workloadId) ||
      !/^[a-zA-Z0-9:_./-]{8,256}$/.test(evidence.proofRef) ||
      evidence.networkPolicy !== "egress-deny-except-pinned-https-443" ||
      evidence.filesystemPolicy !== "ephemeral-read-only" ||
      evidence.secretsPolicy !== "no-credentials-mounted" ||
      evidence.proxyPolicy !== "disabled") {
    throw new Error("BROWSER_ISOLATION_PROOF_INVALID");
  }
  const checkedAt = Date.parse(evidence.checkedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) ||
      checkedAt > now || now - checkedAt > 30_000 ||
      expiresAt <= now || expiresAt - checkedAt > 120_000) {
    throw new Error("BROWSER_ISOLATION_PROOF_STALE");
  }
}

function assertScopedRequest(
  request: ActionRequest<ReadOnlyBrowserPayload>,
): asserts request is ActionRequest<ReadOnlyBrowserPayload> & {
  runtimeContext: NonNullable<ActionRequest["runtimeContext"]> & { taskId: string };
} {
  const context = request.runtimeContext;
  if (request.type !== BROWSER_READ_ACTION_TYPE ||
      !request.id || !request.userId ||
      !context?.workSessionId || !context.taskId || !context.correlationId ||
      context.domain !== "browser" || context.capability !== "browser.read" ||
      !context.idempotencyKey || context.idempotencyKey.length > 256 ||
      !request.approvalReceiptId) {
    throw new Error("BROWSER_ACTION_SCOPE_OR_APPROVAL_REQUIRED");
  }
}

/**
 * Canonical approval fingerprint for a browser read. In addition to Action
 * Core's action/owner/type it binds the exact session, task, idempotency key,
 * URL and timestamp. This uses the existing receipt verifier/store; it does
 * not invent a second approval system.
 */
export function browserReadApprovalFingerprint(
  request: ApprovalRequestLike<ReadOnlyBrowserPayload>,
): string {
  const scoped = request as ApprovalRequestLike<ReadOnlyBrowserPayload> & {
    runtimeContext?: ActionRuntimeContext;
  };
  const context = scoped.runtimeContext;
  if (!context?.workSessionId || !context.taskId ||
      !context.idempotencyKey || context.domain !== "browser" ||
      context.capability !== "browser.read" ||
      request.type !== BROWSER_READ_ACTION_TYPE ||
      !request.id || !request.userId || !request.requestedAt) {
    throw new Error("BROWSER_APPROVAL_SCOPE_REQUIRED");
  }
  return createHash("sha256").update(JSON.stringify([
    "JH-MUSE-BROWSER-APPROVAL-v1",
    request.id, request.userId, request.type, request.requestedAt,
    context.workSessionId, context.taskId, context.idempotencyKey,
    request.action,
  ])).digest("hex");
}

/**
 * Source-only composition. This creates a *canonical*
 * VerifiedActionExecutor → Policy → approval receipt → durable ActionAudit
 * → worker handler path. It does not install a route, scheduler, skill
 * auto-executor, production secrets, or live browser provider registration.
 *
 * The browser's policy overlay can only tighten the canonical policy:
 * every otherwise allowed browser read still requires an owner approval.
 */
export function createGovernedBrowserResearchExecutor(
  options: BrowserResearchCompositionOptions,
) {
  const worker = new BrowserReadOnlyWorker(
    options.policies,
    options.dns,
    options.transport,
  );
  const handler: ActionHandler<ReadOnlyBrowserPayload, BrowserGovernedEvidence> = {
    supports: type => type === BROWSER_READ_ACTION_TYPE,
    async execute(payload, request) {
      assertScopedRequest(request);
      const context = request.runtimeContext;
      const owned = await options.scopeVerifier.verify({
        actionId: request.id,
        ownerUserId: request.userId,
        workSessionId: context.workSessionId,
        taskId: context.taskId,
        idempotencyKey: context.idempotencyKey,
      });
      if (owned !== true) throw new Error("BROWSER_WORK_SESSION_SCOPE_UNVERIFIED");

      const isolation = await options.isolationVerifier.verify({
        actionId: request.id, ownerUserId: request.userId,
        workSessionId: context.workSessionId, sourceUrl: payload.url,
      });
      verifyIsolation(isolation, request);
      const receipt = await worker.read(payload);
      return Object.freeze({
        actionId: request.id,
        ownerUserId: request.userId,
        workSessionId: context.workSessionId,
        taskId: context.taskId,
        idempotencyKey: context.idempotencyKey,
        observedAt: receipt.observedAt,
        sourceUrl: receipt.sourceUrl,
        contentType: receipt.mediaType,
        bytes: receipt.bytes,
        contentSha256: "sha256:" + createHash("sha256")
          .update(receipt.body, "utf8").digest("hex"),
        isolationProofRef: isolation.proofRef,
        untrustedBody: receipt.body,
        trust: "EXTERNAL_UNTRUSTED_READ_ONLY_EVIDENCE" as const,
      });
    },
  };
  const guardedPolicy: ActionPolicy<ReadOnlyBrowserPayload> = {
    async evaluate(request) {
      if (request.type !== BROWSER_READ_ACTION_TYPE ||
          !request.runtimeContext ||
          request.runtimeContext.domain !== "browser" ||
          request.runtimeContext.capability !== "browser.read") return "deny";
      const canonical = await options.policy.evaluate(request);
      if (canonical === "deny") return "deny";
      // The original policy's allow must NOT silently waive browser consent.
      return "approval_required";
    },
  };
  return createProductionActionExecutor<ReadOnlyBrowserPayload, BrowserGovernedEvidence>({
    identityVerifier: options.identityVerifier,
    policy: guardedPolicy,
    approvalReceipts: createApprovalReceiptVerifier(
      options.approvalReceiptStore,
      browserReadApprovalFingerprint,
    ),
    supabase: options.auditRpc,
    domain: "browser",
    capabilityForType: () => BROWSER_READ_ACTION_TYPE,
    handlers: [handler],
  });
}
