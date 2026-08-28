import { DomainRegistry, type JhadinaDomain } from './domain-registry.js';

const domain = (
  name: string,
  goal: string,
  capabilities: string[],
  riskLevel: JhadinaDomain['context']['riskLevel'],
  personalityModifiers = {},
): JhadinaDomain => ({
  context: { domain: name, goal, capabilities, riskLevel, personalityModifiers },
  capabilities: capabilities.map((id) => ({
    id,
    description: `${name} capability: ${id}`,
    riskLevel: riskLevel ?? 'medium',
  })),
});

export function createDefaultDomainRegistry(): DomainRegistry {
  const registry = new DomainRegistry();
  registry.register(domain('music', 'Create, organize, restore, and operate music workflows.', ['create-track', 'restore-audio', 'analyze-track'], 'medium', { creativity: 15, curiosity: 10, playfulness: 10 }));
  registry.register(domain('money', 'Understand and manage financial workflows safely.', ['analyze-finances', 'prepare-payment', 'audit-transaction'], 'high', { directness: 15, humor: -20, riskTolerance: -15, formality: 10 }));
  registry.register(domain('overage', 'Discover, verify, and manage surplus-recovery opportunities.', ['discover-opportunity', 'verify-opportunity', 'prepare-claim'], 'high', { curiosity: 15, directness: 10, formality: 10, humor: -10 }));
  registry.register(domain('campaign', 'Coordinate lawful campaign operations and information workflows.', ['analyze-district', 'organize-outreach', 'prepare-briefing'], 'high', { assertiveness: 15, empathy: 20, directness: 10, formality: 10 }));
  registry.register(domain('social', 'Plan, draft, schedule, and analyze social communication.', ['draft-post', 'schedule-post', 'analyze-engagement'], 'medium', { playfulness: 10, humor: 10, curiosity: 10 }));
  registry.register(domain('commerce', 'Operate product, catalog, merchant, and marketplace workflows.', ['sync-catalog', 'analyze-sales', 'prepare-order'], 'medium', { directness: 10, curiosity: 10, formality: 5 }));
  registry.register(domain('safety', 'Protect the user and coordinate safety workflows.', ['assess-threat', 'capture-evidence', 'prepare-alert'], 'critical', { humor: -100, playfulness: -100, directness: 30, empathy: 25, formality: 25 }));
  registry.register(domain('staffing', 'Coordinate staffing, agency, invoice, and payment workflows.', ['match-worker', 'prepare-invoice', 'audit-payment'], 'high', { directness: 15, formality: 15, curiosity: 10 }));
  return registry;
}
