import { describe, expect, it } from 'vitest';
import { deriveDirectorNativeImprovements, extractDirectorProcessObservation } from './process-observation.js';
import { compileProcessRecipe } from './process-replication.js';

describe('Director process observation and native improvement', () => {
  it('accepts structured process-step observations and rejects unrelated observations', () => {
    const extracted = extractDirectorProcessObservation({
      id:'obs:1',assetId:'study:1',kind:'process-step',
      time:{startSeconds:10,endSeconds:20},confidence:.9,
      provenance:{provider:'study-observer',source:'reference-video',sourceUrl:'https://example.com/tutorial'},
      payload:{processStep:{order:2,kind:'character',purpose:'keep the face consistent',operation:'reroll until the face looks right',requiredCapabilities:['image-generation'],inputs:['prompt'],outputs:['portrait'],failureModes:['identity drift']}},
    });
    expect(extracted?.kind).toBe('character');
    expect(extracted?.evidenceIds).toEqual(['obs:1']);
    expect(extractDirectorProcessObservation({
      id:'obs:2',assetId:'study:1',kind:'caption',time:{startSeconds:0,endSeconds:1},confidence:.8,
      provenance:{provider:'x',source:'y'},payload:{text:'hello'},
    })).toBeUndefined();
  });

  it('replaces known fragile patterns with stronger Director-native controls', () => {
    const recipe = compileProcessRecipe({
      id:'recipe:1',projectId:'p',objective:'recreate',sourceRefs:['ref:1'],
      observations:[{
        id:'s1',sourceId:'ref:1',order:0,kind:'character',purpose:'same face',
        operation:'reroll until close',requiredCapabilities:['text-to-image'],inputs:['prompt'],outputs:['image'],
        qcChecks:[],failureModes:['identity drift'],evidenceIds:['obs:1'],
      }],
    });
    const improvements = deriveDirectorNativeImprovements(recipe);
    expect(improvements).toHaveLength(1);
    expect(improvements[0]?.replacementCapabilities).toContain('certified-visual-adapter');
    expect(improvements[0]?.replacementQcChecks).toContain('identity-lock');
  });
});
