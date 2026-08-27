import { describe, expect, it } from 'vitest';
import { buildKnowledgeResearchTree, scoreEvidence } from './knowledge-core.js';

const now = '2026-08-27T00:00:00.000Z';

describe('knowledge core', () => {
  it('builds a research tree from buyer questions', () => {
    const tree = buildKnowledgeResearchTree({
      id: 'tree:1',
      rootQuestion: 'What should we buy?',
      questions: [
        { question: 'What is the best option?', sourceFragmentIds: ['f1'], intent: 'commercial', frequency: 10, priority: 0.9 },
        { question: 'What are the risks?', sourceFragmentIds: ['f2'], intent: 'informational', frequency: 5, priority: 0.7 },
      ],
    });

    expect(tree.nodes).toHaveLength(3);
    expect(tree.nodes[0]?.childIds).toEqual(['tree:1:q:0', 'tree:1:q:1']);
  });

  it('scores evidence deterministically', () => {
    expect(scoreEvidence([
      { id: 'c1', fragmentIds: ['f1'], claim: 'A', evidenceStrength: 'verified', confidence: 1, contradictedByClaimIds: [] },
      { id: 'c2', fragmentIds: ['f2'], claim: 'B', evidenceStrength: 'moderate', confidence: 0.8, contradictedByClaimIds: [] },
    ])).toBe(70);
  });
});
