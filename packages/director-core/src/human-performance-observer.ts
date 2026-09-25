import type {DecodedFrame} from './media-decoder-adapter.js';
import type {Observation} from './observation-bus.js';
import type {ObservationProvider} from './observation-provider-adapters.js';
import type {FrameAnnotation} from './studio-contracts.js';

export interface HumanBodyKeypointLike {
  part:string;
  positionRaw:[number,number,number?];
  score:number;
}
export interface HumanBodyLike {
  id:number;
  score:number;
  boxRaw:[number,number,number,number];
  keypoints:readonly HumanBodyKeypointLike[];
}
export interface HumanHandLike {
  id:number;
  score:number;
  boxRaw:[number,number,number,number];
  keypoints:readonly [number,number,number?][];
  label?:string;
}
export interface HumanFaceOrientationLike {
  id:number;
  score:number;
  rotation?:{
    angle:{roll:number;yaw:number;pitch:number};
    gaze:{bearing:number;strength:number};
  }|null;
  [key:string]:unknown;
}
export type HumanGestureLike=
  | {body:number;gesture:string}
  | {hand:number;gesture:string}
  | {face:number;gesture:string}
  | {iris:number;gesture:string};

export interface HumanResultLike {
  body:readonly HumanBodyLike[];
  hand:readonly HumanHandLike[];
  face?:readonly HumanFaceOrientationLike[];
  gesture?:readonly HumanGestureLike[];
  timestamp?:number;
  error?:string|null;
  width?:number;
  height?:number;
}

export interface HumanPerformanceEngine {
  detect(frame:DecodedFrame):Promise<HumanResultLike>;
}

export interface HumanPerformanceObserverPolicy {
  minimumConfidence:number;
  includeBody:boolean;
  includeHands:boolean;
  includeFaceOrientation:boolean;
  includeGestures:boolean;
  allowedBodyLandmarks?:readonly string[];
}

export function createHumanPerformanceObservationProvider(
  engine:HumanPerformanceEngine,
  policy:HumanPerformanceObserverPolicy,
):ObservationProvider{
  return {
    name:'human-performance-observer',
    async observeFrame(frame){
      const result=await engine.detect(frame);
      if(result.error) throw new Error(`DIRECTOR_HUMAN_PERCEPTION_FAILED: ${result.error}`);
      return humanResultToObservations(frame,result,policy);
    },
  };
}

export function humanResultToObservations(
  frame:DecodedFrame,
  result:HumanResultLike,
  policy:HumanPerformanceObserverPolicy,
):Observation[]{
  const observations:Observation[]=[];
  const allowed=policy.allowedBodyLandmarks?new Set(policy.allowedBodyLandmarks):undefined;
  const start=frame.timestampSeconds;
  const end=start+0.001;

  if(policy.includeBody){
    for(const body of result.body){
      if(!validConfidence(body.score,policy.minimumConfidence)||!validBox(body.boxRaw)) continue;
      const keypoints=body.keypoints
        .filter(point=>validConfidence(point.score,policy.minimumConfidence))
        .filter(point=>!allowed||allowed.has(point.part))
        .filter(point=>validPoint(point.positionRaw))
        .map(point=>({name:point.part,x:point.positionRaw[0],y:point.positionRaw[1],z:point.positionRaw[2],confidence:point.score}));
      observations.push({
        id:`${frame.assetId}:human:body:${body.id}:${start}`,
        assetId:frame.assetId,
        kind:'human-body-pose',
        time:{startSeconds:start,endSeconds:end},
        payload:{bodyId:body.id,bounds:body.boxRaw,keypoints},
        confidence:body.score,
        provenance:{provider:'vladmandic-human',source:frame.frameRef,scope:'performance-geometry-only'},
      });
    }
  }

  if(policy.includeHands){
    for(const hand of result.hand){
      if(!validConfidence(hand.score,policy.minimumConfidence)||!validBox(hand.boxRaw)) continue;
      observations.push({
        id:`${frame.assetId}:human:hand:${hand.id}:${start}`,
        assetId:frame.assetId,
        kind:'human-hand-pose',
        time:{startSeconds:start,endSeconds:end},
        payload:{
          handId:hand.id,
          bounds:hand.boxRaw,
          label:hand.label,
          keypoints:hand.keypoints.filter(validPoint).map((point,index)=>({index,x:point[0],y:point[1],z:point[2]})),
        },
        confidence:hand.score,
        provenance:{provider:'vladmandic-human',source:frame.frameRef,scope:'performance-geometry-only'},
      });
    }
  }

  if(policy.includeFaceOrientation){
    for(const face of result.face??[]){
      if(!validConfidence(face.score,policy.minimumConfidence)||!face.rotation) continue;
      observations.push({
        id:`${frame.assetId}:human:face-orientation:${face.id}:${start}`,
        assetId:frame.assetId,
        kind:'human-face-orientation',
        time:{startSeconds:start,endSeconds:end},
        payload:{faceId:face.id,rotation:face.rotation.angle,gaze:face.rotation.gaze},
        confidence:face.score,
        provenance:{provider:'vladmandic-human',source:frame.frameRef,scope:'orientation-only-no-demographics-or-identity'},
      });
    }
  }

  if(policy.includeGestures){
    for(const [index,gesture] of (result.gesture??[]).entries()){
      const part='body' in gesture?'body':'hand' in gesture?'hand':'face' in gesture?'face':'iris';
      observations.push({
        id:`${frame.assetId}:human:gesture:${index}:${start}`,
        assetId:frame.assetId,
        kind:'human-gesture',
        time:{startSeconds:start,endSeconds:end},
        payload:{part,gesture:gesture.gesture,index:gestureIndex(gesture)},
        confidence:1,
        provenance:{provider:'vladmandic-human',source:frame.frameRef,scope:'gesture-label-only'},
      });
    }
  }
  return observations;
}

