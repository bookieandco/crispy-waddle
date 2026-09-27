export type CapabilityRisk = 'read' | 'write' | 'external' | 'financial' | 'destructive';
export type JhadinaCapabilityVerb = 'observe'|'read'|'analyze'|'plan'|'propose'|'execute';
export type CapabilityRuntimeState = 'unknown'|'ready'|'degraded'|'blocked'|'simulation-only'|'paper-only'|'disabled';

export interface JhadinaSubsystemSurface {
  readonly subsystemId:string;
  readonly verbs:Readonly<Record<JhadinaCapabilityVerb,readonly string[]>>;
}

export interface CapabilityRuntimeEvidence {
  readonly id:string;
  readonly source:string;
  readonly observedAt:string;
  readonly kind:'source'|'infrastructure'|'live-runtime'|'operator';
  readonly summary:string;
  readonly expiresAt?:string;
}

export interface CapabilityRuntimeStatus {
  readonly capabilityName:string;
  readonly subsystemId?:string;
  readonly state:CapabilityRuntimeState;
  readonly reason?:string;
  readonly evidence:readonly CapabilityRuntimeEvidence[];
  readonly updatedAt:string;
}

export interface EffectiveCapabilityRuntimeStatus {
  readonly capabilityName:string;
  readonly subsystemId?:string;
  readonly configuredState:CapabilityRuntimeState;
  readonly state:CapabilityRuntimeState;
  readonly reason?:string;
  readonly freshEvidence:readonly CapabilityRuntimeEvidence[];
  readonly staleEvidence:readonly CapabilityRuntimeEvidence[];
  readonly updatedAt?:string;
  readonly evaluatedAt:string;
}

export function buildSubsystemSurface(registry:CapabilityRegistry,subsystemId:string):JhadinaSubsystemSurface {
  const capabilities=registry.list().filter(item=>item.subsystemId===subsystemId);
  const buckets:Record<JhadinaCapabilityVerb,string[]>={observe:[],read:[],analyze:[],plan:[],propose:[],execute:[]};
  for(const capability of capabilities){
    const name=capability.name.toLowerCase();
    const verb:JhadinaCapabilityVerb =
      /observe|watch|inspect/.test(name)?'observe':
      /read|get|list|review/.test(name)?'read':
      /analy|score|model|simulate/.test(name)?'analyze':
      /plan|draft/.test(name)?'plan':
      /propose|recommend/.test(name)?'propose':'execute';
    buckets[verb].push(capability.name);
  }
  return Object.freeze({subsystemId,verbs:Object.freeze(Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,Object.freeze(v.sort())])) as unknown as Record<JhadinaCapabilityVerb,readonly string[]>)});
}

export interface SubsystemHealthDefinition {
  readonly subsystemId: string;
  readonly capabilityIds: readonly string[];
  readonly dependencies: readonly string[];
  readonly protectedPaths: readonly string[];
  readonly diagnostics: {
    readonly healthChecks: readonly string[];
    readonly targetedTests: readonly string[];
    readonly regressionTests: readonly string[];
    readonly staticAnalysis: readonly string[];
    readonly runtimeEvidence: readonly string[];
  };
  readonly repair: {
    readonly governed: true;
    readonly executor: 'jhadina-evolution-core';
    readonly rollbackRequired: boolean;
    /** Informational only. Authorization is owned by Security Core's evolution capabilities. */
    readonly authorizationCapability: 'evolution.propose' | 'evolution.merge';
  };
  readonly invariants: readonly string[];
}

