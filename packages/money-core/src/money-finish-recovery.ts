import { createHash } from 'node:crypto';
import { assertPaperLedgerEvent, type PaperLedgerEvent, type PaperLedgerStore } from './paper-ledger.js';

export type MoneyRecoveryStatus =
  | 'ORIGINAL_DATA_UNAVAILABLE'
  | 'SYNTHETIC_REPLAY_ONLY'
  | 'CONTENT_MATCHED_EXTERNAL_CERTIFICATION_REQUIRED';

export type MoneyRecoveryReport = Readonly<{
  paperRunId: string;
  status: MoneyRecoveryStatus;
  sourceIdentity: string | null;
  isolatedRestoreIdentity: string | null;
  rowCount: number;
  manifestHash: string | null;
  reasons: readonly string[];
  authority: 'AUDIT_ONLY';
  canAuthorizeLive: false;
}>;

// A row-by-row isolated restore check does not prove that the source was the lost
// production volume, that backup encryption worked, or that the host is durable.
function canonicalDigest(rows: readonly PaperLedgerEvent[], runId: string): string {
  const ids = new Set<string>();
  const normalized = rows.map(row => {
    assertPaperLedgerEvent(row);
    if (row.paperRunId !== runId || ids.has(row.eventId)) throw new Error('MONEY_FINISH_RESTORE_IDENTITY_CONFLICT');
    ids.add(row.eventId);
    return { id:row.eventId, hash:row.payloadHash, kind:row.kind, time:row.occurredAt };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function verifyIsolatedPaperRestore(input: Readonly<{
  paperRunId: string;
  origin: 'ORIGINAL_PERSISTENT' | 'SYNTHETIC' | 'UNAVAILABLE';
  source?: PaperLedgerStore;
  isolatedRestore?: PaperLedgerStore;
  sourceIdentity?: string;
  isolatedRestoreIdentity?: string;
  sourceEvidenceIds?: readonly string[];
  isolatedReadbackEvidenceIds?: readonly string[];
}>): Promise<MoneyRecoveryReport> {
  if (!input.paperRunId.trim()) throw new Error('MONEY_FINISH_RESTORE_RUN_REQUIRED');
  const common = {paperRunId:input.paperRunId, authority:'AUDIT_ONLY' as const, canAuthorizeLive:false as const};
  if (input.origin==='UNAVAILABLE') {
    return Object.freeze({...common, status:'ORIGINAL_DATA_UNAVAILABLE' as const,
      sourceIdentity:null, isolatedRestoreIdentity:null, rowCount:0, manifestHash:null,
      reasons:Object.freeze(['ORIGINAL_VOLUME_NOT_INDEPENDENTLY_AVAILABLE'])});
  }
  if (!input.source || !input.isolatedRestore || input.source===input.isolatedRestore ||
      !input.sourceIdentity?.trim() || !input.isolatedRestoreIdentity?.trim() ||
      input.sourceIdentity===input.isolatedRestoreIdentity ||
      !input.sourceEvidenceIds?.length || !input.isolatedReadbackEvidenceIds?.length) {
    throw new Error('MONEY_FINISH_RESTORE_INDEPENDENCE_REQUIRED');
  }
  const [sourceRows,restoredRows] = await Promise.all([
    input.source.list(input.paperRunId), input.isolatedRestore.list(input.paperRunId)
  ]);
  if (!sourceRows.length || !restoredRows.length) throw new Error('MONEY_FINISH_RESTORE_EMPTY');
  const expected = canonicalDigest(sourceRows,input.paperRunId);
  const actual = canonicalDigest(restoredRows,input.paperRunId);
  if (expected!==actual || sourceRows.length!==restoredRows.length) throw new Error('MONEY_FINISH_RESTORE_HASH_OR_COUNT_MISMATCH');
  return Object.freeze({
    ...common,
    status: input.origin==='SYNTHETIC' ? 'SYNTHETIC_REPLAY_ONLY' as const : 'CONTENT_MATCHED_EXTERNAL_CERTIFICATION_REQUIRED' as const,
    sourceIdentity:input.sourceIdentity,
    isolatedRestoreIdentity:input.isolatedRestoreIdentity,
    rowCount:sourceRows.length, manifestHash:expected,
    reasons:Object.freeze(input.origin==='SYNTHETIC'
      ? ['SYNTHETIC_DATA_CANNOT_CERTIFY_ORIGINAL_RESTORE']
      : ['HOST_DURABILITY_ENCRYPTION_AND_ORIGINAL_VOLUME_RECEIPTS_STILL_REQUIRED'])
  });
}
