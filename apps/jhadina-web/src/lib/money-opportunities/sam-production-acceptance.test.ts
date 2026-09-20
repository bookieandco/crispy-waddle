import {describe,expect,it} from 'vitest'
import {evaluateSamProductionAcceptance,type SamProductionAcceptanceCheck} from './sam-production-acceptance'
const categories=['ci','database','configuration','live_ingestion','governance','recovery'] as const
describe('SAM production acceptance',()=>{
 it('fails closed when a live prerequisite has not run',()=>{
  const checks:SamProductionAcceptanceCheck[]=categories.map(category=>({id:category,category,status:category==='live_ingestion'?'not_run':'passed',evidenceRefs:['receipt'],notes:[]}))
  expect(evaluateSamProductionAcceptance(checks).status).toBe('blocked')
 })
 it('accepts only evidence-backed passed categories and still grants no execution authority',()=>{
  const checks:SamProductionAcceptanceCheck[]=categories.map(category=>({id:category,category,status:'passed',evidenceRefs:['receipt:'+category],notes:[]}))
  const report=evaluateSamProductionAcceptance(checks,'2026-09-20T00:00:00Z')
  expect(report.status).toBe('accepted')
  expect(report.productionExecutionAuthority).toBe(false)
 })
})
