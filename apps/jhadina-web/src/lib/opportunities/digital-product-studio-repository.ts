import type {
  DigitalProductStudioRecord,
  DigitalProductStudioRecordKind,
} from "@jhadina/opportunity-core"
import {createClient} from "@/lib/supabase/server"

export type StoredDigitalProductStudioRecord={
  id:string
  opportunityId:string
  kind:DigitalProductStudioRecordKind
  status:string
  evidenceRefs:string[]
  payload:DigitalProductStudioRecord
  recordedAt:string
}

type Row={
  id:string
  opportunity_id:string
  kind:DigitalProductStudioRecordKind
  status:string
  evidence_refs:string[]
  payload:DigitalProductStudioRecord
  recorded_at:string
}

export type DigitalProductStudioRepository={
  get(id:string):Promise<StoredDigitalProductStudioRecord|undefined>
  list(input?:{
    opportunityId?:string
    kind?:DigitalProductStudioRecordKind
    limit?:number
  }):Promise<StoredDigitalProductStudioRecord[]>
  record(record:DigitalProductStudioRecord):Promise<DigitalProductStudioRecord>
}

export function createDigitalProductStudioRepository():
DigitalProductStudioRepository{
  return{
    async get(id){
      const supabase=await createClient()
      const{data,error}=await supabase
        .from("jhadina_digital_product_studio_records")
        .select("id,opportunity_id,kind,status,evidence_refs,payload,recorded_at")
        .eq("id",id)
        .maybeSingle<Row>()
      if(error){
        throw new Error(
          `Unable to load Digital Product Studio record: ${error.message}`
        )
      }
      return data?toStored(data):undefined
    },

    async list(input={}){
      const supabase=await createClient()
      let query=supabase
        .from("jhadina_digital_product_studio_records")
        .select("id,opportunity_id,kind,status,evidence_refs,payload,recorded_at")
        .order("recorded_at",{ascending:false})
      if(input.opportunityId){
        query=query.eq("opportunity_id",input.opportunityId)
      }
      if(input.kind){
        query=query.eq("kind",input.kind)
      }
      if(input.limit){
        query=query.limit(input.limit)
      }
      const{data,error}=await query.returns<Row[]>()
      if(error){
        throw new Error(
          `Unable to list Digital Product Studio records: ${error.message}`
        )
      }
      return(data??[]).map(toStored)
    },

    async record(record){
      const supabase=await createClient()
      const{data,error}=await supabase.rpc(
        "jhadina_digital_product_studio_record_save",
        {p_record:record},
      )
      if(error||!data){
        throw new Error(
          `Unable to record Digital Product Studio record: ${error?.message??"no result returned"}`
        )
      }
      return data as DigitalProductStudioRecord
    },
  }
}

function toStored(row:Row):StoredDigitalProductStudioRecord{
  return{
    id:row.id,
    opportunityId:row.opportunity_id,
    kind:row.kind,
    status:row.status,
    evidenceRefs:row.evidence_refs??[],
    payload:row.payload,
    recordedAt:row.recorded_at,
  }
}
