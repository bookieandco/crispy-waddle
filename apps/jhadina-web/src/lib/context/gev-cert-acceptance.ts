import type { GevPublicReadiness } from './gev-cert-public-readiness'
import type { GevLiveCanaryReceipt } from './gev-live-evidence-canary'
import type { GevLiveCloseoutReport } from './gev-live-closeout'

export type GevCertStep =
  | 'GEV-CERT.01' | 'GEV-CERT.02' | 'GEV-CERT.03' | 'GEV-CERT.04'
  | 'GEV-CERT.05' | 'GEV-CERT.06' | 'GEV-CERT.07' | 'GEV-CERT.08'

/** Immutable external verification inputs, never generated from a source-only
 * CI result or a Vercel READY flag. Does not fetch endpoints or change state. */
export type GevCertEvidence = {
  expectedSha: string
  production?: {
    sha: string
    target: 'production' | 'preview'
    ready: boolean
    verifiedByPlatform: boolean
    ownerAuthenticatedJson: boolean
    anonymousRejected: boolean
    oidcVerified: boolean
  }
  supabase?: {
    sqlConnectionAccepted: boolean
    walRecovered: boolean
    backupReviewed: boolean
    sixProtectedTablesAndGrantsVerified: boolean
  }
  publicSources?: GevPublicReadiness
  liveCanary?: GevLiveCanaryReceipt
  canaryExplicitlyAuthorized?: boolean
  independentlyMatched?: {
    evidenceHash: string
    candidateId: string
    admissionId: string
    observedOnProductionDb: boolean
  }
  liveRecovery?: {
    sha: string
    restartReplay: boolean
    duplicateIdempotent: boolean
    sourceOutageFailClosed: boolean
    identityRevocationFailClosed: boolean
    tamperRejected: boolean
    observedOnProductionHost: boolean
  }
  deviceAcceptance?: {
    observedOnRealIphone: boolean
    askObservationsLabeledUnadmitted: boolean
    worldShowsSourceAndRealitySeparately: boolean
  }
  ownerApproved?: boolean
  fullGevCloseout?: GevLiveCloseoutReport
}

export type GevCertLedger = {
  kind: 'GEV_CERT_01_08_V1'
  status: 'BLOCKED' | 'READY_FOR_INDEPENDENT_REVIEW'
  productionCertified: false
  authority: 'CERTIFICATION_EVIDENCE_REVIEW_ONLY'
  steps: Array<{ id: GevCertStep; status: 'EVIDENCE_READY' | 'BLOCKED'; reasonCode: string }>
  blockedOn: GevCertStep[]
  expectedSha: string
  restrictions: {
    noDatabaseWrites: true
    noTrading: true
    noPublishing: true
    noAutomaticProviderActivation: true
  }
}

const shaValid = (value: string | undefined | null): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)

