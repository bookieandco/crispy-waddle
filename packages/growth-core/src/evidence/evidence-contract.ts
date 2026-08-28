import type { GrowthId, ISODateTime, Provenance } from '../domain/types.js';

export type EvidenceKind =
  | 'article'
  | 'video'
  | 'social_post'
  | 'review'
  | 'community_thread'
  | 'product_signal'
  | 'creative'
  | 'document'
  | 'other';

export interface EvidenceItem {
  id: GrowthId;
  kind: EvidenceKind;
  title: string;
  source: string;
  uri?: string;
  capturedAt: ISODateTime;
  text?: string;
  author?: string;
  metrics?: Readonly<Record<string, number>>;
  tags?: readonly string[];
  provenance: Provenance;
}

export interface EvidenceConnector {
  readonly id: string;
  readonly supportedKinds: readonly EvidenceKind[];
  ingest(input: EvidenceIngestRequest): Promise<readonly EvidenceItem[]>;
}

export interface EvidenceIngestRequest {
  source: string;
  uri?: string;
  query?: string;
  since?: ISODateTime;
  limit?: number;
  metadata?: Readonly<Record<string, string>>;
}

export interface EvidenceBundle {
  id: GrowthId;
  source: string;
  capturedAt: ISODateTime;
  items: readonly EvidenceItem[];
}

export function createEvidenceBundle(
  id: GrowthId,
  source: string,
  capturedAt: ISODateTime,
  items: readonly EvidenceItem[],
): EvidenceBundle {
  return { id, source, capturedAt, items: [...items] };
}
