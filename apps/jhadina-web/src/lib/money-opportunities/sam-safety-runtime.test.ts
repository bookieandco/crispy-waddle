import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {evaluateSamSafetyLedgerProbe} from '@jhadina/opportunity-core'

const packageRoot=process.cwd()
const gatewaySource=readFileSync(resolve(packageRoot,'../../supabase/functions/jhadina-sam-runtime-gateway/index.ts'),'utf8')
const commissioningSource=readFileSync(resolve(packageRoot,'scripts/sam-live-commissioning.ts'),'utf8')
const shadowSource=readFileSync(resolve(packageRoot,'scripts/sam-safety-shadow.ts'),'utf8')
const shadowWorkflow=readFileSync(resolve(packageRoot,'../../.github/workflows/sam-safety-shadow.yml'),'utf8')

describe('SAM-SAFETY-LEDGER.06/.07 source and authority boundary',()=>{
  it('uses a dedicated, read-only OIDC-gated SAM-domain probe',()=>{
    expect(gatewaySource).toContain('if(!(await authorizeGitHub(req)))return json(401')
    expect(gatewaySource).toContain('if(action==="sam_safety_probe")')
    const part=gatewaySource.split('async function samSafetyAuditProbe(')[1]?.split('const OPPORTUNITY_PARAMS')[0]
    expect(part).toBeTruthy()
    expect(part).toContain('.eq("domain","sam")')
    expect(part).toContain('head:true')
    expect(part).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/)
    // Arbitrary callers cannot use the general SAM data gateway to read
    // audit events from other domains (or any audit table).
    const allowed=gatewaySource.split('const SAM_TABLES=new Set([')[1]?.split('])')[0]
    expect(allowed).not.toContain('jhadina_audit_event')
  })
  it('marks incomplete safety coverage and does not auto-pass on zero rows',()=>{
    const result=evaluateSamSafetyLedgerProbe({
      source:'jhadina_audit_event',scope:'sam',observedAt:'2026-10-16T20:00:00Z',
      total:0,counts:{started:0,approval_required:0,completed:0,denied:0,failed:0},
      readOnly:true,atomicSnapshot:false,
    })
    expect(result.status).toBe('blocked')
    expect(result.safetyEvidenceComplete).toBe(false)
    expect(result.unauthorizedExternalActions).toBeNull()
    expect(result.silentFallbacks).toBeNull()
  })
  it('reports external receipt source gaps without creating an execution route',()=>{
    expect(commissioningSource).toContain('externalReceiptAudit:')
    expect(commissioningSource).toContain('sources:SAM_EXTERNAL_SOURCE_INVENTORY')
    expect(commissioningSource).toContain('const signedCoveragePreflight=assessSamReceiptCoverage({')
    expect(commissioningSource).toContain('window:receiptAuditWindow,observations:[],checkpoints:[]')
    expect(commissioningSource).toContain('signedCoveragePreflight,')
    expect(commissioningSource).toContain('authorizationGranted:false')
    expect(commissioningSource).not.toContain('externalReceiptAudit:{status:\'pass\'')
  })
  it('enforces manual-only OIDC, DB read health and fail-closed shadow execution',()=>{
    expect(shadowWorkflow).toContain('workflow_dispatch:')
    expect(shadowWorkflow).not.toContain('schedule:')
    expect(shadowWorkflow).toContain("if: github.ref == 'refs/heads/main'")
    expect(shadowWorkflow).toContain("getIDToken('jhadina-sam-runtime')")
    expect(shadowSource).toContain("from('jhadina_sam_scan_runs').select('id',{head:true}).limit(1)")
    expect(shadowSource).toContain("process.env.SAM_SHADOW_ALLOW_EXTERNAL_READS!=='1'")
    expect(shadowSource).toContain('runSamSafetyShadow({window,sources,verifiedAt:end})')
    expect(shadowSource).toContain('process.exitCode=1')
    expect(shadowSource).not.toContain('await runSamEnrichment(')
    expect(shadowSource).not.toContain('await runSamMarketBootstrap(')
    expect(shadowWorkflow).not.toContain('SAM_UPSTREAM_OIDC_TOKEN')
  })
  it('never equates a successful workflow with certification PASS',()=>{
    expect(commissioningSource).toContain('const safetyPreflight=evaluateSamSafetyLedgerProbe(safetyProbe)')
    expect(commissioningSource).toContain("if(certification.status!=='pass')process.exitCode=1")
    expect(commissioningSource).toContain('safetyProbeError')
    expect(commissioningSource).not.toContain('unauthorizedExternalActions:0')
  })
})
