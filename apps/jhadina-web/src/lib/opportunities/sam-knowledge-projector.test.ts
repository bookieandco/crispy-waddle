import { describe, expect, it } from 'vitest'
import type { KnowledgePort, KnowledgeRecord } from '@jhadina/core-spine'
import { planResearchCase } from '@/lib/money-opportunities/research-planner'
import type { MoneyActionItem } from '@/lib/money-opportunities/action-queue'
import { buildSamKnowledgeRecord, projectSamResearchToKnowledge } from './sam-knowledge-projector'

const action: MoneyActionItem = {
  opportunityId: 'sam-opportunity-1',
  action: 'BID_NOW',
  priority: 'HIGH',
  estimatedValue: 100000,
  estimatedMarginPercent: 30,
  capabilityGap: false,
  rationale: ['regression'],
}

const plan = planResearchCase({ action, title: 'SAM opportunity', now: new Date('2026-08-28T00:00:00.000Z') })!

function repository(): { port: KnowledgePort; records: Map<string, KnowledgeRecord> } {
  const records = new Map<string, KnowledgeRecord>()
  const port: KnowledgePort = {
    async ingest(record) { records.set(record.id, record); return record },
    async retrieve() { return [...records.values()] },
    async revise(id, record) { records.set(id, record); return record },
    async invalidate() {},
  }
  return { port, records }
}

describe('SAM knowledge projection', () => {
  it('creates one stable knowledge record for repeated pulls', async () => {
    const { port, records } = repository()
    await projectSamResearchToKnowledge(port, plan!, '2026-08-28T00:00:01.000Z')
    await projectSamResearchToKnowledge(port, plan!, '2026-08-28T00:00:02.000Z')
    expect(records.size).toBe(1)
    expect([...records.values()][0]?.id).toBe(buildSamKnowledgeRecord(plan!).id)
  })

  it('projects all seven SAM research branches and preserves READY/PENDING state', () => {
    const readyPlan = { ...plan!, branches: plan!.branches.map((branch, index) => ({ ...branch, status: index === 0 ? 'READY' as const : 'PENDING' as const })) }
    const record = buildSamKnowledgeRecord(readyPlan)
    expect(readyPlan.branches).toHaveLength(7)
    expect(record.claim).toContain('7 research branches: 1 READY, 6 PENDING')
    expect(record.evidence[0]?.provenance[0]?.sourceId).toBe('sam-research-case:research-sam-opportunity-1')
  })
})
