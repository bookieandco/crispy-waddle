import type { Game, LaunchContext } from './runtime.js';
import type { RemoteApp } from './remote-apps.js';
import type { RemoteQualityPolicy, RemoteQualitySample, RemotePlayClass } from './remote-quality.js';
import type { MoonlightClient, MoonlightStreamCapabilities } from './moonlight-runtime.js';
import type { DeviceStreamCapabilities, SunshineCapabilityRequirement } from './sunshine-capabilities.js';
import { negotiateStream, type StreamPreferences } from './negotiated-stream.js';
import type { RemoteLaunchAuthorizationRequest } from './remote-launch-authorization.js';
import { RemoteLaunchAuthorizer } from './remote-launch-authorization.js';
import type { RemotePlaySession } from './remote-play-session.js';
import { RemotePlaySessionCoordinator } from './remote-play-session.js';
import type { SunshinePairingManager } from './sunshine-pairing.js';
import type { RemotePlaySessionMonitor } from './remote-play-session-monitor.js';

export interface AuthorizedRemoteLaunchRequest { game:Game; app:RemoteApp; playClass:RemotePlayClass; quality:RemoteQualitySample; qualityPolicy:RemoteQualityPolicy; hostCapabilities:MoonlightStreamCapabilities; deviceCapabilities:DeviceStreamCapabilities; streamRequirement?:SunshineCapabilityRequirement; streamPreferences:StreamPreferences; context?:LaunchContext; }
export class AuthorizedRemoteLaunch {
 private readonly authorizer:RemoteLaunchAuthorizer; private readonly coordinator:RemotePlaySessionCoordinator;
 constructor(pairing:SunshinePairingManager,client:MoonlightClient,private readonly monitor?:RemotePlaySessionMonitor){this.authorizer=new RemoteLaunchAuthorizer(pairing);this.coordinator=new RemotePlaySessionCoordinator(client);}
 async launch(request:AuthorizedRemoteLaunchRequest):Promise<RemotePlaySession>{const auth:RemoteLaunchAuthorizationRequest=request;const decision=await this.authorizer.authorize(auth);if(!decision.allowed)throw new Error(`Remote launch denied: ${decision.reasons.join('; ')}`);const stream=negotiateStream(request.hostCapabilities,request.deviceCapabilities,request.streamPreferences,request.streamRequirement);const session=await this.coordinator.start(request.game,request.context,stream);this.monitor?.start(session,request.qualityPolicy);return session;}
 async stop(sessionId:string):Promise<void>{this.monitor?.stop();await this.coordinator.stop(sessionId);}
}
