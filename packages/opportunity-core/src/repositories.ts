import type { AlertDeliveryRecord } from './domain/alert-delivery.js'
import type { AlertEvent, WatchlistEntry } from './domain/watchlist.js'
import type { FeedbackEvent, VersionedAssessment } from './domain/feedback.js'

export interface WatchlistRepository {
  get(id: string): Promise<WatchlistEntry | undefined>
  listByUser(userId: string): Promise<WatchlistEntry[]>
  save(entry: WatchlistEntry): Promise<WatchlistEntry>
  delete(id: string): Promise<void>
}

export interface AlertEventRepository {
  get(id: string): Promise<AlertEvent | undefined>
  listByWatchlistEntry(watchlistEntryId: string): Promise<AlertEvent[]>
  saveIfAbsent(event: AlertEvent): Promise<{ event: AlertEvent; created: boolean }>
}

export interface AlertDeliveryRepository {
  get(id: string): Promise<AlertDeliveryRecord | undefined>
  getByIdempotencyKey(idempotencyKey: string): Promise<AlertDeliveryRecord | undefined>
  saveIfAbsent(record: AlertDeliveryRecord): Promise<{ record: AlertDeliveryRecord; created: boolean }>
  update(record: AlertDeliveryRecord): Promise<AlertDeliveryRecord>
}

export interface FeedbackRepository {
  get(id: string): Promise<FeedbackEvent | undefined>
  listBySubject(subjectId: string): Promise<FeedbackEvent[]>
  append(event: FeedbackEvent): Promise<FeedbackEvent>
}

export interface VersionedAssessmentRepository {
  get(id: string): Promise<VersionedAssessment | undefined>
  listBySubject(subjectId: string, assessmentType?: string): Promise<VersionedAssessment[]>
  append(assessment: VersionedAssessment): Promise<VersionedAssessment>
}

const clone = <T>(value: T): T => {
  if (value === undefined) return value
  return structuredClone(value)
}

export class InMemoryWatchlistRepository implements WatchlistRepository {
  private readonly entries = new Map<string, WatchlistEntry>()

  async get(id: string): Promise<WatchlistEntry | undefined> { return clone(this.entries.get(id)) }

  async listByUser(userId: string): Promise<WatchlistEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.userId === userId).map(clone)
  }

  async save(entry: WatchlistEntry): Promise<WatchlistEntry> {
    this.entries.set(entry.id, clone(entry))
    return clone(entry)
  }

  async delete(id: string): Promise<void> { this.entries.delete(id) }
}

export class InMemoryAlertEventRepository implements AlertEventRepository {
  private readonly events = new Map<string, AlertEvent>()
  private readonly fingerprints = new Map<string, string>()

  async get(id: string): Promise<AlertEvent | undefined> { return clone(this.events.get(id)) }

  async listByWatchlistEntry(watchlistEntryId: string): Promise<AlertEvent[]> {
    return [...this.events.values()].filter((event) => event.watchlistEntryId === watchlistEntryId).map(clone)
  }

  async saveIfAbsent(event: AlertEvent): Promise<{ event: AlertEvent; created: boolean }> {
    const key = `${event.watchlistEntryId}:${event.fingerprint}`
    const existingId = this.fingerprints.get(key)
    if (existingId) return { event: clone(this.events.get(existingId) as AlertEvent), created: false }
    this.events.set(event.id, clone(event))
    this.fingerprints.set(key, event.id)
    return { event: clone(event), created: true }
  }
}

export class InMemoryAlertDeliveryRepository implements AlertDeliveryRepository {
  private readonly records = new Map<string, AlertDeliveryRecord>()
  private readonly idempotency = new Map<string, string>()

  async get(id: string): Promise<AlertDeliveryRecord | undefined> { return clone(this.records.get(id)) }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AlertDeliveryRecord | undefined> {
    const id = this.idempotency.get(idempotencyKey)
    return id ? clone(this.records.get(id)) : undefined
  }

  async saveIfAbsent(record: AlertDeliveryRecord): Promise<{ record: AlertDeliveryRecord; created: boolean }> {
    const existingId = this.idempotency.get(record.idempotencyKey)
    if (existingId) return { record: clone(this.records.get(existingId) as AlertDeliveryRecord), created: false }
    this.records.set(record.id, clone(record))
    this.idempotency.set(record.idempotencyKey, record.id)
    return { record: clone(record), created: true }
  }

  async update(record: AlertDeliveryRecord): Promise<AlertDeliveryRecord> {
    if (!this.records.has(record.id)) throw new Error(`Unknown alert delivery: ${record.id}`)
    this.records.set(record.id, clone(record))
    return clone(record)
  }
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly events = new Map<string, FeedbackEvent>()

  async get(id: string): Promise<FeedbackEvent | undefined> { return clone(this.events.get(id)) }

  async listBySubject(subjectId: string): Promise<FeedbackEvent[]> {
    return [...this.events.values()]
      .filter((event) => event.opportunityId === subjectId || event.principalId === subjectId)
      .map(clone)
  }

  async append(event: FeedbackEvent): Promise<FeedbackEvent> {
    if (this.events.has(event.id)) throw new Error(`Duplicate feedback event: ${event.id}`)
    this.events.set(event.id, clone(event))
    return clone(event)
  }
}

export class InMemoryVersionedAssessmentRepository implements VersionedAssessmentRepository {
  private readonly assessments = new Map<string, VersionedAssessment>()

  async get(id: string): Promise<VersionedAssessment | undefined> { return clone(this.assessments.get(id)) }

  async listBySubject(subjectId: string, assessmentType?: string): Promise<VersionedAssessment[]> {
    return [...this.assessments.values()]
      .filter((assessment) => assessment.subjectId === subjectId && (!assessmentType || assessment.assessmentType === assessmentType))
      .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
      .map(clone)
  }

  async append(assessment: VersionedAssessment): Promise<VersionedAssessment> {
    if (this.assessments.has(assessment.id)) throw new Error(`Duplicate assessment: ${assessment.id}`)
    if (assessment.supersedesId && !this.assessments.has(assessment.supersedesId)) {
      throw new Error(`Assessment supersedes unknown version: ${assessment.supersedesId}`)
    }
    this.assessments.set(assessment.id, clone(assessment))
    return clone(assessment)
  }
}
