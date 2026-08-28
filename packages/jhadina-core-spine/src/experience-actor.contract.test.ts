import { describe, expect, it } from 'vitest';
import { normalizeActor } from './experience.js';

describe('normalizeActor', () => {
  it.each([
    ['user', 'user'],
    ['USER', 'user'],
    ['jhadina', 'jhadina'],
    ['external', 'external'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeActor(input)).toBe(expected);
  });

  it.each([undefined, '', 'admin', 'service-account', 'unknown'])('maps unrecognized actor %s to system', (input) => {
    expect(normalizeActor(input)).toBe('system');
  });
});
