import type { SpatialProductionHealth } from './spatial-production-health'
import type { GevLiveCanaryReceipt } from './gev-live-evidence-canary'

export type GevCloseoutCheckId =
  | 'PRODUCTION_DEPLOYMENT' | 'SAME_SHA' | 'AUTHENTICATED_HEALTH'
  | 'GEV_PROVIDER_RIGHTS' | 'SIX_TABLE_OIDC' | 'USGS_DURABLE_CANARY'
  | 'EVIDENCE_ADMISSION_READBACK' | 'LIVE_RESTART_RECOVERY'
  | 'LIVE_FAILURE_DRILLS' | 'OWNER_REVIEW'

export type GevLiveCloseoutEvidence = {
  expectedSha?: string | null
  deployment?: {
    environment: string
    sha: string
    ready: boolean
    /** Validated from the owner's Vercel deployment record, not a build preview. */
    verifiedVercelDeployment: boolean
    deploymentId: string
  } | null
  /** JSON checked under a real authenticated owner session, NOT an HTML login redirect. */
  authenticatedHealth?: SpatialProductionHealth | null
  ownerSessionVerified?: boolean
  sourceRightsAndNetworkVerified?: boolean
  /** An independently collected PRODUCTION receipt, never a synthetic CI fixture. */
  liveCanary?: GevLiveCanaryReceipt | null
  canaryIndependentlyVerified?: boolean
  recovery?: {
    sha: string
    persistentStoreRestart: boolean
    identicalEvidenceIdempotent: boolean
    sourceOutageFailClosed: boolean
    identityRevocationFailClosed: boolean
    tamperedReadbackRejected: boolean
    observedOnLiveHost: boolean
  } | null
  ownerApprovalRecorded?: boolean
}

export type GevLiveCloseoutReport = {
  kind: 'GEV_LIVE_CLOSEOUT_V1'
  status: 'BLOCKED' | 'READY_FOR_INDEPENDENT_REVIEW'
  productionCertified: false
  checks: { id: GevCloseoutCheckId; result: 'PASS' | 'BLOCKED'; reasonCode: string }[]
  blockedOn: GevCloseoutCheckId[]
  expectedSha: string | null
  deployedSha: string | null
  /** Release is separate from these source gates and always needs human verification. */
  authority: 'READ_ONLY_CERTIFICATION_REVIEW'
}

const isSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)

export function evaluateGevLiveCloseout(evidence: GevLiveCloseoutEvidence): GevLiveCloseoutReport {
  const expected = evidence.expectedSha
  const deployment = evidence.deployment
  const health = evidence.authenticatedHealth
  const canary = evidence.liveCanary
  const recovery = evidence.recovery
  const exactSha = isSha(expected) && isSha(deployment?.sha) &&
    deployment?.sha.toLowerCase() === expected.toLowerCase()
  const deploymentOK = Boolean(deployment?.environment === 'production' &&
    deployment?.ready && deployment.verifiedVercelDeployment &&
    typeof deployment.deploymentId === 'string' && deployment.deploymentId.length > 6)
  const healthOK = Boolean(evidence.ownerSessionVerified && health &&
    health.status === 'READY' && health.deployment.environment === 'production' &&
    health.deployment.commitSha === expected &&
    health.provider.configured && health.provider.reachable)
  const databaseOK = Boolean(health?.database.configured && health.database.reachable &&
    Object.keys(health.database.tables).length === 6 &&
    Object.values(health.database.tables).every(Boolean))
  const canaryOK = Boolean(evidence.canaryIndependentlyVerified && canary &&
    canary.kind === 'GEV_LIVE_CANARY_V1' && canary.status === 'VERIFIED' &&
    canary.sourceId === 'gev-usgs' && canary.durabilityVerified && canary.admittedReality &&
    canary.deploymentSha === expected &&
    /^[a-f0-9]{64}$/i.test(canary.evidenceHash ?? '') &&
    canary.evidenceId && canary.candidateId && canary.admissionId &&
    canary.checks.databaseTables === 6 && canary.checks.evidenceReadback)
  const admissionOK = Boolean(canaryOK && canary?.decision === 'ACCEPT' &&
    canary?.checks.candidateReadback && canary?.checks.admissionReadback)
  const restartOK = Boolean(recovery && recovery.observedOnLiveHost &&
    recovery.sha === expected && recovery.persistentStoreRestart &&
    recovery.identicalEvidenceIdempotent)
  const failureOK = Boolean(recovery && recovery.observedOnLiveHost &&
    recovery.sha === expected && recovery.sourceOutageFailClosed &&
    recovery.identityRevocationFailClosed && recovery.tamperedReadbackRejected)
  const values: Array<[GevCloseoutCheckId, boolean, string]> = [
    ['PRODUCTION_DEPLOYMENT', deploymentOK, 'VERIFIED_PRODUCTION_DEPLOYMENT_MISSING'],
    ['SAME_SHA', exactSha, 'DEPLOYMENT_SHA_MISMATCH_OR_MISSING'],
    ['AUTHENTICATED_HEALTH', healthOK, 'OWNER_AUTHENTICATED_PRODUCTION_JSON_NOT_VERIFIED'],
    ['GEV_PROVIDER_RIGHTS', evidence.sourceRightsAndNetworkVerified === true, 'SOURCE_RIGHTS_OR_EGRESS_NOT_CERTIFIED'],
    ['SIX_TABLE_OIDC', databaseOK && healthOK, 'SIX_TABLE_PRIVILEGED_IDENTITY_NOT_VERIFIED'],
    ['USGS_DURABLE_CANARY', canaryOK, 'REAL_SOURCE_AND_DURABLE_EVIDENCE_RECEIPT_MISSING'],
    ['EVIDENCE_ADMISSION_READBACK', admissionOK, 'REALITY_ADMISSION_READBACK_NOT_VERIFIED'],
    ['LIVE_RESTART_RECOVERY', restartOK, 'LIVE_HOST_RESTART_REPLAY_NOT_PROVEN'],
    ['LIVE_FAILURE_DRILLS', failureOK, 'LIVE_OUTAGE_IDENTITY_AND_TAMPER_DRILLS_NOT_PROVEN'],
    ['OWNER_REVIEW', evidence.ownerApprovalRecorded === true, 'OWNER_APPROVAL_REQUIRED'],
  ]
  const checks = values.map(([id, ok, reason]) => ({
    id, result: ok ? 'PASS' as const : 'BLOCKED' as const,
    reasonCode: ok ? 'EVIDENCE_RECORDED' : reason,
  }))
  const blockedOn = checks.filter(x => x.result === 'BLOCKED').map(x => x.id)
  return {
    kind: 'GEV_LIVE_CLOSEOUT_V1',
    status: blockedOn.length ? 'BLOCKED' : 'READY_FOR_INDEPENDENT_REVIEW',
    productionCertified: false,
    checks, blockedOn,
    expectedSha: isSha(expected) ? expected : null,
    deployedSha: isSha(deployment?.sha) ? deployment!.sha : null,
    authority: 'READ_ONLY_CERTIFICATION_REVIEW',
  }
}

/** Fail closed when no independent live receipts are available. Does not
 * execute canaries, grant permissions, write DB rows, or promote production. */
export function currentGevLiveCloseoutPreflight(): GevLiveCloseoutReport {
  return evaluateGevLiveCloseout({
    expectedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
}
