import type {
  AffiliatePayoutBalanceSnapshot,
  AffiliatePayoutPaidHighWater,
} from '@jhadina/commerce-adapters'
import {createClient} from '@/lib/supabase/server'

export type StoredAffiliatePayoutSnapshot={
  id:string
  opportunityId:string
  provider:string
  accountRef:string
  snapshot:AffiliatePayoutBalanceSnapshot
  paidHighWater:AffiliatePayoutPaidHighWater
  observedAt:string
  authority:'AFFILIATE_PAYOUT_SNAPSHOT_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

type AffiliatePayoutSnapshotRow={
  id:string
  opportunity_id:string
  provider:string
  account_ref:string
  payload:StoredAffiliatePayoutSnapshot
  observed_at:string
}

export type AffiliatePayoutSnapshotRepository={
  list(input:{
    opportunityId:string
    provider?:string
    accountRef?:string
    limit?:number
  }):Promise<StoredAffiliatePayoutSnapshot[]>
  latest(input:{
    opportunityId:string
    provider:string
    accountRef:string
  }):Promise<StoredAffiliatePayoutSnapshot|undefined>
  record(record:StoredAffiliatePayoutSnapshot):Promise<StoredAffiliatePayoutSnapshot>
}

export function createAffiliatePayoutSnapshotRepository():AffiliatePayoutSnapshotRepository{
  return{
    async list(input){
      const supabase=await createClient()
      let query=supabase
        .from('jhadina_affiliate_payout_snapshots')
        .select('id,opportunity_id,provider,account_ref,payload,observed_at')
        .eq('opportunity_id',input.opportunityId)
        .order('observed_at',{ascending:false})
        .limit(Math.max(1,Math.min(input.limit??50,200)))
      if(input.provider)query=query.eq('provider',input.provider)
      if(input.accountRef)query=query.eq('account_ref',input.accountRef)
      const{data,error}=await query.returns<AffiliatePayoutSnapshotRow[]>()
      if(error)throw new Error(`Unable to list affiliate payout snapshots: ${error.message}`)
      return(data??[]).map(row=>row.payload)
    },

    async latest(input){
      const rows=await this.list({...input,limit:1})
      return rows[0]
    },

    async record(record){
      const supabase=await createClient()
      const{data,error}=await supabase.rpc('jhadina_affiliate_payout_snapshot_record',{
        p_record:record,
      })
      if(error||!data){
        throw new Error(`Unable to record affiliate payout snapshot: ${error?.message??'no result returned'}`)
      }
      return data as StoredAffiliatePayoutSnapshot
    },
  }
}
