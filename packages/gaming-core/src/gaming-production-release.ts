import type {G28ProductionAcceptanceReport} from './gaming-production-acceptance-report.js';
import {blockingGamingAuditFindings,type GamingAuditFinding} from './gaming-core-audit.js';

export interface GamingReleaseManifest{
 releaseId:string;version:string;sourceSha:string;certificationRunId:string;
 softwareTestsPassed:number;softwareTestFilesPassed:number;turboTasksPassed:number;
 migrationCertified:boolean;rollbackCertified:boolean;supplyChainCertified:boolean;privacyCertified:boolean;
 productAcceptanceCertified:boolean;physicalAcceptance:G28ProductionAcceptanceReport;
 auditFindings:readonly GamingAuditFinding[];
}
export interface GamingReleaseFreezeDecision{status:'frozen'|'evidence-required'|'blocked';reasons:readonly string[];}
export class GamingProductionReleaseGate{
 evaluate(m:GamingReleaseManifest):GamingReleaseFreezeDecision{
  const reasons:string[]=[];
  if(!m.releaseId.trim()||!m.version.trim()||!/^[a-f0-9]{40}$/i.test(m.sourceSha)||!m.certificationRunId.trim())reasons.push('release-identity');
  if(m.softwareTestsPassed<1||m.softwareTestFilesPassed<1||m.turboTasksPassed<3)reasons.push('software-certification');
  if(!m.migrationCertified)reasons.push('migration');
  if(!m.rollbackCertified)reasons.push('rollback');
  if(!m.supplyChainCertified)reasons.push('supply-chain');
  if(!m.privacyCertified)reasons.push('privacy');
  if(!m.productAcceptanceCertified)reasons.push('product-acceptance');
  if(blockingGamingAuditFindings(m.auditFindings).length)reasons.push('audit-blocker');
  if(reasons.length)return{status:'blocked',reasons};
  if(m.physicalAcceptance.status!=='accepted')return{status:'evidence-required',reasons:['g28-physical-acceptance']};
  return{status:'frozen',reasons:[]};
 }
}
export const G30_RELEASE_GATES=Object.freeze([
 'clean-install','upgrade-migration','save-compatibility','controller-profile-migration','runtime-rollback',
 'offline-operation','security-privacy','supply-chain','performance-regression','crash-recovery',
 'g28-physical-acceptance','release-manifest',
] as const);
