import type { EvolutionExecutionPlan } from './evolution-executor.js';

export type DiagnosticSource = 'health'|'test'|'typecheck'|'lint'|'build'|'runtime'|'ci'|'static-analysis';
export interface DiagnosticEvidence {
  source: DiagnosticSource; subsystemId: string; passed: boolean; summary: string;
  artifact?: string; observedAt?: string; provenance?: string;
  execution?: { command:string; discovered:number; executed:number; exitCode:number };
}
export interface DiagnosticCollector { collect(subsystemId:string): Promise<readonly DiagnosticEvidence[]>; }
export interface RootCauseHypothesis { subsystemId:string; cause:string; confidence:number; evidence:readonly DiagnosticEvidence[]; confirmed:boolean; }
export interface RepairPlan {
  subsystemId:string; hypothesis:RootCauseHypothesis; execution:EvolutionExecutionPlan;
  regressionCommands:readonly string[]; rollbackRequired:true; authorizationCapability:'evolution.propose';
  recovery:{baseCommit:string; strategy:'discard-isolated-branch'};
}
export interface RepairExecutionBridge { execute(plan:RepairPlan):Promise<RepairExecutionEvidence>; }
export interface RepairExecutionEvidence {
  changedFiles:readonly string[]; targeted:readonly CommandVerification[]; regressions:readonly CommandVerification[];
  securityChecks:readonly CommandVerification[]; protectedPathsVerified:boolean; draftPr:string|null; commit:string|null;
}
export interface CommandVerification { command:string; passed:boolean; discovered:number; executed:number; output?:string; }
export interface RepairReceipt {
  version:'1'; subsystemId:string; rootCause:string; evidence:readonly DiagnosticEvidence[]; changedFiles:readonly string[];
  verification:{targeted:readonly CommandVerification[]; regressions:readonly CommandVerification[]; security:readonly CommandVerification[]; protectedPathsVerified:boolean};
  recovery:RepairPlan['recovery']; draftPr:string|null; commit:string|null; status:'VERIFIED'|'FAILED';
}
export interface RepairLearningSink { record(receipt:RepairReceipt):Promise<void>; }

export function proveCommandExecuted(result:CommandVerification):boolean {
  return result.passed && result.discovered > 0 && result.executed > 0;
}

export class DiagnosticEvidenceBus {
  constructor(private readonly collectors:readonly DiagnosticCollector[]){}
  async collect(subsystemId:string):Promise<readonly DiagnosticEvidence[]> {
    const batches=await Promise.all(this.collectors.map((collector)=>collector.collect(subsystemId)));
    return batches.flat().map((item)=>({...item,subsystemId:item.subsystemId || subsystemId}));
  }
}

export class SubsystemDoctor {
  diagnose(subsystemId:string, evidence:readonly DiagnosticEvidence[]):RootCauseHypothesis {
    const failures=evidence.filter((item)=>item.subsystemId===subsystemId && !item.passed);
    if (!failures.length) return {subsystemId,cause:'unknown',confidence:0,evidence:[],confirmed:false};
    const groups=new Map<string,DiagnosticEvidence[]>();
    for(const item of failures){const list=groups.get(item.summary)??[]; list.push(item); groups.set(item.summary,list);}
    const ranked=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);
    const [cause,corroborating]=ranked[0]!;
    const distinctSources=new Set(corroborating.map((item)=>item.source));
    const confirmed=corroborating.length>=2 && distinctSources.size>=2;
    return {subsystemId,cause:confirmed?cause:'unknown',confidence:confirmed?Math.min(.99,.65+(.1*distinctSources.size)):0.35,evidence:failures,confirmed};
  }

  plan(input:{hypothesis:RootCauseHypothesis;allowedPaths:string[];targetedTests:string[];regressionTests:string[];securityChecks:string[];risk:EvolutionExecutionPlan['risk'];baseCommit:string;}):RepairPlan {
    if(!input.hypothesis.confirmed) throw new Error('Repair requires confirmed root-cause evidence');
    if(!input.baseCommit.trim()) throw new Error('Repair requires a known-good base commit');
    return {
      subsystemId:input.hypothesis.subsystemId,hypothesis:input.hypothesis,
      execution:{id:`repair:${input.hypothesis.subsystemId}`,title:`Repair ${input.hypothesis.subsystemId}: ${input.hypothesis.cause}`,risk:input.risk,
        // Security Core owns the decision. A Doctor plan never self-authorizes code evolution.
        requiresApproval:true,allowedPaths:[...input.allowedPaths],testCommands:[...new Set([...input.targetedTests,...input.regressionTests])],securityChecks:[...input.securityChecks]},
      regressionCommands:[...input.regressionTests],rollbackRequired:true,authorizationCapability:'evolution.propose',
      recovery:{baseCommit:input.baseCommit,strategy:'discard-isolated-branch'}
    };
  }
}

