import { createHash } from 'node:crypto';
import type {
  PaperAutopilotEvaluation,
  PaperDecisionLearningRecord,
  PaperDecisionObservation,
  PaperDecisionResolution,
} from './paper-learning-loop.js';
import type {
  StrategyCalibration,
  StrategyLearningRecord,
  StrategyPromotionAssessment,
} from './autonomous-strategy-learning.js';

export type PaperLearningEventKind =
  | 'DECISION'
  | 'RESOLUTION'
  | 'DECISION_LEARNING'
  | 'STRATEGY_LEARNING'
  | 'CALIBRATION'
  | 'REVIEW'
  | 'AUTOPILOT';

export type PaperLearningPayload =
  | PaperDecisionObservation
  | PaperDecisionResolution
  | PaperDecisionLearningRecord
  | StrategyLearningRecord
  | StrategyCalibration
  | StrategyPromotionAssessment
  | PaperAutopilotEvaluation;

export type PaperLearningEvent = Readonly<{
  eventId: string;
  userId: string;
  paperRunId?: string;
  strategyId?: string;
  instrumentId?: string;
  kind: PaperLearningEventKind;
  occurredAt: string;
  payload: PaperLearningPayload;
  payloadHash: string;
  evidenceIds: readonly string[];
  authority: 'LEARNING_RECORD_ONLY';
  canAuthorizeLive: false;
}>;

export type PaperLearningAppendResult = Readonly<{
  disposition: 'INSERTED' | 'REPLAY';
  event: PaperLearningEvent;
}>;

export interface PaperLearningStore {
  append(
    event: PaperLearningEvent,
  ): Promise<PaperLearningAppendResult> | PaperLearningAppendResult;
  get(
    eventId: string,
  ): Promise<PaperLearningEvent | undefined> | PaperLearningEvent | undefined;
  listByUser(
    userId: string,
    limit?: number,
  ): Promise<readonly PaperLearningEvent[]> | readonly PaperLearningEvent[];
  listByStrategy(
    userId: string,
    strategyId: string,
    limit?: number,
  ): Promise<readonly PaperLearningEvent[]> | readonly PaperLearningEvent[];
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return { $moneyBigInt: value.toString() };
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function encodePaperLearningPayload(value: PaperLearningPayload): string {
  return JSON.stringify(canonicalize(value));
}

export function decodePaperLearningPayload(value: unknown): PaperLearningPayload {
  function revive(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(revive);
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      if (
        Object.keys(row).length === 1 &&
        typeof row.$moneyBigInt === 'string' &&
        /^-?\d+$/.test(row.$moneyBigInt)
      ) {
        return BigInt(row.$moneyBigInt);
      }
      return Object.fromEntries(
        Object.entries(row).map(([key, child]) => [key, revive(child)]),
      );
    }
    return item;
  }
  return revive(value) as PaperLearningPayload;
}

export function hashPaperLearningPayload(payload: PaperLearningPayload): string {
  return createHash('sha256')
    .update(encodePaperLearningPayload(payload))
    .digest('hex');
}

function assertIso(value: string, code: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code);
}

function payloadAuthority(payload: PaperLearningPayload): string | undefined {
  return (payload as { authority?: string }).authority;
}

function payloadCanAuthorizeLive(payload: PaperLearningPayload): boolean | undefined {
  return (payload as { canAuthorizeLive?: boolean }).canAuthorizeLive;
}

function assertPayloadBoundary(
  kind: PaperLearningEventKind,
  payload: PaperLearningPayload,
): void {
  const authority = payloadAuthority(payload);
  const canAuthorizeLive = payloadCanAuthorizeLive(payload);

  if (canAuthorizeLive !== false) {
    throw new Error('MONEY_PAPER_LEARNING_LIVE_AUTHORITY_FORBIDDEN');
  }

  if (kind === 'DECISION') {
    if (authority !== 'DECISION_RECORD_ONLY') {
      throw new Error('MONEY_PAPER_LEARNING_DECISION_AUTHORITY_INVALID');
    }
    return;
  }

  if (kind === 'AUTOPILOT') {
    if (authority !== 'PAPER_ONLY') {
      throw new Error('MONEY_PAPER_LEARNING_AUTOPILOT_AUTHORITY_INVALID');
    }
    return;
  }

  if (kind === 'REVIEW') {
    if (authority !== 'REVIEW_ONLY') {
      throw new Error('MONEY_PAPER_LEARNING_REVIEW_AUTHORITY_INVALID');
    }
    return;
  }

  if (authority !== 'LEARNING_ONLY') {
    throw new Error('MONEY_PAPER_LEARNING_AUTHORITY_INVALID');
  }
}

function validateLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('MONEY_PAPER_LEARNING_LIMIT_INVALID');
  }
  return limit;
}

