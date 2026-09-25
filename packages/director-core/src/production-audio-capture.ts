export type ProductionMicrophoneKind='directional-boom'|'lavalier'|'camera-reference'|'other';

export interface ProductionMicrophonePlacement {
  id:string;
  microphoneKind:ProductionMicrophoneKind;
  targetSubjectId?:string;
  distanceToTargetMeters?:number;
  hiddenFromPicture:boolean;
  purpose:string;
  evidenceIds:readonly string[];
}

export interface RoomToneCapture {
  id:string;
  sceneId:string;
  locationId:string;
  durationSeconds:number;
  observedNoiseSources:readonly string[];
  assetId:string;
  evidenceIds:readonly string[];
}

export interface ProductionAudioScenePlan {
  id:string;
  projectId:string;
  sceneId:string;
  dialogueExpected:boolean;
  microphonePlacements:readonly ProductionMicrophonePlacement[];
  cameraReferenceAudio:boolean;
  syncReference?:string;
  roomTone:readonly RoomToneCapture[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_PRODUCTION_AUDIO_PLAN';
}

export interface ProductionAudioPolicy {
  minimumRoomToneSeconds?:number;
  requireDedicatedDialogueMicrophone:boolean;
  requireCameraReferenceAudio:boolean;
}

export function validateProductionAudioScenePlan(
  plan:ProductionAudioScenePlan,
  policy:ProductionAudioPolicy,
):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.sceneId.trim()){
    reasons.push('DIRECTOR_PRODUCTION_AUDIO_IDENTITY_REQUIRED');
  }
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_PRODUCTION_AUDIO_EVIDENCE_REQUIRED');

  for(const mic of plan.microphonePlacements){
    if(!mic.id.trim()||!mic.purpose.trim()||!mic.evidenceIds.length){
      reasons.push(`DIRECTOR_PRODUCTION_AUDIO_MIC_INVALID:${mic.id||'unknown'}`);
    }
    if(
      mic.distanceToTargetMeters!==undefined&&
      (!Number.isFinite(mic.distanceToTargetMeters)||mic.distanceToTargetMeters<0)
    ){
      reasons.push(`DIRECTOR_PRODUCTION_AUDIO_MIC_DISTANCE_INVALID:${mic.id}`);
    }
  }

  if(plan.dialogueExpected&&policy.requireDedicatedDialogueMicrophone){
    const dedicated=plan.microphonePlacements.some(mic=>
      mic.microphoneKind==='directional-boom'||mic.microphoneKind==='lavalier'
    );
    if(!dedicated) reasons.push('DIRECTOR_PRODUCTION_AUDIO_DEDICATED_DIALOGUE_MIC_REQUIRED');
  }
  if(policy.requireCameraReferenceAudio&&!plan.cameraReferenceAudio){
    reasons.push('DIRECTOR_PRODUCTION_AUDIO_CAMERA_REFERENCE_REQUIRED');
  }

  for(const room of plan.roomTone){
    if(
      !room.id.trim()||
      room.sceneId!==plan.sceneId||
      !room.locationId.trim()||
      !room.assetId.trim()||
      !room.evidenceIds.length||
      !Number.isFinite(room.durationSeconds)||
      room.durationSeconds<=0
    ){
      reasons.push(`DIRECTOR_ROOM_TONE_INVALID:${room.id||'unknown'}`);
    }
    if(
      policy.minimumRoomToneSeconds!==undefined&&
      room.durationSeconds<policy.minimumRoomToneSeconds
    ){
      reasons.push(`DIRECTOR_ROOM_TONE_TOO_SHORT:${room.id}`);
    }
  }
  if(plan.dialogueExpected&&!plan.roomTone.length){
    reasons.push('DIRECTOR_ROOM_TONE_REQUIRED_FOR_DIALOGUE_SCENE');
  }

  return Object.freeze([...new Set(reasons)]);
}

export const FILMMAKING_101_AUDIO_CAPTURE_PROFILE:ProductionAudioPolicy=Object.freeze({
  minimumRoomToneSeconds:30,
  requireDedicatedDialogueMicrophone:true,
  requireCameraReferenceAudio:true,
});
