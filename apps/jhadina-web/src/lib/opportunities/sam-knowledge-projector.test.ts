import { describe, expect, it } from 'vitest'
import type { KnowledgePort, KnowledgeRecord } from '@jhadina/core-spine'
import type { ResearchCasePlan } from './research'
import { buildSamKnowledgeRecord, projectSamResearchToKnowledge } from './sam-knowledge-projector'

const plan: ResearchCasePlan = {
  researchCase: {
    id: 'research_sam-opportunity-1',
    userId: 'user-1',
    opportunityId: 'sam-opportunity-1',
    status: 'READY',
    title: 'Research: SAM opportunity',
    sourceName: 'SAM.gov',
    sourceUrl: 'https://sam.gov/opportunity/1',
    action: 'BID_NOW',
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  },
  tasks: Array.from({ length: 7 }, (_, index) => ({
    id: `research_sam-opportunity-1_task_${index + 1}`,
    caseId: 'research_sam-opportunity-1',
    kind: index < 4 ? ['VERIFY_SOURCE', 'VERIFY_ECONOMICS', 'VERIFY_REQUIREMENTS', 'VERIFY_DEADLINE'][index] as any : index === 4 ? 'ASSESS_CAPABILITY' : index === 5 ? 'ASSESS_COMPETITION' : 'VERIFY_SOURCE',
    title: `Task ${index + 1}`,
    required: true,
    status: index === 0 ? 'READY' : 'PENDING',
    createdAt: '2026-08-28T00:00:00.000Z',
  })),
}

function repository(): { port: KnowledgePort; records: Map<string, KnowledgeRecord> } {
  const records = new Map<string, KnowledgeRecord>()
  const port: KnowledgePort = {
    async ingest(record) { records.set(record.id, record); return record },
    async retrieve() { return [...records.values()] },
    async revise(id, record) { records.set(id, record); return record },
    async invalidate(id) { records.delete(id) },
  }
  return { port, records }
}

describe('SAM knowledge projection', () => {
  it('creates one stable knowledge record for repeated pulls', async () => {
    const { port, records } = repository()
    await projectSamResearchToKnowledge(port, plan, '2026-08-28T00:00:01.000Z')
    await projectSamResearchToKnowledge(port, plan, '2026-08-28T00:00:02.000Z')
    expect(records.size).toBe(1)
    expect([...records.values()][0]?.id).toBe(buildSamKnowledgeRecord(plan).id)
  })

  it('preserves the persisted SAM READY case status in the projection', () => {
    const record = buildSamKnowledgeRecord(plan)
    expect(record.claim).toContain('status READY')
    expect(record.evidence[0]?.provenance[0]?.sourceId).toBe('sam-research-case:research_sam-opportunity-1')
  })
})
