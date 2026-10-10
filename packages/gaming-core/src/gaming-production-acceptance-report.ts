import {G28_ACCEPTANCE_MATRIX,evaluateG28Case,type G28CaseEvidence} from './gaming-physical-acceptance.js';
import {G28_FAILURE_DRILLS,evaluateG28Drill,evaluateG28Soak,type G28DrillEvidence,type G28SoakEvidence} from './gaming-physical-drills.js';

export interface G28ProductionAcceptanceInput{
 caseEvidence:readonly G28CaseEvidence[];
 drillEvidence:readonly G28DrillEvidence[];
 soakEvidence?:G28SoakEvidence;
 generatedAtMs:number;
 /** Mandatory for physical acceptance; host verifies independent raw artifact readback. */
 verifyArtifactRef?:(ref:string)=>boolean;
 bundleArtifactRefs?:readonly string[];
}
export interface G28ProductionAcceptanceReport{
 status:'accepted'|'evidence-required';
 generatedAtMs:number;
 passedCases:number;totalCases:number;passedDrills:number;totalDrills:number;
 soakPassed:boolean;
 missingCaseIds:readonly string[];missingDrills:readonly string[];
 limitations:readonly string[];
 artifactVerificationPassed?:boolean;
}
export function buildG28ProductionAcceptanceReport(input:G28ProductionAcceptanceInput):G28ProductionAcceptanceReport{
 const byCase=new Map(input.caseEvidence.map(e=>[e.caseId,e]));
 const duplicateCases=byCase.size!==input.caseEvidence.length;
 const missingCaseIds:string[]=[];let passedCases=0;
 for(const c of G28_ACCEPTANCE_MATRIX){
   const e=byCase.get(c.id);
   if(!e||!evaluateG28Case(c,e).passed)missingCaseIds.push(c.id);else passedCases++;
 }
 const byDrill=new Map(input.drillEvidence.map(e=>[e.drill,e]));
 const duplicateDrills=byDrill.size!==input.drillEvidence.length;
 const missingDrills:string[]=[];let passedDrills=0;
 for(const d of G28_FAILURE_DRILLS){
   const e=byDrill.get(d);
   if(!e||!evaluateG28Drill(e).passed)missingDrills.push(d);else passedDrills++;
 }
 const soakPassed=Boolean(input.soakEvidence&&evaluateG28Soak(input.soakEvidence).passed);
 const refs=[
   ...input.caseEvidence.flatMap(e=>e.receipt.artifactRefs),
   ...input.drillEvidence.flatMap(e=>e.artifactRefs),
   ...(input.soakEvidence?.artifactRefs??[]),
   ...(input.bundleArtifactRefs??[]),
 ];
 const refsComplete=input.caseEvidence.every(e=>e.receipt.artifactRefs.length>0)
   &&input.drillEvidence.every(e=>e.artifactRefs.length>0)
   &&Boolean(input.soakEvidence?.artifactRefs.length)
   &&(input.bundleArtifactRefs===undefined||input.bundleArtifactRefs.length>0);
 const artifactVerificationPassed=Boolean(input.verifyArtifactRef&&refsComplete&&refs.length>0
   &&refs.every(ref=>ref.trim().length>0&&input.verifyArtifactRef!(ref)));
 const accepted=!duplicateCases&&!duplicateDrills&&missingCaseIds.length===0&&missingDrills.length===0&&soakPassed&&artifactVerificationPassed;
 return{
   status:accepted?'accepted':'evidence-required',generatedAtMs:input.generatedAtMs,
   passedCases,totalCases:G28_ACCEPTANCE_MATRIX.length,
   passedDrills,totalDrills:G28_FAILURE_DRILLS.length,
   soakPassed,missingCaseIds,missingDrills,artifactVerificationPassed,
   limitations:accepted?[]:['Physical acceptance requires real observed hardware and independently verified artifact readback.'],
 };
}
