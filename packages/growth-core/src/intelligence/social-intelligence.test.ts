import { describe, expect, it } from 'vitest';
import { calculateBuyerIntentLevel, scoreAdvertisingCandidate } from './social-intelligence.js';

describe('social intelligence', () => {
  it('classifies explicit purchase language as high intent', () => {
    expect(calculateBuyerIntentLevel(['Where can I buy this?', 'What is the price?'])).toBe('high');
  });

  it('combines weaker commercial signals as medium intent', () => {
    expect(calculateBuyerIntentLevel(['I am looking for this', 'Which one do you recommend?'])).toBe('medium');
  });

  it('returns none when no commercial signal exists', () => {
    expect(calculateBuyerIntentLevel([])).toBe('none');
  });

  it('keeps advertising candidates bounded to 0..1', () => {
    expect(scoreAdvertisingCandidate({
      commercialRelevance: 1,
      brandFit: 1,
      audienceFit: 1,
      novelty: 1,
      risk: 0,
      confidence: 1,
    })).toBe(1);

    expect(scoreAdvertisingCandidate({
      commercialRelevance: 0,
      brandFit: 0,
      audienceFit: 0,
      novelty: 0,
      risk: 1,
      confidence: 0,
    })).toBe(0);
  });
});