/**
 * Verify every planned command, not just an all-passing subset. Empty arrays
 * must never pass vacuously. A reported green exit with zero executed tests
 * is not a verification receipt.
 */
function verifyPlannedCommands(planned:readonly string[], results:readonly CommandVerification[]):boolean {
  const required=new Set(planned.map(command=>command.trim()).filter(Boolean));
  if(!required.size || !results.length) return false;
  const byCommand=new Map<string,CommandVerification>();
  for(const item of results){
    if(byCommand.has(item.command) || !required.has(item.command) || !proveCommandExecuted(item)) return false;
    byCommand.set(item.command,item);
  }
  return byCommand.size===required.size;
}

function withinAllowedPaths(path:string, allowedPaths:readonly string[]):boolean {
  const normalize=(value:string)=>value.split('\\').join('/').replace(/^\/+/, '').replace(/\/+/g,'/').replace(/\/$/,'');
  const normalized=normalize(path);
  if(!normalized || normalized==='.' || normalized==='..' ||
     normalized.startsWith('../') || normalized.includes('/../')) return false;
  return allowedPaths.some(root=>{
    const allowed=normalize(root);
    return Boolean(allowed) && (normalized===allowed || normalized.startsWith(allowed+'/'));
  });
}

export function buildRepairReceipt(plan:RepairPlan,result:RepairExecutionEvidence):RepairReceipt {
  const regressionSet=new Set(plan.regressionCommands);
  const plannedTargeted=plan.execution.testCommands.filter(command=>!regressionSet.has(command));
  const targetedVerified=verifyPlannedCommands(plannedTargeted,result.targeted);
  const regressionsVerified=verifyPlannedCommands(plan.regressionCommands,result.regressions);
  const securityVerified=verifyPlannedCommands(plan.execution.securityChecks,result.securityChecks);
  const filesVerified=result.changedFiles.length>0 &&
    result.changedFiles.every(path=>withinAllowedPaths(path,plan.execution.allowedPaths));
  const commitVerified=typeof result.commit==='string' && /^[0-9a-f]{7,40}$/i.test(result.commit);
  const draftVerified=typeof result.draftPr==='string' &&
    new RegExp('^https://github[.]com/[^/]+/[^/]+/pull/[0-9]+$').test(result.draftPr);
  const recoveryVerified=plan.rollbackRequired===true &&
    plan.recovery.strategy==='discard-isolated-branch' &&
    Boolean(plan.recovery.baseCommit.trim()) && plan.hypothesis.confirmed;
  const verified=targetedVerified && regressionsVerified && securityVerified &&
    filesVerified && commitVerified && draftVerified && recoveryVerified && result.protectedPathsVerified;
  return {version:'1',subsystemId:plan.subsystemId,rootCause:plan.hypothesis.cause,evidence:plan.hypothesis.evidence,changedFiles:result.changedFiles,
    verification:{targeted:result.targeted,regressions:result.regressions,security:result.securityChecks,protectedPathsVerified:result.protectedPathsVerified},
    recovery:plan.recovery,draftPr:result.draftPr,commit:result.commit,status:verified?'VERIFIED':'FAILED'};
}

export type DoctorIntent='diagnose_subsystem'|'propose_repair'|'execute_approved_repair'|'verify_repair'|'explain_repair';
export function routeDoctorIntent(message:string):DoctorIntent {
  const value=message.toLowerCase();
  if(/why|diagnos|what.?s wrong|broken/.test(value) && !/fix|repair/.test(value)) return 'diagnose_subsystem';
  if(/fix|repair/.test(value)) return 'propose_repair';
  return 'explain_repair';
}

export class GovernedSubsystemDoctorRuntime {
  constructor(private readonly bus:DiagnosticEvidenceBus,private readonly doctor:SubsystemDoctor,private readonly executor:RepairExecutionBridge,private readonly learning:RepairLearningSink){}
  async diagnose(subsystemId:string){return this.doctor.diagnose(subsystemId,await this.bus.collect(subsystemId));}
  async repair(input:{subsystemId:string;allowedPaths:string[];targetedTests:string[];regressionTests:string[];securityChecks:string[];risk:EvolutionExecutionPlan['risk'];baseCommit:string;approved:boolean;}):Promise<RepairReceipt>{
    const hypothesis=await this.diagnose(input.subsystemId);
    const plan=this.doctor.plan({...input,hypothesis});
    if(!input.approved) throw new Error('Governed repair requires Security Core approval');
    const execution=await this.executor.execute(plan);
    const receipt=buildRepairReceipt(plan,execution);
    await this.learning.record(receipt);
    return receipt;
  }
}
