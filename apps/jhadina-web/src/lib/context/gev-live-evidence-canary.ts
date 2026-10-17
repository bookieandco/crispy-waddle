import {
  createGevSourcePolicyRegistry,
  createSpatialRealityAdmissionReadProvider,
  observationToEvidence,
  spatialEvidenceHash,
  stableSerialize,
  type SpatialContextPackage,
  type SpatialEvidence,
  type SpatialEvidenceStore,
  type SpatialRealityStore,
  type SpatialObservation,
} from '@jhadina/spatial-intelligence-core'
import { readGevLiveSourceGateway, type GatewaySnapshot } from './gev-live-source-gateway'
import { createSupabaseSpatialEvidenceStore } from './supabase-spatial-evidence-store'
import { createSupabaseSpatialRealityStore } from './supabase-spatial-reality-store'
import { createRuntimeServiceRoleClient } from '../supabase/service-role'

const SPATIAL_TABLES = [
  'jhadina_spatial_evidence', 'jhadina_spatial_reality_candidates',
  'jhadina_spatial_reality_admissions', 'jhadina_spatial_workspace_revisions',
  'jhadina_knowledge_nodes', 'jhadina_knowledge_relations',
] as const
const USGS_SOURCE = 'gev-usgs'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
const registry = createGevSourcePolicyRegistry()

export type GevLiveCanaryReceipt = {
  kind: 'GEV_LIVE_CANARY_V1'
  checkedAt: string
  status: 'DISABLED' | 'SOURCE_UNAVAILABLE' | 'IDENTITY_UNAVAILABLE' | 'EVIDENCE_FAILED_CLOSED' | 'DEFERRED' | 'VERIFIED'
  sourceId: 'gev-usgs'
  evidenceId: string | null
  evidenceHash: string | null
  candidateId: string | null
  admissionId: string | null
  decision: 'ACCEPT' | 'DEFER' | 'REJECT' | 'SUPERSEDE' | null
  durabilityVerified: boolean
  admittedReality: boolean
  deploymentSha: string | null
  checks: {
    databaseTables: number
    evidenceReadback: boolean
    candidateReadback: boolean
    admissionReadback: boolean
  }
  reasonCode: string
}

export type LiveCanaryOptions = {
  /** Allows deterministic tests; never enables the external HTTP route. */
  now?: () => string
  enabled?: boolean
  query?: () => Promise<GatewaySnapshot>
  evidenceStore?: SpatialEvidenceStore
  realityStore?: SpatialRealityStore
  /** Only a privileged client can pass this boundary. */
  checkPrivilegedTables?: () => Promise<boolean>
}

export async function probeGevLiveCanaryTables(): Promise<boolean> {
  const client = await createRuntimeServiceRoleClient().catch(() => null)
  if (!client) return false
  const checks = await Promise.all(SPATIAL_TABLES.map(async (table) => {
    try {
      const { error } = await client.from(table).select('*', { head: true, count: 'exact' })
      return !error
    } catch { return false }
  }))
  return checks.every(Boolean)
}

function isRecentObservedEvent(observation: SpatialObservation, now: string): boolean {
  if (observation.provenance.source_ref !== USGS_SOURCE ||
    observation.observation_type !== 'earthquake_event' ||
    observation.inference !== false || !observation.observed_at ||
    !observation.position || observation.entity.type !== 'earthquake') return false
  const difference = Date.parse(now) - Date.parse(observation.observed_at)
  return Number.isFinite(difference) && difference >= -FUTURE_TOLERANCE_MS && difference <= MAX_AGE_MS
}

function evidenceIntegrityMatches(actual: SpatialEvidence | undefined, expected: SpatialEvidence): boolean {
  if (!actual || actual.evidenceId !== expected.evidenceId) return false
  const { integrity, ...withoutIntegrity } = actual
  return integrity.contentHash === spatialEvidenceHash(withoutIntegrity)
    && stableSerialize(actual) === stableSerialize(expected)
}

