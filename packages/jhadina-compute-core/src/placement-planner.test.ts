import { describe, expect, it } from 'vitest';
import {
  defaultQueueForKind,
  normalizeWorkloadPriority,
  type ComputeNode,
  type ComputeWorkload,
} from './resource-contract.js';
import { planPlacement } from './placement-planner.js';

const baseWorkload: ComputeWorkload = {
  id: 'workload-1',
  source: 'director',
  kind: 'video-generation',
  queue: 'creative',
  priority: 700,
  authority: {
    system: 'director-generation',
    jobId: 'generation-1',
    idempotencyKey: 'generation-1',
    projectId: 'movie-1',
  },
  resourceProfileId: 'director.video.test',
  resources: {
    cpuCores: 8,
    ramGiB: 32,
    scratchGiB: 100,
    gpu: { vendor: 'nvidia', count: 1, minVramGiBPerDevice: 24 },
  },
  dataLocalityKeys: ['asset:scene-1'],
  createdAt: '2026-09-26T00:00:00.000Z',
};

const homebase: ComputeNode = {
  id: 'homebase-gpu-1',
  provider: 'homebase',
  zone: 'home',
  status: 'ready',
  cpuCoresFree: 32,
  ramGiBFree: 192,
  scratchGiBFree: 1800,
  networkMbpsAvailable: 10000,
  accelerators: [{ vendor: 'nvidia', model: 'local-gpu', count: 1, vramGiBPerDevice: 48 }],
  localityKeys: ['asset:scene-1'],
};

const cloud: ComputeNode = {
  id: 'cloud-gpu-1',
  provider: 'cloud',
  zone: 'cloud-a',
  status: 'ready',
  cpuCoresFree: 64,
  ramGiBFree: 512,
  scratchGiBFree: 2000,
  networkMbpsAvailable: 25000,
  accelerators: [{ vendor: 'nvidia', model: 'cloud-gpu', count: 1, vramGiBPerDevice: 80 }],
  hourlyCostUsd: 4,
};

describe('planPlacement', () => {
  it('prefers Homebase and asset locality when both nodes are eligible', () => {
    const workload = {
      ...baseWorkload,
      resources: { ...baseWorkload.resources, allowCloudBurst: true },
    };
    const plan = planPlacement([cloud, homebase], workload);
    expect(plan.selectedNodeId).toBe('homebase-gpu-1');
  });

  it('never infers cloud burst merely because cloud has more VRAM', () => {
    const plan = planPlacement([cloud], baseWorkload);
    expect(plan.selectedNodeId).toBeUndefined();
    expect(plan.rejected[0]?.codes).toContain('CLOUD_BURST_NOT_ALLOWED');
  });

  it('denies sensitive workloads on cloud even when burst was requested', () => {
    const workload = {
      ...baseWorkload,
      resources: {
        ...baseWorkload.resources,
        allowCloudBurst: true,
        sensitiveData: true,
      },
    };
    const plan = planPlacement([cloud], workload);
    expect(plan.rejected[0]?.codes).toContain('SENSITIVE_DATA_CLOUD_DENIED');
  });

  it('rejects a node that cannot satisfy per-device VRAM', () => {
    const weak = {
      ...homebase,
      accelerators: [{ vendor: 'nvidia' as const, count: 2, vramGiBPerDevice: 16 }],
    };
    const plan = planPlacement([weak], baseWorkload);
    expect(plan.rejected[0]?.codes).toContain('GPU_VRAM_INSUFFICIENT');
  });

  it('applies an explicit cloud hourly cost ceiling', () => {
    const workload = {
      ...baseWorkload,
      resources: {
        ...baseWorkload.resources,
        allowCloudBurst: true,
        maxCostUsdPerHour: 2,
      },
    };
    const plan = planPlacement([cloud], workload);
    expect(plan.rejected[0]?.codes).toContain('COST_LIMIT_EXCEEDED');
  });

  it('uses deterministic node id ordering for equal scores', () => {
    const a = { ...homebase, id: 'a', localityKeys: [] };
    const b = { ...homebase, id: 'b', localityKeys: [] };
    const workload = { ...baseWorkload, dataLocalityKeys: [] };
    expect(planPlacement([b, a], workload).selectedNodeId).toBe('a');
  });
});

describe('queue policy', () => {
  it('maps latency-sensitive and maintenance work to different queues', () => {
    expect(defaultQueueForKind('llm-interactive')).toBe('interactive');
    expect(defaultQueueForKind('video-generation')).toBe('creative');
    expect(defaultQueueForKind('render')).toBe('render');
    expect(defaultQueueForKind('training')).toBe('background');
    expect(defaultQueueForKind('memory-index')).toBe('maintenance');
  });

  it('does not allow a caller to undercut the queue priority floor', () => {
    expect(normalizeWorkloadPriority('interactive', 1)).toBe(1000);
    expect(normalizeWorkloadPriority('render', 900)).toBe(900);
  });
});
