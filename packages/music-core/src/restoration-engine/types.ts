export type RestorationOperationClass =
  | "analysis"
  | "correction"
  | "reconstruction"
  | "source-recovery"
  | "production"
  | "simulation";

export type RestorationCandidateStatus = "proposed" | "rendered" | "qc-passed" | "rejected";

export interface RestorationEvidence {
  id: string;
  kind: string;
  confidence: number;
  sourceArtifactId?: string;
  region?: { startSample: number; endSample: number };
  data: Record<string, string | number | boolean | null>;
}

export interface RestorationCandidate {
  id: string;
  operation: string;
  operationClass: RestorationOperationClass;
  status: RestorationCandidateStatus;
  inputArtifactId: string;
  outputArtifactId?: string;
  parameters: Record<string, string | number | boolean>;
  evidenceIds: string[];
  provenance: "original" | "derived" | "reconstructed" | "synthetic" | "external";
}

export interface RestorationPlan {
  id: string;
  caseId: string;
  sourceVersionId: string;
  declaredDamageRegion?: { startSample: number; endSample: number };
  allowedPropagationRegion?: { startSample: number; endSample: number };
  protectedRegions?: Array<{ startSample: number; endSample: number; reason: string }>;
  evidenceIds: string[];
  candidates: RestorationCandidate[];
  requiresApproval: boolean;
}

export interface RestorationQcResult {
  passed: boolean;
  conservationPassed: boolean;
  authenticityPassed: boolean;
  artifactFree: boolean;
  reasons: string[];
}

export interface RestorationGateDecision {
  allowed: boolean;
  reason: string;
  candidateId?: string;
}
