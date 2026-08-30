import type { CulturalService } from './culture-service.js';
import type { ResearchSignal } from './cultural-ingestion.js';
import type { ResearchEvidenceLedger, ResearchEvidenceResult } from './research-evidence.js';
import type { ResearchVerifier, VerifiedResearch } from './research-verifier.js';
import { WebScoutPipeline, type SourceAssessment } from './web-scout-pipeline.js';
import type { ResearchSourcePerformanceStore } from '@jhadina/core-spine';

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

/** Research execution feeds real verification outcomes back into adaptive source routing. */
export class ResearchInvestigation {
  constructor(
    private readonly scout: WebScoutPipeline,
    private readonly verifier: ResearchVerifier,
    private readonly evidence: ResearchEvidenceLedger,
    private readonly culture: CulturalService,
    private readonly performance?: ResearchSourcePerformanceStore,
  ) {}

  async investigate(query: string, limit = 5, now = new Date().toISOString()): Promise<InvestigationResult> {
    const discovered = await this.scout.investigate(query, limit);
    const results: InvestigationResult['signals'] = [];
    let verified = 0, corroborated = 0, promoted = 0, duplicates = 0;
    const outcomes = new Map<string, { usefulEvidence: number; corroboratedEvidence: number; verifiedEvidence: number; rejectedEvidence: number }>();

    for (const signal of discovered.signals) {
      const checked = await this.verifier.verify(signal);
      const status = checked.verification.status;
      if (status === 'verified') verified += 1;
      if (status === 'corroborated') corroborated += 1;
      const recorded = await this.evidence.record(checked);
      const canPromote = status === 'verified' || status === 'corroborated';
      const promotion = canPromote ? this.culture.ingest({ ...checked, verification: status }, now) : null;
      if (promotion) promoted += 1;
      if (recorded.duplicate) duplicates += 1;

      const assessment = discovered.sourceAssessments.find(a => a.source === safeHost(checked.sourceUrl) || a.matchedProfile === sourceIdFor(checked.sourceUrl));
      const sourceId = assessment?.matchedProfile;
      if (sourceId) {
        const current = outcomes.get(sourceId) ?? { usefulEvidence: 0, corroboratedEvidence: 0, verifiedEvidence: 0, rejectedEvidence: 0 };
        current.usefulEvidence += canPromote ? 1 : 0;
        current.corroboratedEvidence += status === 'corroborated' ? 1 : 0;
        current.verifiedEvidence += status === 'verified' ? 1 : 0;
        current.rejectedEvidence += canPromote ? 0 : 1;
        outcomes.set(sourceId, current);
      }
      results.push({ signal: checked, verification: checked.verification, evidence: recorded.evidence, promoted: Boolean(promotion), duplicate: recorded.duplicate });
    }

    if (this.performance) for (const [sourceId, outcome] of outcomes) this.performance.record({ sourceId, ...outcome }, now);

    return { query, discovered: discovered.discovered, crawled: discovered.crawled, rejected: discovered.rejected, verified, corroborated, promoted, duplicates, selectedSources: discovered.selectedSources, sourceAssessments: discovered.sourceAssessments, signals: results };
  }
}

function safeHost(url?: string): string { try { return url ? new URL(url).hostname : ''; } catch { return ''; } }
function sourceIdFor(url?: string): string | undefined {
  const host = safeHost(url);
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit-praw';
  if (host === 'qdrant.tech' || host.endsWith('.qdrant.tech')) return 'qdrant';
  if (host === 'scira.ai' || host.endsWith('.scira.ai')) return 'scira';
  return undefined;
}
