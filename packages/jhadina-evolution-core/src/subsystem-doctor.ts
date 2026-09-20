import type { EvolutionExecutionPlan } from './evolution-executor.js';

export type DiagnosticSource = 'health'|'test'|'typecheck'|'lint'|'build'|'runtime'|'ci'|'static-analysis';
export interface DiagnosticEvidence { source: DiagnosticSource; subsystemId: string; passed: boolean; summary: string; artifact?: string; }
export interface RootCauseHypothesis { subsystemId:string; cause:string; confidence:number; evidence:readonly DiagnosticEvidence[]; confirmed:boolean; }
export interface RepairPlan { subsystemId:string; hypothesis:RootCauseHypothesis; execution:EvolutionExecutionPlan; regressionCommands:readonly string[]; rollbackRequired:true; }

export class SubsystemDoctor {
  diagnose(subsystemId:string, evidence:readonly DiagnosticEvidence[]): RootCauseHypothesis {
    const relevant=evidence.filter((item)=>item.subsystemId===subsystemId && !item.passed);
    if (!relevant.length) return {subsystemId,cause:'unknown',confidence:0,evidence:[],confirmed:false};
    const summaries=relevant.map((item)=>item.summary);
    const cause=summaries.every((value)=>value===summaries[0]) ? summaries[0] : 'multiple-failure-signals';
    return {subsystemId,cause,confidence: relevant.length>1 ? 0.9 : 0.6,evidence:relevant,confirmed:relevant.length>1};
  }

  plan(input:{hypothesis:RootCauseHypothesis; allowedPaths:string[]; targetedTests:string[]; regressionTests:string[]; securityChecks:string[]; risk:EvolutionExecutionPlan['risk']; requiresApproval:boolean;}): RepairPlan {
    if (!input.hypothesis.confirmed) throw new Error('Repair requires confirmed root-cause evidence');
    return {
      subsystemId:input.hypothesis.subsystemId,
      hypothesis:input.hypothesis,
      execution:{id:`repair:${input.hypothesis.subsystemId}`,title:`Repair ${input.hypothesis.subsystemId}: ${input.hypothesis.cause}`,risk:input.risk,requiresApproval:input.requiresApproval,allowedPaths:[...input.allowedPaths],testCommands:[...new Set([...input.targetedTests,...input.regressionTests])],securityChecks:[...input.securityChecks]},
      regressionCommands:[...input.regressionTests],
      rollbackRequired:true,
    };
  }
}

export interface SelfDiagnosticAcceptanceResult { diagnosed:boolean; repairPlanned:boolean; targetedVerified:boolean; regressionsVerified:boolean; protectedPathsVerified:boolean; receiptReady:boolean; }

export function verifyBuilder210Acceptance(input:{hypothesis:RootCauseHypothesis; plan:RepairPlan; targetedPassed:boolean; regressionsPassed:boolean; protectedPathsPassed:boolean;}): SelfDiagnosticAcceptanceResult {
  const diagnosed=input.hypothesis.confirmed;
  const repairPlanned=input.plan.hypothesis===input.hypothesis;
  const receiptReady=diagnosed && repairPlanned && input.targetedPassed && input.regressionsPassed && input.protectedPathsPassed;
  return {diagnosed,repairPlanned,targetedVerified:input.targetedPassed,regressionsVerified:input.regressionsPassed,protectedPathsVerified:input.protectedPathsPassed,receiptReady};
}
