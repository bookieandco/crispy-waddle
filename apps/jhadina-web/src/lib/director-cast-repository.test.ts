import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDirectorCastResolver } from './director-cast-repository';

type Row = Record<string, unknown>;

function clientWithTables(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const query: any = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        order: async () => ({ data: rows, error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe('Supabase Director cast resolver', () => {
  it('resolves canonical identity plus scene wardrobe and voice variant from normalized tables', async () => {
    const client = clientWithTables({
      director_cast_characters: [{
        id: 'cast-hero',
        project_id: 'movie-1',
        character_id: 'hero',
        display_name: 'Hero',
        archetype: 'human',
        continuity_ref: 'character:hero:v1',
        behavior_dna_ref: 'behavior:hero:v1',
        rig_asset_id: 'rig:hero:v1',
        canonical_appearance_variant_id: 'hero-base',
        locked_traits: ['brown eyes'],
        identity_fingerprint_refs: ['identity:hero:face:v1'],
        approved_at: '2026-09-22T00:00:00Z',
        approved_by: '11111111-1111-1111-1111-111111111111',
      }],
      director_character_appearance_variants: [
        {
          id: 'hero-base',
          project_id: 'movie-1',
          character_id: 'hero',
          kind: 'base',
          label: 'Base',
          reference_asset_ids: ['hero-ref-base'],
          reference_sha256s: ['sha-base'],
          wardrobe_notes: [],
          appearance_notes: [],
          approved_at: '2026-09-22T00:00:00Z',
          approved_by: '11111111-1111-1111-1111-111111111111',
          created_at: '2026-09-22T00:00:00Z',
        },
        {
          id: 'hero-suit',
          project_id: 'movie-1',
          character_id: 'hero',
          kind: 'wardrobe',
          label: 'Suit',
          reference_asset_ids: ['hero-ref-suit'],
          reference_sha256s: ['sha-suit'],
          wardrobe_notes: ['black suit'],
          appearance_notes: [],
          approved_at: '2026-09-22T00:00:00Z',
          approved_by: '11111111-1111-1111-1111-111111111111',
          created_at: '2026-09-22T00:00:01Z',
        },
      ],
      director_voice_identities: [{
        id: 'voice-hero',
        project_id: 'movie-1',
        character_id: 'hero',
        primary_language: 'en',
        default_variant_id: 'voice-hero-en',
      }],
      director_scene_character_bindings: [{
        project_id: 'movie-1',
        scene_id: 'scene-42',
        character_id: 'hero',
        appearance_variant_id: 'hero-suit',
        voice_identity_id: 'voice-hero',
        voice_variant_id: 'voice-hero-es',
        language: 'es',
      }],
    });

    const resolved = await new SupabaseDirectorCastResolver(client).resolve('hero', 'movie-1', 'scene-42');

    expect(resolved).toMatchObject({
      characterId: 'hero',
      continuityRef: 'character:hero:v1',
      canonicalAppearanceVariantId: 'hero-base',
      sceneAppearanceVariantId: 'hero-suit',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-es',
      language: 'es',
      behaviorDnaRef: 'behavior:hero:v1',
      rigAssetId: 'rig:hero:v1',
    });
    expect(resolved.referenceAssetIds).toEqual(['hero-ref-base', 'hero-ref-suit']);
    expect(resolved.referenceSha256s).toEqual(['sha-base', 'sha-suit']);
  });
});
