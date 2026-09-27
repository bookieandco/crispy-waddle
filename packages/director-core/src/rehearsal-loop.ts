import type { PerformanceMaster } from './performance-master.js';
import type { ProductionCoherenceMetric } from './production-foundry.js';

export type RehearsalMode =
  | 'table-read'
  | 'blocking'
  | 'performance'
  | 'interaction'
  | 'camera'
  | 'full-dress';

export type RehearsalIssueKind =
  | 'dialogue-timing'
  | 'performance'
  | 'eyeline'
  | 'blocking'
  | 'collision'
  | 'prop-interaction'
  | 'wardrobe'
  | 'identity'
  | 'camera'
  | 'continuity'
  | 'audio'
  | 'other';

export interface RehearsalCue {
  id:string;
  characterId:string;
  beatRef:string;
  lineRef?:string;
  action?:string;
  emotion?:string;
  targetCharacterId?:string;
  targetObjectId?:string;
  startSeconds:number;
  endSeconds:number;
}

export interface RehearsalPlan {
  id:string;
  projectId:string;
  sceneId:string;
  mode:RehearsalMode;
  characterIds:readonly string[];
  cues:readonly RehearsalCue[];
  referenceAssetIds:readonly string[];
  worldStateRef?:string;
  wardrobePlanRefs:readonly string[];
  cameraPlanRefs:readonly string[];
  maxTakes:number;
  escalationOrder:readonly RehearsalMode[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_REHEARSAL_PLAN';
}

export interface RehearsalObservation {
  id:string;
  planId:string;
  takeNumber:number;
  characterId?:string;
  cueId?:string;
  issue:RehearsalIssueKind;
  severity:'note'|'fix'|'blocker';
  message:string;
  metric?:ProductionCoherenceMetric;
  score?:number;
  evidenceIds:readonly string[];
}

export interface DirectorRehearsalNote {
  id:string;
  planId:string;
  takeNumber:number;
  priority:'minor'|'normal'|'critical';
  instruction:string;
  appliesToCharacterId?:string;
  appliesToCueId?:string;
  sourceObservationIds:readonly string[];
  authority:'DIRECTOR_REHEARSAL_NOTE';
}

export interface RehearsalTake {
  id:string;
  planId:string;
  takeNumber:number;
  mode:RehearsalMode;
  previewAssetId?:string;
  performanceMaster?:PerformanceMaster;
  observations:readonly RehearsalObservation[];
  directorNotes:readonly DirectorRehearsalNote[];
  status:'ready'|'notes'|'approved'|'blocked';
  evidenceIds:readonly string[];
}

export interface RehearsalDecision {
  disposition:'approve'|'retry'|'escalate'|'block';
  nextMode?:RehearsalMode;
  notes:readonly DirectorRehearsalNote[];
  reasons:readonly string[];
  authority:'DIRECTOR_REHEARSAL_DECISION';
}

const MODE_ORDER:readonly RehearsalMode[]=[
  'table-read','blocking','performance','interaction','camera','full-dress',
];

export function validateRehearsalPlan(plan:RehearsalPlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.sceneId.trim()) reasons.push('DIRECTOR_REHEARSAL_IDENTITY_REQUIRED');
  if(!plan.characterIds.length) reasons.push('DIRECTOR_REHEARSAL_CHARACTER_REQUIRED');
  if(!plan.cues.length) reasons.push('DIRECTOR_REHEARSAL_CUES_REQUIRED');
  if(!Number.isInteger(plan.maxTakes)||plan.maxTakes<1||plan.maxTakes>20) reasons.push('DIRECTOR_REHEARSAL_MAX_TAKES_INVALID');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_REHEARSAL_EVIDENCE_REQUIRED');
  for(const cue of plan.cues){
    if(!cue.id.trim()||!cue.characterId.trim()||!cue.beatRef.trim()) reasons.push('DIRECTOR_REHEARSAL_CUE_IDENTITY_REQUIRED');
    if(!Number.isFinite(cue.startSeconds)||!Number.isFinite(cue.endSeconds)||cue.startSeconds<0||cue.endSeconds<=cue.startSeconds){
      reasons.push(`DIRECTOR_REHEARSAL_CUE_TIME_INVALID:${cue.id}`);
    }
    if(!plan.characterIds.includes(cue.characterId)) reasons.push(`DIRECTOR_REHEARSAL_CUE_CHARACTER_UNKNOWN:${cue.characterId}`);
  }
  for(const mode of plan.escalationOrder){
    if(!MODE_ORDER.includes(mode)) reasons.push('DIRECTOR_REHEARSAL_ESCALATION_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}

function makeNote(plan:RehearsalPlan,takeNumber:number,observation:RehearsalObservation):DirectorRehearsalNote{
  const priority=observation.severity==='blocker'?'critical':observation.severity==='fix'?'normal':'minor';
  return Object.freeze({
    id:`rehearsal-note:${plan.id}:${takeNumber}:${observation.id}`,
    planId:plan.id,
    takeNumber,
    priority,
    instruction:observation.message.trim(),
    ...(observation.characterId?{appliesToCharacterId:observation.characterId}:{}),
    ...(observation.cueId?{appliesToCueId:observation.cueId}:{}),
    sourceObservationIds:Object.freeze([observation.id]),
    authority:'DIRECTOR_REHEARSAL_NOTE',
  });
}

export function evaluateRehearsalTake(
  plan:RehearsalPlan,
  take:{takeNumber:number;mode:RehearsalMode;observations:readonly RehearsalObservation[]},
  policy:{minimumMetricScore?:number;blockOnKinds?:readonly RehearsalIssueKind[]}={},
):RehearsalDecision{
  const planReasons=validateRehearsalPlan(plan);
  if(planReasons.length) throw new Error(`DIRECTOR_REHEARSAL_PLAN_INVALID:${planReasons.join(',')}`);
  if(!Number.isInteger(take.takeNumber)||take.takeNumber<1) throw new Error('DIRECTOR_REHEARSAL_TAKE_NUMBER_INVALID');
  if(take.mode!==plan.mode && !plan.escalationOrder.includes(take.mode)) throw new Error('DIRECTOR_REHEARSAL_TAKE_MODE_INVALID');

  const minimum=policy.minimumMetricScore??0.8;
  const hardKinds=new Set(policy.blockOnKinds??['collision','identity','continuity']);
  const actionable=take.observations.filter(observation=>
    observation.severity!=='note' ||
    (observation.score!==undefined && (!Number.isFinite(observation.score)||observation.score<minimum))
  );
  const blockers=actionable.filter(observation=>observation.severity==='blocker'||hardKinds.has(observation.issue));
  const notes=Object.freeze(actionable.map(observation=>makeNote(plan,take.takeNumber,observation)));
  if(blockers.length && take.takeNumber>=plan.maxTakes){
    return Object.freeze({
      disposition:'block',
      notes,
      reasons:Object.freeze(blockers.map(observation=>`DIRECTOR_REHEARSAL_BLOCKER:${observation.issue}`)),
      authority:'DIRECTOR_REHEARSAL_DECISION',
    });
  }
  if(actionable.length){
    if(take.takeNumber<plan.maxTakes){
      return Object.freeze({
        disposition:'retry',
        notes,
        reasons:Object.freeze(actionable.map(observation=>`DIRECTOR_REHEARSAL_NOTE:${observation.issue}`)),
        authority:'DIRECTOR_REHEARSAL_DECISION',
      });
    }
    const currentIndex=MODE_ORDER.indexOf(take.mode);
    const requested=plan.escalationOrder.find(mode=>MODE_ORDER.indexOf(mode)>currentIndex);
    if(requested){
      return Object.freeze({
        disposition:'escalate',
        nextMode:requested,
        notes,
        reasons:Object.freeze(['DIRECTOR_REHEARSAL_ESCALATION_REQUIRED']),
        authority:'DIRECTOR_REHEARSAL_DECISION',
      });
    }
    return Object.freeze({
      disposition:'block',
      notes,
      reasons:Object.freeze(['DIRECTOR_REHEARSAL_NOT_READY_FOR_FINAL']),
      authority:'DIRECTOR_REHEARSAL_DECISION',
    });
  }
  return Object.freeze({
    disposition:'approve',
    notes:Object.freeze([]),
    reasons:Object.freeze([]),
    authority:'DIRECTOR_REHEARSAL_DECISION',
  });
}

export function rehearsalGraduationReceipt(
  plan:RehearsalPlan,
  take:RehearsalTake,
):readonly string[]{
  if(take.planId!==plan.id) throw new Error('DIRECTOR_REHEARSAL_TAKE_PLAN_MISMATCH');
  if(take.status!=='approved') throw new Error('DIRECTOR_REHEARSAL_TAKE_NOT_APPROVED');
  if(!take.evidenceIds.length) throw new Error('DIRECTOR_REHEARSAL_TAKE_EVIDENCE_REQUIRED');
  return Object.freeze([
    `director-rehearsal:${plan.id}:${take.takeNumber}:${take.mode}`,
    ...plan.evidenceIds,
    ...take.evidenceIds,
    ...(take.performanceMaster?.evidenceIds??[]),
  ]);
}
