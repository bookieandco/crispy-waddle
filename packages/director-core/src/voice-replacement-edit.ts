export type PreservedSourceAudioKind=
  | 'nonverbal-vocalization'
  | 'foley'
  | 'sfx'
  | 'ambience'
  | 'other';

export interface TimedAudioRegion {
  id:string;
  startSeconds:number;
  endSeconds:number;
  evidenceIds:readonly string[];
}

export interface DialogueReplacementRegion extends TimedAudioRegion {
  lineId:string;
}

export interface PreservedSourceAudioRegion extends TimedAudioRegion {
  kind:PreservedSourceAudioKind;
  label:string;
}

export interface VoiceReplacementEditPlan {
  id:string;
  projectId:string;
  characterId:string;
  voiceIdentityId:string;
  sourceVideoAssetId:string;
  sourceAudioAssetId:string;
  replacementDialogueAssetId:string;
  dialogueRegions:readonly DialogueReplacementRegion[];
  preserveSourceAudioRegions:readonly PreservedSourceAudioRegion[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_VOICE_REPLACEMENT_EDIT';
}

export function validateVoiceReplacementEditPlan(
  plan:VoiceReplacementEditPlan,
):readonly string[]{
  const reasons:string[]=[];
  if(
    !plan.id.trim()||
    !plan.projectId.trim()||
    !plan.characterId.trim()||
    !plan.voiceIdentityId.trim()||
    !plan.sourceVideoAssetId.trim()||
    !plan.sourceAudioAssetId.trim()||
    !plan.replacementDialogueAssetId.trim()
  ) reasons.push('DIRECTOR_VOICE_REPLACEMENT_IDENTITY_REQUIRED');
  if(!plan.dialogueRegions.length) reasons.push('DIRECTOR_VOICE_REPLACEMENT_DIALOGUE_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_VOICE_REPLACEMENT_EVIDENCE_REQUIRED');

  const validateRange=(region:TimedAudioRegion,prefix:string)=>{
    if(
      !region.id.trim()||
      !Number.isFinite(region.startSeconds)||
      !Number.isFinite(region.endSeconds)||
      region.startSeconds<0||
      region.endSeconds<=region.startSeconds||
      !region.evidenceIds.length
    ) reasons.push(`${prefix}:${region.id||'unknown'}`);
  };

  for(const region of plan.dialogueRegions){
    validateRange(region,'DIRECTOR_VOICE_REPLACEMENT_DIALOGUE_REGION_INVALID');
    if(!region.lineId.trim()) reasons.push(`DIRECTOR_VOICE_REPLACEMENT_LINE_REQUIRED:${region.id}`);
  }
  for(const region of plan.preserveSourceAudioRegions){
    validateRange(region,'DIRECTOR_VOICE_REPLACEMENT_PRESERVE_REGION_INVALID');
    if(!region.label.trim()) reasons.push(`DIRECTOR_VOICE_REPLACEMENT_PRESERVE_LABEL_REQUIRED:${region.id}`);
  }

  for(const preserve of plan.preserveSourceAudioRegions){
    for(const dialogue of plan.dialogueRegions){
      if(overlaps(preserve,dialogue)){
        reasons.push(`DIRECTOR_VOICE_REPLACEMENT_REGION_CONFLICT:${preserve.id}:${dialogue.id}`);
      }
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

function overlaps(a:TimedAudioRegion,b:TimedAudioRegion):boolean{
  return a.startSeconds<b.endSeconds&&b.startSeconds<a.endSeconds;
}
