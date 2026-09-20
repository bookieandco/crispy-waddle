import { describe, expect, it } from 'vitest';
import { distillEvidence } from './evidence-distillation.js';
import { evidenceToGrowthSignal } from './evidence-signal-adapter.js';
import type { EvidenceItem } from './evidence-contract.js';

const item: EvidenceItem = {
  id: 'evidence:wallet-1',
  kind: 'social_post',
  title: 'Slim wallet trend',
  source: 'social',
  uri: 'https://example.test/post/1',
  capturedAt: '2026-08-27T00:00:00Z',
  text: 'Slim wallets are trending. Buyers want less pocket bulk. The product has strong creator interest.',
  metrics: { momentum: 84, audienceFit: 88, intent: 76, engagementRate: 91 },
  provenance: { source: 'test', actor: 'test' },
};

describe('evidence ingestion boundary', () => {
  it('maps evidence into the existing growth signal contract', () => {
    const signal = evidenceToGrowthSignal(item, 'tiktok');
    expect(signal.id).toBe('growth-signal:evidence:wallet-1');
    expect(signal.momentum).toBe(84);
    expect(signal.audienceFit).toBe(88);
    expect(signal.intent).toBe(76);
    expect(signal.evidenceQuality).toBe(70);
  });

  it('distills bounded evidence without inventing claims', () => {
    const distilled = distillEvidence(item);
    expect(distilled.evidenceId).toBe(item.id);
    expect(distilled.claims).toContain('Slim wallets are trending.');
    expect(distilled.metrics.momentum).toBe(84);
    expect(distilled.confidence).toBe(80);
  });
});
