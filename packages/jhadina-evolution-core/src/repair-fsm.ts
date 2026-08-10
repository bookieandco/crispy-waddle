export type RepairState =
  | "UNDERSTAND"
  | "COLLECT"
  | "FIX"
  | "TEST"
  | "VERIFY"
  | "APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export type RepairAction = "advance" | "retry" | "approve" | "fail" | "block";

export interface RepairPolicy {
  maxAttempts: number;
  requiresApproval: boolean;
  protectedPaths: string[];
}

export interface RepairContext {
  repairId: string;
  state: RepairState;
  attempt: number;
  diagnosis?: string;
  collectedEvidence: string[];
  proposedFix?: string;
  changedFiles: string[];
  testsPassed?: boolean;
  verified?: boolean;
  approvalGranted?: boolean;
  failureReason?: string;
}

export interface RepairEvent {
  at: string;
  from: RepairState;
  to: RepairState;
  action: RepairAction;
  reason: string;
}

export interface RepairTransitionResult {
  context: RepairContext;
  event: RepairEvent;
}

const TRANSITIONS: Record<RepairState, Partial<Record<RepairAction, RepairState>>> = {
  UNDERSTAND: { advance: "COLLECT", block: "BLOCKED", fail: "FAILED" },
  COLLECT: { advance: "FIX", block: "BLOCKED", fail: "FAILED" },
  FIX: { advance: "TEST", retry: "COLLECT", block: "BLOCKED", fail: "FAILED" },
  TEST: { advance: "VERIFY", retry: "FIX", block: "FAILED", block: "BLOCKED" },
  VERIFY: { advance: "COMPLETED", retry: "FIX", approve: "APPROVAL", block: "BLOCKED", fail: "FAILED" },
  APPROVAL: { approve: "COMPLETED", block: "BLOCKED", fail: "FAILED" },
  COMPLETED: {},
  FAILED: {},
  BLOCKED: {},
};

export class RepairFSM {
  constructor(private readonly policy: RepairPolicy) {
    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
      throw new Error("maxAttempts must be a positive integer");
    }
  }

  create(repairId: string): RepairContext {
    return {
      repairId,
      state: "UNDERSTAND",
      attempt: 0,
      collectedEvidence: [],
      changedFiles: [],
    };
  }

  transition(context: RepairContext, action: RepairAction, reason: string): RepairTransitionResult {
    if (context.state === "COMPLETED" || context.state === "FAILED" || context.state === "BLOCKED") {
      throw new Error(`Repair ${context.repairId} is terminal in state ${context.state}`);
    }

    if (action === "advance" && context.state === "VERIFY" && this.policy.requiresApproval && !context.approvalGranted) {
      return this.move(context, "APPROVAL", "Policy requires approval before completion");
    }

    if (action === "retry") {
      if (context.attempt >= this.policy.maxAttempts) {
        return this.move(context, "FAILED", "Maximum repair attempts exceeded");
      }
      context = { ...context, attempt: context.attempt + 1 };
    }

    const target = TRANSITIONS[context.state][action];
    if (!target) throw new Error(`Invalid repair transition: ${context.state} + ${action}`);

    if (target === "FIX" && context.changedFiles.some((file) => this.isProtected(file))) {
      return this.move(context, "BLOCKED", "Repair touches a protected policy boundary");
    }

    return this.move(context, target, reason);
  }

  approve(context: RepairContext, reason = "User approved the repair") {
    return this.transition({ ...context, approvalGranted: true }, "approve", reason);
  }

  recordDiagnosis(context: RepairContext, diagnosis: string): RepairContext {
    if (context.state !== "UNDERSTAND") throw new Error("Diagnosis can only be recorded during UNDERSTAND");
    return { ...context, diagnosis };
  }

  collect(context: RepairContext, evidence: string[]): RepairContext {
    if (context.state !== "COLLECT") throw new Error("Evidence can only be collected during COLLECT");
    return { ...context, collectedEvidence: [...context.collectedEvidence, ...evidence] };
  }

  proposeFix(context: RepairContext, proposedFix: string, changedFiles: string[]): RepairContext {
    if (context.state !== "FIX") throw new Error("A fix can only be proposed during FIX");
    if (changedFiles.some((file) => this.isProtected(file))) {
      throw new Error("Proposed fix touches a protected Jhadina authority boundary");
    }
    return { ...context, proposedFix, changedFiles: [...new Set(changedFiles)] };
  }

  recordTestResult(context: RepairContext, passed: boolean): RepairContext {
    if (context.state !== "TEST") throw new Error("Test results can only be recorded during TEST");
    return { ...context, testsPassed: passed };
  }

  recordVerification(context: RepairContext, verified: boolean): RepairContext {
    if (context.state !== "VERIFY") throw new Error("Verification can only be recorded during VERIFY");
    return { ...context, verified };
  }

  private isProtected(file: string) {
    return this.policy.protectedPaths.some((protectedPath) => file.includes(protectedPath));
  }

  private move(context: RepairContext, target: RepairState, reason: string): RepairTransitionResult {
    const event: RepairEvent = {
      at: new Date().toISOString(),
      from: context.state,
      to: target,
      action: target === "APPROVAL" ? "approve" : "advance",
      reason,
    };
    return { context: { ...context, state: target }, event };
  }
}
