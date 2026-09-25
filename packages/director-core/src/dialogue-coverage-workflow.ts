import type {GenerationCostEstimate} from './generation-spend-gate.js';
import type {GenerationReferenceManifest} from './generation-reference-manifest.js';

export type DialogueCoverageRole='master'|'over-shoulder'|'reverse'|'medium-close-up'|'close-up'|'reaction';
export type ScreenDirection='camera-left'|'camera-right'|'center';
export type DialogueAxisSide='A'|'B';

export interface DialogueEyeline {
  id:string;
  characterId:string;
  targetCharacterId:string;
  screenDirection:ScreenDirection;
  heightNormalized:number;
  evidenceIds:readonly string[];
}

export interface DialogueCoverageShot {
  id:string;
  role:DialogueCoverageRole;
  subjectCharacterIds:readonly string[];
  locationAssetId:string;
  backgroundAnchorIds:readonly string[];
  eyelineIds:readonly string[];
  cameraPlanRef:string;
  axisSide?:DialogueAxisSide;
  screenDirectionBySubject?:Readonly<Record<string,ScreenDirection>>;
  evidenceIds:readonly string[];
}

export interface DialogueAxisTransition {
  afterCoverageShotId:string;
  method:'visible-camera-cross'|'visible-subject-cross'|'neutral-reset';
  from:DialogueAxisSide;
  to:DialogueAxisSide;
  evidenceIds:readonly string[];
}

export interface DialogueCoveragePlan {
  id:string;
  projectId:string;
  sceneId:string;
  locationAssetId:string;
  cameraDiagramAssetId:string;
  characterReferenceAssetIds:readonly string[];
  axisRef:string;
  establishingAxisSide?:DialogueAxisSide;
  axisTransitions?:readonly DialogueAxisTransition[];
  eyelines:readonly DialogueEyeline[];
  shots:readonly DialogueCoverageShot[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_DIALOGUE_COVERAGE';
}

export interface CoverageFrameSelection {
  id:string;
  coverageShotId:string;
  characterId:string;
  sourceVideoAssetId:string;
  sourceTimeSeconds:number;
  frameAssetId:string;
  frameSha256:string;
  eyelineId:string;
  backgroundAnchorIds:readonly string[];
  evidenceIds:readonly string[];
}

export interface CoverageHandoffPlan {
  id:string;
  projectId:string;
  sceneId:string;
  coveragePlanId:string;
  establishmentModel:{
    providerId:string;
    modelId:string;
    costEstimate:GenerationCostEstimate;
  };
  dialogueModel:{
    providerId:string;
    modelId:string;
    costEstimate:GenerationCostEstimate;
  };
  allPremiumDialogueEstimate:GenerationCostEstimate;
  selectedFrames:readonly CoverageFrameSelection[];
  dialogueAudioAssetIds:readonly string[];
  requireStartFrame:true;
  requireAudioReference:true;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_DIALOGUE_COVERAGE_HANDOFF';
}

export interface CoverageHandoffDecision {
  valid:boolean;
  projectedSavingsUsd:number;
  projectedSavingsFraction:number;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_DIALOGUE_COVERAGE_HANDOFF_QC';
}

export function validateDialogueCoveragePlan(plan:DialogueCoveragePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.sceneId.trim()) reasons.push('DIRECTOR_COVERAGE_IDENTITY_REQUIRED');
  if(!plan.locationAssetId.trim()||!plan.cameraDiagramAssetId.trim()||!plan.axisRef.trim()) reasons.push('DIRECTOR_COVERAGE_SCENE_GEOMETRY_REQUIRED');
  if(!plan.characterReferenceAssetIds.length) reasons.push('DIRECTOR_COVERAGE_CHARACTER_REFERENCES_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_COVERAGE_EVIDENCE_REQUIRED');

