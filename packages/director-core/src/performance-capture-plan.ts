export type PerformanceCaptureFraming='torso-up'|'full-body';
export type TrackingLossPolicy='hold-last'|'return-to-rest';
export type PerformanceCapturePassKind='body'|'face'|'gaze'|'hands';
export type PerformanceController='body-tracking'|'manual-dragger'|'trigger-animation';

export interface PerformanceCapturePass {
  id:string;
  kind:PerformanceCapturePassKind;
  frameStart:number;
  frameEnd:number;
  trackedLandmarks:readonly string[];
  blendInFrames:number;
  blendOutFrames:number;
  evidenceIds:readonly string[];
}

export interface PerformanceControllerWindow {
  id:string;
  frameStart:number;
  frameEnd:number;
  controller:PerformanceController;
  bodyTrackingStrength:number;
  evidenceIds:readonly string[];
}

export interface PerformanceCapturePlan {
  id:string;
  projectId:string;
  characterAssetId:string;
  framing:PerformanceCaptureFraming;
  fps:number;
  calibrationCountdownSeconds:number;
  calibrationPose:string;
  trackedLandmarks:readonly string[];
  trackingLoss:{
    policy:TrackingLossPolicy;
    returnDurationFrames?:number;
  };
  trackingStrength:number;
  passes:readonly PerformanceCapturePass[];
  controllerWindows?:readonly PerformanceControllerWindow[];
  setupEvidenceIds:readonly string[];
  authority:'DIRECTOR_PERFORMANCE_CAPTURE_PLAN';
}

export function validatePerformanceCapturePlan(plan:PerformanceCapturePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.characterAssetId.trim()) reasons.push('DIRECTOR_CAPTURE_IDENTITY_REQUIRED');
  if(!Number.isFinite(plan.fps)||plan.fps<=0) reasons.push('DIRECTOR_CAPTURE_FPS_INVALID');
  if(!Number.isFinite(plan.calibrationCountdownSeconds)||plan.calibrationCountdownSeconds<0) reasons.push('DIRECTOR_CAPTURE_COUNTDOWN_INVALID');
  if(!plan.calibrationPose.trim()) reasons.push('DIRECTOR_CAPTURE_CALIBRATION_POSE_REQUIRED');
  if(!plan.trackedLandmarks.length||plan.trackedLandmarks.some(x=>!x.trim())) reasons.push('DIRECTOR_CAPTURE_LANDMARKS_REQUIRED');
  if(new Set(plan.trackedLandmarks).size!==plan.trackedLandmarks.length) reasons.push('DIRECTOR_CAPTURE_LANDMARK_DUPLICATE');
  if(!Number.isFinite(plan.trackingStrength)||plan.trackingStrength<0||plan.trackingStrength>1) reasons.push('DIRECTOR_CAPTURE_STRENGTH_INVALID');
  if(plan.trackingLoss.policy==='return-to-rest'){
    if(!Number.isInteger(plan.trackingLoss.returnDurationFrames)||plan.trackingLoss.returnDurationFrames!<1){
      reasons.push('DIRECTOR_CAPTURE_RETURN_DURATION_REQUIRED');
    }
  }else if(plan.trackingLoss.returnDurationFrames!==undefined){
    reasons.push('DIRECTOR_CAPTURE_RETURN_DURATION_WITH_HOLD');
  }
  if(!plan.passes.length) reasons.push('DIRECTOR_CAPTURE_PASSES_REQUIRED');
  if(!plan.setupEvidenceIds.length) reasons.push('DIRECTOR_CAPTURE_SETUP_EVIDENCE_REQUIRED');

  const passIds=new Set<string>();
  for(const pass of plan.passes){
    if(!pass.id.trim()||passIds.has(pass.id)) reasons.push(`DIRECTOR_CAPTURE_PASS_ID_INVALID:${pass.id||'unknown'}`);
    passIds.add(pass.id);
    if(!Number.isInteger(pass.frameStart)||!Number.isInteger(pass.frameEnd)||pass.frameStart<0||pass.frameEnd<pass.frameStart){
      reasons.push(`DIRECTOR_CAPTURE_PASS_RANGE_INVALID:${pass.id}`);
    }
    if(!Number.isInteger(pass.blendInFrames)||pass.blendInFrames<0||!Number.isInteger(pass.blendOutFrames)||pass.blendOutFrames<0){
      reasons.push(`DIRECTOR_CAPTURE_PASS_BLEND_INVALID:${pass.id}`);
    }
    if(!pass.trackedLandmarks.length||pass.trackedLandmarks.some(x=>!plan.trackedLandmarks.includes(x))){
      reasons.push(`DIRECTOR_CAPTURE_PASS_LANDMARK_INVALID:${pass.id}`);
    }
    if(!pass.evidenceIds.length) reasons.push(`DIRECTOR_CAPTURE_PASS_EVIDENCE_REQUIRED:${pass.id}`);
  }

  const windowIds=new Set<string>();
  let previousEnd=-1;
  for(const window of plan.controllerWindows??[]){
    if(!window.id.trim()||windowIds.has(window.id)) reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_ID_INVALID:${window.id||'unknown'}`);
    windowIds.add(window.id);
    if(!Number.isInteger(window.frameStart)||!Number.isInteger(window.frameEnd)||window.frameStart<0||window.frameEnd<window.frameStart){
      reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_RANGE_INVALID:${window.id}`);
    }
    if(window.frameStart<=previousEnd) reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_OVERLAP:${window.id}`);
    previousEnd=Math.max(previousEnd,window.frameEnd);
    if(!Number.isFinite(window.bodyTrackingStrength)||window.bodyTrackingStrength<0||window.bodyTrackingStrength>1){
      reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_STRENGTH_INVALID:${window.id}`);
    }
    if(window.controller!=='body-tracking'&&window.bodyTrackingStrength>0){
      reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_CONFLICT:${window.id}`);
    }
    if(!window.evidenceIds.length) reasons.push(`DIRECTOR_CAPTURE_CONTROLLER_EVIDENCE_REQUIRED:${window.id}`);
  }

  return Object.freeze([...new Set(reasons)]);
}

export function performanceCaptureEvidence(plan:PerformanceCapturePlan):readonly string[]{
  const reasons=validatePerformanceCapturePlan(plan);
  if(reasons.length) throw new Error(`DIRECTOR_PERFORMANCE_CAPTURE_INVALID: ${reasons.join(', ')}`);
  return Object.freeze([
    `performance-capture:${plan.id}`,
    `performance-capture-framing:${plan.framing}`,
    `performance-capture-loss:${plan.trackingLoss.policy}`,
    `performance-capture-strength:${plan.trackingStrength}`,
    ...plan.passes.map(pass=>`performance-capture-pass:${pass.id}:${pass.kind}:${pass.frameStart}-${pass.frameEnd}`),
    ...(plan.controllerWindows??[]).map(window=>`performance-capture-controller:${window.id}:${window.controller}:${window.bodyTrackingStrength}`),
    ...plan.setupEvidenceIds,
    ...plan.passes.flatMap(pass=>pass.evidenceIds),
    ...(plan.controllerWindows??[]).flatMap(window=>window.evidenceIds),
  ]);
}
