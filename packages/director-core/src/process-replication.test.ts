import { describe, expect, it } from 'vitest';
import {
  compileProcessRecipe,
  compileRecipeToCreativeStageGraph,
  detectProcessReplicationIntent,
  improveProcessRecipe,
} from './process-replication.js';

describe('Director process replication',()=>{
  it('routes study-and-recreate language separately from direct video generation',()=>{
    const intent=detectProcessReplicationIntent('Jhadina study https://example.com/tutorial and replicate this process better as an 8 minute film');
    expect(intent?.sourceUrls).toEqual(['https://example.com/tutorial']);
    expect(intent?.improve).toBe(true);
    expect(intent?.targetKind).toBe('film');
    expect(intent?.targetDurationSeconds).toBe(480);
  });

  it('compiles observations into an evidence-bound provider-neutral recipe',()=>{
    const recipe=compileProcessRecipe({
      id:'recipe:1',projectId:'film:1',objective:'make branded short',sourceRefs:['source:1'],
      observations:[
        {id:'step:identity',sourceId:'source:1',order:0,kind:'character',purpose:'keep face stable',operation:'build canonical identity references',requiredCapabilities:['identity-reference'],inputs:['brief'],outputs:['character-pack'],qcChecks:['identity-lock'],failureModes:['face-drift'],evidenceIds:['obs:1']},
        {id:'step:video',sourceId:'source:1',order:1,kind:'generation',purpose:'create motion',operation:'generate reference-preserving video',requiredCapabilities:['image-to-video','character-reference'],inputs:['character-pack'],outputs:['take'],qcChecks:['temporal-identity'],failureModes:['identity-drift'],evidenceIds:['obs:2']},
      ],
    });
    expect(recipe.steps[1]?.dependsOn).toEqual(['step:identity']);
    expect(recipe.mode).toBe('reference');
  });

  it('records why Jhadina changed a weak reference step instead of silently mutating it',()=>{
    const recipe=compileProcessRecipe({
      id:'recipe:1',projectId:'film:1',objective:'test',sourceRefs:['source:1'],
      observations:[{id:'step:1',sourceId:'source:1',order:0,kind:'generation',purpose:'character consistency',operation:'reroll until close',requiredCapabilities:['text-to-image'],inputs:['prompt'],outputs:['image'],qcChecks:[],failureModes:['identity drift'],evidenceIds:['obs:1']}],
    });
    const improved=improveProcessRecipe(recipe,[{
      id:'improve:1',stepId:'step:1',reason:'canonical identity + held-out QC is less fragile than prompt rerolls',
      replacementOperation:'use certified identity adapter and reference pack',
      replacementCapabilities:['identity-reference','visual-adapter'],
      replacementQcChecks:['identity-lock','held-out-checkpoint-certification'],
      evidenceIds:['director:identity-cert'],
    }]);
    expect(improved.mode).toBe('improved');
    expect(improved.improvementReceipts[0]?.beforeOperation).toBe('reroll until close');
    expect(improved.steps[0]?.requiredCapabilities).toContain('visual-adapter');
  });

  it('turns the improved recipe into canonical Director stages',()=>{
    const recipe=compileProcessRecipe({
      id:'recipe:2',projectId:'film:2',objective:'test',sourceRefs:['source:1'],
      observations:[
        {id:'s1',sourceId:'source:1',order:0,kind:'concept',purpose:'concept',operation:'define concept',requiredCapabilities:[],inputs:[],outputs:['concept'],qcChecks:[],failureModes:[],evidenceIds:['e1']},
        {id:'s2',sourceId:'source:1',order:1,kind:'storyboard',purpose:'board',operation:'storyboard',requiredCapabilities:['storyboard'],inputs:['concept'],outputs:['board'],qcChecks:[],failureModes:[],evidenceIds:['e2']},
        {id:'s3',sourceId:'source:1',order:2,kind:'review',purpose:'review',operation:'coherence review',requiredCapabilities:['coherence-qc'],inputs:['board'],outputs:['qc'],qcChecks:['coherence'],failureModes:[],evidenceIds:['e3']},
      ],
    });
    const graph=compileRecipeToCreativeStageGraph(recipe);
    expect(graph.list().map(stage=>stage.kind)).toEqual(['vision','storyboard','review']);
    expect(graph.get('process:recipe:2:s2')?.dependsOn).toEqual(['process:recipe:2:s1']);
  });
});

it('maps performance work into the rehearsal stage before final generation',()=>{
  const recipe=compileProcessRecipe({
    id:'recipe:rehearse',projectId:'film:r',objective:'performance test',sourceRefs:['source:1'],
    observations:[
      {id:'p1',sourceId:'source:1',order:0,kind:'performance',purpose:'rehearse blocking and dialogue',operation:'run a performance rehearsal',requiredCapabilities:['performance'],inputs:['script'],outputs:['approved-performance'],qcChecks:['eyeline'],failureModes:['collision'],evidenceIds:['e1']},
      {id:'p2',sourceId:'source:1',order:1,kind:'generation',purpose:'render final',operation:'generate final take',requiredCapabilities:['video-generation'],inputs:['approved-performance'],outputs:['final-take'],qcChecks:['coherence'],failureModes:[],evidenceIds:['e2']},
    ],
  });
  const graph=compileRecipeToCreativeStageGraph(recipe);
  expect(graph.list().map(stage=>stage.kind)).toEqual(['rehearsal','generation']);
  expect(graph.get('process:recipe:rehearse:p2')?.dependsOn).toEqual(['process:recipe:rehearse:p1']);
});
