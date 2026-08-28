import { createHash } from 'node:crypto'
import type { KnowledgePort, KnowledgeRecord } from '@jhadina/core-spine'
import type { ResearchCasePlan } from './research'

/**
 * Projects persisted SAM research state into Jhadina Knowledge.
 * SAM remains the source of truth; this is a derived, idempotent projection.
 */
export function buildSamKnowledgeRecord(
  plan: ResearchCasePlan,
  now = new Date().toISOString(),
): KnowledgeRecord {
  return {
    id: deterministicUuid(`sam:research-case:${plan.researchCase.id}`),
    subject: plan.researchCase.title,
    claim: `SAM research case ${plan.researchCase.id} has ${plan.tasks.length} planned research tasks and status ${plan.researchCase.status}.`,
    confidence: 1,
    evidence: [{
      id: deterministicUuid(`sam:research-case:evidence:${plan.researchCase.id}`),
      claim: `Derived from persisted SAM research case ${plan.researchCase.id}.`,
      confidence: 1,
      provenance: [{
        sourceKind: 'system',
        sourceId: `sam-research-case:${plan.researchCase.id}`,
        capturedAt: now,
        locator: plan.researchCase.sourceUrl,
      }],
    }],
    createdAt: plan.researchCase.createdAt,
    updatedAt: now,
  }
}

export async function projectSamResearchToKnowledge(
  knowledge: KnowledgePort,
  plan: ResearchCasePlan,
  now = new Date().toISOString(),
): Promise<KnowledgeRecord> {
  const record = buildSamKnowledgeRecord(plan, now)
  return knowledge.ingest(record)
}

function deterministicUuid(input: string): string {
  const bytes = createHash('sha256').update(input).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
