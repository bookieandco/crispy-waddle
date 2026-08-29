import { describe, expect, it } from 'vitest';
import { evaluateCryptoDefense, type CryptoDefensePolicy, type CryptoThreatSignal } from './crypto-defense.js';

const policy: CryptoDefensePolicy = {
  minimumThreatForExit: 'elevated',
  haltOnSimulationFailure: true,
  haltOnCriticalSignal: true,
};

const signal = (kind: CryptoThreatSignal['kind'], severity: CryptoThreatSignal['severity']): CryptoThreatSignal => ({
  kind,
  severity,
  detectedAt: '2026-08-29T00:00:00.000Z',
  chain: 'ethereum',
  contractAddress: '0x0000000000000000000000000000000000000001',
  evidence: {},
});

describe('crypto defense', () => {
  it('monitors when there are no signals', () => {
    expect(evaluateCryptoDefense([], policy).action).toBe('monitor');
  });

  it('blocks new exposure on a watch signal', () => {
    expect(evaluateCryptoDefense([signal('unverified_contract', 'watch')], policy).action).toBe('block_new_exposure');
  });

  it('requests an exit at the configured threshold', () => {
    expect(evaluateCryptoDefense([signal('liquidity_removed', 'elevated')], policy).action).toBe('request_exit');
  });

  it('halts live crypto on a critical signal', () => {
    expect(evaluateCryptoDefense([signal('owner_changed', 'critical')], policy).action).toBe('halt_live_crypto');
  });

  it('halts live crypto when simulation fails', () => {
    expect(evaluateCryptoDefense([signal('simulation_failure', 'elevated')], policy).action).toBe('halt_live_crypto');
  });
});
