import { InMemoryKnowledgeRepository } from './knowledge-repository.js'
import type { KnowledgeRecord } from './knowledge.js'

const record: KnowledgeRecord = {
  id: 'knowledge-1',
  subject: 'sam-opportunity',
  claim: 'The opportunity requires cybersecurity experience',
  confidence: 0.9,
  evidence: [{
    id: 'evidence-1',
    claim: 'The solicitation lists cybersecurity experience',
    confidence: 0.95,
    provenance: [{ sourceKind: 'domain', sourceId: 'sam-1', capturedAt: '2026-08-28T00:00:00.000Z' }],
  }],
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
}

async function runKnowledgeRepositoryChecks(): Promise<void> {
  const repository = new InMemoryKnowledgeRepository()
  await repository.ingest(record)

  const matches = await repository.retrieve({ text: 'cybersecurity', limit: 10 })
  if (matches.length !== 1 || matches[0]?.id !== record.id) throw new Error('Knowledge retrieval failed')
  if (matches[0]?.evidence[0]?.provenance[0]?.sourceId !== 'sam-1') throw new Error('Knowledge provenance was not preserved')

  const revised: KnowledgeRecord = { ...record, claim: 'The opportunity requires verified cybersecurity experience', updatedAt: '2026-08-28T01:00:00.000Z' }
  await repository.revise(record.id, revised)
  const revisedMatches = await repository.retrieve({ subject: 'sam-opportunity' })
  if (revisedMatches[0]?.claim !== revised.claim) throw new Error('Knowledge revision failed')

  await repository.invalidate(record.id, 'superseded')
  if ((await repository.retrieve({ subject: 'sam-opportunity' })).length !== 0) throw new Error('Knowledge invalidation failed')

  let rejected = false
  try {
    await repository.ingest({ ...record, id: 'invalid', confidence: 2 })
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('Invalid confidence was accepted')
}

void runKnowledgeRepositoryChecks()
