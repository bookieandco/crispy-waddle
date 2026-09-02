import { describe, expect, it } from 'vitest';
import { RemoteWorkerBoundary } from './remote-worker-boundary.js';

const now = 1_000_000;
const boundary = new RemoteWorkerBoundary(RemoteWorkerBoundary.defaultPolicy());
const job = {
  jobId: 'job-1', workerId: 'worker-1', capability: 'take.generate',
  inputObjectIds: ['asset-1'], outputPrefix: 'jobs/job-1/', expiresAt: now + 60_000,
};

describe('RemoteWorkerBoundary', () => {
  it('allows scoped compute jobs', () => expect(boundary.authorize(job, now).decision).toBe('allow'));
  it('rejects expired jobs', () => expect(boundary.authorize({ ...job, expiresAt: now }, now).decision).toBe('deny'));
  it('rejects control-plane capabilities', () => expect(boundary.authorize({ ...job, capability: 'security.policy.write' }, now).decision).toBe('deny'));
  it('rejects path traversal output prefixes', () => expect(boundary.authorize({ ...job, outputPrefix: '../control-plane/' }, now).decision).toBe('deny'));
  it('rejects absolute output prefixes', () => expect(boundary.authorize({ ...job, outputPrefix: '/etc/jhadina/' }, now).decision).toBe('deny'));
  it('keeps secrets and control-plane writes disabled by policy', () => {
    const policy = RemoteWorkerBoundary.defaultPolicy();
    expect(policy.allowSecrets).toBe(false);
    expect(policy.allowControlPlaneWrites).toBe(false);
  });
});
