/** Local working notes, never verified evidence or an adopted campaign platform. */
export const RESEARCH_TOPICS = ["Housing", "Healthcare", "Education and youth", "Justice", "Veterans", "Seniors", "Other"] as const
export type ResearchTopic = typeof RESEARCH_TOPICS[number]
export type ResearchNotebook = {
  topic: ResearchTopic
  problem: string
  evidence: string
  alternatives: string
  tradeoffs: string
  counterevidence: string
  outcomes: string
}
export const EMPTY_NOTEBOOK: ResearchNotebook = {
  topic: "Housing", problem: "", evidence: "", alternatives: "", tradeoffs: "", counterevidence: "", outcomes: "",
}
export function exportResearchNotebook(note: ResearchNotebook, exportedAt: string): string {
  return JSON.stringify({ schemaVersion: 1, status: "UNVERIFIED_WORKING_DRAFT", exportedAt,
    provenance: "Owner-entered notes; no independent source verification performed.",
    ...note,
    adoption: "Not an adopted policy or published statement.",
    authority: "No external action authorized.",
  }, null, 2)
}
