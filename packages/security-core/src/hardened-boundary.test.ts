import { describe, expect, it } from 'vitest';
import {
  HardenedSecurityBoundary,
  InMemoryReplayGuard,
  JHADINA_BASE_SECURITY_POLICY,
  createHardenedRequest,
} from './index.js';
import { JhadinaSecurityCore } from './index.js';

describe('HardenedSecurityBoundary', () => {
  it('allows an intact low-risk request once', async () => {
    const boundary = new HardenedSecurityBoundary(
      new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
      new InMemoryReplayGuard(),
    );
    const request = await createHardenedRequest({
      requestId: 'r-1',
      actorId: 'owner',
      domain: 'jhadina-action',
      capability: 'project.create',
      payload: { name: 'safe' },
    });
    expect(await boundary.authorize(request)).toBe('allow');
    expect(await boundary.authorize(request)).toBe('deny');
  });

  it('denies payload tampering', async () => {
    const boundary = new HardenedSecurityBoundary(
      new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
      new InMemoryReplayGuard(),
    );
    const request = await createHardenedRequest({
      requestId: 'r-2',
      actorId: 'owner',
      domain: 'jhadina-action',
      capability: 'project.create',
      payload: { name: 'safe' },
    });
    request.payload = { name: 'tampered' };
    expect(await boundary.authorize(request)).toBe('deny');
  });

  it('denies an unknown capability', async () => {
    const boundary = new HardenedSecurityBoundary(
      new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
      new InMemoryReplayGuard(),
    );
    const request = await createHardenedRequest({
      requestId: 'r-3',
      actorId: 'owner',
      domain: 'jhadina-action',
      capability: 'system.root',
      payload: {},
    });
    expect(await boundary.authorize(request)).toBe('deny');
  });

  it('never silently converts approval into allow', async () => {
    const boundary = new HardenedSecurityBoundary(
      new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
      new InMemoryReplayGuard(),
    );
    const request = await createHardenedRequest({
      requestId: 'r-4',
      actorId: 'owner',
      domain: 'jhadina-action',
      capability: 'financial.execute',
      payload: { amount: 1 },
    });
    expect(await boundary.authorize(request)).toBe('approval_required');
  });
});
