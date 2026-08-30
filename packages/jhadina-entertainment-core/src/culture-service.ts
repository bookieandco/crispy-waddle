import { CulturalContext, type CulturalContextResult, type CulturalReference } from './cultural-context.js';
import { CulturalIngestion, type CulturalIngestionPolicy, type CulturalIngestionResult, type ResearchSignal } from './cultural-ingestion.js';

export class CulturalService {
  constructor(
    private readonly context = new CulturalContext(),
    private readonly ingestion = new CulturalIngestion(),
  ) {}

  ingest(signal: ResearchSignal, now?: string): CulturalIngestionResult | null {
    const result = this.ingestion.ingest(signal, now);
    if (!result) return null;
    this.context.upsert(result.reference);
    return result;
  }

  refresh(now = new Date().toISOString()): void { this.context.refresh(now); }

  relevant(text: string, now?: string, audienceFamiliarity?: number): CulturalContextResult {
    return this.context.findRelevant({ text, now, audienceFamiliarity });
  }

  snapshot(): CulturalReference[] { return this.context.snapshot(); }
}

export type { CulturalIngestionPolicy, ResearchSignal, CulturalIngestionResult };
