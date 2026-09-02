import { beforeEach, describe, expect, it } from 'vitest';
import { acquireMediaElementEventLease, resetMediaElementEventOwnership } from './media-element-event-owner';

describe('persistent media element event ownership', () => {
  beforeEach(() => resetMediaElementEventOwnership());

  it('allows only the newest lease to publish events', () => {
    const first = acquireMediaElementEventLease();
    const second = acquireMediaElementEventLease();

    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('does not let stale release revoke the current owner', () => {
    const first = acquireMediaElementEventLease();
    const second = acquireMediaElementEventLease();

    first.release();
    expect(second.isCurrent()).toBe(true);
  });

  it('allows the current owner to release itself', () => {
    const lease = acquireMediaElementEventLease();

    expect(lease.isCurrent()).toBe(true);
    lease.release();
    expect(lease.isCurrent()).toBe(false);
  });

  it('reset fences an owner during global session disposal', () => {
    const lease = acquireMediaElementEventLease();

    resetMediaElementEventOwnership();

    expect(lease.isCurrent()).toBe(false);
  });
});
