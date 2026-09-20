export type StreamingProvider='sunshine-moonlight'|'playstation-remote-play'|'xbox-home'|'xbox-cloud'|'steam-remote';
export interface StreamingNetworkSample{rttMs:number;jitterMs:number;packetLossPercent:number;bandwidthMbps:number;encodeMs:number;decodeMs:number;framePacingMs:number;inputLatencyMs:number;}
export interface StreamingPolicy{maxRttMs:number;maxJitterMs:number;maxLossPercent:number;minBandwidthMbps:number;maxInputLatencyMs:number;}
export interface StreamingAdaptation{allowed:boolean;degradeVideo:boolean;blockLatencySensitive:boolean;reasons:readonly string[];}
export function evaluateStreamingNetwork(s:StreamingNetworkSample,p:StreamingPolicy):StreamingAdaptation{
 const reasons:string[]=[];if(s.rttMs>p.maxRttMs)reasons.push('rtt');if(s.jitterMs>p.maxJitterMs)reasons.push('jitter');if(s.packetLossPercent>p.maxLossPercent)reasons.push('packet-loss');if(s.bandwidthMbps<p.minBandwidthMbps)reasons.push('bandwidth');if(s.inputLatencyMs>p.maxInputLatencyMs)reasons.push('input-latency');
 return{allowed:!reasons.includes('input-latency'),degradeVideo:reasons.some(x=>x!=='input-latency'),blockLatencySensitive:reasons.includes('input-latency'),reasons};
}
export interface StreamingSessionContract{provider:StreamingProvider;sessionId:string;authenticated:boolean;controllerBound:boolean;videoBufferMayDelayInput:false;credentialIsolation:true;}
export function assertStreamingSession(s:StreamingSessionContract):void{if(!s.sessionId.trim()||!s.authenticated)throw new Error('Streaming session is not authenticated');if(s.videoBufferMayDelayInput!==false||s.credentialIsolation!==true)throw new Error('Streaming input/security invariant violated');}
export const G33_G41_STREAMING_SCOPE=Object.freeze(['runtime-unification','online-transport','adaptive-streaming','input-integrity','handoff','save-resume','security-privacy','runtime-resolver','network-failure-acceptance'] as const);
