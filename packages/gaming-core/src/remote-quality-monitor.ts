import { evaluateRemoteQuality, type RemotePlayClass, type RemoteQualityDecision, type RemoteQualityPolicy, type RemoteQualitySample } from './remote-quality.js';

export type RemoteQualityState = 'healthy' | 'degraded' | 'blocked';
export interface RemoteQualityMonitorSnapshot { sample: RemoteQualitySample; decision: RemoteQualityDecision; state: RemoteQualityState; atMs:number; }
export interface RemoteQualityMonitorOptions { intervalMs?:number; degradedScore?:number; }
export class RemoteQualityMonitor {
 private timer?:ReturnType<typeof setInterval>;
 private latest?:RemoteQualityMonitorSnapshot;
 constructor(private readonly probe:()=>Promise<RemoteQualitySample>, private readonly policy:RemoteQualityPolicy, private readonly onChange?:(snapshot:RemoteQualityMonitorSnapshot)=>void, private readonly options:RemoteQualityMonitorOptions={}){}
 async sample(nowMs=Date.now()):Promise<RemoteQualityMonitorSnapshot>{const sample=await this.probe();const decision=evaluateRemoteQuality(sample,this.policy);const degradedScore=this.options.degradedScore??70;const state=!decision.allowed?'blocked':decision.score<degradedScore?'degraded':'healthy';const snapshot={sample,decision,state,atMs:nowMs};this.latest=snapshot;this.onChange?.(snapshot);return snapshot;}
 start():void{if(this.timer)return;const interval=this.options.intervalMs??1000;void this.sample();this.timer=setInterval(()=>void this.sample(),interval);}
 stop():void{if(this.timer){clearInterval(this.timer);this.timer=undefined;}}
 getSnapshot():RemoteQualityMonitorSnapshot|undefined{return this.latest;}
}

export function policyForPlayClass(playClass:RemotePlayClass, policies:Readonly<Record<RemotePlayClass,RemoteQualityPolicy>>):RemoteQualityPolicy{return policies[playClass];}
