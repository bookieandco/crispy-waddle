export interface EmulatorContentAdmission {uri:string;source:'user-selected'|'app-library';digest:string;writable:boolean;}
export function assertEmulatorContentAdmission(c:EmulatorContentAdmission):void{
 if(!c.uri.trim()||!c.digest.trim())throw new Error('Emulator content identity is incomplete');
 if(c.source!=='user-selected'&&c.source!=='app-library')throw new Error('Emulator content source is not admitted');
}
export interface EmulatorFirmwareAdmission {id:string;uri:string;digest:string;source:'user-provided'|'app-provisioned';}
export function assertEmulatorFirmwareAdmission(f:EmulatorFirmwareAdmission):void{
 if(!f.id.trim()||!f.uri.trim()||!f.digest.trim())throw new Error('Firmware identity/provenance is incomplete');
}
export interface EmulatorRuntimeHealth {runtimeId:string;frameTimeMs:number;audioLatencyMs:number;inputLatencyMs:number;saveRoundTripPassed:boolean;crashed:boolean;}
export function emulatorRuntimeHealthy(h:EmulatorRuntimeHealth):boolean{
 return Number.isFinite(h.frameTimeMs)&&Number.isFinite(h.audioLatencyMs)&&Number.isFinite(h.inputLatencyMs)&&h.frameTimeMs>0&&h.inputLatencyMs>=0&&h.saveRoundTripPassed&&!h.crashed;
}
export interface EmulatorCompatibilityReceipt{gameId:string;runtimeId:string;coreId:string;contentDigest:string;runtimeVersion:string;controllerProfileId:string;saveRoundTripPassed:boolean;measured:boolean;}
export class EmulatorCompatibilityLedger{
 private readonly receipts=new Map<string,EmulatorCompatibilityReceipt>();
 record(r:EmulatorCompatibilityReceipt):void{if(!r.measured)throw new Error('Compatibility receipt must be measured');if(!r.contentDigest.trim()||!r.runtimeVersion.trim())throw new Error('Compatibility receipt identity is incomplete');this.receipts.set(`${r.gameId}:${r.runtimeId}:${r.coreId}:${r.contentDigest}`,Object.freeze({...r}));}
 list():readonly EmulatorCompatibilityReceipt[]{return [...this.receipts.values()];}
}
