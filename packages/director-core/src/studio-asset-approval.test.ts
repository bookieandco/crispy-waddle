import {describe,expect,it} from 'vitest'
import {STUDIO_QC_CHECKS,validateStudioApprovalEvidence} from './studio-asset-approval'
const evidenceIds=STUDIO_QC_CHECKS.map(x=>`qc-check:${x}:passed`)
describe('studio approval evidence',()=>{it('requires all final checks',()=>expect(validateStudioApprovalEvidence({qcReportId:'q',minimumObservedScore:.9,evidenceIds})).toEqual([]));it('fails closed on missing physics evidence',()=>expect(validateStudioApprovalEvidence({qcReportId:'q',minimumObservedScore:.9,evidenceIds:evidenceIds.filter(x=>!x.includes('physics'))})).toContain('missing QC evidence: physics'))})
