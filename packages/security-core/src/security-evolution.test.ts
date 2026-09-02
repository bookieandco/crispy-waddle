import { describe, expect, it } from 'vitest';
import { SecurityEvolutionEngine, createSecurityChangeProposal } from './security-evolution.js';

describe('SecurityEvolutionEngine', () => {
  const engine = new SecurityEvolutionEngine();

  it('allows observation-only changes', () => {
    const proposal = createSecurityChangeProposal({
      observationId: 'obs-1',
      mode: 'observe',
      target: 'prompt-injection-detector',
      currentVersion: '1',
      proposedVersion: '1',
      rationale: 'collect telemetry only',
      reversible: true,
    });
    expect(engine.evaluate(proposal).decision).toBe('allow');
  });

  it('never autonomously deploys a defensive policy change', () => {
    const proposal = createSecurityChangeProposal({
      observationId: 'obs-2',
      mode: 'tighten',
      target: 'financial.execute',
      currentVersion: '1',
      proposedVersion: '2',
      rationale: 'new critical threat',
      reversible: true,
    });
    expect(engine.evaluate(proposal).decision).toBe('approval_required');
  });

  it('hard-denies weakening security guarantees', () => {
    expect(engine.evaluateWeakening().decision).toBe('deny');
  });

  it('requires approval for irreversible changes', () => {
    const proposal = createSecurityChangeProposal({
      observationId: 'obs-3',
      mode: 'revoke',
      target: 'worker-1',
      currentVersion: '1',
      proposedVersion: '2',
      rationale: 'compromise suspected',
      reversible: false,
    });
    expect(engine.evaluate(proposal).decision).toBe('approval_required');
  });
});
