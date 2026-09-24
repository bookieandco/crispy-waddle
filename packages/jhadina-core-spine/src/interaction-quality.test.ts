import { describe, expect, it } from 'vitest';
import { certifyInteractionQuality } from './interaction-quality.js';

describe('JHADINA-INTERACTION-QUALITY.FINAL', () => {
  it('passes the complete governed interaction-quality matrix', () => {
    const certification = certifyInteractionQuality();

    expect(certification.contractVersion).toBe('JHADINA-INTERACTION-QUALITY.FINAL');
    expect(certification.status).toBe('READY');
    expect(certification.gates).toHaveLength(12);
    expect(certification.gates.every((gate) => gate.ready)).toBe(true);
  });

  it('covers continuity, grounding, relational, humor, session, and voice boundaries', () => {
    const ids = new Set(certifyInteractionQuality().gates.map((gate) => gate.id));

    expect(ids).toEqual(new Set([
      'identity-continuity',
      'semantic-invariance',
      'disagreement-without-hostility',
      'distress-high-stakes-override',
      'sacred-love-boundary',
      'fringe-evidence-boundary',
      'clinical-evidence-boundary',
      'intimacy-agency-boundary',
      'cultural-salon-bounds',
      'session-ephemerality',
      'discomfort-kills-bit',
      'voice-expression-parity',
    ]));
  });
});
