import { describe, expect, it } from 'vitest';
import { evaluateDevicePolicy } from './device-capabilities.js';

describe('evaluateDevicePolicy', () => {
  it('allows a compatible device', () => {
    expect(evaluateDevicePolicy({ capabilities: ['network', 'tv-cast', 'hdr'] }, { requiredCapabilities: ['tv-cast', 'hdr'], networkRequired: true }).allowed).toBe(true);
  });
  it('rejects missing capabilities', () => {
    const result = evaluateDevicePolicy({ capabilities: ['network'] }, { requiredCapabilities: ['tv-cast'] });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('missing capability: tv-cast');
  });
  it('rejects critical thermal state and excessive latency', () => {
    const result = evaluateDevicePolicy({ capabilities: ['network'], networkLatencyMs: 180, thermalState: 'critical' }, { networkRequired: true, maxLatencyMs: 100 });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('network latency too high');
    expect(result.reasons).toContain('device thermal state is critical');
  });
});
