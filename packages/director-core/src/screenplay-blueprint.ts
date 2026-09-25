export type SceneInteriorExterior='INT'|'EXT'|'INT/EXT';

export interface StoryTreatment {
  id:string;
  projectId:string;
  title:string;
  synopsis:string;
  beginning:string;
  middle:string;
  ending:string;
  characterRefs:readonly string[];
  locationRefs:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_STORY_TREATMENT';
}

export interface ScreenplayDialogueLine {
  id:string;
  characterId:string;
  text:string;
  parenthetical?:string;
  evidenceIds:readonly string[];
}

export interface ScreenplayScene {
  id:string;
  projectId:string;
  order:number;
  interiorExterior:SceneInteriorExterior;
  location:string;
  timeOfDay:string;
  action:readonly string[];
  dialogue:readonly ScreenplayDialogueLine[];
  treatmentId:string;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_SCREENPLAY_SCENE';
}

export interface ShootingScriptAnnotation {
  id:string;
  projectId:string;
  sceneId:string;
  shotIds:readonly string[];
  cameraDirection?:string;
  lightingDirection?:string;
  productionNotes:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_SHOOTING_SCRIPT_ANNOTATION';
}

export interface ScreenplayBlueprintDecision {
  valid:boolean;
  reasons:readonly string[];
  authority:'DIRECTOR_SCREENPLAY_BLUEPRINT_QC';
}

export function validateScreenplayBlueprint(input:{
  treatment:StoryTreatment;
  scenes:readonly ScreenplayScene[];
  shootingAnnotations?:readonly ShootingScriptAnnotation[];
}):ScreenplayBlueprintDecision{
  const reasons:string[]=[];
  const {treatment,scenes}=input;

  if(!treatment.id.trim()||!treatment.projectId.trim()||!treatment.title.trim()||!treatment.synopsis.trim()){
    reasons.push('DIRECTOR_TREATMENT_IDENTITY_REQUIRED');
  }
  for(const [field,value] of Object.entries({
    beginning:treatment.beginning,
    middle:treatment.middle,
    ending:treatment.ending,
  })){
    if(!value.trim()) reasons.push(`DIRECTOR_TREATMENT_STRUCTURE_REQUIRED:${field}`);
  }
  if(!treatment.evidenceIds.length) reasons.push('DIRECTOR_TREATMENT_EVIDENCE_REQUIRED');
  if(!scenes.length) reasons.push('DIRECTOR_SCREENPLAY_SCENES_REQUIRED');

  const sceneIds=new Set<string>();
  const orders=new Set<number>();
  for(const scene of scenes){
    if(!scene.id.trim()||sceneIds.has(scene.id)) reasons.push(`DIRECTOR_SCREENPLAY_SCENE_ID_INVALID:${scene.id||'unknown'}`);
    sceneIds.add(scene.id);
    if(scene.projectId!==treatment.projectId||scene.treatmentId!==treatment.id){
      reasons.push(`DIRECTOR_SCREENPLAY_SCENE_LINEAGE_MISMATCH:${scene.id}`);
    }
    if(!Number.isInteger(scene.order)||scene.order<1||orders.has(scene.order)){
      reasons.push(`DIRECTOR_SCREENPLAY_SCENE_ORDER_INVALID:${scene.id}`);
    }
    orders.add(scene.order);
    if(!scene.location.trim()||!scene.timeOfDay.trim()||!scene.evidenceIds.length){
      reasons.push(`DIRECTOR_SCREENPLAY_SCENE_CONTEXT_REQUIRED:${scene.id}`);
    }
    if(!scene.action.length&&!scene.dialogue.length){
      reasons.push(`DIRECTOR_SCREENPLAY_SCENE_EMPTY:${scene.id}`);
    }
    for(const line of scene.dialogue){
      if(!line.id.trim()||!line.characterId.trim()||!line.text.trim()||!line.evidenceIds.length){
        reasons.push(`DIRECTOR_SCREENPLAY_DIALOGUE_INVALID:${line.id||'unknown'}`);
      }
    }
  }

  for(const annotation of input.shootingAnnotations??[]){
    if(
      !annotation.id.trim()||
      annotation.projectId!==treatment.projectId||
      !sceneIds.has(annotation.sceneId)||
      !annotation.evidenceIds.length
    ){
      reasons.push(`DIRECTOR_SHOOTING_SCRIPT_ANNOTATION_INVALID:${annotation.id||'unknown'}`);
    }
    if(!annotation.shotIds.length&&!annotation.productionNotes.length&&!annotation.cameraDirection&&!annotation.lightingDirection){
      reasons.push(`DIRECTOR_SHOOTING_SCRIPT_ANNOTATION_EMPTY:${annotation.id||'unknown'}`);
    }
  }

  return Object.freeze({
    valid:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_SCREENPLAY_BLUEPRINT_QC',
  });
}
