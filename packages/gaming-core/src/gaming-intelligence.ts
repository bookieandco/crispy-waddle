export type GamingObservationKind='frame-event'|'hud-state'|'death'|'objective'|'performance'|'player-note';

export interface GamingObservation {
  observationId:string;
  sessionId:string;
  gameId:string;
  kind:GamingObservationKind;
  observedAtMs:number;
  summary:string;
  evidenceRefs:readonly string[];
}

export interface GamingAdvice {
  gameId:string;
  basedOnObservationIds:readonly string[];
  text:string;
  controllerInjectionAllowed:false;
}

export class GamingIntelligenceLedger {
  private readonly observations=new Map<string,GamingObservation>();

  record(observation:GamingObservation):void{
    if(!observation.observationId.trim()||!observation.sessionId.trim()||!observation.gameId.trim())throw new Error('Gaming observation identity is incomplete');
    if(!Number.isFinite(observation.observedAtMs))throw new Error('Gaming observation timestamp must be finite');
    if(!observation.summary.trim())throw new Error('Gaming observation summary is required');
    this.observations.set(observation.observationId,Object.freeze({...observation,evidenceRefs:Object.freeze([...observation.evidenceRefs])}));
  }

  forGame(gameId:string):readonly GamingObservation[]{
    return [...this.observations.values()].filter(item=>item.gameId===gameId).sort((a,b)=>a.observedAtMs-b.observedAtMs).map(item=>({...item,evidenceRefs:[...item.evidenceRefs]}));
  }

  advise(gameId:string,text:string,observationIds:readonly string[]):GamingAdvice{
    const known=new Set(this.forGame(gameId).map(item=>item.observationId));
    for(const id of observationIds)if(!known.has(id))throw new Error(`Unknown supporting gaming observation: ${id}`);
    return{gameId,basedOnObservationIds:[...observationIds],text,controllerInjectionAllowed:false};
  }
}

export type GamingAssistantIntent=
  |'resume-game'|'switch-runtime'|'switch-display'|'use-controller'
  |'explain-death'|'show-attempts'|'compare-runtime-performance';

export interface GamingAssistantRequest {
  intent:GamingAssistantIntent;
  gameId:string;
  targetId?:string;
}

export interface GamingAssistantPlan {
  intent:GamingAssistantIntent;
  gameId:string;
  targetId?:string;
  requiresAuthorization:boolean;
  controllerInjectionAllowed:false;
  actions:readonly string[];
}

export class GamingAssistantPlanner {
  plan(request:GamingAssistantRequest):GamingAssistantPlan{
    const mutating=new Set<GamingAssistantIntent>(['resume-game','switch-runtime','switch-display','use-controller']);
    const actions:Record<GamingAssistantIntent,readonly string[]>={
      'resume-game':['resolve-resume-pointer','request-launch-authorization'],
      'switch-runtime':['resolve-compatible-runtime','request-runtime-switch-authorization'],
      'switch-display':['resolve-display-route','request-display-switch-authorization'],
      'use-controller':['resolve-controller-profile','request-controller-bind-authorization'],
      'explain-death':['retrieve-observations','generate-advice'],
      'show-attempts':['retrieve-session-history','present-attempts'],
      'compare-runtime-performance':['retrieve-measured-runtime-profiles','compare-measurements'],
    };
    return{
      intent:request.intent,
      gameId:request.gameId,
      targetId:request.targetId,
      requiresAuthorization:mutating.has(request.intent),
      controllerInjectionAllowed:false,
      actions:actions[request.intent],
    };
  }
}
