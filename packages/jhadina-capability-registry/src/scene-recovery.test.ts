import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SceneRunner, type SceneAction } from './scene-recovery.js';

describe('scene recovery', () => {
  it('compensates completed actions in reverse order after failure', async () => {
    const events: string[] = [];
    const actions: SceneAction[] = [
      { id: 'a', execute: async () => events.push('a'), compensate: async () => events.push('undo-a') },
      { id: 'b', execute: async () => events.push('b'), compensate: async () => events.push('undo-b') },
      { id: 'c', execute: async () => { events.push('c'); throw new Error('boom'); }, compensate: async () => events.push('undo-c') },
    ];
    const result = await new SceneRunner(actions, 'stop').run();
    assert.equal(result.status, 'failed');
    assert.deepEqual(events, ['a', 'b', 'c', 'undo-b', 'undo-a']);
  });

  it('cancels remaining actions without executing them', async () => {
    const events: string[] = [];
    const runner = new SceneRunner([
      { id: 'a', execute: async () => { events.push('a'); runner.cancel(); } },
      { id: 'b', execute: async () => events.push('b') },
    ], 'stop');
    const result = await runner.run();
    assert.equal(result.status, 'cancelled');
    assert.deepEqual(events, ['a']);
  });

  it('continues after an action failure when configured to continue', async () => {
    const events: string[] = [];
    const result = await new SceneRunner([
      { id: 'a', execute: async () => { events.push('a'); throw new Error('boom'); } },
      { id: 'b', execute: async () => events.push('b') },
    ], 'continue').run();
    assert.equal(result.status, 'completed-with-errors');
    assert.deepEqual(events, ['a', 'b']);
  });
});