  const eyelineIds=new Set<string>();
  for(const eyeline of plan.eyelines){
    if(!eyeline.id.trim()||eyelineIds.has(eyeline.id)) reasons.push(`DIRECTOR_COVERAGE_EYELINE_ID_INVALID:${eyeline.id||'unknown'}`);
    eyelineIds.add(eyeline.id);
    if(!eyeline.characterId.trim()||!eyeline.targetCharacterId.trim()||eyeline.characterId===eyeline.targetCharacterId){
      reasons.push(`DIRECTOR_COVERAGE_EYELINE_CHARACTERS_INVALID:${eyeline.id}`);
    }
    if(!Number.isFinite(eyeline.heightNormalized)||eyeline.heightNormalized<0||eyeline.heightNormalized>1){
      reasons.push(`DIRECTOR_COVERAGE_EYELINE_HEIGHT_INVALID:${eyeline.id}`);
    }
    if(!eyeline.evidenceIds.length) reasons.push(`DIRECTOR_COVERAGE_EYELINE_EVIDENCE_REQUIRED:${eyeline.id}`);
  }

  const shotIds=new Set<string>();
  let masterCount=0;
  const transitionByShot=new Map((plan.axisTransitions??[]).map(transition=>[transition.afterCoverageShotId,transition]));
  let expectedAxisSide=plan.establishingAxisSide;
  let establishedScreenDirections:Readonly<Record<string,ScreenDirection>>|undefined;
  for(const shot of plan.shots){
    if(!shot.id.trim()||shotIds.has(shot.id)) reasons.push(`DIRECTOR_COVERAGE_SHOT_ID_INVALID:${shot.id||'unknown'}`);
    shotIds.add(shot.id);
    if(shot.role==='master') masterCount+=1;
    if(!shot.subjectCharacterIds.length) reasons.push(`DIRECTOR_COVERAGE_SHOT_SUBJECT_REQUIRED:${shot.id}`);
    if(shot.locationAssetId!==plan.locationAssetId) reasons.push(`DIRECTOR_COVERAGE_LOCATION_MISMATCH:${shot.id}`);
    if(!shot.backgroundAnchorIds.length) reasons.push(`DIRECTOR_COVERAGE_BACKGROUND_ANCHORS_REQUIRED:${shot.id}`);
    if(!shot.cameraPlanRef.trim()) reasons.push(`DIRECTOR_COVERAGE_CAMERA_PLAN_REQUIRED:${shot.id}`);

    if(plan.establishingAxisSide){
      if(!shot.axisSide) reasons.push(`DIRECTOR_COVERAGE_AXIS_SIDE_REQUIRED:${shot.id}`);
      else if(shot.axisSide!==expectedAxisSide) reasons.push(`DIRECTOR_COVERAGE_AXIS_CROSSED_WITHOUT_TRANSITION:${shot.id}`);

      if(!establishedScreenDirections&&shot.role==='master'&&shot.screenDirectionBySubject){
        establishedScreenDirections=shot.screenDirectionBySubject;
      }else if(establishedScreenDirections&&shot.screenDirectionBySubject){
        const participantIds=new Set([
          ...plan.eyelines.flatMap(eyeline=>[eyeline.characterId,eyeline.targetCharacterId]),
          ...plan.shots.flatMap(candidate=>candidate.subjectCharacterIds),
        ]);
        for(const subjectId of participantIds){
          const initial=establishedScreenDirections[subjectId];
          const current=shot.screenDirectionBySubject[subjectId];
          if(initial&&current&&initial!==current&&shot.role!=='reaction'){
            reasons.push(`DIRECTOR_COVERAGE_SCREEN_DIRECTION_FLIPPED:${shot.id}:${subjectId}`);
          }
        }
      }

      const transition=transitionByShot.get(shot.id);
      if(transition){
        if(
          !shot.axisSide||
          transition.from!==shot.axisSide||
          transition.from===transition.to||
          !transition.evidenceIds.length
        ){
          reasons.push(`DIRECTOR_COVERAGE_AXIS_TRANSITION_INVALID:${shot.id}`);
        }else{
          expectedAxisSide=transition.to;
          establishedScreenDirections=undefined;
        }
      }
    }
    for(const eyelineId of shot.eyelineIds){
      if(!eyelineIds.has(eyelineId)) reasons.push(`DIRECTOR_COVERAGE_EYELINE_UNKNOWN:${shot.id}:${eyelineId}`);
    }
    if(!shot.evidenceIds.length) reasons.push(`DIRECTOR_COVERAGE_SHOT_EVIDENCE_REQUIRED:${shot.id}`);
  }
  if(masterCount!==1) reasons.push('DIRECTOR_COVERAGE_SINGLE_MASTER_REQUIRED');

