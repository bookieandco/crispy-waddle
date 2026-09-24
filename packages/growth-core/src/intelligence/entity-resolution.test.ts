import { describe, expect, it } from 'vitest';
import { resolveEntity } from './entity-resolution.js';

describe('entity resolution', () => {
  const canonical = [{ id: 'entity:nike' as never, label: 'Nike, Inc.', aliases: ['Nike', 'nike.com'], externalIds: { wikidata: 'Q483915' } }];

  it('prefers stable external identifiers', () => {
    const result = resolveEntity({ id: 'mention:1' as never, label: 'Nike', source: 'news', externalIds: { wikidata: 'Q483915' } }, canonical);
    expect(result.canonicalId).toBe('entity:nike');
    expect(result.method).toBe('external_id');
    expect(result.confidence).toBe(1);
  });

  it('resolves known aliases without external ids', () => {
    const result = resolveEntity({ id: 'mention:2' as never, label: 'nike.com', source: 'web' }, canonical);
    expect(result.canonicalId).toBe('entity:nike');
    expect(result.method).toBe('exact_alias');
  });

  it('does not invent a match when evidence is absent', () => {
    const result = resolveEntity({ id: 'mention:3' as never, label: 'Nikee', source: 'social' }, canonical);
    expect(result.method).toBe('unresolved');
    expect(result.confidence).toBe(0);
  });
});
