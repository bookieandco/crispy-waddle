export interface VocalRestorationProfile {
  declick: boolean;
  declip: boolean;
  denoiseNoiseFloorDb?: number;
  highPassHz?: number;
}

export interface VocalRestorationApproval {
  approvedByUserId: string;
  approvedAt: string;
  evidenceId: string;
}

export interface VocalRestorationRequest {
  requestId: string;
  sourceArtifactId: string;
  profile: VocalRestorationProfile;
  evidenceIds: string[];
  approval: VocalRestorationApproval;
}

export interface VocalRestorationQcEvidence {
  passed: boolean;
  identityPreserved: boolean;
  method: string;
  findings: string[];
  requiresAudition: boolean;
}

export interface VocalRestorationResult {
  requestId: string;
  sourceArtifactId: string;
  outputArtifactId: string;
  status: "rendered" | "rejected";
  qc: VocalRestorationQcEvidence;
  createdAt: string;
}

function finite(value: number | undefined, label: string): void {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}

export function validateVocalRestorationRequest(
  request: VocalRestorationRequest,
  options: { ownerUserId?: string } = {},
): void {
  if (!request.requestId.trim()) throw new Error("MUSIC_VOCAL_RESTORATION_REQUEST_ID_REQUIRED");
  if (!request.sourceArtifactId.trim()) throw new Error("MUSIC_VOCAL_RESTORATION_SOURCE_REQUIRED");
  if (!request.approval.evidenceId.trim() || !request.approval.approvedByUserId.trim()) {
    throw new Error("MUSIC_VOCAL_RESTORATION_EXPLICIT_APPROVAL_REQUIRED");
  }
  if (options.ownerUserId && request.approval.approvedByUserId !== options.ownerUserId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_APPROVER_MISMATCH");
  }
  if (Number.isNaN(Date.parse(request.approval.approvedAt))) {
    throw new Error("MUSIC_VOCAL_RESTORATION_APPROVAL_TIME_INVALID");
  }

  const { profile } = request;
  finite(profile.denoiseNoiseFloorDb, "denoiseNoiseFloorDb");
  finite(profile.highPassHz, "highPassHz");
  if (!profile.declick && !profile.declip &&
      profile.denoiseNoiseFloorDb === undefined &&
      profile.highPassHz === undefined) {
    throw new Error("MUSIC_VOCAL_RESTORATION_EMPTY_PROFILE");
  }
  if (profile.denoiseNoiseFloorDb !== undefined &&
      (profile.denoiseNoiseFloorDb < -80 || profile.denoiseNoiseFloorDb > -25)) {
    throw new Error("MUSIC_VOCAL_RESTORATION_DENOISE_OUT_OF_RANGE");
  }
  if (profile.highPassHz !== undefined &&
      (profile.highPassHz < 20 || profile.highPassHz > 180)) {
    throw new Error("MUSIC_VOCAL_RESTORATION_HIGHPASS_OUT_OF_RANGE");
  }
}
