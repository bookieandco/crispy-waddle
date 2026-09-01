export type ControllerHealthState='healthy'|'jitter'|'out-of-range'|'disconnected';

export interface ControllerCalibration {
  axisDeadzone:number;
  axisMax:number;
  triggerMin:number;
  triggerMax:number;
  jitterThreshold:number;
  jitterWindowMs?:number;
}

export interface ControllerSample {
  deviceId:string;
  connected:boolean;
  capturedAtMs:number;
  axes?:readonly number[];
  triggers?:readonly number[];
}

export interface ControllerHealthResult {
  deviceId:string;
  state:ControllerHealthState;
  accepted:boolean;
  normalizedAxes:readonly number[];
  normalizedTriggers:readonly number[];
  jitterDetected:boolean;
  outOfRange:boolean;
}

const finite=(value:number)=>Number.isFinite(value);

export function normalizeControllerSample(sample:ControllerSample,calibration:ControllerCalibration,previous?:ControllerSample):ControllerHealthResult{
  if(typeof sample.deviceId!=='string'||!sample.deviceId.trim())throw new Error('deviceId is required');
  if(!finite(sample.capturedAtMs))throw new Error('capturedAtMs must be finite');
  if(!sample.connected)return{deviceId:sample.deviceId,state:'disconnected',accepted:false,normalizedAxes:[],normalizedTriggers:[],jitterDetected:false,outOfRange:false};
  if(!finite(calibration.axisDeadzone)||calibration.axisDeadzone<0||calibration.axisDeadzone>=1)throw new Error('axisDeadzone must be in [0,1)');
  if(!finite(calibration.axisMax)||calibration.axisMax<=0)throw new Error('axisMax must be positive');
  if(!finite(calibration.triggerMin)||!finite(calibration.triggerMax)||calibration.triggerMax<=calibration.triggerMin)throw new Error('trigger calibration range is invalid');
  if(!finite(calibration.jitterThreshold)||calibration.jitterThreshold<0)throw new Error('jitterThreshold must be non-negative');
  const jitterWindowMs=calibration.jitterWindowMs??50;
  if(!finite(jitterWindowMs)||jitterWindowMs<0)throw new Error('jitterWindowMs must be non-negative');
  const axes=sample.axes??[];
  const triggers=sample.triggers??[];
  const outOfRange=axes.some(value=>!finite(value)||value<-calibration.axisMax||value>calibration.axisMax)||triggers.some(value=>!finite(value)||value<calibration.triggerMin||value>calibration.triggerMax);
  if(outOfRange)return{deviceId:sample.deviceId,state:'out-of-range',accepted:false,normalizedAxes:[],normalizedTriggers:[],jitterDetected:false,outOfRange:true};
  const normalizedAxes=axes.map(value=>{const scaled=value/calibration.axisMax;return Math.abs(scaled)<calibration.axisDeadzone?0:scaled;});
  const normalizedTriggers=triggers.map(value=>(value-calibration.triggerMin)/(calibration.triggerMax-calibration.triggerMin));
  const previousAxes=previous?.axes??[];
  const jitterDetected=previous?.deviceId===sample.deviceId&&sample.capturedAtMs>=previous.capturedAtMs&&sample.capturedAtMs-previous.capturedAtMs<=jitterWindowMs&&normalizedAxes.some((value,index)=>{const prior=previousAxes[index];if(prior===undefined||!finite(prior)||prior<-calibration.axisMax||prior>calibration.axisMax)return false;const priorNormalized=Math.abs(prior/calibration.axisMax)<calibration.axisDeadzone?0:prior/calibration.axisMax;const delta=Math.abs(value-priorNormalized);return delta>0&&delta<=calibration.jitterThreshold;});
  return{deviceId:sample.deviceId,state:jitterDetected?'jitter':'healthy',accepted:!jitterDetected,normalizedAxes,normalizedTriggers,jitterDetected,outOfRange:false};
}

export function assertControllerHealthy(result:ControllerHealthResult):void{if(!result.accepted||result.state!=='healthy')throw new Error(`Controller is not healthy: ${result.state}`);}
