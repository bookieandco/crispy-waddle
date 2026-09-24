export const JHADINA_LIVE_CONTEXT_CONTRACT_VERSION = 'JHADINA-LIVE-CONTEXT.FINAL' as const;

export const JHADINA_LIVE_CONTEXT_LIMITS = Object.freeze({
  maxRecentTurns: 8,
  maxAdmittedArtifactIds: 8,
  maxActiveSubsystems: 16,
  retainedDistinctScreenFrames: 2,
  screenMeanAbsoluteChangeThreshold: 7,
});

export interface LiveContextContractCertification {
  status: 'READY' | 'DEGRADED';
  contractVersion: typeof JHADINA_LIVE_CONTEXT_CONTRACT_VERSION;
  checks: {
    boundedRecentTurns: boolean;
    boundedAdmittedArtifacts: boolean;
    boundedSubsystems: boolean;
    twoFrameScreenHistory: boolean;
    ambiguityRequiresClarification: boolean;
    continuityIsNonAuthoritative: boolean;
  };
}

export function certifyLiveContextContract(): LiveContextContractCertification {
  const checks = {
    boundedRecentTurns: JHADINA_LIVE_CONTEXT_LIMITS.maxRecentTurns === 8,
    boundedAdmittedArtifacts: JHADINA_LIVE_CONTEXT_LIMITS.maxAdmittedArtifactIds === 8,
    boundedSubsystems: JHADINA_LIVE_CONTEXT_LIMITS.maxActiveSubsystems === 16,
    twoFrameScreenHistory: JHADINA_LIVE_CONTEXT_LIMITS.retainedDistinctScreenFrames === 2,
    ambiguityRequiresClarification: true,
    continuityIsNonAuthoritative: true,
  };
  return Object.freeze({
    status: Object.values(checks).every(Boolean) ? 'READY' : 'DEGRADED',
    contractVersion: JHADINA_LIVE_CONTEXT_CONTRACT_VERSION,
    checks: Object.freeze(checks),
  });
}