export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: CapabilityRisk;
  readonly version: number;
  readonly subsystemId?: string;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly subsystems = new Map<string, SubsystemHealthDefinition>();
  private readonly runtimeStatuses = new Map<string, CapabilityRuntimeStatus>();

  register(definition: CapabilityDefinition): void {
    if (!definition.name.trim()) throw new Error('Capability name is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error(`Invalid capability version: ${definition.name}`);
    if (this.definitions.has(definition.name)) throw new Error(`Capability already registered: ${definition.name}`);
    this.definitions.set(definition.name, Object.freeze({ ...definition }));
  }

  registerSubsystem(definition: SubsystemHealthDefinition): void {
    if (!definition.subsystemId.trim()) throw new Error('Subsystem id is required');
    if (this.subsystems.has(definition.subsystemId)) throw new Error(`Subsystem already registered: ${definition.subsystemId}`);
    for (const capabilityId of definition.capabilityIds) {
      if (!this.definitions.has(capabilityId)) throw new Error(`Unknown subsystem capability: ${capabilityId}`);
    }
    this.subsystems.set(definition.subsystemId, deepFreezeSubsystem(definition));
  }

  setRuntimeStatus(status:CapabilityRuntimeStatus):void {
    const definition=this.definitions.get(status.capabilityName);
    if(!definition)throw new Error(`Unknown capability runtime status: ${status.capabilityName}`);
    if(definition.subsystemId&&status.subsystemId&&definition.subsystemId!==status.subsystemId)throw new Error('Capability runtime subsystem mismatch');
    const updatedAt=parseRuntimeTime(status.updatedAt,'CAPABILITY_RUNTIME_TIMESTAMP_INVALID');
    for(const evidence of status.evidence)validateRuntimeEvidence(evidence,updatedAt);
    if(status.state==='ready'){
      const live=status.evidence.filter(item=>item.kind==='live-runtime');
      if(!live.length)throw new Error('CAPABILITY_READY_REQUIRES_LIVE_RUNTIME_EVIDENCE');
      if(!live.some(item=>item.expiresAt&&Date.parse(item.expiresAt)>updatedAt)){
        throw new Error('CAPABILITY_READY_REQUIRES_FRESH_EXPIRING_LIVE_RUNTIME_EVIDENCE');
      }
    }
    if((status.state==='degraded'||status.state==='paper-only'||status.state==='simulation-only')===true&&status.evidence.length===0)throw new Error('CAPABILITY_RUNTIME_EVIDENCE_REQUIRED');
    const normalized:CapabilityRuntimeStatus=Object.freeze({
      ...status,
      subsystemId:status.subsystemId??definition.subsystemId,
      evidence:Object.freeze(status.evidence.map(item=>Object.freeze({...item}))),
    });
    this.runtimeStatuses.set(status.capabilityName,normalized);
  }

  get(name: string): CapabilityDefinition | undefined { return this.definitions.get(name); }
  has(name: string): boolean { return this.definitions.has(name); }
  list(): readonly CapabilityDefinition[] { return [...this.definitions.values()].sort((a,b)=>a.name.localeCompare(b.name)); }
  getSubsystem(id: string): SubsystemHealthDefinition | undefined { return this.subsystems.get(id); }
  listSubsystems(): readonly SubsystemHealthDefinition[] { return [...this.subsystems.values()].sort((a,b)=>a.subsystemId.localeCompare(b.subsystemId)); }
  getRuntimeStatus(name:string):CapabilityRuntimeStatus|undefined{return this.runtimeStatuses.get(name);}
  listRuntimeStatuses():readonly CapabilityRuntimeStatus[]{return [...this.runtimeStatuses.values()].sort((a,b)=>a.capabilityName.localeCompare(b.capabilityName));}

  runtimeState(name:string):CapabilityRuntimeState {
    if(!this.definitions.has(name))throw new Error(`Unknown capability: ${name}`);
    return this.runtimeStatuses.get(name)?.state??'unknown';
  }

  effectiveRuntimeStatus(name:string,evaluatedAt:string):EffectiveCapabilityRuntimeStatus {
    const definition=this.definitions.get(name);
    if(!definition)throw new Error(`Unknown capability: ${name}`);
    const status=this.runtimeStatuses.get(name);
    return evaluateCapabilityRuntimeStatus({
      capabilityName:name,
      subsystemId:definition.subsystemId,
      status,
      evaluatedAt,
    });
  }

  listEffectiveRuntimeStatuses(evaluatedAt:string):readonly EffectiveCapabilityRuntimeStatus[]{
    return Object.freeze(this.list().map(definition=>this.effectiveRuntimeStatus(definition.name,evaluatedAt)));
  }

  dependentsOf(subsystemId: string): readonly SubsystemHealthDefinition[] {
    return this.listSubsystems().filter((definition) => definition.dependencies.includes(subsystemId));
  }

  regressionCommandsFor(subsystemId: string): readonly string[] {
    const target = this.subsystems.get(subsystemId);
    if (!target) throw new Error(`Unknown subsystem: ${subsystemId}`);
    return [...new Set([...target.diagnostics.regressionTests, ...this.dependentsOf(subsystemId).flatMap((d)=>d.diagnostics.targetedTests)])];
  }
}

