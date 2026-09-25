import { describe, expect, it, vi } from 'vitest';
import {
  validateLipSyncRepairPlan,
  validateMasterSceneScalePlan,
  validatePreRenderCachePlan,
  validateShotRigScopePlan,
  validateSpriteSequencePlan,
  type LipSyncRepairPlan,
  type MasterSceneScalePlan,
  type PreRenderCachePlan,
  type ShotRigScopePlan,
  type SpriteSequencePlan,
} from './cartoon-production-workflow';
import { createVoiceSyncProvider } from './studio-voice-sync';
import { createRigAnimationProvider } from './studio-rig-animation';
import { createStudioRenderProvider } from './studio-render';
import { createDirectorStudioAction } from './studio-governed-action';

const repair:LipSyncRepairPlan={
  id:'repair:1',
  projectId:'project-1',
  audioAssetId:'audio-1',
  audioDurationMs:30_000,
  segments:[{
    id:'segment:1',startMs:8_000,endMs:18_000,strategy:'audio-only',
    reason:'transcript alignment failed only in this local interval',
    evidenceIds:['sync-failure-marker:8s'],
  }],
  evidenceIds:['dialogue:approved'],
  authority:'DIRECTOR_LIP_SYNC_REPAIR',
};

const scope:ShotRigScopePlan={
  id:'scope:extra-knight',
  projectId:'project-1',
  characterAssetId:'character-knight',
  shotIds:['shot:ending-gag'],
  requiredChannels:['face','hands'],
  mouthMode:'jaw-only',
  features:['dangle','arm-ik','automated-lights'],
  evidenceIds:['script:ending-gag'],
  authority:'DIRECTOR_SHOT_RIG_SCOPE',
};

const sequence:SpriteSequencePlan={
  id:'door-open',
  projectId:'project-1',
  targetAssetId:'prop:drawer-door',
  mode:'triggered',
  frameAssetIds:['door:1','door:2','door:3','door:4','door:5','door:6'],
  framesPerStep:1,
  trigger:'character hand reaches drawer',
  evidenceIds:['blocking:drawer-open'],
  authority:'DIRECTOR_SPRITE_SEQUENCE',
};

const cache:PreRenderCachePlan={
  id:'cache:xbox',
  projectId:'project-1',
  sourceVersionId:'animation-version:12',
  fps:24,
  frameStart:0,
  frameEnd:5230,
  width:1920,
  height:1080,
  imageFormat:'png',
  transparent:true,
  includeAudio:true,
  audioFormat:'wav',
  evidenceIds:['performance-lock:xbox'],
  authority:'DIRECTOR_PRE_RENDER_CACHE',
};

const scale:MasterSceneScalePlan={
  id:'master:apartment',
  projectId:'project-1',
  workingWidth:10_000,
  workingHeight:5_000,
  deliveryWidth:1920,
  deliveryHeight:1080,
  maximumRasterScale:1,
  evidenceIds:['shot-list:apartment'],
  authority:'DIRECTOR_MASTER_SCENE_SCALE',
};

const track={
  trackId:'track-1',class:'character' as const,instanceId:'character-knight',
  frameStart:0,frameEnd:24,
  annotations:[{frame:0,class:'character' as const,instanceId:'character-knight',confidence:.95}],
  source:'hybrid' as const,confidence:.95,approved:true,
};

