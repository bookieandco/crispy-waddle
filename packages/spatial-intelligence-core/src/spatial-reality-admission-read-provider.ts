import type { EvidenceRef } from '@jhadina/core-spine'
import type { SpatialEvidence } from './evidence.js'
import type { SpatialEvidenceStore } from './evidence-store.js'
import type { SpatialContextPackage, SpatialContextReadProvider } from './integration.js'
import { evaluateSpatialRealityAdmission } from './reality-admission.js'
import type { RealityAdmission, SpatialRealityCandidate, SpatialRealityStore } from './reality.js'
import type { SpatialQueryPlan } from './spatial-pipeline.js'

export type SpatialRealityAdmissionReadProviderOptions = {
  read: SpatialContextReadProvider
  evidenceStore: SpatialEvidenceStore
  realityStore: SpatialRealityStore
  verifier?: string
  now?: () => string
  maxCandidates?: number
}

const asStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  : []

const sourcePolicyLimitations = (evidence: SpatialEvidence): string[] => {
  const policy = evidence.payload.attributes.sourcePolicy
  return policy && typeof policy === 'object'
    ? asStringArray((policy as Record<string, unknown>).limitations)
    : []
}

const fallbackEvidence = (evidence: SpatialEvidence): boolean => {
  if (evidence.payload.attributes.fallbackActive === true) return true
  const sourceKind = typeof evidence.payload.attributes.sourceKind === 'string'
    ? evidence.payload.attributes.sourceKind.toLowerCase()
    : ''
  return sourceKind === 'fallback' || sourceKind === 'streetview' || sourceKind === 'synthetic'
}

const entityIdFrom = (evidence: SpatialEvidence): string | null => {
  const value = evidence.payload.entity.id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const candidateFromEvidence = (evidence: SpatialEvidence, createdAt: string): SpatialRealityCandidate | null => {
  const entityId = entityIdFrom(evidence)
  if (!entityId || !evidence.timing.observedAt) return null
  return {
    candidateId: `spatial:candidate:${evidence.integrity.contentHash}`,
    entityId,
    state: {
      position: evidence.payload.position,
      attributes: evidence.payload.attributes,
      sourceProvider: evidence.source.provider,
      observationId: evidence.observationId,
    },
    determination: 'observed',
    evidenceRefs: [evidence.evidenceId],
    observationRefs: [evidence.observationId],
    fusionRefs: [],
    createdAt,
    validFrom: evidence.timing.observedAt,
    validTo: null,
    limitations: sourcePolicyLimitations(evidence),
  }
}

const candidateRef = (candidate: SpatialRealityCandidate): EvidenceRef => ({
  id: candidate.candidateId,
  source: 'spatial-reality-candidate',
  observedAt: candidate.validFrom ?? candidate.createdAt,
  summary: `Reality candidate for ${candidate.entityId} (${candidate.determination})`,
  immutable: true,
})

const realityRef = (candidate: SpatialRealityCandidate, admission: RealityAdmission): EvidenceRef => ({
  id: admission.admissionId,
  source: 'spatial-reality-admission',
  observedAt: candidate.validFrom ?? admission.createdAt,
  summary: `Admitted spatial reality for ${candidate.entityId}`,
  immutable: true,
})

const uniqueRefs = (refs: EvidenceRef[]): EvidenceRef[] => {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false
    seen.add(ref.id)
    return true
  })
}

/**
 * Governed promotion layer over an evidence-only SpatialContextReadProvider.
 * It can only evaluate evidence that was durably persisted and read back from
 * SpatialEvidenceStore; raw observations never enter this admission path.
 */
export class SpatialRealityAdmissionReadProvider implements SpatialContextReadProvider {
  private readonly verifier: string
  private readonly now: () => string
  private readonly maxCandidates: number

  constructor(private readonly options: SpatialRealityAdmissionReadProviderOptions) {
    this.verifier = options.verifier ?? 'gev-production-admission:v1'
    this.now = options.now ?? (() => new Date().toISOString())
    this.maxCandidates = options.maxCandidates ?? 100
    if (!this.verifier) throw new Error('SPATIAL_REALITY_VERIFIER_REQUIRED')
    if (!Number.isInteger(this.maxCandidates) || this.maxCandidates < 1 || this.maxCandidates > 1_000) {
      throw new Error('SPATIAL_REALITY_MAX_CANDIDATES_INVALID')
    }
  }

  async read(plan: SpatialQueryPlan, userId: string): Promise<SpatialContextPackage | undefined> {
    const pkg = await this.options.read.read(plan, userId)
    if (!pkg) return undefined

    const claims: EvidenceRef[] = []
    const reality: EvidenceRef[] = []
    const limitations = [...pkg.limitations]
    const evidenceRefs = pkg.evidence.slice(0, this.maxCandidates)

    if (pkg.evidence.length > evidenceRefs.length) {
      limitations.push(`Reality admission bounded to ${this.maxCandidates} evidence item(s) for this read.`)
    }

    for (const ref of evidenceRefs) {
      try {
        const evidence = await this.options.evidenceStore.get(ref.id)
        if (!evidence) {
          limitations.push(`Reality admission skipped ${ref.id}: durable evidence was not readable.`)
          continue
        }

        const createdAt = this.now()
        const candidate = candidateFromEvidence(evidence, createdAt)
        if (!candidate) {
          limitations.push(`Reality admission skipped ${ref.id}: source observation time or entity identity is unavailable.`)
          continue
        }

        await this.options.realityStore.appendCandidate(candidate)
        claims.push(candidateRef(candidate))

        const isFallback = fallbackEvidence(evidence)
        const result = evaluateSpatialRealityAdmission({
          candidate,
          verifier: this.verifier,
          evidenceAvailable: new Set([evidence.evidenceId]),
          fallbackEvidenceRefs: isFallback ? new Set([evidence.evidenceId]) : new Set(),
          freshEvidenceRefs: evidence.coverage.freshness === 'fresh' ? new Set([evidence.evidenceId]) : new Set(),
          requiredNonFallbackEvidence: 1,
          requiredFreshEvidence: 1,
          createdAt,
        })
        const admission: RealityAdmission = {
          admissionId: `spatial:admission:${evidence.integrity.contentHash}:${result.decision.toLowerCase()}:v1`,
          candidateId: candidate.candidateId,
          decision: result.decision,
          verifier: this.verifier,
          evidenceRefs: result.evidenceRefs,
          rationale: result.rationale,
          createdAt,
        }
        await this.options.realityStore.appendAdmission(admission)

        if (result.decision === 'ACCEPT') reality.push(realityRef(candidate, admission))
        else limitations.push(`Reality admission ${result.decision.toLowerCase()} for ${candidate.entityId}: ${result.rationale.join(' | ')}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        limitations.push(`Reality admission failed closed for ${ref.id}: ${message}`)
      }
    }

    return {
      ...pkg,
      claims: uniqueRefs([...pkg.claims, ...claims]),
      reality: uniqueRefs([...pkg.reality, ...reality]),
      limitations: [...new Set(limitations)].sort(),
    }
  }
}

export const createSpatialRealityAdmissionReadProvider = (
  options: SpatialRealityAdmissionReadProviderOptions,
): SpatialRealityAdmissionReadProvider => new SpatialRealityAdmissionReadProvider(options)
