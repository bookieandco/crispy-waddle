export type ResearchSourceType = "web" | "academic" | "book" | "github" | "user";
export type EvidenceStatus = "unverified" | "verified" | "disputed" | "rejected";

export interface ResearchSource { id: string; type: ResearchSourceType; title: string; locator: string; publisher?: string; accessedAt: string; status: EvidenceStatus; }
export interface ResearchClaim { id: string; claim: string; sourceIds: string[]; status: EvidenceStatus; confidence: "low" | "medium" | "high"; }
export interface ResearchBrief { id: string; question: string; sources: ResearchSource[]; claims: ResearchClaim[]; gaps: string[]; generatedAt: string; }

export function createResearchBrief(question: string): ResearchBrief {
  return { id: crypto.randomUUID(), question, sources: [], claims: [], gaps: ["No sources collected yet"], generatedAt: new Date().toISOString() };
}

export function addResearchSource(brief: ResearchBrief, source: Omit<ResearchSource, "id" | "accessedAt">): ResearchBrief {
  const next = { ...brief, sources: [...brief.sources, { ...source, id: crypto.randomUUID(), accessedAt: new Date().toISOString() }] };
  return { ...next, gaps: next.sources.length ? [] : next.gaps };
}

export function addResearchClaim(brief: ResearchBrief, claim: Omit<ResearchClaim, "id">): ResearchBrief {
  return { ...brief, claims: [...brief.claims, { ...claim, id: crypto.randomUUID() }] };
}
