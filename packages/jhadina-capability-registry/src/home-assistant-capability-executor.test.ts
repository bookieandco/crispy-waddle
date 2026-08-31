import { describe, expect, it, vi } from 'vitest';
import type { ActionRequest } from '@jhadina/core-spine';
import { HomeAssistantCapabilityExecutor } from './home-assistant-capability-executor.js';

const request: ActionRequest = {
  id: 'action-1',
  proposalId: 'proposal-1',
  capability: 'home.light.turn_on',
  operation: 'light.turn_on',
  input: { entityId: 'light.living_room' },
  reversible: true,
  consequenceLevel: 'low',
};

describe('HomeAssistantCapabilityExecutor', () => {
  it('dispatches mapped governed requests to transport', async () => {
    const map = vi.fn(() => ({ domain: 'light', service: 'turn_on', entityId: 'light.living_room', data: {} }));
    const call = vi.fn(async () => ({ ok: true }));
    const executor = new HomeAssistantCapabilityExecutor({ map } as never, { call });

    const result = await executor.execute(request);

    expect(result.success).toBe(true);
    expect(call).toHaveBeenCalledOnce();
    expect(map).toHaveBeenCalledWith(request);
  });

  it('does not call transport for an unsupported mapped action', async () => {
    const map = vi.fn(() => undefined);
    const call = vi.fn();
    const executor = new HomeAssistantCapabilityExecutor({ map } as never, { call });

    const result = await executor.execute(request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('unsupported Home Assistant action');
    expect(call).not.toHaveBeenCalled();
  });

  it('converts transport failures into ActionResult failures', async () => {
    const map = vi.fn(() => ({ domain: 'light', service: 'turn_on', entityId: 'light.living_room', data: {} }));
    const call = vi.fn(async () => { throw new Error('HA unavailable'); });
    const executor = new HomeAssistantCapabilityExecutor({ map } as never, { call });

    const result = await executor.execute(request);

    expect(result.success).toBe(false);
    expect(result.requestId).toBe(request.id);
    expect(result.error).toBe('HA unavailable');
  });
});