export async function runGevLiveEvidenceCanary(options: LiveCanaryOptions = {}): Promise<GevLiveCanaryReceipt> {
  const at = (options.now ?? (() => new Date().toISOString()))()
  const emptyChecks = () => ({ databaseTables: 0, evidenceReadback: false, candidateReadback: false, admissionReadback: false })
  const receipt: GevLiveCanaryReceipt = {
    kind: 'GEV_LIVE_CANARY_V1', checkedAt: at, status: 'DISABLED', sourceId: USGS_SOURCE,
    evidenceId: null, evidenceHash: null, candidateId: null, admissionId: null,
    decision: null, durabilityVerified: false, admittedReality: false,
    deploymentSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    checks: emptyChecks(), reasonCode: 'GEV_CANARY_DISABLED',
  }
  // Fail closed unless an operator explicitly enables this one-source,
  // owner-authenticated POST route in the expected production environment.
  if (options.enabled !== true && !(options.enabled === undefined &&
    process.env.VERCEL_ENV === 'production' && process.env.JHADINA_GEV_LIVE_CANARY_ENABLED === 'true')) return receipt

  const privileged = await (options.checkPrivilegedTables ?? probeGevLiveCanaryTables)().catch(() => false)
  if (!privileged) return { ...receipt, status: 'IDENTITY_UNAVAILABLE', reasonCode: 'SIX_TABLE_PRIVILEGED_READ_UNAVAILABLE' }
  const checks = { ...emptyChecks(), databaseTables: SPATIAL_TABLES.length }
  const evidenceStore = options.evidenceStore ?? createSupabaseSpatialEvidenceStore()
  const realityStore = options.realityStore ?? createSupabaseSpatialRealityStore()
  if (!evidenceStore || !realityStore) {
    return { ...receipt, status: 'IDENTITY_UNAVAILABLE', checks, reasonCode: 'SPATIAL_DURABLE_STORES_UNAVAILABLE' }
  }

  const policy = registry.decide(USGS_SOURCE, 'model-input')
  if (!policy.allowed) return { ...receipt, status: 'SOURCE_UNAVAILABLE', checks, reasonCode: 'SOURCE_POLICY_DENIED' }

  try {
    const snapshot = await (options.query ?? (() => readGevLiveSourceGateway({
      purpose: 'model-input', domains: ['earthquake'],
    })))()
    const source = snapshot.sources.find((row) => row.sourceId === USGS_SOURCE)
    if (source?.status !== 'AVAILABLE' || source.observations.length === 0 ||
      snapshot.authority !== 'INTELLIGENCE_ONLY' || snapshot.persisted || snapshot.admittedReality) {
      return { ...receipt, status: 'SOURCE_UNAVAILABLE', checks, reasonCode: 'UPSTREAM_NOT_VERIFIED' }
    }
    const observation = source.observations.find((row) => isRecentObservedEvent(row, at))
    if (!observation) return { ...receipt, status: 'DEFERRED', checks, reasonCode: 'NO_RECENT_NON_DERIVED_OBSERVATION' }

    const evidence = observationToEvidence(observation, registry)
    await evidenceStore.append(evidence)
    const stored = await evidenceStore.get(evidence.evidenceId)
    if (!evidenceIntegrityMatches(stored, evidence)) {
      return { ...receipt, status: 'EVIDENCE_FAILED_CLOSED', checks,
        evidenceId: evidence.evidenceId, evidenceHash: evidence.integrity.contentHash,
        reasonCode: 'DURABLE_EVIDENCE_HASH_OR_READBACK_FAILED' }
    }
    checks.evidenceReadback = true
    const candidateId = `spatial:candidate:${evidence.integrity.contentHash}`
    const context: SpatialContextPackage = {
      subject: 'USGS observation provenance canary', geographicScope: null,
      temporalScope: { from: null, to: null, asOf: at },
      observations: [],
      evidence: [{
        id: evidence.evidenceId, source: evidence.source.provider,
        observedAt: evidence.timing.observedAt ?? evidence.timing.receivedAt,
        summary: 'Real-source USGS evidence canary (not pre-admitted Reality)', immutable: true,
      }],
      claims: [], reality: [], patterns: [], predictions: [], scenarios: [], hypotheses: [],
      sourceHealth: ['earthquake:available:1'], conflicts: [], uncertainty: [], limitations: [],
      workspaceRef: null, investigationRef: null, provenance: [],
    }
    const provider = createSpatialRealityAdmissionReadProvider({
      read: { read: async () => context },
      // Recovery: replaying exactly the same immutable evidence must produce
      // byte-identical candidate/admission rows after a worker restart. Never
      // manufacture a new admission creation time on an identical readback.
      evidenceStore, realityStore, now: () => evidence.timing.receivedAt,
      verifier: 'gev-live-07-manual-canary:v1', maxCandidates: 1,
    })
    const result = await provider.read({
      queryId: 'gev-live-07:manual', capability: 'READ_SPATIAL_CONTEXT',
      subject: 'USGS observation provenance canary', scope: null,
      temporalScope: { from: null, to: null, asOf: at },
      domains: ['earthquake'], evidenceRequired: true,
    }, 'owner-verified-by-route')
    // No acceptance based only on a success return from append: independently
    // read back the candidate and admission from the canonical Reality store.
    const candidate = await realityStore.getCandidate(candidateId)
    const expectedState = {
      position: evidence.payload.position,
      attributes: evidence.payload.attributes,
      sourceProvider: evidence.source.provider,
      observationId: evidence.observationId,
    }
    if (!candidate || candidate.candidateId !== candidateId ||
      candidate.entityId !== evidence.payload.entity.id ||
      candidate.determination !== 'observed' ||
      stableSerialize(candidate.evidenceRefs) !== stableSerialize([evidence.evidenceId]) ||
      stableSerialize(candidate.observationRefs) !== stableSerialize([evidence.observationId]) ||
      stableSerialize(candidate.state) !== stableSerialize(expectedState) ||
      !result?.claims.some((claim) => claim.id === candidateId)) {
      return { ...receipt, status: 'EVIDENCE_FAILED_CLOSED', checks,
        evidenceId: evidence.evidenceId, evidenceHash: evidence.integrity.contentHash,
        reasonCode: 'REALITY_CANDIDATE_READBACK_FAILED' }
    }
    checks.candidateReadback = true
    const admissions = await realityStore.getAdmissions(candidateId)
    const admission = admissions.find((row) => row.verifier === 'gev-live-07-manual-canary:v1' &&
      row.candidateId === candidateId &&
      row.admissionId === `spatial:admission:${evidence.integrity.contentHash}:${row.decision.toLowerCase()}:v1` &&
      stableSerialize(row.evidenceRefs) === stableSerialize([evidence.evidenceId]) &&
      row.rationale.length > 0)
    if (!admission) return {
      ...receipt, status: 'EVIDENCE_FAILED_CLOSED', checks,
      evidenceId: evidence.evidenceId, evidenceHash: evidence.integrity.contentHash,
      candidateId, reasonCode: 'REALITY_ADMISSION_READBACK_FAILED',
    }
    checks.admissionReadback = true
    const admitted = admission.decision === 'ACCEPT' &&
      Boolean(result.reality.some((ref) => ref.id === admission.admissionId))
    return {
      ...receipt, status: admitted ? 'VERIFIED' : 'DEFERRED',
      checks, evidenceId: evidence.evidenceId, evidenceHash: evidence.integrity.contentHash,
      candidateId, admissionId: admission.admissionId,
      decision: admission.decision, durabilityVerified: true,
      admittedReality: admitted,
      reasonCode: admitted ? 'READBACK_AND_ADMISSION_VERIFIED' : 'REALITY_ADMISSION_NOT_ACCEPTED',
    }
  } catch {
    return { ...receipt, status: 'EVIDENCE_FAILED_CLOSED', checks,
      reasonCode: 'SOURCE_OR_PERSISTENCE_OPERATION_FAILED' }
  }
}
