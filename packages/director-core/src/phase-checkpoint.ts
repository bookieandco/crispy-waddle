export type DirectorPhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stale';

export interface DirectorPhaseCheckpoint {
  id: string;
  runId: string;
  projectId: string;
  phase: string;
  status: DirectorPhaseStatus;
  inputFingerprint: string;
  outputArtifactIds: readonly string[];
  outputFingerprint?: string;
  completedAt?: string;
  costUnits?: number;
}

export interface ResumePhaseRequest {
  runId: string;
  projectId: string;
  phase: string;
  inputFingerprint: string;
}

export function canResumeDirectorPhase(
  checkpoint: DirectorPhaseCheckpoint | undefined,
  request: ResumePhaseRequest,
): boolean {
  return Boolean(
    checkpoint &&
    checkpoint.status === 'completed' &&
    checkpoint.runId === request.runId &&
    checkpoint.projectId === request.projectId &&
    checkpoint.phase === request.phase &&
    checkpoint.inputFingerprint === request.inputFingerprint &&
    checkpoint.outputArtifactIds.length > 0 &&
    checkpoint.outputFingerprint,
  );
}

export function invalidateDirectorPhase(
  checkpoint: DirectorPhaseCheckpoint,
  nextInputFingerprint: string,
): DirectorPhaseCheckpoint {
  if (checkpoint.inputFingerprint === nextInputFingerprint) return checkpoint;
  return Object.freeze({ ...checkpoint, status: 'stale' as const });
}
