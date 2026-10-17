import { describe, expect, it } from 'vitest'
import { currentGevLiveCloseoutPreflight, evaluateGevLiveCloseout, type GevLiveCloseoutEvidence } from './gev-live-closeout'

const sha = '1234567890abcdef1234567890abcdef12345678'
const full = (): GevLiveCloseoutEvidence => ({
  expectedSha: sha,
  deployment: { environment: 'production', sha, ready: true, verifiedVercelDeployment: true, deploymentId: 'dpl_verified_fixture' },
  ownerSessionVerified: true,
  authenticatedHealth: {
    status: 'READY', checkedAt: '2026-10-16T21:00:00Z',
    provider: { configured: true, reachable: true, usable: true, reportedSources: 1, healthySources: 1, fallbackSources: 0 },
    database: {
      configured: true, reachable: true,
      tables: {
        jhadina_spatial_evidence: true,
        jhadina_spatial_reality_candidates: true,
        jhadina_spatial_reality_admissions: true,
        jhadina_spatial_workspace_revisions: true,
        jhadina_knowledge_nodes: true,
        jhadina_knowledge_relations: true,
      },
    },
    deployment: { environment: 'production', commitSha: sha },
  },
  sourceRightsAndNetworkVerified: true,
  canaryIndependentlyVerified: true,
  liveCanary: {
    kind: 'GEV_LIVE_CANARY_V1', checkedAt: '2026-10-16T21:00:00Z',
    status: 'VERIFIED', sourceId: 'gev-usgs',
    evidenceId: 'gev:evidence:one', evidenceHash: 'a'.repeat(64),
    candidateId: 'spatial:candidate:one', admissionId: 'spatial:admission:one',
    decision: 'ACCEPT', durabilityVerified: true, admittedReality: true,
    deploymentSha: sha, checks: {
      databaseTables: 6, evidenceReadback: true, candidateReadback: true, admissionReadback: true,
    }, reasonCode: 'READBACK_AND_ADMISSION_VERIFIED',
  },
  recovery: {
    sha, persistentStoreRestart: true, identicalEvidenceIdempotent: true,
    sourceOutageFailClosed: true, identityRevocationFailClosed: true,
    tamperedReadbackRejected: true, observedOnLiveHost: true,
  },
  ownerApprovalRecorded: true,
})

describe('GEV-LIVE.13–.14 production certification boundaries', () => {
  it('returns an explicit BLOCKED certificate when no deployment or receipts exist', () => {
    const report = evaluateGevLiveCloseout({})
    expect(report.status).toBe('BLOCKED')
    expect(report.productionCertified).toBe(false)
    expect(report.blockedOn).toHaveLength(10)
    expect(report.expectedSha).toBeNull()
    expect(report.deployedSha).toBeNull()
  })
  it('never self-issues production PASS even when synthetic fields are all green', () => {
    const report = evaluateGevLiveCloseout(full())
    expect(report.blockedOn).toEqual([])
    expect(report.status).toBe('READY_FOR_INDEPENDENT_REVIEW')
    expect(report.productionCertified).toBe(false)
    expect(report.checks).toHaveLength(10)
  })
  it('detects preview, missing identity and mismatched deployments', () => {
    const evidence = full()
    evidence.deployment!.environment = 'preview'
    evidence.deployment!.sha = 'f'.repeat(40)
    evidence.ownerSessionVerified = false
    const report = evaluateGevLiveCloseout(evidence)
    expect(report.blockedOn).toContain('PRODUCTION_DEPLOYMENT')
    expect(report.blockedOn).toContain('SAME_SHA')
    expect(report.blockedOn).toContain('AUTHENTICATED_HEALTH')
    expect(report.blockedOn).toContain('SIX_TABLE_OIDC')
  })
  it('rejects a missing OIDC table and a mismatched canary SHA', () => {
    const evidence = full()
    evidence.authenticatedHealth!.database.tables.jhadina_knowledge_relations = false
    evidence.liveCanary!.deploymentSha = 'f'.repeat(40)
    const report = evaluateGevLiveCloseout(evidence)
    expect(report.blockedOn).toContain('SIX_TABLE_OIDC')
    expect(report.blockedOn).toContain('USGS_DURABLE_CANARY')
    expect(report.blockedOn).toContain('EVIDENCE_ADMISSION_READBACK')
  })
  it('never infers live drill success from source-only CI or a missing owner review', () => {
    const evidence = full()
    evidence.recovery!.observedOnLiveHost = false
    evidence.ownerApprovalRecorded = false
    evidence.sourceRightsAndNetworkVerified = false
    const report = evaluateGevLiveCloseout(evidence)
    expect(report.blockedOn).toContain('GEV_PROVIDER_RIGHTS')
    expect(report.blockedOn).toContain('LIVE_RESTART_RECOVERY')
    expect(report.blockedOn).toContain('LIVE_FAILURE_DRILLS')
    expect(report.blockedOn).toContain('OWNER_REVIEW')
  })
  it('ignores a fabricated VERIFIED canary without independent live verification', () => {
    const evidence = full()
    evidence.canaryIndependentlyVerified = false
    const report = evaluateGevLiveCloseout(evidence)
    expect(report.blockedOn).toContain('USGS_DURABLE_CANARY')
    expect(report.blockedOn).toContain('EVIDENCE_ADMISSION_READBACK')
  })
  it('the in-app preflight cannot infer operational readiness from mere env variables', () => {
    const old = process.env.VERCEL_GIT_COMMIT_SHA
    process.env.VERCEL_GIT_COMMIT_SHA = sha
    try {
      const report = currentGevLiveCloseoutPreflight()
      expect(report.status).toBe('BLOCKED')
      expect(report.productionCertified).toBe(false)
      expect(report.expectedSha).toBe(sha)
      expect(report.blockedOn).toContain('PRODUCTION_DEPLOYMENT')
    } finally {
      if (old === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
      else process.env.VERCEL_GIT_COMMIT_SHA = old
    }
  })
})
