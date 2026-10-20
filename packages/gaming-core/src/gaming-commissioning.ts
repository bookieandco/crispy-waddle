export type CommissioningPathId=
  |'gamesir-x5-local'|'gamesir-x5-ps5'|'dualsense-usb-local'|'dualsense-bluetooth-local'
  |'dualsense-ps5'|'libretro-wasm'|'emulatorjs-browser'|'native-emulator'
  |'homebase-tv'|'sunshine-lan'|'sunshine-internet'|'playstation-lan'|'playstation-internet'
  |'xbox-home'|'xbox-cloud';

export interface CommissioningSample {
  pathId:CommissioningPathId;
  sampleId:string;
  capturedAtMs:number;
  jhadinaCapturedAtMs:number;
  runtimeReceivedAtMs:number;
  frameRenderedAtMs:number;
  displayedAtMs:number;
  rttMs:number;
  jitterMs:number;
  packetLossPercent:number;
  reconnectCount:number;
  orphanedResources:number;
}

export interface CommissioningReceipt {
  receiptId:string;
  pathId:CommissioningPathId;
  deviceIds:readonly string[];
  firmwareVersions:Readonly<Record<string,string>>;
  runtimeVersions:Readonly<Record<string,string>>;
  samples:readonly CommissioningSample[];
  observedByHardware:boolean;
  artifactRefs:readonly string[];
}

export class GamingCommissioningHarness {
  validate(receipt:CommissioningReceipt):void{
    if(!receipt.receiptId.trim()||receipt.deviceIds.length===0)throw new Error('Commissioning receipt identity is incomplete');
    if(receipt.samples.length===0)throw new Error('Commissioning receipt requires samples');
    if(!receipt.artifactRefs.length||receipt.artifactRefs.some(ref=>!ref.trim()))throw new Error('Commissioning requires artifact references');
    if(receipt.deviceIds.some(id=>!id.trim())||!Object.values(receipt.firmwareVersions).length||!Object.values(receipt.runtimeVersions).length)throw new Error('Commissioning device/runtime identity incomplete');
    const sampleIds=new Set<string>();
    for(const sample of receipt.samples){
      if(sample.pathId!==receipt.pathId)throw new Error('Commissioning sample path mismatch');
      if(!sample.sampleId.trim()||sampleIds.has(sample.sampleId))throw new Error('Commissioning sample ids must be unique and nonempty');
      sampleIds.add(sample.sampleId);
      const timeline=[sample.capturedAtMs,sample.jhadinaCapturedAtMs,sample.runtimeReceivedAtMs,sample.frameRenderedAtMs,sample.displayedAtMs];
      if(timeline.some(v=>!Number.isFinite(v))||timeline.some((v,i)=>i>0&&v<timeline[i-1]!))throw new Error('Commissioning timeline must be finite and monotonic');
      if(![sample.rttMs,sample.jitterMs,sample.packetLossPercent,sample.reconnectCount,sample.orphanedResources].every(Number.isFinite))throw new Error('Non-finite commissioning metrics');
      if(sample.rttMs<0||sample.jitterMs<0||sample.packetLossPercent<0||sample.packetLossPercent>100)throw new Error('Commissioning network metrics are invalid');
      if(sample.reconnectCount<0||sample.orphanedResources<0)throw new Error('Commissioning counters cannot be negative');
    }
  }
}

export const G28_COMMISSIONING_PATHS:readonly CommissioningPathId[]=Object.freeze([
  'gamesir-x5-local','gamesir-x5-ps5','dualsense-usb-local','dualsense-bluetooth-local','dualsense-ps5',
  'libretro-wasm','emulatorjs-browser','native-emulator','homebase-tv','sunshine-lan','sunshine-internet',
  'playstation-lan','playstation-internet','xbox-home','xbox-cloud',
]);
