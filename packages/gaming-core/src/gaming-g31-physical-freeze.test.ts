import {describe,expect,it} from 'vitest';
import {G31_PHASES,G31_PHYSICAL_SCOPE,G31PhysicalProductionFreeze} from './gaming-g31-physical-freeze.js';
import {GAMING_CORE_AUDIT_FINDINGS} from './gaming-core-audit.js';
describe('G31 final physical production freeze',()=>{
 const manifest={releaseId:'gaming-production',version:'1.0.0',sourceSha:'a'.repeat(40),certificationRunId:'software-run',softwareTestsPassed:194,softwareTestFilesPassed:75,turboTasksPassed:3,migrationCertified:true,rollbackCertified:true,supplyChainCertified:true,privacyCertified:true,productAcceptanceCertified:true,auditFindings:GAMING_CORE_AUDIT_FINDINGS};
 it('implements every G31.1-G31.12 phase',()=>{expect(G31_PHASES).toHaveLength(12);expect(G31_PHASES.at(-1)).toBe('G31.12');});
 it('covers the physical production scope',()=>{expect(G31_PHYSICAL_SCOPE.controllers).toContain('gamesir-x5-lite');expect(G31_PHYSICAL_SCOPE.playstation).toContain('dualsense-ps5');expect(G31_PHYSICAL_SCOPE.minimumSoakMinutes).toBe(240);});
 it('cannot freeze without real G28 physical evidence',()=>{const result=new G31PhysicalProductionFreeze().evaluate({bundleId:'pending-hardware',generatedAtMs:1,caseEvidence:[],drillEvidence:[],artifactRefs:[]},manifest);expect(result.status).toBe('evidence-required');expect(result.g28.status).toBe('evidence-required');expect(result.releaseReasons).toEqual(['g28-physical-acceptance']);});
});
