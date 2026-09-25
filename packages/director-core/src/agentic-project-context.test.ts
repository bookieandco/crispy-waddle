import {describe,expect,it} from 'vitest';
import {
  resolveAgenticSceneContext,
  summarizeAgenticSceneCost,
  validateAgenticProjectContext,
  validateDirectorCollaborationProfile,
  type AgenticProjectContext,
} from './agentic-project-context';
import type { CreativeWorkspaceLibrary } from './creative-workspace-media';

const context:AgenticProjectContext={
  id:'context:precious-cargo',
  projectId:'p',
  scriptAssetId:'script:film',
  assets:[
    {assetId:'style:film',role:'style',semanticLabel:'project visual style',media:'image',global:true,evidenceIds:['style:approved']},
    {assetId:'character:harper',role:'character',semanticLabel:'Harper character sheet',media:'image',global:false,evidenceIds:['char:approved']},
    {assetId:'location:train',role:'location',semanticLabel:'last train car',media:'image',global:false,evidenceIds:['location:approved']},
    {assetId:'prop:book',role:'prop',semanticLabel:'paperback book',media:'image',global:false,evidenceIds:['prop:book']},
    {assetId:'prop:binoculars',role:'prop',semanticLabel:'binoculars',media:'image',global:false,evidenceIds:['prop:binoculars']},
    {assetId:'prop:bow',role:'prop',semanticLabel:'bow and arrows',media:'image',global:false,evidenceIds:['prop:bow']},
    {assetId:'spider',role:'character',semanticLabel:'attacking spider design',media:'image',global:false,evidenceIds:['spider:approved']},
  ],
  scenes:[
    {
      id:'scene:opening',
      order:1,
      startSeconds:0,
      endSeconds:13,
      direction:'Harper reads on the moving train, then notices danger.',
      requiredAssetIds:['character:harper','location:train','prop:book'],
      optionalAssetIds:['prop:binoculars','prop:bow'],
      excludedAssetIds:['spider'],
      evidenceIds:['script:opening'],
    },
    {
      id:'scene:attack',
      order:2,
      startSeconds:13,
      endSeconds:21,
      direction:'Spiders attack while Harper defends the train.',
      requiredAssetIds:['character:harper','location:train','spider','prop:bow'],
      optionalAssetIds:['prop:binoculars'],
      excludedAssetIds:['prop:book'],
      evidenceIds:['script:attack'],
    },
  ],
  evidenceIds:['project:approved-context'],
  authority:'DIRECTOR_AGENTIC_PROJECT_CONTEXT',
};

const library:CreativeWorkspaceLibrary={
  projectId:'p',
  allAssets:[
    {id:'script:film',projectId:'p',origin:'uploaded',mediaType:'unknown',uri:'file://script',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['script']},
    {id:'style:film',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://style',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['style']},
    {id:'character:harper',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://harper',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['harper']},
    {id:'location:train',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://train',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['train']},
    {id:'prop:book',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://book',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['book']},
    {id:'prop:binoculars',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://binoculars',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['binoculars']},
    {id:'prop:bow',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://bow',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['bow']},
    {id:'spider',projectId:'p',origin:'uploaded',mediaType:'image',uri:'file://spider',createdAt:'2026-09-25T00:00:00Z',provenanceRefs:['spider']},
  ],
  generatedHistory:[],
  capturedMedia:[],
  mediaCounts:{image:7,video:0,audio:0,'3d':0,motion:0,subtitle:0,unknown:1},
  authority:'DIRECTOR_CREATIVE_WORKSPACE_LIBRARY',
};

function estimate(id:string,unit:'per-second'|'per-token'|'per-request'|'custom',quantity:number,unitPriceUsd:number){
  return {
    id,
    projectId:'p',
    provider:'provider',
    modelId:'model',
    pricingUnit:unit,
    pricingSourceRef:'pricing:current',
    quantity,
    unitPriceUsd,
    estimatedCostUsd:quantity*unitPriceUsd,
    derivedAt:'2026-09-25T00:00:00Z',
    assumptions:['provider estimate'],
  };
}

describe('agentic project context',()=>{
  it('resolves generate-scene-by-id from persistent project context without rebinding unrelated assets',()=>{
    expect(validateAgenticProjectContext(context)).toEqual([]);
    const resolved=resolveAgenticSceneContext({
      id:'execute:opening',
      context,
      library,
      sceneId:'scene:opening',
      supplementalAssetIds:['prop:binoculars'],
      evidenceIds:['user:generate-scene-1'],
    });
    expect(resolved.targetDurationSeconds).toBe(13);
    expect(resolved.boundAssetIds).toEqual(expect.arrayContaining([
      'style:film','character:harper','location:train','prop:book','prop:binoculars',
    ]));
    expect(resolved.boundAssetIds).not.toContain('spider');
    expect(resolved.generationReferences.references.map(reference=>reference.assetId)).not.toContain('prop:bow');
  });

  it('rejects manual over-binding of assets that are not relevant to the scene',()=>{
    expect(()=>resolveAgenticSceneContext({
      id:'execute:opening',
      context,
      library,
      sceneId:'scene:opening',
      supplementalAssetIds:['spider'],
      evidenceIds:['user:extra-ref'],
    })).toThrow('DIRECTOR_AGENTIC_SCENE_SUPPLEMENTAL_NOT_ALLOWED:spider');
  });

  it('separates media, reference, orchestration and repair spend',()=>{
    const summary=summarizeAgenticSceneCost({
      id:'cost:scene-1',
      projectId:'p',
      sceneId:'scene:opening',
      components:[
        {kind:'media-generation',estimate:estimate('media','per-second',13,.5),evidenceIds:['pricing:video']},
        {kind:'reference-surcharge',estimate:estimate('refs','per-request',1,1.25),evidenceIds:['pricing:references']},
        {kind:'orchestration',estimate:estimate('agent','per-token',1000,.0002),evidenceIds:['pricing:agent']},
        {kind:'repair',estimate:estimate('repair','custom',1,.8),evidenceIds:['pricing:repair']},
      ],
      evidenceIds:['cost-plan:scene-1'],
      authority:'DIRECTOR_AGENTIC_SCENE_COST',
    });
    expect(summary.reasons).toEqual([]);
    expect(summary.totalEstimatedUsd).toBeCloseTo(8.75);
    expect(summary.byKind.orchestration).toBeCloseTo(.2);
  });

  it('supports an evidence-only technical collaborator profile instead of automatic hype',()=>{
    expect(validateDirectorCollaborationProfile({
      id:'collab:technical',
      mode:'technical-collaborator',
      responseStyle:'concise',
      praisePolicy:'evidence-only',
      optimizeForModelId:'video-model',
      evidenceIds:['project:collaboration-setting'],
      authority:'DIRECTOR_COLLABORATION_PROFILE',
    })).toEqual([]);
  });
});
