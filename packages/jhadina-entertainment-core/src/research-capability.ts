import type { CulturalService } from './culture-service.js';
import type { ResearchInvestigation, InvestigationResult } from './research-investigation.js';
import type { AuthoritativeActionProposal, CapabilityGateway } from '@jhadina/core-spine';

export type KnowledgeState = 'known' | 'likely' | 'unknown' | 'stale' | 'conflicted' | 'unverified';
export interface KnowledgeCheck { state: KnowledgeState; confidence: number; reason: string; }
export interface ResearchIntent { query: string; reason: string; requestedAt: string; }
export interface ResearchContext { addResearch(result: InvestigationResult): void; }
export interface ResearchCapabilityResult { check: KnowledgeCheck; intent?: ResearchIntent; researched: boolean; denied?: { reason: string; policyId: string }; result?: InvestigationResult; }

/** Research uses the same authoritative capability/policy boundary as every other Jhadina action. */
export class ResearchCapability {
  constructor(private readonly investigation: ResearchInvestigation, private readonly gateway: CapabilityGateway, private readonly context: ResearchContext) {}

  async execute(query: string, check: KnowledgeCheck, limit = 5): Promise<ResearchCapabilityResult> {
    if (!['unknown', 'stale', 'conflicted'].includes(check.state)) return { check, researched: false };
    const intent: ResearchIntent = { query, reason: check.reason, requestedAt: new Date().toISOString() };
    const proposal: AuthoritativeActionProposal = { id: `research:${crypto.randomUUID()}`, capability: 'research', operation: 'investigate', input: { query, limit }, reversible: true, consequenceLevel: 'low', reason: intent.reason };
    const policy = await this.gateway.authorize(proposal);
    if (!policy.allowed) return { check, intent, researched: false, denied: { reason: policy.reason, policyId: policy.id } };
    const result = await this.investigation.investigate(query, limit);
    this.context.addResearch(result);
    return { check, intent, researched: true, result };
  }
}

export class CulturalResearchContext implements ResearchContext {
  constructor(private readonly culture: CulturalService) {}
  addResearch(result: InvestigationResult): void { for (const item of result.signals) if (item.promoted) this.culture.ingest(item.signal, new Date().toISOString()); }
}
