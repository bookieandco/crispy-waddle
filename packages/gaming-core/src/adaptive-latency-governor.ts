import {DEFAULT_REMOTE_POLICIES,evaluateRemoteQuality,type RemotePlayClass,type RemoteQualitySample} from './remote-quality.js';
import {selectGamingDisplayRoute,type GamingDisplayRoute,type GamingDisplayRouteDecision} from './display-routing.js';

export type GamingVideoProfile='native'|'balanced'|'reduced';
export type GamingLatencyAction='allow'|'reduce-video'|'block';

export interface GamingLatencyDecision {
  action:GamingLatencyAction;
  inputPriority:'protected';
  videoProfile:GamingVideoProfile;
  qualityScore:number;
  reasons:readonly string[];
  display:GamingDisplayRouteDecision;
}

export class AdaptiveGamingLatencyGovernor {
  evaluate(
    playClass:RemotePlayClass,
    sample:RemoteQualitySample,
    displayRoutes:readonly GamingDisplayRoute[],
  ):GamingLatencyDecision{
    const policy=DEFAULT_REMOTE_POLICIES[playClass];
    const quality=evaluateRemoteQuality(sample,policy);
    const display=selectGamingDisplayRoute(displayRoutes,{
      maxLatencyMs:policy.maxRttMs,
      requireLowLatency:playClass==='competitive'||playClass==='action',
      preferDirectHomebaseTv:true,
    });

    if(!quality.allowed||!display.allowed){
      return{
        action:'block',
        inputPriority:'protected',
        videoProfile:'reduced',
        qualityScore:quality.score,
        reasons:[...quality.reasons,...(!display.allowed?['no viable low-latency display route']:[])],
        display,
      };
    }

    if(quality.score<70){
      return{
        action:'reduce-video',
        inputPriority:'protected',
        videoProfile:'reduced',
        qualityScore:quality.score,
        reasons:['reduce video demand before compromising controller responsiveness'],
        display,
      };
    }

    return{
      action:'allow',
      inputPriority:'protected',
      videoProfile:quality.score<85?'balanced':'native',
      qualityScore:quality.score,
      reasons:[],
      display,
    };
  }
}
