import type { EvidenceRef } from "@jhadina/core-spine"
import { retrieveKnowledge,type KnowledgeContextProvider } from "../../../../../packages/jhadina-knowledge-runtime/src/index.js"
import { createSupabaseKnowledgeStore } from "./supabase-knowledge-store"

export function createProductionKnowledgeContextProvider():KnowledgeContextProvider {
 const store=createSupabaseKnowledgeStore()
 return {getKnowledgeContext:(query)=>retrieveKnowledge(store,query)}
}
export function knowledgeContextToEvidenceRefs(context:Awaited<ReturnType<KnowledgeContextProvider["getKnowledgeContext"]>>):EvidenceRef[]{
 return context.items.map(({record,score,temporalState})=>({id:record.id,source:"knowledge-core",observedAt:record.observedAt,summary:`${record.subject}: ${record.claim} [score=${score.toFixed(3)}; ${temporalState}; ${record.verificationState}; ${record.freshnessState}]`,immutable:false}))
}
