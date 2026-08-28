import { describe, expect, it, vi } from 'vitest';
import { JhadinaSpine, type SpinePorts } from './spine.js';
import { createDefaultDomainRegistry } from './domain-bootstrap.js';
import { createOperatingModel } from './operating-model.js';
import { createPersonalitySliderProfile } from './personality-expression.js';
import type { ContextPacket, Experience, PolicyDecision } from './types.js';

const experience: Experience = {
  id: 'experience-domain-context',
  occurredAt: '2026-08-27T00:00:00.000Z',
  source: 'test',
  domain: 'music',
  actor: 'user',
  content: 'restore this track',
  evidence: [],
};

describe('spine domain context', () => {
  it('makes the selected domain and expression available to the decision port', async () => {
    const registry = createDefaultDomainRegistry();
    const music = registry.get('music');
    expect(music).toBeDefined();

    let captured: ContextPacket | undefined;
    const context: ContextPacket = {
      id: 'ctx-1', purpose: 'test', relevantMemories: [], patterns: [],
      personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: experience.occurredAt },
      knowledge: [], constraints: [], excludedContext: [],
    };
    const ports = {
      memory: { observe: vi.fn().mockResolvedValue([]), loadRelevant: vi.fn().mockResolvedValue([]) },
      pattern: { detect: vi.fn().mockResolvedValue([]) },
      personality: { build: vi.fn().mockResolvedValue({ version: 1, traits: [], independentAssessmentRequired: false, updatedAt: experience.occurredAt }) },
      context: { build: vi.fn().mockImplementation(async (input) => { captured = { ...context, operatingContext: input.operatingContext, personalityExpression: input.personalityExpression }; return captured; }) },
      decision: { decide: vi.fn().mockImplementation(async (ctx) => { expect(ctx.operatingContext?.domain.domain).toBe('music'); expect(ctx.operatingContext?.expression.playfulness).toBeGreaterThan(0); return { id: 'decision-1', contextId: ctx.id, disposition: 'PROCEED', recommendation: 'restore', rationale: 'test', evidence: [], uncertainty: [], alternatives: [] }; }) },
      policy: { evaluate: vi.fn().mockResolvedValue({ id: 'policy-1', proposalId: 'decision-1', allowed: false, reason: 'test', requiredApproval: false, evaluatedAt: experience.occurredAt } as PolicyDecision) },
      action: { prepare: vi.fn(), execute: vi.fn() },
      audit: { record: vi.fn().mockResolvedValue(undefined) },
      evolution: { analyze: vi.fn() },
      domainRegistry: registry,
      operatingModel: createOperatingModel(createPersonalitySliderProfile()),
    } as unknown as SpinePorts;

    await new JhadinaSpine(ports).run(experience);
    expect(captured?.operatingContext?.domain.domain).toBe('music');
    expect(captured?.operatingContext?.model.version).toBe(1);
  });
});
