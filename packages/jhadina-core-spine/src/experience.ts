import type { ActionResult, AuditEvent, EvidenceRef, Experience, MemoryProposal } from './types.js';

export const EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ExperienceOutcome =
  | 'requested'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'denied'
  | 'started'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'corrected'
  | 'observed';

export type ExperienceEventType =
  | 'action.requested'
  | 'action.approval_required'
  | 'action.approved'
  | 'action.denied'
  | 'action.started'
  | 'action.completed'
  | 'action.failed'
  | 'memory.proposed'
  | 'memory.approved'
  | 'memory.rejected'
  | 'decision.authorized'
  | 'decision.denied'
  | 'experience.corrected'
  | (string & {});

export interface ExperienceEvent extends Experience {
  schemaVersion: typeof EXPERIENCE_SCHEMA_VERSION;
  eventType: ExperienceEventType;
  recordedAt: string;
  correlationId?: string;
  causationId?: string;
  outcome?: ExperienceOutcome;
  sensitivity: 'public' | 'private' | 'sensitive' | 'restricted';
  provenance: {
    sourceId?: string;
    sourceType: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ExperienceAppendResult {
  accepted: boolean;
  duplicate: boolean;
  conflict: boolean;
  eventId: string;
}

export interface ExperiencePort {
  append(event: ExperienceEvent): Promise<ExperienceAppendResult>;
}

/**
 * Deterministic recorder used by tests and composition roots that provide
 * their own durable implementation. It is intentionally append-only and
 * idempotent by event id. Reusing an event id for different content is a
 * conflict and is rejected rather than silently treated as a duplicate.
 */
export class InMemoryExperienceRecorder implements ExperiencePort {
  private readonly events = new Map<string, ExperienceEvent>();

  async append(event: ExperienceEvent): Promise<ExperienceAppendResult> {
    const existing = this.events.get(event.id);
    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(event)) {
        return { accepted: true, duplicate: true, conflict: false, eventId: existing.id };
      }
      return { accepted: false, duplicate: false, conflict: true, eventId: event.id };
    }
    this.events.set(event.id, structuredClone(event));
    return { accepted: true, duplicate: false, conflict: false, eventId: event.id };
  }

  snapshot(): ExperienceEvent[] {
    return [...this.events.values()].map((event) => structuredClone(event));
  }
}

export interface ExperienceFactoryInput {
  id: string;
  occurredAt: string;
  source: string;
  domain?: string;
  actor: Experience['actor'];
  content: string;
  evidence?: EvidenceRef[];
  eventType: ExperienceEventType;
  recordedAt?: string;
  correlationId?: string;
  causationId?: string;
  outcome?: ExperienceOutcome;
  sensitivity?: ExperienceEvent['sensitivity'];
  provenance?: ExperienceEvent['provenance'];
  metadata?: ExperienceEvent['metadata'];
}

export function createExperienceEvent(input: ExperienceFactoryInput): ExperienceEvent {
  return {
    id: input.id,
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    source: input.source,
    domain: input.domain,
    actor: input.actor,
    content: redactExperienceContent(input.content),
    evidence: input.evidence ?? [],
    schemaVersion: EXPERIENCE_SCHEMA_VERSION,
    eventType: input.eventType,
    correlationId: input.correlationId,
    causationId: input.causationId,
    outcome: input.outcome,
    sensitivity: input.sensitivity ?? 'private',
    provenance: input.provenance ?? { sourceType: input.source },
    metadata: input.metadata,
  };
}

export function experienceFromAuditEvent(event: AuditEvent): ExperienceEvent {
  return createExperienceEvent({
    id: `audit:${event.id}`,
    occurredAt: event.occurredAt,
    source: 'core-audit',
    domain: 'audit',
    actor: normalizeActor(event.actor),
    content: `Audit event ${event.type} for ${event.subjectId}`,
    eventType: mapAuditEventType(event.type),
    sensitivity: 'sensitive',
    provenance: { sourceId: event.id, sourceType: 'audit-event' },
    metadata: {
      subjectId: event.subjectId,
    },
  });
}

export function experienceFromActionResult(
  result: ActionResult,
  input: {
    actionId: string;
    source?: string;
    domain?: string;
    correlationId?: string;
    actor?: Experience['actor'];
    auditStatus?: 'complete' | 'incomplete';
  },
): ExperienceEvent {
  const outcome: ExperienceOutcome = result.success ? 'completed' : 'failed';
  const metadata: ExperienceEvent['metadata'] = {
    auditStatus: input.auditStatus ?? 'complete',
  };
  if (input.auditStatus === 'incomplete') {
    metadata.auditWarning = 'external-action-completed-but-completion-audit-incomplete';
  }
  return createExperienceEvent({
    id: `action-result:${result.id}`,
    occurredAt: result.completedAt,
    source: input.source ?? 'action-core',
    domain: input.domain ?? 'action',
    actor: input.actor ?? 'jhadina',
    content: result.success ? `Action ${input.actionId} completed.` : `Action ${input.actionId} failed.`,
    eventType: result.success ? 'action.completed' : 'action.failed',
    outcome,
    correlationId: input.correlationId ?? input.actionId,
    provenance: { sourceId: result.id, sourceType: 'action-result' },
    sensitivity: 'sensitive',
    metadata,
  });
}

export function experienceFromMemoryProposal(
  proposal: MemoryProposal,
  source = 'memory-core',
  actor: Experience['actor'] = 'user',
): ExperienceEvent {
  const approved = proposal.disposition === 'SAVE';
  const rejected = proposal.disposition === 'IGNORE';
  return createExperienceEvent({
    id: `memory-proposal:${proposal.id}:${proposal.disposition.toLowerCase()}`,
    occurredAt: new Date().toISOString(),
    source,
    domain: 'memory',
    actor,
    content: approved ? 'Memory proposal approved.' : rejected ? 'Memory proposal rejected.' : 'Memory proposal observed.',
    eventType: approved ? 'memory.approved' : rejected ? 'memory.rejected' : 'memory.proposed',
    outcome: approved ? 'approved' : rejected ? 'rejected' : 'proposed',
    evidence: proposal.evidence,
    provenance: { sourceId: proposal.id, sourceType: 'memory-proposal' },
    sensitivity: 'sensitive',
  });
}

function mapAuditEventType(type: string): ExperienceEventType {
  switch (type) {
    case 'DECISION_AUTHORIZED':
      return 'decision.authorized';
    case 'POLICY_DENIED':
      return 'decision.denied';
    case 'ACTION_COMPLETED':
      return 'action.completed';
    case 'ACTION_FAILED':
      return 'action.failed';
    default:
      return `audit.${type.toLowerCase()}`;
  }
}

function normalizeActor(actor: string): Experience['actor'] {
  switch (actor.toLowerCase()) {
    case 'user':
      return 'user';
    case 'jhadina':
      return 'jhadina';
    case 'external':
      return 'external';
    default:
      return 'system';
  }
}

/** Remove common credential/token-shaped material before it enters Experience. */
function redactExperienceContent(content: string): string {
  return content
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(secret\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(password\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}