export function createPaperLearningEvent(input: Readonly<{
  userId: string;
  kind: PaperLearningEventKind;
  occurredAt: string;
  payload: PaperLearningPayload;
  paperRunId?: string;
  strategyId?: string;
  instrumentId?: string;
  evidenceIds?: readonly string[];
}>): PaperLearningEvent {
  if (!input.userId.trim()) throw new Error('MONEY_PAPER_LEARNING_USER_REQUIRED');
  assertIso(input.occurredAt, 'MONEY_PAPER_LEARNING_TIME_INVALID');
  assertPayloadBoundary(input.kind, input.payload);

  const evidenceIds = Object.freeze([
    ...new Set([
      ...((input.payload as { evidenceIds?: readonly string[] }).evidenceIds ?? []),
      ...(input.evidenceIds ?? []),
    ]),
  ].sort());

  if (!evidenceIds.length) {
    throw new Error('MONEY_PAPER_LEARNING_EVIDENCE_REQUIRED');
  }

  const payloadHash = hashPaperLearningPayload(input.payload);
  const eventId =
    'paper-learning:' +
    createHash('sha256')
      .update(
        JSON.stringify({
          userId: input.userId,
          kind: input.kind,
          occurredAt: input.occurredAt,
          payloadHash,
          paperRunId: input.paperRunId,
          strategyId: input.strategyId,
          instrumentId: input.instrumentId,
        }),
      )
      .digest('hex');

  return Object.freeze({
    eventId,
    userId: input.userId,
    paperRunId: input.paperRunId,
    strategyId: input.strategyId,
    instrumentId: input.instrumentId,
    kind: input.kind,
    occurredAt: input.occurredAt,
    payload: input.payload,
    payloadHash,
    evidenceIds,
    authority: 'LEARNING_RECORD_ONLY',
    canAuthorizeLive: false,
  });
}

export function assertPaperLearningEvent(event: PaperLearningEvent): void {
  if (
    event.authority !== 'LEARNING_RECORD_ONLY' ||
    event.canAuthorizeLive !== false
  ) {
    throw new Error('MONEY_PAPER_LEARNING_EVENT_AUTHORITY_INVALID');
  }
  if (!event.eventId || !event.userId || !event.payloadHash) {
    throw new Error('MONEY_PAPER_LEARNING_EVENT_IDENTITY_REQUIRED');
  }
  assertIso(event.occurredAt, 'MONEY_PAPER_LEARNING_TIME_INVALID');
  assertPayloadBoundary(event.kind, event.payload);
  if (hashPaperLearningPayload(event.payload) !== event.payloadHash) {
    throw new Error('MONEY_PAPER_LEARNING_PAYLOAD_HASH_MISMATCH');
  }
  if (!event.evidenceIds.length) {
    throw new Error('MONEY_PAPER_LEARNING_EVIDENCE_REQUIRED');
  }
}

export class InMemoryPaperLearningStore implements PaperLearningStore {
  private readonly rows = new Map<string, PaperLearningEvent>();

  append(event: PaperLearningEvent): PaperLearningAppendResult {
    assertPaperLearningEvent(event);
    const prior = this.rows.get(event.eventId);
    if (prior) {
      if (
        prior.payloadHash !== event.payloadHash ||
        encodePaperLearningPayload(prior.payload) !==
          encodePaperLearningPayload(event.payload)
      ) {
        throw new Error('MONEY_PAPER_LEARNING_EVENT_CONFLICT');
      }
      return Object.freeze({ disposition: 'REPLAY', event: prior });
    }
    this.rows.set(event.eventId, event);
    return Object.freeze({ disposition: 'INSERTED', event });
  }

  get(eventId: string): PaperLearningEvent | undefined {
    return this.rows.get(eventId);
  }

  listByUser(userId: string, limit = 200): readonly PaperLearningEvent[] {
    validateLimit(limit);
    return Object.freeze(
      [...this.rows.values()]
        .filter((event) => event.userId === userId)
        .sort(
          (a, b) =>
            b.occurredAt.localeCompare(a.occurredAt) ||
            b.eventId.localeCompare(a.eventId),
        )
        .slice(0, limit),
    );
  }

  listByStrategy(
    userId: string,
    strategyId: string,
    limit = 200,
  ): readonly PaperLearningEvent[] {
    validateLimit(limit);
    return Object.freeze(
      [...this.rows.values()]
        .filter(
          (event) =>
            event.userId === userId && event.strategyId === strategyId,
        )
        .sort(
          (a, b) =>
            b.occurredAt.localeCompare(a.occurredAt) ||
            b.eventId.localeCompare(a.eventId),
        )
        .slice(0, limit),
    );
  }
}