  for(const transition of plan.axisTransitions??[]){
    if(!shotIds.has(transition.afterCoverageShotId)){
      reasons.push(`DIRECTOR_COVERAGE_AXIS_TRANSITION_SHOT_UNKNOWN:${transition.afterCoverageShotId}`);
    }
  }
  const coverageRoles=new Set(plan.shots.map(shot=>shot.role));
  if(!coverageRoles.has('master')||!(coverageRoles.has('medium-close-up')||coverageRoles.has('close-up')||coverageRoles.has('over-shoulder')||coverageRoles.has('reverse'))){
    reasons.push('DIRECTOR_COVERAGE_DIALOGUE_COVERAGE_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function evaluateCoverageHandoff(
  coverage:DialogueCoveragePlan,
  handoff:CoverageHandoffPlan,
):CoverageHandoffDecision{
  const reasons=[...validateDialogueCoveragePlan(coverage)];
  const evidenceIds=[...new Set([...coverage.evidenceIds,...handoff.evidenceIds,...handoff.selectedFrames.flatMap(frame=>frame.evidenceIds)])];

  if(!handoff.id.trim()||handoff.projectId!==coverage.projectId||handoff.sceneId!==coverage.sceneId||handoff.coveragePlanId!==coverage.id){
    reasons.push('DIRECTOR_COVERAGE_HANDOFF_LINEAGE_MISMATCH');
  }
  if(!handoff.dialogueAudioAssetIds.length) reasons.push('DIRECTOR_COVERAGE_HANDOFF_AUDIO_REQUIRED');
  if(!handoff.selectedFrames.length) reasons.push('DIRECTOR_COVERAGE_HANDOFF_FRAMES_REQUIRED');

  const shotById=new Map(coverage.shots.map(shot=>[shot.id,shot]));
  const eyelineById=new Map(coverage.eyelines.map(eyeline=>[eyeline.id,eyeline]));
  const frameIds=new Set<string>();
  for(const frame of handoff.selectedFrames){
    if(!frame.id.trim()||frameIds.has(frame.id)) reasons.push(`DIRECTOR_COVERAGE_FRAME_ID_INVALID:${frame.id||'unknown'}`);
    frameIds.add(frame.id);
    const shot=shotById.get(frame.coverageShotId);
    if(!shot) reasons.push(`DIRECTOR_COVERAGE_FRAME_SHOT_UNKNOWN:${frame.id}`);
    const eyeline=eyelineById.get(frame.eyelineId);
    if(!eyeline) reasons.push(`DIRECTOR_COVERAGE_FRAME_EYELINE_UNKNOWN:${frame.id}`);
    if(eyeline&&eyeline.characterId!==frame.characterId) reasons.push(`DIRECTOR_COVERAGE_FRAME_EYELINE_CHARACTER_MISMATCH:${frame.id}`);
    if(!Number.isFinite(frame.sourceTimeSeconds)||frame.sourceTimeSeconds<0) reasons.push(`DIRECTOR_COVERAGE_FRAME_TIME_INVALID:${frame.id}`);
    if(!frame.sourceVideoAssetId.trim()||!frame.frameAssetId.trim()||!frame.frameSha256.trim()) reasons.push(`DIRECTOR_COVERAGE_FRAME_PROVENANCE_REQUIRED:${frame.id}`);
    if(shot){
      const expected=new Set(shot.backgroundAnchorIds);
      if(frame.backgroundAnchorIds.some(anchor=>!expected.has(anchor))||expected.size!==new Set(frame.backgroundAnchorIds).size){
        reasons.push(`DIRECTOR_COVERAGE_FRAME_BACKGROUND_MISMATCH:${frame.id}`);
      }
    }
    if(!frame.evidenceIds.length) reasons.push(`DIRECTOR_COVERAGE_FRAME_EVIDENCE_REQUIRED:${frame.id}`);
  }

  for(const [name,estimate] of [
    ['establishment',handoff.establishmentModel.costEstimate],
    ['dialogue',handoff.dialogueModel.costEstimate],
    ['all-premium',handoff.allPremiumDialogueEstimate],
  ] as const){
    if(estimate.projectId!==coverage.projectId) reasons.push(`DIRECTOR_COVERAGE_COST_PROJECT_MISMATCH:${name}`);
    if(!estimate.provider.trim()||!estimate.modelId.trim()||!Number.isFinite(estimate.estimatedCostUsd)||estimate.estimatedCostUsd<0){
      reasons.push(`DIRECTOR_COVERAGE_COST_INVALID:${name}`);
    }
  }
  if(
    handoff.establishmentModel.costEstimate.provider!==handoff.establishmentModel.providerId||
    handoff.establishmentModel.costEstimate.modelId!==handoff.establishmentModel.modelId
  ) reasons.push('DIRECTOR_COVERAGE_ESTABLISHMENT_COST_MODEL_MISMATCH');
  if(
    handoff.dialogueModel.costEstimate.provider!==handoff.dialogueModel.providerId||
    handoff.dialogueModel.costEstimate.modelId!==handoff.dialogueModel.modelId
  ) reasons.push('DIRECTOR_COVERAGE_DIALOGUE_COST_MODEL_MISMATCH');

  const stagedCost=handoff.establishmentModel.costEstimate.estimatedCostUsd+handoff.dialogueModel.costEstimate.estimatedCostUsd;
  const premium=handoff.allPremiumDialogueEstimate.estimatedCostUsd;
  const savings=premium-stagedCost;
  const fraction=premium>0?savings/premium:0;
  if(savings<=0) reasons.push('DIRECTOR_COVERAGE_HANDOFF_NO_COST_ADVANTAGE');

  return Object.freeze({
    valid:reasons.length===0,
    projectedSavingsUsd:savings,
    projectedSavingsFraction:fraction,
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze(evidenceIds),
    authority:'DIRECTOR_DIALOGUE_COVERAGE_HANDOFF_QC',
  });
}


export function buildDialogueCoverageGenerationManifest(input:{
  id:string;
  shotId:string;
  coverage:DialogueCoveragePlan;
  handoff:CoverageHandoffPlan;
  frameId:string;
  dialogueAudioAssetId:string;
  dialogueAudioSha256?:string;
  evidenceIds:readonly string[];
}):GenerationReferenceManifest{
  const decision=evaluateCoverageHandoff(input.coverage,input.handoff);
  if(!decision.valid) throw new Error(`DIRECTOR_COVERAGE_HANDOFF_INVALID: ${decision.reasons.join(', ')}`);
  const frame=input.handoff.selectedFrames.find(candidate=>candidate.id===input.frameId);
  if(!frame) throw new Error('DIRECTOR_COVERAGE_MANIFEST_FRAME_REQUIRED');
  if(!input.handoff.dialogueAudioAssetIds.includes(input.dialogueAudioAssetId)) {
    throw new Error('DIRECTOR_COVERAGE_MANIFEST_AUDIO_NOT_ADMITTED');
  }
  if(!input.id.trim()||!input.shotId.trim()||!input.evidenceIds.length) {
    throw new Error('DIRECTOR_COVERAGE_MANIFEST_IDENTITY_REQUIRED');
  }

  return Object.freeze({
    id:input.id,
    projectId:input.coverage.projectId,
    shotId:input.shotId,
    references:Object.freeze([
      Object.freeze({
        slot:1,
        assetId:frame.frameAssetId,
        sha256:frame.frameSha256,
        media:'image' as const,
        role:'first-frame' as const,
        semanticLabel:`Approved dialogue coverage frame for ${frame.characterId}; preserve eyeline ${frame.eyelineId} and background anchors ${frame.backgroundAnchorIds.join(', ')}`,
        promptToken:'DIALOGUE_START_FRAME',
        required:true,
        evidenceIds:Object.freeze([
          ...frame.evidenceIds,
          ...input.evidenceIds,
          `coverage-plan:${input.coverage.id}`,
          `coverage-shot:${frame.coverageShotId}`,
          `coverage-eyeline:${frame.eyelineId}`,
        ]),
      }),
      Object.freeze({
        slot:2,
        assetId:input.dialogueAudioAssetId,
        ...(input.dialogueAudioSha256 ? {sha256:input.dialogueAudioSha256} : {}),
        media:'audio' as const,
        role:'audio' as const,
        semanticLabel:'Approved dialogue audio reference for lip-sync/performance timing',
        promptToken:'DIALOGUE_AUDIO',
        required:true,
        evidenceIds:Object.freeze([
          ...input.evidenceIds,
          `coverage-handoff:${input.handoff.id}`,
        ]),
      }),
    ]),
    authority:'DIRECTOR_REFERENCE_MANIFEST',
  });
}