describe('cartoon production workflow',()=>{
  it('isolates local transcript failures instead of forcing a whole-track fallback',()=>{
    expect(validateLipSyncRepairPlan(repair)).toEqual([]);
    expect(validateLipSyncRepairPlan({
      ...repair,
      segments:[
        repair.segments[0]!,
        {...repair.segments[0]!,id:'segment:2',startMs:17_000,endMs:20_000},
      ],
    })).toContain('DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_OVERLAP:segment:2');
  });

  it('supports deliberately minimal rigs for brief/background characters',()=>{
    expect(validateShotRigScopePlan(scope)).toEqual([]);
    expect(validateShotRigScopePlan({...scope,shotIds:[]})).toContain('DIRECTOR_SHOT_RIG_SCOPE_SHOTS_REQUIRED');
  });

  it('supports short triggered prop animations and recurring layer cycles',()=>{
    expect(validateSpriteSequencePlan(sequence)).toEqual([]);
    const loop:SpriteSequencePlan={
      ...sequence,id:'lights',mode:'loop',trigger:undefined,
      frameAssetIds:['light:1','light:2','light:3'],framesPerStep:47,
    };
    expect(validateSpriteSequencePlan(loop)).toEqual([]);
  });

  it('locks frame rate and output characteristics for prerender caches',()=>{
    expect(validatePreRenderCachePlan(cache)).toEqual([]);
    expect(validatePreRenderCachePlan({...cache,fps:0})).toContain('DIRECTOR_PRE_RENDER_CACHE_FPS_INVALID');
  });

  it('rejects master-scene plans that require raster assets above 100 percent',()=>{
    expect(validateMasterSceneScalePlan(scale)).toEqual([]);
    expect(validateMasterSceneScalePlan({...scale,maximumRasterScale:1.2}))
      .toContain('DIRECTOR_MASTER_SCENE_RASTER_UPSCALE_RISK');
  });

  it('routes regional repair evidence through governed voice sync',async()=>{
    const synchronize=vi.fn(async()=>({
      artifactId:'sync',videoAssetId:'video-1',audioAssetId:'audio-1',
      provider:'sync-test',syncEvidenceIds:['alignment'],averageConfidence:.93,
    }));
    const provider=createVoiceSyncProvider({name:'sync-test',synchronize});
    const req=createDirectorStudioAction({
      id:'sync:repair',userId:'u',requestedAt:'now',projectId:'project-1',
      capability:'voice-sync',inputAssetIds:['video-1','audio-1'],
      parameters:{
        mode:'viseme-driven',
        tracks:[{startMs:0,endMs:250,viseme:'A',confidence:.95}],
        repairPlan:repair,
      },
    });
    const result=await provider.execute(req.action,req);
    expect(synchronize).toHaveBeenCalledWith(expect.objectContaining({repairPlan:repair}));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'lip-sync-repair:repair:1',
      'lip-sync-repair-segment:segment:1:audio-only:8000-18000',
    ]));
  });

  it('routes shot rig scope through the existing rig provider',async()=>{
    const animate=vi.fn(async()=>({
      artifactId:'motion',rigAssetId:'rig',animationAssetId:'anim',
      provider:'rig-test',evidenceIds:['solve'],frameStart:0,frameEnd:24,
    }));
    const provider=createRigAnimationProvider({name:'rig-test',animate});
    const req=createDirectorStudioAction({
      id:'rig:scope',userId:'u',requestedAt:'now',projectId:'project-1',
      capability:'rig',inputAssetIds:['character-knight'],
      parameters:{trackingArtifactId:'tracking',tracks:[track],channels:['face','hands'],rigScopePlan:scope},
    });
    const result=await provider.execute(req.action,req);
    expect(animate).toHaveBeenCalledWith(expect.objectContaining({rigScopePlan:scope}));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'shot-rig-scope:scope:extra-knight',
      'shot-rig-mouth:jaw-only',
    ]));
  });

  it('routes cache, sprite and master-scene constraints through final render',async()=>{
    const render=vi.fn(async()=>({
      artifactId:'render-evidence',mediaAssetId:'cached-render',provider:'render-test',
      evidenceIds:['render:ok'],frameStart:0,frameEnd:5230,
    }));
    const provider=createStudioRenderProvider({name:'render-test',render});
    const req=createDirectorStudioAction({
      id:'render:cache',userId:'u',requestedAt:'now',projectId:'project-1',
      capability:'render',inputAssetIds:['source','composite','sync','anim','physics'],
      parameters:{frameStart:0,frameEnd:5230,cachePlan:cache,spriteSequences:[sequence],scalePlan:scale},
    });
    const result=await provider.execute(req.action,req);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({
      cachePlan:cache,spriteSequences:[sequence],scalePlan:scale,
    }));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'pre-render-cache:cache:xbox',
      'sprite-sequence:door-open:triggered',
      'master-scene-scale:master:apartment',
    ]));
  });
});
