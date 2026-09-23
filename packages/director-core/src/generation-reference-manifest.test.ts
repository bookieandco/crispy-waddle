import { describe, expect, it } from 'vitest';
import {
  compileGenerationReferenceManifest,
  selectRelevantGenerationReferences,
  validateGenerationReferenceManifest,
  type GenerationReferenceManifest,
} from './generation-reference-manifest.js';

function manifest(): GenerationReferenceManifest {
  return {
    id: 'refs:soda:shot-5',
    projectId: 'ad:soda',
    shotId: 'shot:5',
    authority: 'DIRECTOR_REFERENCE_MANIFEST',
    references: [
      {
        slot: 1,
        assetId: 'video:blockout',
        media: 'video',
        role: 'motion',
        semanticLabel: 'authored greybox timing and camera movement',
        promptToken: 'BLOCKOUT',
        required: true,
        evidenceIds: ['e:blockout'],
      },
      {
        slot: 2,
        assetId: 'image:lime-can',
        media: 'image',
        role: 'product-identity',
        semanticLabel: 'lime flavor hero can',
        promptToken: 'LIME_CAN',
        required: true,
        evidenceIds: ['e:lime'],
      },
      {
        slot: 3,
        assetId: 'image:glass',
        media: 'image',
        role: 'style',
        semanticLabel: 'finished carbonated drink appearance',
        promptToken: 'FINISHED_DRINK',
        required: false,
        evidenceIds: ['e:glass'],
      },
      {
        slot: 4,
        assetId: 'image:unused-carton',
        media: 'image',
        role: 'custom',
        semanticLabel: 'retail 12-pack carton not visible in this shot',
        required: false,
        evidenceIds: ['e:carton'],
      },
    ],
  };
}

describe('generation reference manifest', () => {
  it('keeps provider reference order deterministic and semantic', () => {
    const result = compileGenerationReferenceManifest(manifest());
    expect(result.orderedAssetIds).toEqual([
      'video:blockout',
      'image:lime-can',
      'image:glass',
      'image:unused-carton',
    ]);
    expect(result.tokenToAssetId.LIME_CAN).toBe('image:lime-can');
    expect(result.directive).toContain('meaning "lime flavor hero can"');
  });

  it('removes irrelevant optional references and compacts positional slots', () => {
    const selected = selectRelevantGenerationReferences(manifest(), ['product-identity', 'style']);
    expect(selected.references.map((reference) => reference.assetId)).toEqual([
      'video:blockout',
      'image:lime-can',
      'image:glass',
    ]);
    expect(selected.references.map((reference) => reference.slot)).toEqual([1, 2, 3]);
  });

  it('fails closed on positional gaps', () => {
    const invalid = manifest();
    invalid.references = invalid.references.map((reference) =>
      reference.slot === 2 ? { ...reference, slot: 7 } : reference,
    );
    const issues = validateGenerationReferenceManifest(invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_SLOT_GAP' }),
    ]));
  });

  it('rejects duplicate prompt tokens', () => {
    const invalid = manifest();
    invalid.references = invalid.references.map((reference) =>
      reference.slot === 3 ? { ...reference, promptToken: 'LIME_CAN' } : reference,
    );
    const issues = validateGenerationReferenceManifest(invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_PROMPT_TOKEN_DUPLICATE' }),
    ]));
  });
});
