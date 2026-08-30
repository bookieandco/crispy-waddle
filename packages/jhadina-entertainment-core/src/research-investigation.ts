import type { CulturalService } from './culture-service.js';
import type { ResearchSignal } from './cultural-ingestion.js';
import type { ResearchEvidenceLedger, ResearchEvidenceResult } from './research-evidence.js';
import type { ResearchVerifier, VerifiedResearch } from './research-verifier.js';
import { WebScoutPipeline, selectResearchSources, type SourceAssessment } from './web-scout-pipeline.js';

export interface InvestigationResult {
  query: string;
  discovered: number;
  crawled: number;
  rejected: number;
  verified: number;
  corroborated: number;
  promoted: number;
  duplicates: number;
  selectedSources: string[];
  sourceAssessments: SourceAssessment[];
  signals: Array<{ signal: ResearchSignal; verification: VerifiedResearch['verification']; evidence: ResearchEvidenceResult['evidence']; promoted: boolean; duplicate: boolean }>;
}

/** Research planner: select appropriate sources first, execute discovery, then verify underlying evidence. */
export class ResearchInvestigation {
  constructor(
    private readonly scout: WebScoutPipeline,
    private readonly verifier: ResearchVerifier,
    private readonly evidence: ResearchEvidenceLedger,
    private readonly culture: CulturalService,
  ) {}

  async investigate(query: string, limit = 5, now = new Date().toISOString()): Promise<InvestigationResult> {
    const plan = selectResearchSources(query);
    const discovered = await this.scout.investigate(query, limit);
    const results: InvestigationResult['signals'] = [];
    let verified = 0, corroborated = 0, promoted = 0, duplicates = 0;
    for (const signal of discovered.signals) {
      const checked = await this.verifier.verify(signal);
      if (checked.verification.status === 'verified') verified += 1;
      if (checked.verification.status === 'corroborated') corroborated += 1;
      const recorded = await this.evidence.record(checked);
      const canPromote = checked.verification.status === 'verified' || checked.verification.status === 'corroborated';
      const promotion = canPromote ? this.culture.ingest({ ...checked, verification: checked.verification.status }, now) : null;
      if (promotion) promoted += 1;
      if (recorded.duplicate) duplicates += 1;
      results.push({ signal: checked, verification: checked.verification, evidence: recorded.evidence, promoted: Boolean(promotion), duplicate: recorded.duplicate });
    }
    return {
      query,
      discovered: discovered.discovered,
      crawled: discovered.crawled,
      rejected: discovered.rejected,
      verified,
      corroborated,
      promoted,
      duplicates,
      selectedSources: plan.slice(0, 3).map(({ profile }) => profile.id),
      sourceAssessments: discovered.sourceAssessments,
      signals: results,
    };
  }
}
