import type {VideoTrack} from './studio-contracts.js';

export interface PoseActionRecognitionPlan {
  id:string;
  projectId:string;
  classifierId:string;
  windowSize:number;
  stride:number;
  landmarkOrder:readonly string[];
  labels:readonly string[];
  minimumConfidence:number;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_POSE_ACTION_RECOGNITION';
}

export interface PoseActionWindow {
  id:string;
  trackId:string;
  frameStart:number;
  frameEnd:number;
  vectors:readonly (readonly number[])[];
  evidenceIds:readonly string[];
}

export interface PoseActionPrediction {
  label:string;
  confidence:number;
  classifierId:string;
  windowId:string;
  frameStart:number;
  frameEnd:number;
  evidenceIds:readonly string[];
}

export interface PoseActionClassifier {
  classify(window:PoseActionWindow,plan:PoseActionRecognitionPlan):Promise<{label:string;confidence:number;evidenceIds?:readonly string[]}>;
}

export function validatePoseActionRecognitionPlan(plan:PoseActionRecognitionPlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.classifierId.trim()) reasons.push('DIRECTOR_ACTION_PLAN_IDENTITY_REQUIRED');
  if(!Number.isInteger(plan.windowSize)||plan.windowSize<2) reasons.push('DIRECTOR_ACTION_WINDOW_INVALID');
  if(!Number.isInteger(plan.stride)||plan.stride<1) reasons.push('DIRECTOR_ACTION_STRIDE_INVALID');
  if(!plan.landmarkOrder.length||new Set(plan.landmarkOrder).size!==plan.landmarkOrder.length) reasons.push('DIRECTOR_ACTION_LANDMARKS_INVALID');
  if(!plan.labels.length||plan.labels.some(x=>!x.trim())||new Set(plan.labels).size!==plan.labels.length) reasons.push('DIRECTOR_ACTION_LABELS_INVALID');
  if(!Number.isFinite(plan.minimumConfidence)||plan.minimumConfidence<0||plan.minimumConfidence>1) reasons.push('DIRECTOR_ACTION_CONFIDENCE_INVALID');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_ACTION_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function buildPoseActionWindows(
  track:VideoTrack,
  plan:PoseActionRecognitionPlan,
):readonly PoseActionWindow[]{
  const reasons=validatePoseActionRecognitionPlan(plan);
  if(reasons.length) throw new Error(`DIRECTOR_ACTION_PLAN_INVALID: ${reasons.join(', ')}`);
  if(!track.approved) throw new Error('DIRECTOR_ACTION_APPROVED_POSE_TRACK_REQUIRED');

  const frames=track.annotations
    .filter(annotation=>annotation.keypoints?.length)
    .sort((a,b)=>a.frame-b.frame)
    .flatMap(annotation=>{
      const byName=new Map(annotation.keypoints!.map(point=>[point.name,point]));
      if(plan.landmarkOrder.some(name=>!byName.has(name))) return [];
      const points=plan.landmarkOrder.map(name=>byName.get(name)!);
      if(points.some(point=>point.confidence<plan.minimumConfidence)) return [];
      const vector=normalizePose(points.map(point=>[point.x,point.y] as const));
      return [{frame:annotation.frame,vector,evidenceId:`pose-frame:${track.trackId}:${annotation.frame}`}];
    });

  const windows:PoseActionWindow[]=[];
  for(let start=0;start+plan.windowSize<=frames.length;start+=plan.stride){
    const slice=frames.slice(start,start+plan.windowSize);
    windows.push(Object.freeze({
      id:`${plan.id}:window:${windows.length+1}`,
      trackId:track.trackId,
      frameStart:slice[0]!.frame,
      frameEnd:slice[slice.length-1]!.frame,
      vectors:Object.freeze(slice.map(item=>Object.freeze(item.vector))),
      evidenceIds:Object.freeze([...plan.evidenceIds,...slice.map(item=>item.evidenceId)]),
    }));
  }
  return Object.freeze(windows);
}

export async function classifyPoseActionWindows(
  classifier:PoseActionClassifier,
  windows:readonly PoseActionWindow[],
  plan:PoseActionRecognitionPlan,
):Promise<readonly PoseActionPrediction[]>{
  const predictions:PoseActionPrediction[]=[];
  for(const window of windows){
    const result=await classifier.classify(window,plan);
    if(!plan.labels.includes(result.label)) throw new Error(`DIRECTOR_ACTION_LABEL_NOT_ALLOWED:${result.label}`);
    if(!Number.isFinite(result.confidence)||result.confidence<0||result.confidence>1) throw new Error('DIRECTOR_ACTION_CLASSIFIER_CONFIDENCE_INVALID');
    if(result.confidence<plan.minimumConfidence) continue;
    predictions.push(Object.freeze({
      label:result.label,
      confidence:result.confidence,
      classifierId:plan.classifierId,
      windowId:window.id,
      frameStart:window.frameStart,
      frameEnd:window.frameEnd,
      evidenceIds:Object.freeze([...window.evidenceIds,...(result.evidenceIds??[])]),
    }));
  }
  return Object.freeze(predictions);
}

function normalizePose(points:readonly (readonly [number,number])[]):number[]{
  const cx=points.reduce((sum,p)=>sum+p[0],0)/points.length;
  const cy=points.reduce((sum,p)=>sum+p[1],0)/points.length;
  const centered=points.flatMap(([x,y])=>[x-cx,y-cy]);
  const scale=Math.sqrt(centered.reduce((sum,value)=>sum+value*value,0))||1;
  return centered.map(value=>value/scale);
}
