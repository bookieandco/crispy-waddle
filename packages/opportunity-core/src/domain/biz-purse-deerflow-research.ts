/** BIZ-PURSE.03 — optional DeerFlow 2.x research receipt boundary.
 * DeerFlow is a separate MIT-licensed Python/Gateway harness with privileged
 * shell/MCP/sandbox capabilities. NEVER treat an agent's output as permission.
 * This module cannot call or launch DeerFlow and cannot access credentials.
 */
import {assessVentureScoutResearch,type BusinessEvidenceRef} from './biz-purse-commercial-gates.js'
export type DeerFlowResearchReceipt=Readonly<{
  runId:string
  ownerUserId:string
  businessId:string
  family:string
  sourceRepository:'bytedance/deer-flow'
  upstreamCommitSha:string
  status:'COMPLETED'|'INCOMPLETE'|'FAILED'
  taskCategory:'BUSINESS_RESEARCH'|'OTHER'
  hostedModelRequestCount:number
  hostMode:'ISOLATED_LOCAL'|'EXTERNAL'|'UNVERIFIED'
  observedAt:string
  responseEvidenceIds:readonly string[]
  externalEvidence:readonly BusinessEvidenceRef[]
  independentlyVerifiedEvidenceIds:readonly string[]
  verifier:'JHADINA_PROVENANCE_VERIFIER'|'UNVERIFIED'
  sandboxAttested:boolean
  gatewayAdminAuthority:false
  shellExecutionAuthority:false
  fileWriteAuthority:false
  paymentAuthority:false
  tradingAuthority:false
  liveExternalActionAuthority:false
  financialCredentialsExposed:false
  bearerTokensExposed:false
  synthetic:boolean
}>
export type DeerFlowResearchAdmission=Readonly<{
 status:'BLOCKED'|'REVIEW_READY'
 reasonCodes:readonly string[]
 runId:string
 businessId:string
 independentEvidenceIds:readonly string[]
 authority:'UNTRUSTED_RESEARCH_IMPORT_ONLY'
 mayStartGateway:false
 mayExecuteTools:false
 maySpend:false
 mayTrade:false
 mayMoveMoney:false
 mayPublish:false
 canPromoteCommercialOutcome:false
}>
/** Evidence must have independently validated provenance outside the DeerFlow
 * result payload. Textual instructions and tool suggestions are NEVER replayed.
 */
export function assessDeerFlowResearch(input:Readonly<{
  receipt:DeerFlowResearchReceipt
  ownerUserId:string
  approvedBusinessId:string
  approvedFamily:string
  asOf:string
  approvedUpstreamCommitSha:string
  availableCostBudgetMinor:bigint
}>):DeerFlowResearchAdmission{
 const r=input.receipt
 const reasons:string[]=[]
 if(!r?.runId||!r.businessId||r.businessId!==input.approvedBusinessId||!r.ownerUserId||r.ownerUserId!==input.ownerUserId)reasons.push('OWNER_BUSINESS_MISMATCH')
 if(r.sourceRepository!=='bytedance/deer-flow'||!(/^[a-f0-9]{40}$/).test(input.approvedUpstreamCommitSha)||r.upstreamCommitSha!==input.approvedUpstreamCommitSha)reasons.push('UPSTREAM_COMMIT_UNPINNED')
 if(r.taskCategory!=='BUSINESS_RESEARCH'||r.status!=='COMPLETED')reasons.push('RESEARCH_NOT_COMPLETE')
 if(!Number.isInteger(r.hostedModelRequestCount)||r.hostedModelRequestCount<0||input.availableCostBudgetMinor!==0n)reasons.push('UNAPPROVED_PAID_MODEL_OR_COST')
 if(r.hostMode!=='ISOLATED_LOCAL'||!r.sandboxAttested)reasons.push('ISOLATED_GATEWAY_UNVERIFIED')
 if(r.gatewayAdminAuthority!==false||r.shellExecutionAuthority!==false||r.fileWriteAuthority!==false||r.paymentAuthority!==false||r.tradingAuthority!==false||r.liveExternalActionAuthority!==false||r.financialCredentialsExposed!==false||r.bearerTokensExposed!==false)reasons.push('PRIVILEGED_CAPABILITY_OR_SECRET_EXPOSURE')
 if(r.verifier!=='JHADINA_PROVENANCE_VERIFIER'||r.synthetic)reasons.push('SELF_ATTESTED_OR_SYNTHETIC_RESEARCH')
 const verifiedIds=new Set(r.independentlyVerifiedEvidenceIds)
 if(!r.responseEvidenceIds.length||!r.externalEvidence.length||verifiedIds.size!==r.independentlyVerifiedEvidenceIds.length)reasons.push('MISSING_OR_DUPLICATE_PROVENANCE')
 if(r.externalEvidence.some(x=>!verifiedIds.has(x.id)||!r.responseEvidenceIds.includes(x.id)))reasons.push('EVIDENCE_NOT_INDEPENDENTLY_MATCHED')
 const assessment=assessVentureScoutResearch({
  family:r.family,approvedFamily:input.approvedFamily,observedAt:input.asOf,
  maxAgeDays:30,distinctSourcesRequired:2,evidence:r.externalEvidence,
 })
 if(assessment.status!=='REVIEW_READY')reasons.push(...assessment.reasons)
 return Object.freeze({
  status:reasons.length?'BLOCKED':'REVIEW_READY',
  reasonCodes:Object.freeze([...new Set(reasons)]),
  runId:r.runId,businessId:r.businessId,
  independentEvidenceIds:Object.freeze(r.externalEvidence.map(x=>x.id)),
  authority:'UNTRUSTED_RESEARCH_IMPORT_ONLY' as const,
  mayStartGateway:false as const,mayExecuteTools:false as const,
  maySpend:false as const,mayTrade:false as const,mayMoveMoney:false as const,
  mayPublish:false as const,canPromoteCommercialOutcome:false as const,
 })
}
