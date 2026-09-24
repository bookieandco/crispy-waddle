import { describe, expect, it } from 'vitest';
import { classifySocialSignal, commercialSignalValue } from './social-signal-classification.js';

describe('social signal classification', () => {
  it('does not treat attention as purchase intent', () => {
    const result = classifySocialSignal({ id: '1' as never, topic: 'pet portraits', platform: 'tiktok', observedAt: '2026-08-30T00:00:00Z', signal: 'this is so cute', value: 100, confidence: 1, evidence: [] });
    expect(result.signalClass).toBe('attention');
    expect(result.commercialWeight).toBe(0.15);
  });

  it('recognizes explicit buying language as intent', () => {
    const result = classifySocialSignal({ id: '2' as never, topic: 'pet portraits', platform: 'instagram', observedAt: '2026-08-30T00:00:00Z', signal: 'where can I buy this?', value: 1, confidence: 1, evidence: [] });
    expect(result.signalClass).toBe('intent');
  });

  it('prioritizes actual conversion economics', () => {
    const result = classifySocialSignal({ id: '3' as never, topic: 'pet portraits', platform: 'instagram', observedAt: '2026-08-30T00:00:00Z', signal: 'purchase', value: 1, confidence: 1, evidence: [], conversion: { revenue: 200, spend: 100, conversions: 4 } });
    expect(result.signalClass).toBe('conversion');
    expect(commercialSignalValue(result)).toBe(1);
  });
});
