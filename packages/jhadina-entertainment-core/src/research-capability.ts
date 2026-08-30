import type { CulturalService } from './culture-service.js';
import type { ResearchInvestigation, InvestigationResult } from './research-investigation.js';

export type KnowledgeState = 'known' | 'likely' | 'unknown' | 'stale' | 'conflicted' | 'unverified';

export interface KnowledgeCheck { state: KnowledgeState; confidence: number; reason: string; }
export interface ResearchIntent { query: string; reason: string; requestedAt: string; }
export interface ResearchPolicy { canResearch(intent: ResearchIntent): boolean; }
export interface ResearchContext { addResearch(result: InvestigationResult): void; }

export interface ResearchCapabilityResult {
  check: KnowledgeCheck;
  intent?: ResearchIntent;
  researched: boolean;
  result?: InvestigationResult;
}

/** Governed reflex: check knowledge, form intent, pass policy, investigate, then return evidence to context. */
export class ResearchCapability {
  constructor(
    private readonly investigation: ResearchInvestigation,
    private readonly policy: ResearchPolicy,
    private readonly context: ResearchContext,
  ) {}

  async execute(query: string, check: KnowledgeCheck, limit = 5): Promise<ResearchCapabilityResult> {
    if (check.state !== 'unknown' && check.state !== 'stale' && check.state !== 'conflicted') {
      return { check, researched: false };
    }
    const intent: ResearchIntent = { query, reason: check.reason, requestedAt: new Date().toISOString() };
    if (!this.policy.canResearch(intent)) return { check, intent, researched: false };
    const result = await this.investigation.investigate(query, limit);
    this.context.addResearch(result);
    return { check, intent, researched: true, result };
  }
}

export class AllowResearchPolicy implements ResearchPolicy {
  canResearch(): boolean { return true; }
}

export class CulturalResearchContext implements ResearchContext {
  constructor(private readonly culture: CulturalService) {}
  addResearch(result: InvestigationResult): void {
    for (const item of result.signals) {
      if (item.promoted) this.culture.ingest(item.signal, new Date().toISOString());
    }
  }
}
