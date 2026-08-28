import { createHash } from 'node:crypto'
import type { KnowledgePort, KnowledgeRecord } from '@jhadina/core-spine'
import type { PlannedResearchCase } from '@/lib/money-opportunities/research-planner'

/**
 * Projects persisted SAM research state into Jhadina Knowledge.
 * SAM remains the source of truth; this is a derived, idempotent projection.
 */
export function buildSamKnowledgeRecord(
  plan: PlannedResearchCase,
  now = new Date().toISOString(),
): KnowledgeRecord {
  const ready = plan.branches.filter((branch) => branch.status === 'READY').length
  const pending = plan.branches.filter((branch) => branch.status === 'PENDING').length
  const complete = plan.branches.filter((branch) => branch.status === 'COMPLETE').length
  const blocked = plan.branches.filter((branch) => branch.status === 'BLOCKED').length

  return {
    id: deterministicUuid(`sam:research-case:${plan.id}`),
    subject: plan.title,
    claim: `SAM research case ${plan.id} has ${plan.branches.length} research branches: ${ready} READY, ${pending} PENDING, ${complete} COMPLETE, ${blocked} BLOCKED.`,
    confidence: 1,
    evidence: [{
      id: deterministicUuid(`sam:research-case:evidence:${plan.id}`),
      claim: `Derived from persisted SAM research case ${plan.id}.`,
      confidence: 1,
      provenance: [{
        sourceKind: 'system',
        sourceId: `sam-research-case:${plan.id}`,
        capturedAt: now,
      }],
    }],
    createdAt: plan.createdAt,
    updatedAt: now,
  }
}

export async function projectSamResearchToKnowledge(
  knowledge: KnowledgePort,
  plan: PlannedResearchCase,
  now = new Date().toISOString(),
): Promise<KnowledgeRecord> {
  return knowledge.ingest(buildSamKnowledgeRecord(plan, now))
}

function deterministicUuid(input: string): string {
  const bytes = createHash('sha256').update(input).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
