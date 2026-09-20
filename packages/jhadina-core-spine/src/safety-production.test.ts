import { describe, expect, it } from 'vitest';
import type { DurableSafetyIncident, DurableSafetyIncidentStore } from './safety-durable-runtime.js';
import { DurableDeadManRuntime } from './safety-deadman-runtime.js';
import { runSafetyChaosCase } from './safety-chaos-runtime.js';
import { runSafetyDrill } from './safety-drill.js';

class MemoryIncidentStore implements DurableSafetyIncidentStore {
  constructor(private value: DurableSafetyIncident) {}
  async load(): Promise<DurableSafetyIncident> { return this.value; }
  async save(snapshot: DurableSafetyIncident, expectedUpdatedAt?: string): Promise<'saved' | 'conflict'> {
    if (expectedUpdatedAt && expectedUpdatedAt !== this.value.updatedAt) return 'conflict';
    this.value = snapshot;
    return 'saved';
  }
}

describe('Safety production runtime', () => {
  it('restores and advances a durable dead-man incident', async () => {
    const store = new MemoryIncidentStore({
      incidentId: 'incident-1',
      ownerUserId: 'user-1',
      protocolId: 'protocol-1',
      deadManState: 'armed',
      deadlineAt: '2026-09-20T17:00:00Z',
      updatedAt: '2026-09-20T16:00:00Z',
      timeline: [],
    });
    const runtime = new DurableDeadManRuntime(store, { now: () => '2026-09-20T17:01:00Z' });
    expect(await runtime.due('incident-1')).toBe(true);
    expect((await runtime.apply({ incidentId: 'incident-1', event: 'check-in-due' })).deadManState).toBe('check-in-due');
  });

  it('runs chaos checks and always resets faults', async () => {
    let reset = false;
    const result = await runSafetyChaosCase(
      { id: 'offline', failures: ['cellular-loss', 'wifi-loss'], mustPreserve: ['policy', 'audit'] },
      { enable: async () => undefined, reset: async () => { reset = true; } },
      { verify: async () => true },
    );
    expect(result.passed).toBe(true);
    expect(reset).toBe(true);
  });

  it('completes SAFETY-DRILL.1 with fake recipients and test evidence', async () => {
    const audit: string[] = [];
    const result = await runSafetyDrill('drill-1', 'test-actor', 'test-recipient', {
      spatial: {
        snapshot: async (incidentId, at) => ({ incidentId, createdAt: at, signals: [] }),
      },
      vault: {
        upload: async (chunk) => ({ chunkId: chunk.id, accepted: true, verifiedHash: chunk.contentHash }),
        verify: async (_chunkId, expectedHash) => expectedHash === 'hash-1',
      },
      communications: {
        send: async (intent) => ({ intentId: intent.intentId, accepted: true, acknowledgedAt: intent.createdAt }),
      },
      startTestCapture: async () => ({ chunkId: 'chunk-1', contentHash: 'hash-1' }),
      persistTestEvidence: async () => true,
      evaluateDeadMan: async () => 'safe',
      appendAudit: async (_incidentId, stage) => { audit.push(stage); },
    });
    expect(result.passed).toBe(true);
    expect(result.stages).toContain('audit-complete');
    expect(audit).toEqual(result.stages);
  });
});
