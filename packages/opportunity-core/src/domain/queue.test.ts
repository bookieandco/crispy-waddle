import { CanonicalOpportunityQueue, freshestOpportunityEvidenceAt } from './queue.js'
import { adaptCommercialOpportunity } from '../adapters/commercial.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const older = adaptCommercialOpportunity({
  providerId: 'provider:growth-affiliate',
  externalId: 'same',
  kind: 'affiliate',
  title: 'Older',
  sourceUrl: 'https://example.test/old',
  sourceName: 'Fixture',
  capturedAt: '2026-09-18T00:00:00Z',
})
older.fitScore = 40
older.updatedAt = '2026-09-18T00:00:00Z'

const newer = {
  ...older,
  title: 'Newer',
  fitScore: 80,
  updatedAt: '2026-09-19T00:00:00Z',
  evidence: older.evidence.map((evidence) => ({ ...evidence, capturedAt: '2026-09-19T00:00:00Z' })),
}

const second = adaptCommercialOpportunity({
  providerId: 'provider:growth-creator',
  externalId: 'creator',
  kind: 'creator',
  title: 'Creator',
  sourceUrl: 'https://example.test/creator',
  sourceName: 'Fixture',
  capturedAt: '2026-09-19T00:00:00Z',
})
second.fitScore = 70

const queue = new CanonicalOpportunityQueue()
const ranked = queue.ingest([older, second, newer])
assert(queue.size() === 2, 'Queue must deduplicate by canonical opportunity id')
assert(ranked[0]?.opportunity.title === 'Newer', 'Newest version and higher score must win')
assert(freshestOpportunityEvidenceAt(newer) === '2026-09-19T00:00:00Z', 'Queue must surface evidence freshness')
assert(queue.list({ family: 'creator' }).length === 1, 'Queue must filter by family')


const inactive = { ...second, id: 'commercial:inactive', status: 'superseded' as const, updatedAt: '2026-09-19T02:00:00Z' }
queue.ingest([inactive])
assert(queue.list().every((entry) => entry.opportunity.id !== inactive.id), 'Active queue must hide inactive records without deleting them')
assert(queue.list({ includeInactive: true }).some((entry) => entry.opportunity.id === inactive.id), 'Inactive records must remain auditable')
