import { describe, expect, it } from 'vitest';
import { validateCapabilityRequest, type JhadinaDomain } from './domain-registry.js';

describe('domain capability contract', () => {
  const domain: JhadinaDomain = {
    context: {
      domain: 'music',
      goal: 'create and manage music work',
      capabilities: ['create-track'],
      riskLevel: 'medium',
    },
    capabilities: [{ id: 'create-track', description: 'Create a track', riskLevel: 'medium' }],
  };

  it('accepts a capability belonging to the requested domain', () => {
    const capability = validateCapabilityRequest(domain, {
      domain: 'music',
      capabilityId: 'create-track',
      input: {},
      context: {
        model: {
          version: 1,
          principles: ['EVIDENCE_BEFORE_CERTAINTY'],
          personality: {
            warmth: 70, playfulness: 65, directness: 60, patience: 70, curiosity: 75,
            assertiveness: 55, formality: 25, humor: 70, empathy: 80, riskTolerance: 40,
          },
        },
        domain: domain.context,
        situation: { seriousness: 20, urgency: 10, emotionalLoad: 10, humorAllowance: 80, playfulnessAllowance: 80, directnessRequired: 50, reassuranceNeeded: 20, confidence: 80 },
        expression: { warmth: 70, playfulness: 52, directness: 30, patience: 63, curiosity: 70, assertiveness: 45, formality: 20, humor: 56, empathy: 60, riskTolerance: 32 },
      },
    });
    expect(capability.id).toBe('create-track');
  });

  it('rejects cross-domain capability requests', () => {
    expect(() => validateCapabilityRequest(domain, {
      domain: 'money', capabilityId: 'create-track', input: {}, context: {} as never,
    })).toThrow('Domain mismatch');
  });
});
