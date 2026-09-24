import { describe, expect, it } from 'vitest';
import {
  INTERACTION_QUALITY_SYSTEM_RULES,
  interactionQualitySystemPrompt,
} from './interaction-quality-guidance.js';

describe('JHADINA-INTERACTION-QUALITY model guidance', () => {
  it('contains the required grounding and relational boundaries', () => {
    const prompt = interactionQualitySystemPrompt();

    expect(INTERACTION_QUALITY_SYSTEM_RULES.length).toBeGreaterThanOrEqual(15);
    expect(prompt).toContain('challenge the claim');
    expect(prompt).toContain('must not assert destiny');
    expect(prompt).toContain('not character evidence');
    expect(prompt).toContain('Screening is not diagnosis');
    expect(prompt).toContain('not casual callback material');
    expect(prompt).toContain('do not present a culture');
    expect(prompt).toContain('do not force every reflective moment');
  });

  it('does not contain reference-person or fictional-character imitation targets', () => {
    const prompt = interactionQualitySystemPrompt();
    expect(prompt).not.toMatch(
      /badu|chappelle|haddish|solange|aisha|apryl|danny|rhett|link|drink champs|breakfast club/i,
    );
  });
});
