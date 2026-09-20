export interface HardwareLatencySample {
  pathId:string;
  capturedAtMs:number;
  capturedByJhadinaAtMs:number;
  runtimeReceivedAtMs:number;
  frameRenderedAtMs:number;
  displayedAtMs:number;
}

export interface HardwareLatencySummary {
  pathId:string;
  samples:number;
  p50InputToPhotonMs:number;
  p95InputToPhotonMs:number;
  p95CaptureToRuntimeMs:number;
  classification:'excellent'|'good'|'warning'|'blocked';
}

const percentile=(values:readonly number[],p:number):number=>{
  const sorted=[...values].sort((a,b)=>a-b);
  const index=Math.min(sorted.length-1,Math.ceil((p/100)*sorted.length)-1);
  return sorted[index]!;
};

export function summarizeHardwareLatency(samples:readonly HardwareLatencySample[],minimumSamples=20):HardwareLatencySummary{
  if(samples.length<minimumSamples)throw new Error(`Insufficient hardware latency samples: ${samples.length}/${minimumSamples}`);
  const pathId=samples[0]!.pathId;
  if(samples.some(sample=>sample.pathId!==pathId))throw new Error('Latency samples must belong to one hardware path');
  const inputToPhoton:number[]=[];
  const captureToRuntime:number[]=[];
  for(const sample of samples){
    const timeline=[sample.capturedAtMs,sample.capturedByJhadinaAtMs,sample.runtimeReceivedAtMs,sample.frameRenderedAtMs,sample.displayedAtMs];
    if(timeline.some(value=>!Number.isFinite(value)))throw new Error('Latency timestamps must be finite');
    if(timeline.some((value,index)=>index>0&&value<timeline[index-1]!))throw new Error('Latency timeline must be monotonic');
    inputToPhoton.push(sample.displayedAtMs-sample.capturedAtMs);
    captureToRuntime.push(sample.runtimeReceivedAtMs-sample.capturedAtMs);
  }
  const p95=percentile(inputToPhoton,95);
  const classification=p95<=20?'excellent':p95<=50?'good':p95<=80?'warning':'blocked';
  return{
    pathId,
    samples:samples.length,
    p50InputToPhotonMs:percentile(inputToPhoton,50),
    p95InputToPhotonMs:p95,
    p95CaptureToRuntimeMs:percentile(captureToRuntime,95),
    classification,
  };
}

export const G21_HARDWARE_LATENCY_MATRIX=Object.freeze([
  'gamesir-x5-usb-c-phone',
  'dualsense-usb',
  'dualsense-bluetooth',
  'sunshine-lan',
  'emulatorjs-browser',
  'libretro-local',
  'playstation-remote-play-lan',
] as const);
