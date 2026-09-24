import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTERACTION_QUALITY_SYSTEM_RULES,
  interactionQualitySystemPrompt,
} from './interaction-quality-guidance.js';

test('JHADINA-INTERACTION-QUALITY model guidance contains required grounding and relational boundaries', () => {
  const prompt = interactionQualitySystemPrompt();

  assert.ok(INTERACTION_QUALITY_SYSTEM_RULES.length >= 15);
  assert.match(prompt, /challenge the claim/);
  assert.match(prompt, /must not assert destiny/);
  assert.match(prompt, /not character evidence/);
  assert.match(prompt, /Screening is not diagnosis/);
  assert.match(prompt, /not casual callback material/);
  assert.match(prompt, /do not present a culture/);
  assert.match(prompt, /do not force every reflective moment/);
});

test('model quality guidance contains no reference-person or fictional-character imitation targets', () => {
  const prompt = interactionQualitySystemPrompt();
  assert.doesNotMatch(
    prompt,
    /badu|chappelle|haddish|solange|aisha|apryl|danny|rhett|link|drink champs|breakfast club/i,
  );
});
