import { describe, expect, it, vi } from 'vitest';
import { ControllerCore, InMemoryControllerRepository, type ControllerAdapter, type ControllerProfile } from './controller.js';

describe('ControllerCore', () => {
  it('discovers devices from all registered adapters and persists them', async () => {
    const repository = new InMemoryControllerRepository();
    const device = { id: 'feisedy-1', name: 'Feisedy Gamepad', connection: 'bluetooth' as const };
    const adapter: ControllerAdapter = { discover: vi.fn(async () => [device]), readInput: vi.fn() };
    const core = new ControllerCore(repository, [adapter]);
    await expect(core.discover()).resolves.toEqual([device]);
    await expect(repository.get(device.id)).resolves.toEqual(device);
  });

  it('rejects input for a controller that has not been discovered', async () => {
    const repository = new InMemoryControllerRepository();
    const adapter: ControllerAdapter = { discover: vi.fn(async () => []), readInput: vi.fn() };
    const core = new ControllerCore(repository, [adapter]);
    await expect(core.input('missing')).rejects.toThrow('Controller not registered: missing');
    expect(adapter.readInput).not.toHaveBeenCalled();
  });

  it('persists and retrieves a controller profile only for a registered device', async () => {
    const repository = new InMemoryControllerRepository();
    const device = { id: 'feisedy-1', name: 'Feisedy Gamepad', connection: 'bluetooth' as const };
    const adapter: ControllerAdapter = { discover: vi.fn(async () => [device]), readInput: vi.fn() };
    const core = new ControllerCore(repository, [adapter]);
    await core.discover();
    const profile: ControllerProfile = {
      id: 'profile-feisedy-default',
      deviceId: device.id,
      name: 'Jhadina Default',
      mapping: { button_a: 'a', button_b: 'b', button_x: 'x', button_y: 'y' },
      deadzone: 0.12,
    };
    await core.saveProfile(profile);
    await expect(core.profile(device.id)).resolves.toEqual(profile);
    await expect(core.saveProfile({ ...profile, deviceId: 'missing' })).rejects.toThrow('Controller not registered: missing');
  });
});
