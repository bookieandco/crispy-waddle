import type { ResearchSignal } from './cultural-ingestion.js';

export interface EvidenceRecord {
  id: string;
  canonicalUrl: string;
  contentHash: string;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
  verificationConfidence: number;
  supportingSignalIds: string[];
}

export interface EvidenceStore {
  get(id: string): EvidenceRecord | undefined;
  put(record: EvidenceRecord): void;
}

export interface ResearchEvidenceResult {
  signal: ResearchSignal;
  evidence: EvidenceRecord;
  duplicate: boolean;
}

function canonicalize(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.searchParams.sort();
  return parsed.toString();
}

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Durable evidence identity: canonical URL + content hash, preserving provenance without trusting discovery. */
export class ResearchEvidenceLedger {
  constructor(private readonly store: EvidenceStore) {}

  async record(signal: ResearchSignal): Promise<ResearchEvidenceResult> {
    const canonicalUrl = canonicalize(signal.sourceUrl);
    const contentHash = await digest(`${signal.title}\n${signal.summary}`);
    const id = `evidence:${await digest(`${canonicalUrl}:${contentHash}`)}`;
    const existing = this.store.get(id);
    const now = new Date().toISOString();
    const evidence: EvidenceRecord = existing
      ? { ...existing, lastSeenAt: now, observationCount: existing.observationCount + 1, supportingSignalIds: [...new Set([...existing.supportingSignalIds, signal.id])], verificationConfidence: Math.max(existing.verificationConfidence, signal.verification.confidence) }
      : { id, canonicalUrl, contentHash, source: signal.source, firstSeenAt: now, lastSeenAt: now, observationCount: 1, verificationConfidence: signal.verification.confidence, supportingSignalIds: [signal.id] };
    this.store.put(evidence);
    return { signal: { ...signal, sourceUrl: canonicalUrl }, evidence, duplicate: Boolean(existing) };
  }
}