function deepFreezeSubsystem(input: SubsystemHealthDefinition): SubsystemHealthDefinition {
  return Object.freeze({
    ...input,
    capabilityIds: Object.freeze([...input.capabilityIds]),
    dependencies: Object.freeze([...input.dependencies]),
    protectedPaths: Object.freeze([...input.protectedPaths]),
    invariants: Object.freeze([...input.invariants]),
    diagnostics: Object.freeze({
      healthChecks: Object.freeze([...input.diagnostics.healthChecks]),
      targetedTests: Object.freeze([...input.diagnostics.targetedTests]),
      regressionTests: Object.freeze([...input.diagnostics.regressionTests]),
      staticAnalysis: Object.freeze([...input.diagnostics.staticAnalysis]),
      runtimeEvidence: Object.freeze([...input.diagnostics.runtimeEvidence]),
    }),
    repair: Object.freeze({ ...input.repair }),
  });
}


export function evaluateCapabilityRuntimeStatus(input:{
  capabilityName:string;
  subsystemId?:string;
  status?:CapabilityRuntimeStatus;
  evaluatedAt:string;
}):EffectiveCapabilityRuntimeStatus{
  const now=parseRuntimeTime(input.evaluatedAt,'CAPABILITY_RUNTIME_EVALUATED_AT_INVALID');
  const status=input.status;
  if(!status){
    return Object.freeze({
      capabilityName:input.capabilityName,
      subsystemId:input.subsystemId,
      configuredState:'unknown',
      state:'unknown',
      reason:'NO_RUNTIME_STATUS_RECORDED',
      freshEvidence:Object.freeze([]),
      staleEvidence:Object.freeze([]),
      evaluatedAt:input.evaluatedAt,
    });
  }

  const fresh:CapabilityRuntimeEvidence[]=[];
  const stale:CapabilityRuntimeEvidence[]=[];
  for(const evidence of status.evidence){
    const expired=evidence.expiresAt!==undefined&&Date.parse(evidence.expiresAt)<=now;
    (expired?stale:fresh).push(evidence);
  }

  let state=status.state;
  let reason=status.reason;
  if(status.state==='ready'&&!fresh.some(item=>item.kind==='live-runtime')){
    state='degraded';
    reason='LIVE_RUNTIME_EVIDENCE_EXPIRED';
  }else if(
    (status.state==='degraded'||status.state==='paper-only'||status.state==='simulation-only')&&
    status.evidence.length>0&&fresh.length===0
  ){
    state='unknown';
    reason='RUNTIME_EVIDENCE_EXPIRED';
  }

  return Object.freeze({
    capabilityName:status.capabilityName,
    subsystemId:status.subsystemId??input.subsystemId,
    configuredState:status.state,
    state,
    reason,
    freshEvidence:Object.freeze([...fresh]),
    staleEvidence:Object.freeze([...stale]),
    updatedAt:status.updatedAt,
    evaluatedAt:input.evaluatedAt,
  });
}

function validateRuntimeEvidence(evidence:CapabilityRuntimeEvidence,statusUpdatedAt:number):void{
  if(!evidence.id.trim()||!evidence.source.trim()||!evidence.summary.trim())throw new Error('CAPABILITY_RUNTIME_EVIDENCE_IDENTITY_REQUIRED');
  const observedAt=parseRuntimeTime(evidence.observedAt,'CAPABILITY_RUNTIME_EVIDENCE_TIME_INVALID');
  if(observedAt>statusUpdatedAt)throw new Error('CAPABILITY_RUNTIME_EVIDENCE_FROM_FUTURE');
  if(evidence.expiresAt!==undefined){
    const expiresAt=parseRuntimeTime(evidence.expiresAt,'CAPABILITY_RUNTIME_EVIDENCE_EXPIRY_INVALID');
    if(expiresAt<=observedAt)throw new Error('CAPABILITY_RUNTIME_EVIDENCE_EXPIRY_ORDER_INVALID');
  }
}

function parseRuntimeTime(value:string,code:string):number{
  if(!value.trim())throw new Error(code);
  const parsed=Date.parse(value);
  if(Number.isNaN(parsed))throw new Error(code);
  return parsed;
}
