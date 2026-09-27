import "server-only"
import { assertMoneyFeedEvent,type MoneyFeedEvent } from "@jhadina/money-core"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_FEED1_SESSION_REQUIRED")
 return id
}
function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}

export type MoneyFeedRow=Readonly<{
 eventId:string
 type:MoneyFeedEvent["type"]
 lane:MoneyFeedEvent["lane"]
 commitment:MoneyFeedEvent["commitment"]
 title:string
 body:string
 subjectId:string|null
 route:string
 fundedAmountMinor:string|null
 currency:string|null
 materiality:number
 occurredAt:string
 evidenceIds:readonly string[]
}>

export async function appendMoneyFeedEvent(event:MoneyFeedEvent){
 assertMoneyFeedEvent(event)
 const db=admin()
 const {error}=await db.from("money_feed_events").upsert({
  event_id:event.eventId,user_id:event.userId,type:event.type,lane:event.lane,commitment:event.commitment,title:event.title,body:event.body,
  subject_id:event.subjectId??null,route:event.route,funded_amount_minor:event.fundedAmountMinor?.toString()??null,currency:event.currency??null,
  materiality:event.materiality,occurred_at:event.occurredAt,evidence_ids:[...event.evidenceIds],
 },{onConflict:"event_id",ignoreDuplicates:true})
 if(error)throw new Error("MONEY_FEED1_STORE_FAILED:"+error.message)
}

export async function readSessionMoneyFeed(limit=20):Promise<readonly MoneyFeedRow[]>{
 const userId=await verifiedUserId(),db=admin()
 const safeLimit=Math.max(1,Math.min(50,Math.trunc(limit)||20))
 const {data,error}=await db.from("money_feed_events")
  .select("event_id,type,lane,commitment,title,body,subject_id,route,funded_amount_minor,currency,materiality,occurred_at,evidence_ids")
  .eq("user_id",userId).gte("materiality",50).order("occurred_at",{ascending:false}).limit(safeLimit)
 if(error)throw new Error("MONEY_FEED1_READ_FAILED:"+error.message)
 return Object.freeze((data??[]).map(x=>Object.freeze({
  eventId:x.event_id,type:x.type as MoneyFeedRow["type"],lane:x.lane as MoneyFeedRow["lane"],commitment:x.commitment as MoneyFeedRow["commitment"],
  title:x.title,body:x.body,subjectId:x.subject_id??null,route:x.route,fundedAmountMinor:x.funded_amount_minor===null?null:String(x.funded_amount_minor),
  currency:x.currency??null,materiality:Number(x.materiality),occurredAt:x.occurred_at,evidenceIds:Object.freeze(x.evidence_ids??[]),
 })))
}
