import type { SupabaseClient } from "@supabase/supabase-js"
import type { MemoryStorage } from "./MemoryStorage"
import type { Memory, MemoryCandidate, ReasoningEvent, TimelineEvent, Observation, Classification, MemoryType } from "./InMemoryStorage"

type MemoryRow = { id:string; user_id:string; type:MemoryType; status:"APPROVED"|"REJECTED"; content:string; confidence:number; created_at:string; approved_at:string|null; rejected_at:string|null }
type CandidateRow = { id:string; user_id:string; type:MemoryType; status:"PENDING"; content:string; confidence:number; reasoning_event_id:string; created_at:string }
type ReasoningEventRow = { id:string; user_id:string; occurred_at:string; user_message:string; observation:Observation; classification:Classification; system_response:string; confidence:number; candidate_id:string|null }
type TimelineEventRow = { id:string; user_id:string; occurred_at:string; type:TimelineEvent["type"]; reasoning_event_id:string|null; memory_id:string|null; memory_type:MemoryType|null; memory_content:string|null; decision:"APPROVED"|"REJECTED"|null }

const memoryFromRow = (r:MemoryRow):Memory => ({ id:r.id,userId:r.user_id,type:r.type,status:r.status,content:r.content,confidence:r.confidence,createdAt:r.created_at,approvedAt:r.approved_at??undefined,rejectedAt:r.rejected_at??undefined })
const candidateFromRow = (r:CandidateRow):MemoryCandidate => ({ id:r.id,userId:r.user_id,type:r.type,content:r.content,confidence:r.confidence,status:r.status,createdAt:r.created_at,reasoningEventId:r.reasoning_event_id })
const reasoningFromRow = (r:ReasoningEventRow):ReasoningEvent => ({ id:r.id,userId:r.user_id,timestamp:r.occurred_at,userMessage:r.user_message,observation:r.observation,classification:r.classification,systemResponse:r.system_response,confidence:r.confidence,candidateId:r.candidate_id??undefined })
const timelineFromRow = (r:TimelineEventRow):TimelineEvent => ({ id:r.id,userId:r.user_id,timestamp:r.occurred_at,type:r.type,reasoningEventId:r.reasoning_event_id??undefined,memoryId:r.memory_id??undefined,memoryType:r.memory_type??undefined,memoryContent:r.memory_content??undefined,decision:r.decision??undefined })
const nextId = (prefix:string) => `${prefix}_${crypto.randomUUID()}`
function fail(error:{message:string}|null, context:string):void { if(error) throw new Error(`JHADINA_MEMORY_STORAGE_FAILED:${context}:${error.message}`) }

