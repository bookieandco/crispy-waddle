export type InputLatencyClassification='excellent'|'good'|'warning'|'blocked';

export interface InputPhotonTimestamps {
  capturedAtMs:number;
  runtimeReceivedAtMs?:number;
  frameRenderedAtMs?:number;
}

export interface InputPhotonLatencyPolicy {
  excellentMaxMs:number;
  goodMaxMs:number;
  warningMaxMs:number;
}

export interface InputPhotonLatencyMeasurement {
  captureToRuntimeMs?:number;
  inputToPhotonMs?:number;
  classification:'unmeasurable'|InputLatencyClassification;
}

const delta=(start:number,end?:number):number|undefined=>end===undefined?undefined:end-start;

export function measureInputToPhoton(
  timestamps:InputPhotonTimestamps,
  policy:InputPhotonLatencyPolicy={excellentMaxMs:20,goodMaxMs:50,warningMaxMs:80},
):InputPhotonLatencyMeasurement{
  if(!Number.isFinite(timestamps.capturedAtMs))throw new Error('capturedAtMs must be finite');
  for(const [name,value] of Object.entries(timestamps)){if(value!==undefined&&!Number.isFinite(value))throw new Error(`${name} must be finite`);}
  if(policy.excellentMaxMs<0||policy.goodMaxMs<policy.excellentMaxMs||policy.warningMaxMs<policy.goodMaxMs)throw new Error('Latency policy thresholds must be ordered and non-negative');
  const captureToRuntimeMs=delta(timestamps.capturedAtMs,timestamps.runtimeReceivedAtMs);
  const inputToPhotonMs=delta(timestamps.capturedAtMs,timestamps.frameRenderedAtMs);
  if(captureToRuntimeMs!==undefined&&captureToRuntimeMs<0)throw new Error('runtimeReceivedAtMs must not precede capturedAtMs');
  if(inputToPhotonMs!==undefined&&inputToPhotonMs<0)throw new Error('frameRenderedAtMs must not precede capturedAtMs');
  if(inputToPhotonMs===undefined)return{captureToRuntimeMs,inputToPhotonMs,classification:'unmeasurable'};
  const classification=inputToPhotonMs<=policy.excellentMaxMs?'excellent':inputToPhotonMs<=policy.goodMaxMs?'good':inputToPhotonMs<=policy.warningMaxMs?'warning':'blocked';
  return{captureToRuntimeMs,inputToPhotonMs,classification};
}

export function enforceInputPhotonLatency(measurement:InputPhotonLatencyMeasurement):void{
  if(measurement.classification==='blocked')throw new Error(`Input-to-photon latency budget exceeded: ${measurement.inputToPhotonMs}ms`);
  if(measurement.classification==='unmeasurable')throw new Error('Input-to-photon latency is not measurable');
}
