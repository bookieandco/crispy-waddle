import type { Shot, ShotStatus } from "./types.js";

export type ProductionRunStatus = "draft" | "planning" | "awaiting_approval" | "executing" | "review" | "completed" | "failed" | "cancelled";
export type CreativeGateKind = "storyboard" | "shotlist" | "generation" | "rough_cut" | "final";
export type CreativeGateDecision = "pending" | "approved" | "changes_requested" | "rejected";

export interface ProductionRun {
  id: string;
  projectId: string;
  status: ProductionRunStatus;
  createdAt: string;
  updatedAt: string;
  shotIds: string[];
  gateIds: string[];
}

export interface CreativeGate {
  id: string;
  runId: string;
  kind: CreativeGateKind;
  decision: CreativeGateDecision;
  requestedAt: string;
  decidedAt?: string;
  note?: string;
}

export interface ProductionPlan {
  runId: string;
  projectId: string;
  shotIds: string[];
  requiredApprovals: CreativeGateKind[];
}

export function canExecuteShot(shot: Shot, gate: CreativeGate): boolean {
  return shot.status === "approved" && gate.decision === "approved";
}

export function canAdvanceGate(gate: CreativeGate): boolean {
  return gate.decision === "approved" || gate.decision === "changes_requested" || gate.decision === "rejected";
}

export function nextRunStatus(gate: CreativeGate): ProductionRunStatus {
  if (gate.decision === "approved") return "executing";
  if (gate.decision === "changes_requested") return "planning";
  if (gate.decision === "rejected") return "cancelled";
  return "awaiting_approval";
}
