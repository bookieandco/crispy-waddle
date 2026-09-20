import type {
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core"
import type { PodJob } from "../pod/workflow"
import { buildAutomationDispatch, type AutomationDispatch } from "../pod/automation"

export interface CreativeIngressQueue {
  enqueue(input: {
    job: PodJob
    evidenceIds: readonly string[]
    actorId: string
    sourceAssetId: string
    intent?: string
    dispatch: AutomationDispatch
  }): Promise<{ receiptId: string }>
}

/**
 * Jhadina -> PupsonStuff/Creative Engine intelligence ingress.
 *
 * This bridge only creates the canonical initial POD job at photo_received.
 * It does not call image-generation providers, advance workflow stages,
 * upload to Printify, create orders, or approve customer artwork.
 */
export class PupsonStuffCreativeIntelligenceAdapter implements SubsystemIntelligenceAdapter {
  readonly subsystem = "creative-engine" as const

  constructor(private readonly queue: CreativeIngressQueue, private readonly now: () => Date = () => new Date()) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    if (!input.actorId.trim()) throw new Error("CREATIVE_INGRESS_ACTOR_REQUIRED")
    if (!input.assetId.trim()) throw new Error("CREATIVE_INGRESS_ASSET_REQUIRED")
    if (!input.evidence.length) throw new Error("CREATIVE_INGRESS_EVIDENCE_REQUIRED")

    const evidenceIds = input.evidence.map((evidence) => evidence.id)
    if (evidenceIds.some((id) => !id.startsWith(`asset:${input.assetId}:`))) {
      throw new Error("CREATIVE_INGRESS_EVIDENCE_NOT_ASSET_BOUND")
    }

    const creationId = `jhadina:${input.assetId}`
    const job: PodJob = {
      id: `pod-job:${input.assetId}`,
      creationId,
      stage: "photo_received",
      status: "queued",
      attempts: 0,
      updatedAt: this.now().toISOString(),
    }
    const dispatch = buildAutomationDispatch({ type: "creation.created", creationId }, job)
    const queued = await this.queue.enqueue({
      job,
      evidenceIds: Object.freeze([...evidenceIds]),
      actorId: input.actorId,
      sourceAssetId: input.assetId,
      intent: input.intent,
      dispatch,
    })

    return Object.freeze({
      subsystem: this.subsystem,
      acceptedEvidenceIds: Object.freeze([...evidenceIds]),
      receiptId: queued.receiptId,
    })
  }
}
