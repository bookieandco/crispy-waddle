import type {
  AffiliateComplianceSnapshot,
} from "@jhadina/opportunity-core"
import {createClient} from "@/lib/supabase/server"

type Row={
  payload:AffiliateComplianceSnapshot
}

export type AffiliateComplianceSnapshotRepository={
  list(input?:{
    opportunityId?:string
    limit?:number
  }):Promise<AffiliateComplianceSnapshot[]>
  latest(input:{
    opportunityId:string
  }):Promise<AffiliateComplianceSnapshot|undefined>
  record(
    snapshot:AffiliateComplianceSnapshot
  ):Promise<AffiliateComplianceSnapshot>
}

export function createAffiliateComplianceSnapshotRepository():
AffiliateComplianceSnapshotRepository{
  return{
    async list(input={}){
      const supabase=await createClient()
      let query=supabase
        .from("jhadina_affiliate_compliance_snapshots")
        .select("payload")
        .order("evaluated_at",{ascending:false})
      if(input.opportunityId){
        query=query.eq("opportunity_id",input.opportunityId)
      }
      if(input.limit){
        query=query.limit(input.limit)
      }
      const{data,error}=await query.returns<Row[]>()
      if(error){
        throw new Error(
          `Unable to list affiliate compliance snapshots: ${error.message}`
        )
      }
      return(data??[]).map(row=>row.payload)
    },

    async latest(input){
      return(await this.list({
        opportunityId:input.opportunityId,
        limit:1,
      }))[0]
    },

    async record(snapshot){
      const supabase=await createClient()
      const{data,error}=await supabase.rpc(
        "jhadina_affiliate_compliance_snapshot_record",
        {p_record:snapshot},
      )
      if(error||!data){
        throw new Error(
          `Unable to record affiliate compliance snapshot: ${error?.message??"no result returned"}`
        )
      }
      return data as AffiliateComplianceSnapshot
    },
  }
}