export function evaluateGevCert01to08(evidence: GevCertEvidence): GevCertLedger {
  const sha = evidence.expectedSha
  const db = evidence.supabase
  const deployment = evidence.production
  const publicProbe = evidence.publicSources
  const live = evidence.liveCanary
  const independent = evidence.independentlyMatched
  const recovery = evidence.liveRecovery
  const device = evidence.deviceAcceptance

  const dbReady = Boolean(db?.sqlConnectionAccepted && db.walRecovered &&
    db.backupReviewed && db.sixProtectedTablesAndGrantsVerified)
  const productionReady = Boolean(
    shaValid(sha) && deployment?.sha === sha && deployment.target === 'production' &&
    deployment.ready && deployment.verifiedByPlatform &&
    deployment.ownerAuthenticatedJson && deployment.anonymousRejected && deployment.oidcVerified,
  )
  const publicReady = Boolean(
    publicProbe?.kind === 'GEV_PUBLIC_READINESS_V1' &&
    publicProbe.status === 'SOURCE_READABLE' &&
    publicProbe.sources.length === 2 &&
    publicProbe.sources.every(source => source.state === 'OBSERVED' || source.state === 'EMPTY') &&
    publicProbe.persisted === false && publicProbe.admittedReality === false &&
    publicProbe.productionCertified === false && publicProbe.canAct === false,
  )
  const canaryReady = Boolean(
    dbReady && productionReady && evidence.canaryExplicitlyAuthorized &&
    live?.kind === 'GEV_LIVE_CANARY_V1' && live.status === 'VERIFIED' &&
    live.deploymentSha === sha && live.sourceId === 'gev-usgs' &&
    live.durabilityVerified && live.admittedReality &&
    live.checks.databaseTables === 6 && live.checks.evidenceReadback &&
    live.checks.candidateReadback && live.checks.admissionReadback &&
    live.decision === 'ACCEPT' && /^[a-f0-9]{64}$/i.test(live.evidenceHash ?? ''),
  )
  const readbackReady = Boolean(canaryReady && independent?.observedOnProductionDb &&
    independent.evidenceHash === live?.evidenceHash &&
    independent.candidateId === live?.candidateId &&
    independent.admissionId === live?.admissionId)
  const recoveryReady = Boolean(readbackReady && recovery?.observedOnProductionHost &&
    recovery.sha === sha && recovery.restartReplay && recovery.duplicateIdempotent &&
    recovery.sourceOutageFailClosed && recovery.identityRevocationFailClosed &&
    recovery.tamperRejected)
  const deviceReady = Boolean(productionReady && device?.observedOnRealIphone &&
    device.askObservationsLabeledUnadmitted && device.worldShowsSourceAndRealitySeparately)
  const prior = [dbReady, productionReady, publicReady, canaryReady, readbackReady, recoveryReady, deviceReady]
  const finalReady = prior.every(Boolean) && evidence.ownerApproved === true &&
    evidence.fullGevCloseout?.status === 'READY_FOR_INDEPENDENT_REVIEW' &&
    evidence.fullGevCloseout.productionCertified === false &&
    evidence.fullGevCloseout.blockedOn.length === 0 &&
    evidence.fullGevCloseout.expectedSha === sha &&
    evidence.fullGevCloseout.deployedSha === sha

  const states: Array<[GevCertStep, boolean, string]> = [
    ['GEV-CERT.01', dbReady, 'SUPABASE_WAL_SQL_BACKUP_OR_SIX_TABLES_NOT_VERIFIED'],
    ['GEV-CERT.02', productionReady, 'OWNER_AUTH_JSON_OIDC_OR_EXACT_PRODUCTION_SHA_UNVERIFIED'],
    ['GEV-CERT.03', publicReady, 'PUBLIC_USGS_AND_CELESTRAK_READS_NOT_BOTH_VERIFIED'],
    ['GEV-CERT.04', canaryReady, 'EXPLICITLY_AUTHORIZED_LIVE_USGS_CANARY_MISSING'],
    ['GEV-CERT.05', readbackReady, 'INDEPENDENT_DURABLE_EVIDENCE_ADMISSION_HASHES_MISSING'],
    ['GEV-CERT.06', recoveryReady, 'REAL_HOST_RESTART_AND_FAILURE_DRILLS_NOT_PROVEN'],
    ['GEV-CERT.07', deviceReady, 'IPHONE_ASK_SPATIAL_ACCEPTANCE_NOT_PROVEN'],
    ['GEV-CERT.08', finalReady, 'OWNER_AND_INDEPENDENT_CERTIFICATION_REVIEW_REQUIRED'],
  ]
  const steps = states.map(([id, good, reason]) => ({
    id,
    status: good ? 'EVIDENCE_READY' as const : 'BLOCKED' as const,
    reasonCode: good ? 'EVIDENCE_RECORDED' : reason,
  }))
  const blockedOn = steps.filter(item => item.status === 'BLOCKED').map(item => item.id)
  return {
    kind: 'GEV_CERT_01_08_V1',
    status: blockedOn.length ? 'BLOCKED' : 'READY_FOR_INDEPENDENT_REVIEW',
    productionCertified: false,
    authority: 'CERTIFICATION_EVIDENCE_REVIEW_ONLY',
    steps, blockedOn, expectedSha: sha,
    restrictions: {
      noDatabaseWrites: true, noTrading: true, noPublishing: true,
      noAutomaticProviderActivation: true,
    },
  }
}

/** This default report cannot fabricate outside approvals or test receipts. */
export function getGevCertBlockedPreflight(): GevCertLedger {
  return evaluateGevCert01to08({ expectedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? '' })
}
