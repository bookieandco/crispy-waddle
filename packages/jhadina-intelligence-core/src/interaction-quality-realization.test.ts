import { describe, expect, it } from 'vitest';
import type { DecisionProposal, ExpressionDirective, ExpressionRegister } from '@jhadina/core-spine';
import { realizeGovernedExpression } from './expression-realization.js';

const proposal: DecisionProposal = {
  id: 'quality-proposal',
  contextId: 'quality-context',
  disposition: 'PROCEED',
  recommendation: 'Keep the subsystem result exactly as produced.',
  rationale: 'Expression is presentation-only.',
  evidence: [{ id: 'e1', source: 'test', summary: 'governed subsystem result', observedAt: '2026-09-23T00:00:00.000Z' }],
  uncertainty: [],
  alternatives: [],
};

describe('JHADINA-INTERACTION-QUALITY subsystem semantic preservation', () => {
  it('keeps Director/Social/Growth-style semantic proposals unchanged across presentation registers', () => {
    const registers: ExpressionRegister[] = ['creative', 'social-reaction', 'community-room', 'household-ops', 'serious'];

    for (const register of registers) {
      const directive: ExpressionDirective = {
        mode: register === 'serious' ? 'serious' : 'direct',
        allowProfanity: register !== 'serious',
        allowQuip: register !== 'serious',
        register,
        symbolicFraming: 'off',
        evidenceDiscipline: register === 'serious' ? 'strict' : 'standard',
      };
      const realized = realizeGovernedExpression(proposal, directive);

      expect(realized.proposal).toBe(proposal);
      expect(realized.proposal.recommendation).toBe('Keep the subsystem result exactly as produced.');
      expect(realized.proposal.evidence).toEqual(proposal.evidence);
      expect(realized.segments[0]).toEqual({
        kind: 'semantic',
        text: 'Keep the subsystem result exactly as produced.',
      });
    }
  });
});
