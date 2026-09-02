import { describe, expect, it } from 'vitest';
import { assertTransportCommand } from './transport-lifecycle.js';

describe('remote transport lifecycle contract', () => {
  it('rejects empty commands', () => {
    expect(() => assertTransportCommand('   ')).toThrow('Remote command must not be empty');
  });

  it('accepts non-empty commands', () => {
    expect(() => assertTransportCommand('uname -a')).not.toThrow();
  });
});
