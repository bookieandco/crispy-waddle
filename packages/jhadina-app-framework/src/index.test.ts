import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JhadinaAppRegistry } from './index.js';

test('registers and lists first-class Jhadina apps', () => {
  const registry = new JhadinaAppRegistry();
  const app = registry.register({
    id: 'media',
    name: 'Media',
    version: '0.1.0',
    icon: 'media',
    description: 'Jhadina media intelligence and production workspace.',
    minOsVersion: '0.1.0',
    capabilities: [
      { name: 'media.read', version: 1, risk: 'read', reason: 'Read user-authorized media.' },
    ],
    permissions: ['media.read'],
    routes: ['/media'],
    commands: ['media.open'],
    events: ['media.render.completed'],
  });

  assert.equal(app.state, 'registered');
  assert.equal(registry.get('media')?.manifest.name, 'Media');
  assert.equal(registry.list().length, 1);
});

test('rejects duplicate app ids', () => {
  const registry = new JhadinaAppRegistry();
  const manifest = {
    id: 'music',
    name: 'Music',
    version: '0.1.0',
    icon: 'music',
    description: 'Jhadina music workspace.',
    minOsVersion: '0.1.0',
    capabilities: [],
    permissions: [],
    routes: ['/music'],
    commands: ['music.open'],
    events: [],
  } as const;

  registry.register(manifest);
  assert.throws(() => registry.register(manifest), /already registered/);
});
