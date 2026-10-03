import type {
  SideHustleCommissioningEvidence,
  SideHustleFamily,
} from '@jhadina/opportunity-core'
import {createClient} from '@/lib/supabase/server'

type CommissioningEvidenceRow={
  payload:SideHustleCommissioningEvidence
}

export type SideHustleCommissioningEvidenceRepository={
  list(input?:{family?:SideHustleFamily}):Promise<SideHustleCommissioningEvidence[]>
  record(evidence:SideHustleCommissioningEvidence):Promise<SideHustleCommissioningEvidence>
}

export function createSideHustleCommissioningEvidenceRepository():SideHustleCommissioningEvidenceRepository{
  return{
    async list(input={}){
      const supabase=await createClient()
      let query=supabase
        .from('jhadina_side_hustle_commissioning_evidence')
        .select('payload')
        .order('observed_at',{ascending:true})
      if(input.family)query=query.eq('family',input.family)
      const{data,error}=await query.returns<CommissioningEvidenceRow[]>()
      if(error)throw new Error(`Unable to list Side Hustle commissioning evidence: ${error.message}`)
      return(data??[]).map(row=>row.payload)
    },

    async record(evidence){
      const supabase=await createClient()
      const{data,error}=await supabase.rpc('jhadina_side_hustle_commissioning_evidence_record',{
        p_evidence:evidence,
      })
      if(error||!data){
        throw new Error(`Unable to record Side Hustle commissioning evidence: ${error?.message??'no result returned'}`)
      }
      return data as SideHustleCommissioningEvidence
    },
  }
}
