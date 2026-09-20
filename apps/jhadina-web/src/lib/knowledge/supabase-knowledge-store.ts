import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { KnowledgeQuery,KnowledgeRecord,KnowledgeStore } from "../../../../../packages/jhadina-knowledge-runtime/src/index.js"

function client(input?:SupabaseClient|null){const c=input??createServiceRoleClient();if(!c)throw new Error("Knowledge retrieval requires SUPABASE_SERVICE_ROLE_KEY");return c}
function map(row:any):KnowledgeRecord{return {id:row.id,ownerId:row.owner_id??undefined,scope:row.scope,subject:row.subject,predicate:row.predicate,claim:row.claim,object:row.object_json,confidence:Number(row.confidence),verificationState:row.verification_state,authorityScore:Number(row.authority_score),freshnessScore:Number(row.freshness_score),freshnessState:row.freshness_state,observedAt:row.observed_at,validFrom:row.valid_from??undefined,validUntil:row.valid_until??undefined,supersededBy:row.superseded_by??undefined,evidence:Array.isArray(row.evidence)?row.evidence.map((e:any)=>({id:e.id,sourceId:e.sourceId,authorityScore:Number(e.authorityScore),verificationState:e.verificationState,freshnessState:e.freshnessState})):[]}}
export function createSupabaseKnowledgeStore(input?:SupabaseClient|null):KnowledgeStore{
 const s=client(input); const run=async(q:KnowledgeQuery)=>{const {data,error}=await s.rpc("jhadina_query_knowledge",{p_query:q.text,p_owner_id:q.ownerId??null,p_scope:q.scope??null,p_as_of:q.asOf??new Date().toISOString(),p_limit:q.limit??8,p_require_verified:q.requireVerified??false});if(error)throw new Error(`Knowledge query failed: ${error.message}`);return (data??[]).map(map)}
 return {exact:run,semantic:run,graph:run}
}
