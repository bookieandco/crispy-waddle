import { describe, expect, it } from 'vitest'
import { evaluateGevCert01to08, getGevCertBlockedPreflight, type GevCertEvidence } from './gev-cert-acceptance'

const sha = '1234567890abcdef1234567890abcdef12345678'
const full = (): GevCertEvidence => ({
  expectedSha: sha,
  production: {
    sha, target: 'production', ready: true, verifiedByPlatform: true,
    ownerAuthenticatedJson: true, anonymousRejected: true, oidcVerified: true,
  },
  supabase: {
    sqlConnectionAccepted: true, walRecovered: true, backupReviewed: true,
    sixProtectedTablesAndGrantsVerified: true,
  },
  publicSources: {
    kind: 'GEV_PUBLIC_READINESS_V1', status: 'SOURCE_READABLE',
    checkedAt: '2026-10-16T23:00:00Z', scope: 'READ_ONLY_PUBLIC_SOURCE',
    productionCertified: false, persisted: false, admittedReality: false,
    canAct: false, databaseNotRequiredForSourceProbe: true,
    sources: [{
      sourceId: 'gev-usgs', state: 'OBSERVED', sampleCount: 1,
      derivedEstimate: false, limitation: 'bounded',
    }, {
      sourceId: 'gev-celestrak', state: 'OBSERVED', sampleCount: 1,
      derivedEstimate: true, limitation: 'estimate',
    }],
    blockers: [],
  },
  liveCanary: {
    kind: 'GEV_LIVE_CANARY_V1', status: 'VERIFIED',
    checkedAt: '2026-10-16T23:00:00Z',
    sourceId: 'gev-usgs', evidenceId: 'ev', evidenceHash: 'a'.repeat(64),
    candidateId: 'candidate-1', admissionId: 'admission-1',
    decision: 'ACCEPT', durabilityVerified: true, admittedReality: true,
    deploymentSha: sha,
    checks: {
      databaseTables: 6, evidenceReadback: true, candidateReadback: true, admissionReadback: true,
    },
    reasonCode: 'READBACK_AND_ADMISSION_VERIFIED',
  },
  canaryExplicitlyAuthorized: true,
  independentlyMatched: {
    evidenceHash: 'a'.repeat(64), candidateId: 'candidate-1',
    admissionId: 'admission-1', observedOnProductionDb: true,
  },
  liveRecovery: {
    sha, restartReplay: true, duplicateIdempotent: true,
    sourceOutageFailClosed: true, identityRevocationFailClosed: true,
    tamperRejected: true, observedOnProductionHost: true,
  },
  deviceAcceptance: {
    observedOnRealIphone: true, askObservationsLabeledUnadmitted: true,
    worldShowsSourceAndRealitySeparately: true,
  },
  fullGevCloseout: {
    kind: 'GEV_LIVE_CLOSEOUT_V1', status: 'READY_FOR_INDEPENDENT_REVIEW',
    productionCertified: false, checks: [], blockedOn: [],
    expectedSha: sha, deployedSha: sha, authority: 'READ_ONLY_CERTIFICATION_REVIEW',
  },
  ownerApproved: true,
})

describe('GEV-CERT.01-.08 fail-closed independent acceptance', () => {
  it('blocks all eight without externally verified receipts even if deployed SHA exists', () => {
    const result = evaluateGevCert01to08({ expectedSha: sha })
    expect(result.blockedOn).toHaveLength(8)
    expect(result.status).toBe('BLOCKED')
    expect(result.productionCertified).toBe(false)
    expect(result.restrictions.noDatabaseWrites).toBe(true)
  })
  it('does not use a public readable source as an OIDC, database, persistence or admission receipt', () => {
    const evidence = full()
    const source = evidence.publicSources
    const result = evaluateGevCert01to08({ expectedSha: sha, publicSources: source })
    expect(result.steps.find(s => s.id === 'GEV-CERT.03')?.status).toBe('EVIDENCE_READY')
    expect(result.blockedOn).toContain('GEV-CERT.01')
    expect(result.blockedOn).toContain('GEV-CERT.04')
    expect(result.blockedOn).toContain('GEV-CERT.08')
  })
  it('does not accept a fixture canary without explicit permission, database or same deployment SHA', () => {
    const evidence = full()
    evidence.supabase!.sqlConnectionAccepted = false
    evidence.liveCanary!.deploymentSha = 'f'.repeat(40)
    evidence.canaryExplicitlyAuthorized = false
    const result = evaluateGevCert01to08(evidence)
    expect(result.blockedOn).toContain('GEV-CERT.01')
    expect(result.blockedOn).toContain('GEV-CERT.04')
    expect(result.blockedOn).toContain('GEV-CERT.05')
    expect(result.blockedOn).toContain('GEV-CERT.06')
    expect(result.blockedOn).toContain('GEV-CERT.08')
  })
  it('requires independently witnessed admission, real host drills, actual iPhone, and owner approval', () => {
    const evidence = full()
    evidence.independentlyMatched!.observedOnProductionDb = false
    evidence.liveRecovery!.observedOnProductionHost = false
    evidence.deviceAcceptance!.observedOnRealIphone = false
    evidence.ownerApproved = false
    const result = evaluateGevCert01to08(evidence)
    for (const n of ['GEV-CERT.05', 'GEV-CERT.06', 'GEV-CERT.07', 'GEV-CERT.08']) {
      expect(result.blockedOn).toContain(n)
    }
  })
  it('all-green synthetic fields only permit independent review, never production self-certification', () => {
    const result = evaluateGevCert01to08(full())
    expect(result.blockedOn).toEqual([])
    expect(result.status).toBe('READY_FOR_INDEPENDENT_REVIEW')
    expect(result.productionCertified).toBe(false)
    expect(result.authority).toBe('CERTIFICATION_EVIDENCE_REVIEW_ONLY')
  })
  it('server preflight cannot manufacture source, OIDC, iPhone or owner receipts from environment flags', () => {
    const result = getGevCertBlockedPreflight()
    expect(result.status).toBe('BLOCKED')
    expect(result.productionCertified).toBe(false)
    expect(result.blockedOn).toHaveLength(8)
  })
})
