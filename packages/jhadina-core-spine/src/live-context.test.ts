import { describe, expect, it } from 'vitest';
import {
  certifyLiveContextContract,
  JHADINA_LIVE_CONTEXT_CONTRACT_VERSION,
  JHADINA_LIVE_CONTEXT_LIMITS,
} from './live-context.js';

describe('JHADINA-LIVE-CONTEXT.FINAL contract', () => {
  it('keeps continuity bounded and non-authoritative', () => {
    const certification=certifyLiveContextContract();
    expect(certification.contractVersion).toBe(JHADINA_LIVE_CONTEXT_CONTRACT_VERSION);
    expect(certification.status).toBe('READY');
    expect(Object.values(certification.checks).every(Boolean)).toBe(true);
    expect(JHADINA_LIVE_CONTEXT_LIMITS).toEqual({
      maxRecentTurns: 8,
      maxAdmittedArtifactIds: 8,
      maxActiveSubsystems: 16,
      retainedDistinctScreenFrames: 2,
      screenMeanAbsoluteChangeThreshold: 7,
    });
  });
});
