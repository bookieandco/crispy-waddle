export type RemotePlayClass = 'competitive' | 'action' | 'casual' | 'turn-based';
export interface RemoteQualitySample { rttMs:number; jitterMs:number; packetLossPercent:number; bandwidthMbps?:number; decodeLatencyMs?:number; inputLatencyMs?:number; }
export interface RemoteQualityPolicy { maxRttMs:number; maxJitterMs:number; maxPacketLossPercent:number; minBandwidthMbps?:number; maxInputLatencyMs?:number; }
export interface RemoteQualityDecision { allowed:boolean; reasons:readonly string[]; score:number; }
export const DEFAULT_REMOTE_POLICIES:Readonly<Record<RemotePlayClass,RemoteQualityPolicy>>={
 competitive:{maxRttMs:50,maxJitterMs:8,maxPacketLossPercent:0.5,maxInputLatencyMs:35},
 action:{maxRttMs:60,maxJitterMs:12,maxPacketLossPercent:1,maxInputLatencyMs:45},
 casual:{maxRttMs:100,maxJitterMs:20,maxPacketLossPercent:2},
 'turn-based':{maxRttMs:150,maxJitterMs:30,maxPacketLossPercent:3},
};
export function evaluateRemoteQuality(sample:RemoteQualitySample,policy:RemoteQualityPolicy):RemoteQualityDecision{const reasons:string[]=[];if(sample.rttMs>policy.maxRttMs)reasons.push('round-trip latency too high');if(sample.jitterMs>policy.maxJitterMs)reasons.push('jitter too high');if(sample.packetLossPercent>policy.maxPacketLossPercent)reasons.push('packet loss too high');if(policy.minBandwidthMbps!==undefined&&(sample.bandwidthMbps??0)<policy.minBandwidthMbps)reasons.push('insufficient bandwidth');if(policy.maxInputLatencyMs!==undefined&&(sample.inputLatencyMs??Number.POSITIVE_INFINITY)>policy.maxInputLatencyMs)reasons.push('input latency too high');const score=Math.max(0,100-(sample.rttMs/policy.maxRttMs)*35-(sample.jitterMs/policy.maxJitterMs)*25-(sample.packetLossPercent/policy.maxPacketLossPercent)*40);return{allowed:reasons.length===0,reasons,score};}
