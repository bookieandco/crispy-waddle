import type {GamingLaunchProposal} from './unified-runtime-resolver.js';
import type {LaunchAuthorizationResult} from './launch-authorization.js';

export interface AuthorizedGamingLaunch {
  proposal: GamingLaunchProposal;
  authorization: Extract<LaunchAuthorizationResult, {allowed:true}>;
}

export interface GamingSession {
  sessionId:string;
  proposalId:string;
  runtimeId:string;
  runtimeKind:GamingLaunchProposal['runtimeKind'];
  startedAtMs:number;
  status:'starting'|'running'|'stopped'|'failed';
}

export interface GamingLaunchAdapter {
  supports(runtimeKind:GamingLaunchProposal['runtimeKind']):boolean;
  launch(proposal:GamingLaunchProposal):Promise<GamingSession>;
}

export class GamingLaunchExecutionBoundary {
  constructor(private readonly adapters:readonly GamingLaunchAdapter[]){ }

  async launch(request:AuthorizedGamingLaunch):Promise<GamingSession>{
    if(request.authorization.allowed!==true || request.authorization.reason!=='authorized'){
      throw new Error('Gaming launch is not authorized');
    }
    const adapter=this.adapters.find(candidate=>candidate.supports(request.proposal.runtimeKind));
    if(!adapter)throw new Error(`No launch adapter for runtime kind: ${request.proposal.runtimeKind}`);
    return adapter.launch(request.proposal);
  }
}

export function toAuthorizedGamingLaunch(
  proposal:GamingLaunchProposal,
  authorization:LaunchAuthorizationResult,
):AuthorizedGamingLaunch{
  if(authorization.allowed!==true || authorization.reason!=='authorized'){
    throw new Error(`Launch authorization denied: ${authorization.reason}`);
  }
  return {proposal,authorization};
}
