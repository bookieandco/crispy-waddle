import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type LedgerRow={
 execution_id:string;approval_id:string|null;proposal_id:string|null;connector_id:string|null;operation:string|null;
 state:string;started_at:string;completed_at:string|null;recovery_of_execution_id:string|null
}
type ReconciliationRow={
 execution_id:string;status:string;provider_operation:string|null;provider_reference:string|null;observed_state:string|null;checked_at:string
}

export async function GET(request:Request){
 const claimed=request.headers.get("x-jhadina-user-id")
 if(!claimed)return NextResponse.json({error:"x-jhadina-user-id is required"},{status:401})
 try{
  const verified=await createRequestIdentityVerifier(request).verify(claimed)
  const service=createServiceRoleClient()
  if(!service)return NextResponse.json({error:"Recovery evidence store is not configured"},{status:503})
  const {data,error}=await service.from("jhadina_connector_execution_ledger")
   .select("execution_id,approval_id,proposal_id,connector_id,operation,state,started_at,completed_at,recovery_of_execution_id")
   .eq("actor_id",verified)
   .order("started_at",{ascending:false})
   .limit(100)
  if(error)throw new Error(error.message)
  const executions=(data??[]) as LedgerRow[]
  const ids=executions.map(row=>row.execution_id)
  let reconciliations:ReconciliationRow[]=[]
  if(ids.length){
   const result=await service.from("jhadina_connector_execution_reconciliation")
    .select("execution_id,status,provider_operation,provider_reference,observed_state,checked_at")
    .in("execution_id",ids)
    .order("checked_at",{ascending:false})
   if(result.error)throw new Error(result.error.message)
   reconciliations=(result.data??[]) as ReconciliationRow[]
  }
  const latest=new Map<string,ReconciliationRow>()
  for(const row of reconciliations){if(!latest.has(row.execution_id))latest.set(row.execution_id,row)}
  return NextResponse.json({ok:true,executions:executions.map(row=>({id:row.execution_id,approvalId:row.approval_id,proposalId:row.proposal_id,connectorId:row.connector_id,operation:row.operation,state:row.state,startedAt:row.started_at,completedAt:row.completed_at,recoveryOfExecutionId:row.recovery_of_execution_id,reconciliation:latest.get(row.execution_id)??null}))})
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Unable to read recovery evidence"},{status:403})
 }
}
