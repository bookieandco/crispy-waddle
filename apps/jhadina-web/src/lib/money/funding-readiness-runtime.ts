import "server-only"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

export type FundingRailReadiness=Readonly<{
 railId:string
 provider:string
 environment:"SANDBOX"|"LIVE"
 admission:"UNCOMMISSIONED"|"READ_ONLY"|"CONTROLLED_CANARY"|"LIVE"
 maxMovementMinor:string
 maxDailyMovementMinor:string
 allowedKinds:readonly string[]
 allowedCurrencies:readonly string[]
 executable:boolean
 evidenceIds:readonly string[]
}>

export type FundingReadinessSnapshot=Readonly<{
 userId:string
 rails:readonly FundingRailReadiness[]
 pendingApprovalCount:number
 approvedNotExecutedCount:number
 unresolvedAttemptCount:number
 unsettledAttemptCount:number
 canExecuteAnyLiveMovement:boolean
 blockers:readonly string[]
 authority:"READINESS_ONLY"
 canMoveMoney:false
}>

async function userId(){
 const c=await createClient();const {data,error}=await c.auth.getClaims();const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_FUND2_SESSION_REQUIRED");return id
}
function admin(){const c=createServiceRoleClient();if(!c)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED");return c}

export async function readSessionFundingReadiness():Promise<FundingReadinessSnapshot>{
 const uid=await userId(),db=admin()
 const [railsResult,proposalResult,attemptResult]=await Promise.all([
  db.from("money_funding_rail_admissions").select("rail_id,provider,environment,admission,max_movement_minor,max_daily_movement_minor,allowed_kinds,allowed_currencies,evidence_ids").order("updated_at",{ascending:false}),
  db.from("money_movement_proposals").select("movement_id,state,approval_receipt_id,execution_permit_id").eq("user_id",uid).in("state",["PENDING_APPROVAL","APPROVED"]),
  db.from("money_movement_attempts").select("attempt_id,state,recovery_required").eq("user_id",uid).order("started_at",{ascending:false}).limit(100),
 ])
 if(railsResult.error)throw new Error("MONEY_FUND2_RAIL_READ_FAILED:"+railsResult.error.message)
 if(proposalResult.error)throw new Error("MONEY_FUND2_PROPOSAL_READ_FAILED:"+proposalResult.error.message)
 if(attemptResult.error)throw new Error("MONEY_FUND2_ATTEMPT_READ_FAILED:"+attemptResult.error.message)
 const rails=Object.freeze((railsResult.data??[]).map(x=>Object.freeze({
  railId:x.rail_id,provider:x.provider,environment:x.environment as FundingRailReadiness["environment"],admission:x.admission as FundingRailReadiness["admission"],
  maxMovementMinor:String(x.max_movement_minor),maxDailyMovementMinor:String(x.max_daily_movement_minor),
  allowedKinds:Object.freeze(x.allowed_kinds??[]),allowedCurrencies:Object.freeze(x.allowed_currencies??[]),
  executable:x.environment==="LIVE"&&(x.admission==="CONTROLLED_CANARY"||x.admission==="LIVE")&&BigInt(String(x.max_movement_minor))>0n&&BigInt(String(x.max_daily_movement_minor))>0n,
  evidenceIds:Object.freeze(x.evidence_ids??[]),
 })))
 const proposals=proposalResult.data??[],attempts=attemptResult.data??[]
 const pendingApprovalCount=proposals.filter(x=>x.state==="PENDING_APPROVAL").length
 const approvedNotExecutedCount=proposals.filter(x=>x.state==="APPROVED"&&!x.execution_permit_id).length
 const unresolvedAttemptCount=attempts.filter(x=>x.recovery_required||x.state==="UNKNOWN"||x.state==="RECOVERY_REQUIRED").length
 const unsettledAttemptCount=attempts.filter(x=>x.state==="STARTED"||x.state==="ACKNOWLEDGED"||x.state==="PENDING").length
 const blockers:string[]=[]
 if(!rails.some(x=>x.executable))blockers.push("LIVE_FUNDING_RAIL_NOT_COMMISSIONED")
 if(unresolvedAttemptCount>0)blockers.push("UNRESOLVED_PROVIDER_ATTEMPT")
 if(unsettledAttemptCount>0)blockers.push("MOVEMENT_STILL_IN_FLIGHT")
 if(approvedNotExecutedCount>0)blockers.push("APPROVED_MOVEMENT_NEEDS_EXECUTION_PERMIT")
 return Object.freeze({userId:uid,rails,pendingApprovalCount,approvedNotExecutedCount,unresolvedAttemptCount,unsettledAttemptCount,canExecuteAnyLiveMovement:rails.some(x=>x.executable)&&unresolvedAttemptCount===0&&unsettledAttemptCount===0,blockers:Object.freeze(blockers),authority:"READINESS_ONLY" as const,canMoveMoney:false as const})
}