/** Durable MemoryStorage. Ownership-sensitive queries always include user_id. */
export class SupabaseMemoryStorage implements MemoryStorage {
  constructor(private readonly client:SupabaseClient) {}
  async createMemory(data:Omit<Memory,"id">):Promise<Memory> {
    const row:MemoryRow={id:nextId("mem"),user_id:data.userId,type:data.type,status:data.status as "APPROVED"|"REJECTED",content:data.content,confidence:data.confidence,created_at:data.createdAt,approved_at:data.approvedAt??null,rejected_at:data.rejectedAt??null}
    const {error}=await this.client.from("jhadina_memories").insert(row); fail(error,"createMemory"); return memoryFromRow(row)
  }
  async getMemory(userId:string,id:string):Promise<Memory|undefined> {
    const {data,error}=await this.client.from("jhadina_memories").select("*").eq("user_id",userId).eq("id",id).maybeSingle(); fail(error,"getMemory"); return data?memoryFromRow(data as MemoryRow):undefined
  }
  async listMemories(userId:string):Promise<Memory[]> {
    const {data,error}=await this.client.from("jhadina_memories").select("*").eq("user_id",userId); fail(error,"listMemories"); return (data??[]).map(r=>memoryFromRow(r as MemoryRow))
  }
  async updateMemory(userId:string,id:string,updates:Partial<Memory>):Promise<Memory|undefined> {
    const patch:Record<string,unknown>={}; if(updates.status!==undefined)patch.status=updates.status; if(updates.content!==undefined)patch.content=updates.content; if(updates.confidence!==undefined)patch.confidence=updates.confidence; if(updates.approvedAt!==undefined)patch.approved_at=updates.approvedAt; if(updates.rejectedAt!==undefined)patch.rejected_at=updates.rejectedAt
    const {data,error}=await this.client.from("jhadina_memories").update(patch).eq("user_id",userId).eq("id",id).select("*").maybeSingle(); fail(error,"updateMemory"); return data?memoryFromRow(data as MemoryRow):undefined
  }
  async createCandidate(data:Omit<MemoryCandidate,"id">):Promise<MemoryCandidate> {
    const row:CandidateRow={id:nextId("cand"),user_id:data.userId,type:data.type,status:data.status,content:data.content,confidence:data.confidence,reasoning_event_id:data.reasoningEventId,created_at:data.createdAt}; const {error}=await this.client.from("jhadina_memory_candidates").insert(row); fail(error,"createCandidate"); return candidateFromRow(row)
  }
  async getCandidate(userId:string,id:string):Promise<MemoryCandidate|undefined> {
    const {data,error}=await this.client.from("jhadina_memory_candidates").select("*").eq("user_id",userId).eq("id",id).maybeSingle(); fail(error,"getCandidate"); return data?candidateFromRow(data as CandidateRow):undefined
  }
  async listCandidates(userId:string,status?:"PENDING"):Promise<MemoryCandidate[]> {
    let query=this.client.from("jhadina_memory_candidates").select("*").eq("user_id",userId); if(status)query=query.eq("status",status); const {data,error}=await query; fail(error,"listCandidates"); return (data??[]).map(r=>candidateFromRow(r as CandidateRow))
  }
  async removeCandidate(userId:string,id:string):Promise<void> { const {error}=await this.client.from("jhadina_memory_candidates").delete().eq("user_id",userId).eq("id",id); fail(error,"removeCandidate") }
  async createReasoningEvent(data:Omit<ReasoningEvent,"id">):Promise<ReasoningEvent> { const row:ReasoningEventRow={id:nextId("reason"),user_id:data.userId,occurred_at:data.timestamp,user_message:data.userMessage,observation:data.observation,classification:data.classification,system_response:data.systemResponse,confidence:data.confidence,candidate_id:data.candidateId??null}; const {error}=await this.client.from("jhadina_reasoning_events").insert(row); fail(error,"createReasoningEvent"); return reasoningFromRow(row) }
  async getReasoningEvent(id:string):Promise<ReasoningEvent|undefined> { const {data,error}=await this.client.from("jhadina_reasoning_events").select("*").eq("id",id).maybeSingle(); fail(error,"getReasoningEvent"); return data?reasoningFromRow(data as ReasoningEventRow):undefined }
  async listReasoningEvents(userId:string,limit=50):Promise<ReasoningEvent[]> { const {data,error}=await this.client.from("jhadina_reasoning_events").select("*").eq("user_id",userId).order("occurred_at",{ascending:false}).limit(limit); fail(error,"listReasoningEvents"); return (data??[]).map(r=>reasoningFromRow(r as ReasoningEventRow)) }
  async appendTimelineEvent(data:Omit<TimelineEvent,"id">):Promise<TimelineEvent> { const row:TimelineEventRow={id:nextId("timeline"),user_id:data.userId,occurred_at:data.timestamp,type:data.type,reasoning_event_id:data.reasoningEventId??null,memory_id:data.memoryId??null,memory_type:data.memoryType??null,memory_content:data.memoryContent??null,decision:data.decision??null}; const {error}=await this.client.from("jhadina_timeline_events").insert(row); fail(error,"appendTimelineEvent"); return timelineFromRow(row) }
  async listTimeline(userId:string,limit=50):Promise<TimelineEvent[]> { const {data,error}=await this.client.from("jhadina_timeline_events").select("*").eq("user_id",userId).order("occurred_at",{ascending:false}).limit(limit); fail(error,"listTimeline"); return (data??[]).map(r=>timelineFromRow(r as TimelineEventRow)) }
}
