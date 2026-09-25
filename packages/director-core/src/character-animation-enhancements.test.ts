import { describe, expect, it, vi } from 'vitest';
import {
  validateCharacterLocomotionPlan,
  validateCharacterMotionEffectsPlan,
  validateLipSyncTuningPlan,
  type CharacterLocomotionPlan,
  type CharacterMotionEffectsPlan,
  type LipSyncTuningPlan,
} from './character-animation-enhancements';
import { createVoiceSyncProvider } from './studio-voice-sync';
import { createRigAnimationProvider } from './studio-rig-animation';
import { createDirectorStudioAction } from './studio-governed-action';

const tuning:LipSyncTuningPlan={
  id:'lip-tuning:1',
  projectId:'project-1',
  visemeDensity:.65,
  audioGateDb:-36,
  visualMouthGateStrength:.7,
  algorithmProfile:'current',
  evidenceIds:['mic-profile:actor-1'],
  authority:'DIRECTOR_LIP_SYNC_TUNING',
};

const motion:CharacterMotionEffectsPlan={
  id:'motion:1',
  projectId:'project-1',
  characterAssetId:'character-1',
  motionLines:[{
    id:'motion-line:right-wrist',
    attachment:'right-wrist',
    velocityThreshold:.6,
    lifespanFrames:5,
    fade:true,
    opacity:.45,
  }],
  particleTrails:[{
    id:'particle:wand',
    attachment:'wand-tip',
    velocityThreshold:.1,
    lifespanFrames:24,
    gravityScale:0,
    particleAssetId:'particle:star',
    followPointer:true,
  }],
  evidenceIds:['direction:subtle-motion'],
  authority:'DIRECTOR_CHARACTER_MOTION_EFFECTS',
};

const locomotion:CharacterLocomotionPlan={
  id:'locomotion:1',
  projectId:'project-1',
  characterAssetId:'character-1',
  gait:'walk',
  fps:24,
  keyframes:[
    {id:'position:0',timeSeconds:0,positionX:-1,positionY:0,interpolation:'smooth'},
    {id:'position:1',timeSeconds:3,positionX:1,positionY:0,interpolation:'smooth'},
  ],
  preserveFootPlant:true,
  evidenceIds:['blocking:scene-1'],
  authority:'DIRECTOR_CHARACTER_LOCOMOTION',
};

const track={
  trackId:'track-1',
  class:'character' as const,
  instanceId:'character-1',
  frameStart:0,
  frameEnd:72,
  annotations:[{frame:0,class:'character' as const,instanceId:'character-1',confidence:.95}],
  source:'hybrid' as const,
  confidence:.95,
  approved:true,
};

describe('character animation enhancements',()=>{
  it('validates bounded lip-sync tuning controls',()=>{
    expect(validateLipSyncTuningPlan(tuning)).toEqual([]);
    expect(validateLipSyncTuningPlan({...tuning,visemeDensity:1.4})).toContain('DIRECTOR_LIP_SYNC_VISEME_DENSITY_INVALID');
  });

  it('validates velocity-triggered motion lines and particle trails',()=>{
    expect(validateCharacterMotionEffectsPlan(motion)).toEqual([]);
    expect(validateCharacterMotionEffectsPlan({
      ...motion,
      motionLines:[{...motion.motionLines[0]!,lifespanFrames:0}],
    })).toContain('DIRECTOR_MOTION_EFFECTS_LIFESPAN_INVALID:motion-line:right-wrist');
  });

  it('requires ordered path keyframes for position-driven walking',()=>{
    expect(validateCharacterLocomotionPlan(locomotion)).toEqual([]);
    expect(validateCharacterLocomotionPlan({
      ...locomotion,
      keyframes:[locomotion.keyframes[1]!,locomotion.keyframes[0]!],
    })).toContain('DIRECTOR_LOCOMOTION_KEYFRAMES_UNSORTED');
  });

  it('forwards lip-sync tuning through the governed voice-sync path',async()=>{
    const synchronize=vi.fn(async()=>({
      artifactId:'sync-1',videoAssetId:'video-1',audioAssetId:'audio-1',
      provider:'sync-test',syncEvidenceIds:['alignment:1'],averageConfidence:.94,
    }));
    const provider=createVoiceSyncProvider({name:'sync-test',synchronize});
    const req=createDirectorStudioAction({
      id:'sync:1',userId:'user-1',requestedAt:'now',projectId:'project-1',
      capability:'voice-sync',inputAssetIds:['video-1','audio-1'],
      parameters:{
        mode:'viseme-driven',
        tracks:[{startMs:0,endMs:250,phoneme:'AH',viseme:'A',confidence:.95}],
        tuningPlan:tuning,
      },
    });
    const result=await provider.execute(req.action,req);
    expect(synchronize).toHaveBeenCalledWith(expect.objectContaining({tuningPlan:tuning}));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'lip-sync-tuning:lip-tuning:1',
      'lip-sync-audio-gate-db:-36',
      'lip-sync-visual-gate:0.7',
    ]));
  });

  it('forwards motion and locomotion plans through the governed rig path',async()=>{
    const animate=vi.fn(async()=>({
      artifactId:'motion-1',rigAssetId:'rig-1',animationAssetId:'anim-1',
      provider:'rig-test',evidenceIds:['solve:1'],frameStart:0,frameEnd:72,
    }));
    const provider=createRigAnimationProvider({name:'rig-test',animate});
    const req=createDirectorStudioAction({
      id:'rig:1',userId:'user-1',requestedAt:'now',projectId:'project-1',
      capability:'rig',inputAssetIds:['character-1'],
      parameters:{
        trackingArtifactId:'tracking-1',
        tracks:[track],
        channels:['body','hands'],
        motionEffectsPlan:motion,
        locomotionPlan:locomotion,
      },
    });
    const result=await provider.execute(req.action,req);
    expect(animate).toHaveBeenCalledWith(expect.objectContaining({
      motionEffectsPlan:motion,
      locomotionPlan:locomotion,
    }));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'motion-effects:motion:1',
      'locomotion:locomotion:1',
      'locomotion-foot-plant:true',
    ]));
  });
});
