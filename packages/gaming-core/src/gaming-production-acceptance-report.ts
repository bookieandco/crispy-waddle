import {G28_ACCEPTANCE_MATRIX,evaluateG28Case,type G28CaseEvidence} from './gaming-physical-acceptance.js';
import {G28_FAILURE_DRILLS,evaluateG28Drill,evaluateG28Soak,type G28DrillEvidence,type G28SoakEvidence} from './gaming-physical-drills.js';

export interface G28ProductionAcceptanceInput{
 caseEvidence:readonly G28CaseEvidence[];
 drillEvidence:readonly G28DrillEvidence[];
 soakEvidence?:G28SoakEvidence;
 generatedAtMs:number;
}
export interface G28ProductionAcceptanceReport{
 status:'accepted'|'evidence-required';
 generatedAtMs:number;
 passedCases:number;totalCases:number;passedDrills:number;totalDrills:number;
 soakPassed:boolean;
 missingCaseIds:readonly string[];missingDrills:readonly string[];
 limitations:readonly string[];
}
export function buildG28ProductionAcceptanceReport(input:G28ProductionAcceptanceInput):G28ProductionAcceptanceReport{
 const byCase=new Map(input.caseEvidence.map(e=>[e.caseId,e]));
 const missingCaseIds:string[]=[];let passedCases=0;
 for(const c of G28_ACCEPTANCE_MATRIX){const e=byCase.get(c.id);if(!e||!evaluateG28Case(c,e).passed)missingCaseIds.push(c.id);else passedCases++;}
 const byDrill=new Map(input.drillEvidence.map(e=>[e.drill,e]));
 const missingDrills:string[]=[];let passedDrills=0;
 for(const d of G28_FAILURE_DRILLS){const e=byDrill.get(d);if(!e||!evaluateG28Drill(e).passed)missingDrills.push(d);else passedDrills++;}
 const soakPassed=Boolean(input.soakEvidence&&evaluateG28Soak(input.soakEvidence).passed);
 const accepted=missingCaseIds.length===0&&missingDrills.length===0&&soakPassed;
 return{status:accepted?'accepted':'evidence-required',generatedAtMs:input.generatedAtMs,passedCases,totalCases:G28_ACCEPTANCE_MATRIX.length,passedDrills,totalDrills:G28_FAILURE_DRILLS.length,soakPassed,missingCaseIds,missingDrills,limitations:accepted?[]:['Physical commissioning cannot be certified without observed hardware receipts and artifacts.']};
}
