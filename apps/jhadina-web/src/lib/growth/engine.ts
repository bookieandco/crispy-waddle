import type { GrowthBrand, GrowthDraft, GrowthIdea, GrowthPlatform, ContentKind } from "./types"

const drafts = new Map<string, GrowthDraft>()
const ideas = new Map<string, GrowthIdea>()
let draftCounter = 0
let ideaCounter = 0

export function createGrowthIdea(input: Omit<GrowthIdea, "id" | "createdAt">): GrowthIdea {
  const idea: GrowthIdea = { ...input, id: `idea_${++ideaCounter}`, createdAt: new Date().toISOString() }
  ideas.set(idea.id, idea)
  return idea
}
export function listGrowthIdeas(userId: string): GrowthIdea[] { return Array.from(ideas.values()).filter((idea) => idea.userId === userId).sort((a,b)=>b.score-a.score) }
export function createGrowthDraft(input: { userId:string; brand:GrowthBrand; platforms:GrowthPlatform[]; kind:ContentKind; title?:string; body:string; mediaIds?:string[]; sourceAssetId?:string; rationale:string; suggestedPublishAt?:string; seo?:GrowthDraft["seo"] }): GrowthDraft {
  const draft:GrowthDraft={...input,id:`growth_${++draftCounter}`,mediaIds:input.mediaIds??[],version:1,status:"PENDING_APPROVAL",createdAt:new Date().toISOString()}; drafts.set(draft.id,draft); return draft
}
export function getGrowthDraft(userId:string,draftId:string):GrowthDraft|null { const draft=drafts.get(draftId); return draft&&draft.userId===userId?draft:null }
export function listGrowthDraftVersions(userId:string,draftId:string):GrowthDraft[] { const current=getGrowthDraft(userId,draftId); if(!current)return []; const root=current.versionOf||current.id; return Array.from(drafts.values()).filter(d=>d.userId===userId&&(d.id===root||d.versionOf===root)).sort((a,b)=>a.version-b.version) }
export function redraftGrowthDraft(userId:string,draftId:string,instruction:string):GrowthDraft|null {
  const draft=getGrowthDraft(userId,draftId); if(!draft)return null; const lower=instruction.toLowerCase(); let body=draft.body
  if(lower.includes("less robotic")||lower.includes("more human")||lower.includes("more like me")) body=body.replace(/\b(leverage|utilize|synergy|delve|robust|seamless)\b/gi,w=>({leverage:"use",utilize:"use",synergy:"fit",delve:"dig",robust:"strong",seamless:"easy"}[w.toLowerCase()]||w)).replace(/\s+/g," ").trim()
  if(lower.includes("shorten")||lower.includes("shorter")){const s=body.split(/(?<=[.!?])\s+/);body=s.slice(0,Math.max(1,Math.ceil(s.length/2))).join(" ")}
  if(lower.includes("exciting")||lower.includes("more energy"))body=body.replace(/\.$/,"!")
  const root=draft.versionOf||draft.id; const versions=listGrowthDraftVersions(userId,draft.id)
  const redraft:GrowthDraft={...draft,id:`growth_${++draftCounter}`,body,versionOf:root,version:versions.length+1,status:"PENDING_APPROVAL",approvedAt:undefined,scheduledAt:undefined,publishedAt:undefined,rationale:`Redraft of ${draft.id}: ${instruction}`,createdAt:new Date().toISOString()}; drafts.set(redraft.id,redraft); return redraft
}
export function listGrowthDrafts(userId:string):GrowthDraft[]{return Array.from(drafts.values()).filter(d=>d.userId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export function approveGrowthDraft(userId:string,draftId:string):GrowthDraft|null{const d=drafts.get(draftId);if(!d||d.userId!==userId||d.status!=="PENDING_APPROVAL")return null;const a={...d,status:"APPROVED",approvedAt:new Date().toISOString()};drafts.set(draftId,a);return a}
export function rejectGrowthDraft(userId:string,draftId:string):GrowthDraft|null{const d=drafts.get(draftId);if(!d||d.userId!==userId||d.status!=="PENDING_APPROVAL")return null;const r={...d,status:"REJECTED"};drafts.set(draftId,r);return r}
export function scheduleGrowthDraft(userId:string,draftId:string,scheduledAt:string):GrowthDraft|null{const d=drafts.get(draftId);if(!d||d.userId!==userId||d.status!=="APPROVED")return null;const s={...d,status:"SCHEDULED",scheduledAt};drafts.set(draftId,s);return s}
