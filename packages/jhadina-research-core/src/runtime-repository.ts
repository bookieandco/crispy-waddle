import type { PersistedResearchPlan, ResearchRuntimeAdmission } from "./runtime-reconciliation.js";

export type ResearchUsageDelta = {
  cost?: number;
  risk?: number;
  queries?: number;
  sources?: number;
  evidence?: number;
  retries?: number;
  depth?: number;
  breadth?: number;
  wallClockMs?: number;
};

export type ResearchExecutionEventType =
  | "task_started"
  | "source_queried"
  | "evidence_captured"
  | "task_completed"
  | "contradiction_found"
  | "stopped"
  | "completed"
  | "failed";

export type ResearchCommitResult = {
  accepted: boolean;
  stopped: boolean;
  reason?: string;
  eventId?: string;
  sequenceNo?: number;
};

export type ResearchProviderSubmission = {
  id: string;
  planId: string;
  leaseId: string;
  taskId: string;
  providerId: string;
  idempotencyKey: string;
  status: "reserved" | "submitted" | "recovery_required";
  providerJobId?: string;
};

export type ResearchEvidenceSourceKind =
  | "github"
  | "web"
  | "pdf"
  | "api"
  | "database"
  | "conversation"
  | "user"
  | "system";

export type ResearchEvidenceAuthority =
  | "primary"
  | "official"
  | "secondary"
  | "community"
  | "user"
  | "system"
  | "unknown";

export type ResearchEvidenceCapture = {
  sourceUri: string;
  contentHash: string;
  sourceKind?: ResearchEvidenceSourceKind;
  publisher?: string;
  authority?: ResearchEvidenceAuthority;
  trustScore?: number;
  locator?: Record<string, unknown>;
  excerpt?: string;
  metadata?: Record<string, unknown>;
};

export interface ResearchRuntimeRepository {
  loadPlan(planId: string): Promise<PersistedResearchPlan | undefined>;
  claimExecution(input: {
    planId: string;
    policyDecisionId: string;
    workerId: string;
    leaseSeconds: number;
  }): Promise<ResearchRuntimeAdmission | undefined>;
  renewExecutionLease(admission: ResearchRuntimeAdmission, leaseSeconds: number): Promise<ResearchRuntimeAdmission | undefined>;
  reserveProviderSubmission(input: {
    admission: ResearchRuntimeAdmission;
    taskId: string;
    providerId: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<ResearchProviderSubmission | undefined>;
  acknowledgeProviderSubmission(input: {
    admission: ResearchRuntimeAdmission;
    submissionId: string;
    providerJobId?: string;
  }): Promise<ResearchProviderSubmission | undefined>;
  markProviderRecoveryRequired(input: {
    admission: ResearchRuntimeAdmission;
    submissionId: string;
    error: string;
  }): Promise<boolean>;
  commitExecutionEvent(input: {
    admission: ResearchRuntimeAdmission;
    eventType: ResearchExecutionEventType;
    taskId?: string;
    payload?: Record<string, unknown>;
    usage?: ResearchUsageDelta;
    contentHash?: string;
  }): Promise<ResearchCommitResult>;
  captureEvidence(input: {
    admission: ResearchRuntimeAdmission;
    executionEventId: string;
    evidence: ResearchEvidenceCapture;
  }): Promise<string | undefined>;
  releaseExecution(admission: ResearchRuntimeAdmission, state: "released" | "completed" | "failed" | "fenced"): Promise<boolean>;
}