export function humanResultToFrameAnnotations(
  frameNumber:number,
  result:HumanResultLike,
  policy:Pick<HumanPerformanceObserverPolicy,'minimumConfidence'|'allowedBodyLandmarks'>,
):FrameAnnotation[]{
  if(!Number.isInteger(frameNumber)||frameNumber<0) throw new Error('DIRECTOR_HUMAN_FRAME_INVALID');
  const allowed=policy.allowedBodyLandmarks?new Set(policy.allowedBodyLandmarks):undefined;
  const annotations:FrameAnnotation[]=[];
  for(const body of result.body){
    if(!validConfidence(body.score,policy.minimumConfidence)) continue;
    const keypoints=body.keypoints
      .filter(point=>validConfidence(point.score,policy.minimumConfidence))
      .filter(point=>!allowed||allowed.has(point.part))
      .filter(point=>validPoint(point.positionRaw))
      .map(point=>({name:point.part,x:point.positionRaw[0]!,y:point.positionRaw[1]!,confidence:point.score}));
    if(!keypoints.length) continue;
    annotations.push({
      frame:frameNumber,
      class:'character',
      instanceId:`human-body:${body.id}`,
      confidence:body.score,
      keypoints,
    });
  }
  for(const hand of result.hand){
    if(!validConfidence(hand.score,policy.minimumConfidence)) continue;
    const keypoints=hand.keypoints
      .filter(validPoint)
      .map((point,index)=>({name:`handPoint:${index}`,x:point[0]!,y:point[1]!,confidence:hand.score}));
    if(!keypoints.length) continue;
    annotations.push({
      frame:frameNumber,
      class:'hand',
      instanceId:`human-hand:${hand.id}`,
      confidence:hand.score,
      keypoints,
    });
  }
  return annotations;
}

function gestureIndex(gesture:HumanGestureLike):number{
  if('body' in gesture) return gesture.body;
  if('hand' in gesture) return gesture.hand;
  if('face' in gesture) return gesture.face;
  return gesture.iris;
}
function validConfidence(value:number,minimum:number):boolean{
  return Number.isFinite(value)&&value>=minimum&&value<=1;
}
function validPoint(point:readonly (number|undefined)[]):boolean{
  const x=point[0],y=point[1];
  return typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1;
}
function validBox(box:readonly number[]):boolean{
  return box.length===4&&box.every(Number.isFinite)&&box[0]!>=0&&box[1]!>=0&&box[2]!>0&&box[3]!>0&&box[0]!+box[2]!<=1&&box[1]!+box[3]!<=1;
}
