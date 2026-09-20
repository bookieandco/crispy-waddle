import type { InferenceRecord, IntelligenceInferenceLedger } from './intelligence-fabric.js';

export interface InferenceTelemetry {
  readonly canonicalModelId?: string;
  readonly providerModelId?: string;
  readonly registryVersion?: number;
  readonly fallbackIndex?: number;
  readonly latencyMs?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly estimatedCostMicros?: number;
  readonly criticOutcome?: 'not_required' | 'accepted' | 'deferred' | 'unavailable';
  readonly verifierOutcome?: 'accepted' | 'deferred' | 'rejected';
}

export interface DurableInferenceRecord extends InferenceRecord {
  readonly telemetry?: InferenceTelemetry;
}

export interface InferenceLedgerSink {
  append(record: DurableInferenceRecord): Promise<void>;
}

/**
 * Append-only inference ledger boundary. Raw prompts, ContextPacket text,
 * model responses, and evidence summaries are intentionally excluded.
 */
export class DurableInferenceLedger implements IntelligenceInferenceLedger {
  constructor(private readonly sink: InferenceLedgerSink) {}

  async append(record: InferenceRecord): Promise<void> {
    validateBaseRecord(record);
    await this.sink.append(freezeRecord(record));
  }

  async appendWithTelemetry(record: InferenceRecord, telemetry: InferenceTelemetry): Promise<void> {
    validateBaseRecord(record);
    validateTelemetry(telemetry);
    await this.sink.append(freezeRecord({ ...record, telemetry: Object.freeze({ ...telemetry }) }));
  }
}

export class InMemoryInferenceLedgerSink implements InferenceLedgerSink {
  private readonly records: DurableInferenceRecord[] = [];
  async append(record: DurableInferenceRecord): Promise<void> { this.records.push(record); }
  snapshot(): readonly DurableInferenceRecord[] { return Object.freeze([...this.records]); }
}

function validateBaseRecord(record: InferenceRecord): void {
  if (!record.inferenceId || !record.taskId || !record.contextHash || !record.provider || !record.observedAt) {
    throw new Error('INFERENCE_LEDGER_REQUIRED_FIELD_MISSING');
  }
  if (!/^[a-f0-9]{64}$/i.test(record.contextHash)) throw new Error('INFERENCE_LEDGER_CONTEXT_HASH_INVALID');
  if (record.outcome === 'succeeded' && !record.proposalId) throw new Error('INFERENCE_LEDGER_SUCCESS_PROPOSAL_REQUIRED');
  if (record.outcome === 'failed' && !record.errorCode) throw new Error('INFERENCE_LEDGER_FAILURE_CODE_REQUIRED');
}

function validateTelemetry(t: InferenceTelemetry): void {
  for (const [key, value] of Object.entries(t)) {
    if ((key.endsWith('Ms') || key.endsWith('Tokens') || key.endsWith('Micros') || key === 'fallbackIndex' || key === 'registryVersion') && value !== undefined) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`INFERENCE_LEDGER_TELEMETRY_INVALID:${key}`);
    }
  }
}

function freezeRecord(record: DurableInferenceRecord): DurableInferenceRecord {
  return Object.freeze({ ...record, evidenceIds: Object.freeze([...record.evidenceIds]) });
}
