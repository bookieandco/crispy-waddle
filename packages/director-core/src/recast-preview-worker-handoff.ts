import type { RecastPreviewPlan } from './recast-preview'

export type RecastPreviewStage =
  | 'tracking-review'
  | 'character-replace'
  | 'voice-sync'
  | 'render-preview'
  | 'independent-qc'
  | 'owner-review'

export interface RecastPreviewWorkerHandoff {
  schemaVersion: 'director.recast.worker-handoff.v1'
  projectId: string
  requestId: string
  sourceVideoAssetId: string
  replacementCharacterAssetId: string
  sourceAudioAssetId: string
  trackingArtifactId: string
  stages: readonly RecastPreviewStage[]
  maxDurationSeconds: 30
  outputPolicy: 'UNAPPROVED_PREVIEW_ONLY'
  workerConnection: 'DISABLED'
  executionPermit: null
  costAuthority: 'NONE'
  publicationAuthority: 'NONE'
  requiresFreshOwnerApproval: true
}

export function createRecastPreviewWorkerHandoff(plan: RecastPreviewPlan): RecastPreviewWorkerHandoff {
  if (plan.renderMode !== 'preview' || plan.environmentMode !== 'preserve-source' ||
    plan.audioMode !== 'resync-after-swap' ||
    plan.executionAuthority !== 'NONE' || plan.publicationAuthority !== 'NONE' ||
    plan.costAuthority !== 'NONE') {
    throw new Error('DIRECTOR_RECAST_WORKER_MODE_NOT_ADMITTED')
  }
  const request = plan.source.replacement
  const action = request.action
  const input = action.inputAssetIds
  const trackingArtifactId = action.parameters?.trackingArtifactId
  if (plan.id !== request.id || !action.projectId || input.length !== 2 ||
    typeof trackingArtifactId !== 'string' || !trackingArtifactId ||
    !plan.source.lipSync ||
    !plan.source.lipSync.sourceAudioAssetId) {
    throw new Error('DIRECTOR_RECAST_WORKER_LINEAGE_INVALID')
  }
  return Object.freeze({
    schemaVersion: 'director.recast.worker-handoff.v1',
    projectId: action.projectId,
    requestId: request.id,
    sourceVideoAssetId: input[0],
    replacementCharacterAssetId: input[1],
    sourceAudioAssetId: plan.source.lipSync.sourceAudioAssetId,
    trackingArtifactId,
    stages: Object.freeze([
      'tracking-review', 'character-replace', 'voice-sync',
      'render-preview', 'independent-qc', 'owner-review',
    ] as RecastPreviewStage[]),
    maxDurationSeconds: 30,
    outputPolicy: 'UNAPPROVED_PREVIEW_ONLY',
    workerConnection: 'DISABLED',
    executionPermit: null,
    costAuthority: 'NONE',
    publicationAuthority: 'NONE',
    requiresFreshOwnerApproval: true,
  })
}

/** QC reports are independent measurements made *after* a governed preview
 * execution. A worker returning synthetic metrics cannot approve its own work. */
export interface RecastPreviewQCMetrics {
  visualIdentity: number
  motionMatch: number
  environmentMatch: number
  edgeQuality: number
  lightingMatch: number
  voiceSync: number
  absoluteAudioOffsetMs: number
}

export interface RecastPreviewQCReport {
  previewAssetId: string
  sourceVideoAssetId: string
  replacementCharacterAssetId: string
  sourceAudioAssetId: string
  independentReviewerId: string
  workerProviderId: string
  outputSha256: string
  reviewedAt: string
  evidenceIds: readonly string[]
  metrics: RecastPreviewQCMetrics
  measured: boolean
}

export interface RecastPreviewQCDecision {
  qualityPassed: boolean
  issues: readonly string[]
  previewStatus: 'QC_REVIEWED_UNAPPROVED' | 'QC_REJECTED'
  approvedForTimeline: false
  publicationAuthority: 'NONE'
}

const qualityThresholds: Readonly<Record<Exclude<keyof RecastPreviewQCMetrics, 'absoluteAudioOffsetMs'>, number>> = {
  visualIdentity: .80,
  motionMatch: .85,
  environmentMatch: .90,
  edgeQuality: .80,
  lightingMatch: .80,
  voiceSync: .80,
}

export function evaluateRecastPreviewQC(
  handoff: RecastPreviewWorkerHandoff,
  report: RecastPreviewQCReport,
): RecastPreviewQCDecision {
  const issues: string[] = []
  if (handoff.executionPermit !== null ||
    handoff.workerConnection !== 'DISABLED' ||
    handoff.outputPolicy !== 'UNAPPROVED_PREVIEW_ONLY') {
    issues.push('DIRECTOR_RECAST_QC_WORKER_CONTRACT_INVALID')
  }
  if (!report.measured || !report.previewAssetId ||
    !report.independentReviewerId ||
    report.independentReviewerId === report.workerProviderId ||
    !report.workerProviderId || !report.reviewedAt ||
    !Number.isFinite(Date.parse(report.reviewedAt)) ||
    !/^[0-9a-f]{64}$/i.test(report.outputSha256) ||
    !Array.isArray(report.evidenceIds) || report.evidenceIds.length === 0 ||
    report.evidenceIds.some(ref => typeof ref !== 'string' || !ref.trim())) {
    issues.push('DIRECTOR_RECAST_QC_INDEPENDENT_EVIDENCE_REQUIRED')
  }
  if (report.sourceVideoAssetId !== handoff.sourceVideoAssetId ||
    report.replacementCharacterAssetId !== handoff.replacementCharacterAssetId ||
    report.sourceAudioAssetId !== handoff.sourceAudioAssetId ||
    report.previewAssetId === report.sourceVideoAssetId) {
    issues.push('DIRECTOR_RECAST_QC_SOURCE_LINEAGE_MISMATCH')
  }
  for (const [metric, threshold] of Object.entries(qualityThresholds) as [keyof typeof qualityThresholds, number][]) {
    const score = report.metrics[metric]
    if (!Number.isFinite(score) || score < threshold || score > 1) {
      issues.push('DIRECTOR_RECAST_QC_' + metric.toUpperCase() + '_FAIL')
    }
  }
  const offset = report.metrics.absoluteAudioOffsetMs
  if (!Number.isFinite(offset) || offset < 0 || offset > 80) {
    issues.push('DIRECTOR_RECAST_QC_AUDIO_OFFSET_FAIL')
  }
  return Object.freeze({
    qualityPassed: issues.length === 0,
    issues: Object.freeze(issues),
    previewStatus: issues.length === 0 ? 'QC_REVIEWED_UNAPPROVED' : 'QC_REJECTED',
    approvedForTimeline: false,
    publicationAuthority: 'NONE',
  })
}
