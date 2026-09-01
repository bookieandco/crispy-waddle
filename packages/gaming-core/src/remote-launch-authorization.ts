import type { Game } from './runtime.js';
import type { RemoteApp } from './remote-apps.js';
import type { RemotePlayClass, RemoteQualitySample, RemoteQualityPolicy } from './remote-quality.js';
import { evaluateRemoteQuality } from './remote-quality.js';
import type { SunshinePairingManager } from './sunshine-pairing.js';
import { evaluateSunshineCapabilities, type DeviceStreamCapabilities, type SunshineCapabilityRequirement } from './sunshine-capabilities.js';
import type { MoonlightStreamCapabilities } from './moonlight-runtime.js';

export interface RemoteLaunchAuthorizationRequest { game:Game; app:RemoteApp; playClass:RemotePlayClass; quality:RemoteQualitySample; qualityPolicy:RemoteQualityPolicy; hostCapabilities:MoonlightStreamCapabilities; deviceCapabilities:DeviceStreamCapabilities; streamRequirement?:SunshineCapabilityRequirement; }
export interface RemoteLaunchAuthorization { allowed:boolean; reasons:readonly string[]; }
export class RemoteLaunchAuthorizer {
 constructor(private readonly pairing:SunshinePairingManager){}
 async authorize(request:RemoteLaunchAuthorizationRequest):Promise<RemoteLaunchAuthorization>{const reasons:string[]=[];if(request.app.hostId!==request.game.metadata?.['hostId'])reasons.push('game is not bound to the selected remote host');try{await this.pairing.requirePaired(request.app.hostId);}catch{reasons.push('remote host is not paired');}const q=evaluateRemoteQuality(request.quality,request.qualityPolicy);if(!q.allowed) reasons.push(...q.reasons);const c=evaluateSunshineCapabilities(request.hostCapabilities,request.deviceCapabilities,request.streamRequirement);if(!c.allowed) reasons.push(...c.reasons);return{allowed:reasons.length===0,reasons};}
}
