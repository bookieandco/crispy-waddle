import type { EnvironmentViewPack } from './continuity-reference-strategy.js';
import type { StoryboardReferenceBoard } from './storyboard-reference-board.js';
import type { GenerationCostEstimate } from './generation-spend-gate.js';

export type WorldSourceKind='image-derived'|'text-derived';
export type WorldReferenceUse='omni-reference'|'storyboard'|'first-frame'|'last-frame';

export interface WorldBuildPlan {
  id:string;
  projectId:string;
  environmentId:string;
  sourceKind:WorldSourceKind;
  sourceAssetId?:string;
  sourcePrompt?:string;
  previewAssetId?:string;
  canonicalStyleAssetIds:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_WORLD_BUILD_PLAN';
}

export interface WorldCameraPose {
  id:string;
  position:{x:number;y:number;z:number};
  rotationDegrees:{x:number;y:number;z:number};
  focalLengthMm:number;
  evidenceIds:readonly string[];
}

export interface WorldCharacterPlacement {
  characterId:string;
  position:{x:number;y:number;z:number};
  facingDegrees:number;
  lookAtCharacterId?:string;
  evidenceIds:readonly string[];
}

export interface WorldReferenceCapture {
  id:string;
  projectId:string;
  environmentId:string;
  worldPlanId:string;
  viewLabel:string;
  camera:WorldCameraPose;
  characters:readonly WorldCharacterPlacement[];
  referenceUse:WorldReferenceUse;
  continuityGroupId?:string;
  assetId:string;
  sha256:string;
  evidenceIds:readonly string[];
}

