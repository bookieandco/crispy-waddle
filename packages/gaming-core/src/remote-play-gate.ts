import { DEFAULT_REMOTE_POLICIES, evaluateRemoteQuality, type RemotePlayClass, type RemoteQualitySample } from './remote-quality.js';
import type { Game, LaunchContext } from './runtime.js';
import type { MoonlightClient } from './moonlight-runtime.js';
import { RemotePlaySessionCoordinator, type RemotePlaySession } from './remote-play-session.js';

export interface RemoteLaunchRequest { game: Game; playClass: RemotePlayClass; quality: RemoteQualitySample; context?: LaunchContext; }
export class RemotePlayGate {
  private readonly coordinator: RemotePlaySessionCoordinator;
  constructor(private readonly client: MoonlightClient, private readonly policies = DEFAULT_REMOTE_POLICIES) { this.coordinator = new RemotePlaySessionCoordinator(client); }
  async start(request: RemoteLaunchRequest): Promise<RemotePlaySession> {
    const decision = evaluateRemoteQuality(request.quality, this.policies[request.playClass]);
    if (!decision.allowed) throw new Error(`Remote launch blocked: ${decision.reasons.join('; ')}`);
    return this.coordinator.start(request.game, request.context);
  }
  sendInput(sessionId:string,input:Parameters<RemotePlaySessionCoordinator['sendInput']>[1],nowMs?:number){return this.coordinator.sendInput(sessionId,input,nowMs);}
  stop(sessionId:string){return this.coordinator.stop(sessionId);}
}
