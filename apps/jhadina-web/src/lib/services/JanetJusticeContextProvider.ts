export type JanetJusticeContextStatus =
  | "READY"
  | "JUSTICE_UNAVAILABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICT_UNRESOLVED"

export interface JanetJusticeEvidenceReference {
  evidenceId: string
  sourceId: string
  citation?: string
  authorityLevel: string
  verificationState: string
  contentHash: string
  provenance: Record<string, unknown>
}

export interface JanetJusticeContext {
  status: JanetJusticeContextStatus
  query?: string
  jurisdiction?: string
  asOf?: string
  evidence: JanetJusticeEvidenceReference[]
  conflicts: string[]
  limitations: string[]
}

export interface JanetJusticeContextProvider {
  getContext(input: {
    userId: string
    objective?: string
    jurisdiction?: string
    asOf?: string
  }): Promise<JanetJusticeContext>
}

export class EmptyJanetJusticeContextProvider implements JanetJusticeContextProvider {
  async getContext(): Promise<JanetJusticeContext> {
    return {
      status: "JUSTICE_UNAVAILABLE",
      evidence: [],
      conflicts: [],
      limitations: ["No Justice Core provider is configured."],
    }
  }
}