export interface WorldCaptureSession {
  id:string;
  projectId:string;
  world:WorldBuildPlan;
  canonicalCaptureId:string;
  captures:readonly WorldReferenceCapture[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_WORLD_CAPTURE_SESSION';
}

export interface WorldPreviewCostDecision {
  valid:boolean;
  projectedSavingsUsd:number;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_WORLD_PREVIEW_COST_QC';
}

export function validateWorldCaptureSession(session:WorldCaptureSession):readonly string[]{
  const reasons:string[]=[];
  const world=session.world;

  if(!session.id.trim()||!session.projectId.trim()||session.projectId!==world.projectId){
    reasons.push('DIRECTOR_WORLD_SESSION_IDENTITY_REQUIRED');
  }
  if(!world.id.trim()||!world.environmentId.trim()||!world.evidenceIds.length){
    reasons.push('DIRECTOR_WORLD_PLAN_IDENTITY_REQUIRED');
  }
  if(world.sourceKind==='image-derived'&&!world.sourceAssetId?.trim()){
    reasons.push('DIRECTOR_WORLD_IMAGE_SOURCE_REQUIRED');
  }
  if(world.sourceKind==='text-derived'&&!world.sourcePrompt?.trim()){
    reasons.push('DIRECTOR_WORLD_TEXT_SOURCE_REQUIRED');
  }
  if(!session.captures.length) reasons.push('DIRECTOR_WORLD_CAPTURES_REQUIRED');
  if(!session.evidenceIds.length) reasons.push('DIRECTOR_WORLD_SESSION_EVIDENCE_REQUIRED');

  const captureIds=new Set<string>();
  const capturesByContinuity=new Map<string,WorldReferenceCapture[]>();

  for(const capture of session.captures){
    if(!capture.id.trim()||captureIds.has(capture.id)){
      reasons.push(`DIRECTOR_WORLD_CAPTURE_ID_INVALID:${capture.id||'unknown'}`);
    }
    captureIds.add(capture.id);

    if(
      capture.projectId!==session.projectId||
      capture.environmentId!==world.environmentId||
      capture.worldPlanId!==world.id
    ) reasons.push(`DIRECTOR_WORLD_CAPTURE_LINEAGE_MISMATCH:${capture.id}`);

    if(!capture.assetId.trim()||!capture.sha256.trim()||!capture.viewLabel.trim()){
      reasons.push(`DIRECTOR_WORLD_CAPTURE_ASSET_REQUIRED:${capture.id}`);
    }
    if(!capture.evidenceIds.length) reasons.push(`DIRECTOR_WORLD_CAPTURE_EVIDENCE_REQUIRED:${capture.id}`);

    if(
      !Number.isFinite(capture.camera.focalLengthMm)||
      capture.camera.focalLengthMm<=0||
      !capture.camera.id.trim()||
      !capture.camera.evidenceIds.length||
      !vectorFinite(capture.camera.position)||
      !vectorFinite(capture.camera.rotationDegrees)
    ) reasons.push(`DIRECTOR_WORLD_CAMERA_INVALID:${capture.id}`);

    const characterIds=new Set<string>();
    for(const placement of capture.characters){
      if(!placement.characterId.trim()||characterIds.has(placement.characterId)){
        reasons.push(`DIRECTOR_WORLD_CHARACTER_PLACEMENT_INVALID:${capture.id}`);
      }
      characterIds.add(placement.characterId);
      if(!vectorFinite(placement.position)||!Number.isFinite(placement.facingDegrees)||!placement.evidenceIds.length){
        reasons.push(`DIRECTOR_WORLD_CHARACTER_PLACEMENT_INVALID:${capture.id}:${placement.characterId}`);
      }
    }

    if(capture.referenceUse==='first-frame'||capture.referenceUse==='last-frame'){
      if(!capture.continuityGroupId?.trim()){
        reasons.push(`DIRECTOR_WORLD_ENDPOINT_CONTINUITY_GROUP_REQUIRED:${capture.id}`);
      }else{
        const list=capturesByContinuity.get(capture.continuityGroupId)??[];
        list.push(capture);
        capturesByContinuity.set(capture.continuityGroupId,list);
      }
    }
  }

  if(!captureIds.has(session.canonicalCaptureId)){
    reasons.push('DIRECTOR_WORLD_CANONICAL_CAPTURE_REQUIRED');
  }

  for(const [groupId,captures] of capturesByContinuity){
    const first=captures.filter(c=>c.referenceUse==='first-frame');
    const last=captures.filter(c=>c.referenceUse==='last-frame');
    if(first.length!==1||last.length!==1){
      reasons.push(`DIRECTOR_WORLD_ENDPOINT_PAIR_REQUIRED:${groupId}`);
      continue;
    }
    const firstIds=new Set(first[0]!.characters.map(c=>c.characterId));
    const lastIds=new Set(last[0]!.characters.map(c=>c.characterId));
    if(firstIds.size!==lastIds.size||[...firstIds].some(id=>!lastIds.has(id))){
      reasons.push(`DIRECTOR_WORLD_ENDPOINT_CHARACTER_SET_MISMATCH:${groupId}`);
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

export function buildEnvironmentViewPackFromWorld(session:WorldCaptureSession):EnvironmentViewPack{
  const reasons=validateWorldCaptureSession(session);
  if(reasons.length) throw new Error(`DIRECTOR_WORLD_CAPTURE_INVALID: ${reasons.join(', ')}`);

  const canonical=session.captures.find(c=>c.id===session.canonicalCaptureId)!;
  return Object.freeze({
    id:`${session.id}:environment-pack`,
    projectId:session.projectId,
    environmentId:session.world.environmentId,
    canonicalAssetId:canonical.assetId,
    views:Object.freeze(session.captures.map(capture=>Object.freeze({
      id:capture.id,
      assetId:capture.assetId,
      sha256:capture.sha256,
      viewLabel:capture.viewLabel,
      source:'authored' as const,
      parentAssetIds:Object.freeze(session.world.sourceAssetId?[session.world.sourceAssetId]:[]),
      evidenceIds:Object.freeze([
        ...capture.evidenceIds,
        ...capture.camera.evidenceIds,
        ...capture.characters.flatMap(character=>character.evidenceIds),
        `world-camera:${capture.camera.id}`,
        `world-focal-length-mm:${capture.camera.focalLengthMm}`,
        `world-reference-use:${capture.referenceUse}`,
      ]),
    }))),
    ...(session.world.canonicalStyleAssetIds.length?{styleReferenceAssetIds:Object.freeze([...session.world.canonicalStyleAssetIds])}:{}),
    version:1,
  });
}

export function buildStoryboardReferenceBoardFromWorld(input:{
  id:string;
  title:string;
  session:WorldCaptureSession;
  captureIds:readonly string[];
  holdSeconds:number;
  evidenceIds:readonly string[];
}):StoryboardReferenceBoard{
  const reasons=validateWorldCaptureSession(input.session);
  if(reasons.length) throw new Error(`DIRECTOR_WORLD_CAPTURE_INVALID: ${reasons.join(', ')}`);
  if(!input.id.trim()||!input.title.trim()||!input.captureIds.length||!input.evidenceIds.length){
    throw new Error('DIRECTOR_WORLD_STORYBOARD_IDENTITY_REQUIRED');
  }
  if(!Number.isFinite(input.holdSeconds)||input.holdSeconds<=0){
    throw new Error('DIRECTOR_WORLD_STORYBOARD_HOLD_INVALID');
  }

  const byId=new Map(input.session.captures.map(capture=>[capture.id,capture]));
  const frames=input.captureIds.map((id,index)=>{
    const capture=byId.get(id);
    if(!capture) throw new Error(`DIRECTOR_WORLD_STORYBOARD_CAPTURE_UNKNOWN:${id}`);
    return Object.freeze({
      id:`${input.id}:frame:${index+1}`,
      sourceAssetId:capture.assetId,
      stillAssetId:capture.assetId,
      stillSha256:capture.sha256,
      label:capture.viewLabel,
      crop:Object.freeze({x:0,y:0,width:1,height:1,aspectRatio:'16:9' as const}),
      metadata:Object.freeze({
        lens:`${capture.camera.focalLengthMm}mm`,
        cameraAngle:capture.viewLabel,
      }),
      annotations:Object.freeze([]),
      holdSeconds:input.holdSeconds,
      notes:`World capture ${capture.id}; use=${capture.referenceUse}`,
      evidenceIds:Object.freeze([
        ...capture.evidenceIds,
        ...input.evidenceIds,
        `world-plan:${input.session.world.id}`,
      ]),
    });
  });

  return Object.freeze({
    id:input.id,
    projectId:input.session.projectId,
    title:input.title,
    frames:Object.freeze(frames),
    version:1,
    authority:'DIRECTOR_REFERENCE_BOARD',
  });
}

export function evaluateWorldPreviewCost(input:{
  projectId:string;
  previewEstimate:GenerationCostEstimate;
  fullWorldEstimate:GenerationCostEstimate;
  previewAccepted:boolean;
  evidenceIds:readonly string[];
}):WorldPreviewCostDecision{
  const reasons:string[]=[];
  const {previewEstimate,fullWorldEstimate}=input;

  for(const [name,estimate] of [['preview',previewEstimate],['full',fullWorldEstimate]] as const){
    if(estimate.projectId!==input.projectId) reasons.push(`DIRECTOR_WORLD_COST_PROJECT_MISMATCH:${name}`);
    if(!estimate.id.trim()||!estimate.provider.trim()||!estimate.modelId.trim()||!estimate.pricingSourceRef.trim()){
      reasons.push(`DIRECTOR_WORLD_COST_IDENTITY_REQUIRED:${name}`);
    }
    if(
      !Number.isFinite(estimate.quantity)||estimate.quantity<=0||
      !Number.isFinite(estimate.unitPriceUsd)||estimate.unitPriceUsd<0||
      !Number.isFinite(estimate.estimatedCostUsd)||estimate.estimatedCostUsd<0
    ) reasons.push(`DIRECTOR_WORLD_COST_INVALID:${name}`);
  }
  if(!input.evidenceIds.length) reasons.push('DIRECTOR_WORLD_COST_EVIDENCE_REQUIRED');
  if(!input.previewAccepted) reasons.push('DIRECTOR_WORLD_PREVIEW_NOT_ACCEPTED');

  const savings=fullWorldEstimate.estimatedCostUsd-previewEstimate.estimatedCostUsd;
  if(savings<=0) reasons.push('DIRECTOR_WORLD_PREVIEW_NO_COST_ADVANTAGE');

  return Object.freeze({
    valid:reasons.length===0,
    projectedSavingsUsd:savings,
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'DIRECTOR_WORLD_PREVIEW_COST_QC',
  });
}

function vectorFinite(vector:{x:number;y:number;z:number}):boolean{
  return Number.isFinite(vector.x)&&Number.isFinite(vector.y)&&Number.isFinite(vector.z);
}
