import {describe,expect,it} from 'vitest';
import {
  buildProductionAssetPackage,currentProductionPayloads,selectWardrobeLook,evaluateGarmentLock,
  preflightSpatialAction,chooseAdapterCheckpoint,evaluateProductionCoherence,
  resolveCreativeControl,planTimelineInterchange,type WorldStateGraph,
} from './production-foundry.js';

describe('production foundry convergence',()=>{
  it('keeps canonical references authoritative over model-specific cache payloads',()=>{
    const pkg=buildProductionAssetPackage({
      id:'asset:hoodie',version:1,kind:'wearable',displayName:'Bookie Hoodie',
      canonicalReferences:[{id:'front',assetId:'media:front',sha256:'a'.repeat(64),role:'front',rightsRef:'rights:owned',evidenceIds:['upload:1']}],
      descriptiveTags:['hoodie'],immutableTraits:['logo geometry'],changeableTraits:['lighting'],
      derivedPayloads:[{id:'p1',kind:'lora',engineId:'trainer',engineVersion:'1',artifactRef:'artifact:lora',sha256:'b'.repeat(64),sourceFingerprint:'front:front:'+ 'a'.repeat(64),createdAt:'2026-09-26T00:00:00Z',evidenceIds:['train:1']}],
      rights:{ownership:'owned',commercialUse:'allowed'},createdAt:'2026-09-26T00:00:00Z',updatedAt:'2026-09-26T00:00:00Z',
    });
    expect(currentProductionPayloads(pkg)).toHaveLength(1);
  });

  it('treats wardrobe as stateful inventory with explicit garment lock',()=>{
    const plan=selectWardrobeLook([{
      item:{id:'hoodie',characterId:'mike',productionAssetPackageRef:'asset:hoodie',metadata:{category:'top',subcategory:'hoodie',colors:['black'],styleTags:['streetwear'],materials:['cotton'],fitTags:['oversized']},state:'available',wearCount:2,commercialProductRef:'product:hoodie',evidenceIds:['wardrobe:1']},
      colorHarmony:.9,silhouetteFit:.9,characterStyleFit:.95,sceneFit:.9,continuityFit:1,commercialFit:.8,
    }],{characterId:'mike',requiredSlots:['top'],allowCommercialPlacement:true});
    expect(plan.commercialProductRefs).toEqual(['product:hoodie']);
    expect(evaluateGarmentLock({itemId:'hoodie',identityScore:.98,colorScore:.99,silhouetteScore:.97,materialScore:.95,logoOrPrintScore:.98,frameConsistencyScore:.96,evidenceIds:['vision:1']},{minimumIdentity:.9,minimumColor:.9,minimumSilhouette:.9,minimumMaterial:.9,minimumLogoOrPrint:.95,minimumFrameConsistency:.9})).toEqual([]);
  });

  it('fails physically impossible object actions before generation',()=>{
    const graph:WorldStateGraph={id:'w',projectId:'film',kind:'fictional',version:1,authority:'DIRECTOR_WORLD_STATE',entities:[
      {id:'mike',kind:'character',label:'Mike',evidenceIds:['canon:mike']},
      {id:'pipe',kind:'asset',label:'Pipe',affordances:['hold','place'],evidenceIds:['asset:pipe']},
      {id:'room',kind:'location',label:'Room',evidenceIds:['set:room']},
    ],relations:[
      {id:'r1',subjectId:'mike',kind:'at',objectId:'room',validFrom:'2026-09-26T00:00:00Z',evidenceIds:['block:1']},
      {id:'r2',subjectId:'pipe',kind:'at',objectId:'room',validFrom:'2026-09-26T00:00:00Z',evidenceIds:['block:2']},
    ]};
    expect(preflightSpatialAction(graph,{actorId:'mike',targetId:'pipe',affordance:'sit'}).admissible).toBe(false);
  });

  it('uses a checkpoint tournament instead of latest-checkpoint wins',()=>{
    const policy={requiredMetrics:['identity','quality','editability','overfit'] as const,minimums:{identity:.9,quality:.85,editability:.8},maximums:{overfit:.2},weights:{identity:.4,quality:.25,editability:.25,overfit:.1}};
    const chosen=chooseAdapterCheckpoint([
      {id:'c1',jobId:'j',step:100,artifactRef:'a',metrics:{identity:.94,quality:.9,editability:.88,overfit:.12},evidenceIds:['e1']},
      {id:'c2',jobId:'j',step:200,artifactRef:'b',metrics:{identity:.98,quality:.94,editability:.62,overfit:.3},evidenceIds:['e2']},
    ],policy);
    expect(chosen?.id).toBe('c1');
  });

  it('rejects polished output when cross-scene continuity is weak',()=>{
    const result=evaluateProductionCoherence([{id:'o',projectId:'film',segmentRef:'scene:3',startSeconds:30,endSeconds:40,metrics:{'story-causality':.95,'character-identity':.98,'wardrobe-continuity':.55,'visual-cleanliness':.99},evidenceByMetric:{'story-causality':['story'],'character-identity':['face'],'wardrobe-continuity':['wardrobe'],'visual-cleanliness':['qc']}}],{requiredMetrics:['story-causality','character-identity','wardrobe-continuity','visual-cleanliness'],minimums:{'story-causality':.8,'character-identity':.9,'wardrobe-continuity':.9,'visual-cleanliness':.9},weights:{'story-causality':.25,'character-identity':.25,'wardrobe-continuity':.25,'visual-cleanliness':.25}});
    expect(result.admissible).toBe(false);
    expect(result.rerunScopes).toEqual(['scene:3']);
  });

  it('keeps user creative locks above automation and protects interchange fidelity',()=>{
    expect(resolveCreativeControl([{id:'lock',projectId:'film',scope:'shot',scopeRef:'shot:10',key:'lens',mode:'pin',value:'35mm',createdBy:'user',createdAt:'2026-09-26T00:00:00Z',evidenceIds:['user:edit']}],{projectId:'film',scope:'shot',scopeRef:'shot:10',key:'lens',proposedValue:'85mm'}).allowed).toBe(false);
    expect(planTimelineInterchange({format:'edl',supportedFeatures:['source-ranges','transitions'],lossyFeatures:['keyframes'],supportsRoundTrip:false},{projectId:'film',timelineVersionId:'v2',requiredFeatures:['source-ranges','keyframes'],allowLossy:false,evidenceIds:['timeline:v2']}).admissible).toBe(false);
  });
});
