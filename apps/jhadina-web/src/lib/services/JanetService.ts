/**
 * JanetService
 *
 * Core orchestrator. Implements the memory-governed reasoning pipeline.
 * Context for downstream agents is built only from APPROVED memories and
 * explicitly configured codebase and Justice providers.
 */

import { Classifier } from "./Classifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import {
  JanetContextProvider,
  JanetCodebaseContextProvider,
} from "./JanetContextProvider"
import {
  EmptyJanetJusticeContextProvider,
  JanetJusticeContextProvider,
} from "./JanetJusticeContextProvider"
import { JanetGitHubCodebaseProvider } from "./JanetGitHubCodebaseProvider"
import { Observation, Classification, MemoryCandidate } from "../storage/InMemoryStorage"

export interface JanetServiceResponse {
  response: string
  reasoningEventId: string
  classification: Classification
  memoryCandidate: MemoryCandidate
  confidence: number
}

export type JanetReadiness = "READY" | "DEGRADED" | "NOT_READY"

export interface JanetHealth {
  status: "ok" | "error"
  readiness: JanetReadiness
  memory: "READY"
  codebase: "READY" | "UNAVAILABLE"
  justice: "READY" | "JUSTICE_UNAVAILABLE" | "INSUFFICIENT_EVIDENCE" | "CONFLICT_UNRESOLVED"
}

export class JanetService {
  private readonly contextProvider: JanetContextProvider

  constructor(
    private classifier: Classifier,
    private memoryRepo: MemoryRepository,
    private reasoningRepo: ReasoningEventRepository,
    private timelineRepo: TimelineRepository,
    codebaseProvider?: JanetCodebaseContextProvider,
    justiceProvider: JanetJusticeContextProvider = new EmptyJanetJusticeContextProvider(),
  ) {
    this.contextProvider = new JanetContextProvider(
      memoryRepo,
      codebaseProvider ?? JanetService.defaultCodebaseProvider(),
      justiceProvider,
    )
  }

  private static defaultCodebaseProvider(): JanetCodebaseContextProvider {
    const owner = process.env.JANET_CODEBASE_OWNER
    const repo = process.env.JANET_CODEBASE_REPO
    if (!owner || !repo) {
      return { getContext: async () => ({ summary: "No JANET_CODEBASE_OWNER/REPO configured.", relevantPaths: [], relationships: [] }) }
    }
    return new JanetGitHubCodebaseProvider({
      owner,
      repo,
      ref: process.env.JANET_CODEBASE_REF || "main",
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      maxFiles: Number(process.env.JANET_CODEBASE_MAX_FILES || 180),
    })
  }

  async processMessage(params: { userId: string; message: string }): Promise<JanetServiceResponse> {
    const { userId, message } = params
    const observation = this.observe(message)
    const classification = this.classifier.classify(message)
    const candidate = await this.memoryRepo.createCandidate({ userId, content: message, type: classification.type, confidence: classification.confidence, reasoningEventId: "" })
    const reasoningEvent = await this.reasoningRepo.create({ userId, userMessage: message, observation, classification, systemResponse: this.generateResponse(classification, message), confidence: classification.confidence, candidateId: candidate.id })
    await this.timelineRepo.recordReasoning({ userId, reasoningEventId: reasoningEvent.id, userMessage: message, systemResponse: reasoningEvent.systemResponse })
    return { response: reasoningEvent.systemResponse, reasoningEventId: reasoningEvent.id, classification, memoryCandidate: candidate, confidence: classification.confidence }
  }

  async getAgentContext(userId: string, objective?: string) {
    return this.contextProvider.build({ userId, objective })
  }

  async getJusticeContext(userId: string, objective?: string, jurisdiction?: string, asOf?: string) {
    const context = await this.contextProvider.build({ userId, objective, jurisdiction, asOf })
    return context.justice
  }

  async getContext(userId: string): Promise<any[]> { return (await this.contextProvider.build({ userId })).approvedMemories }
  async getApprovedMemoryIds(userId: string): Promise<string[]> { return (await this.contextProvider.build({ userId })).sourceMemoryIds }

  private observe(input: string): Observation { return { raw: input, extracted: input.trim(), timestamp: new Date().toISOString() } }

  private generateResponse(classification: Classification, message: string): string {
    const confidence = (classification.confidence * 100).toFixed(0)
    switch (classification.type) {
      case "PREFERENCE": return `I've noted that ${message.toLowerCase()}. This is stored as a preference (${confidence}% confidence) and is pending your approval.`
      case "IDENTITY": return `I'll remember that ${message.toLowerCase()}. This is stored as an identity statement (${confidence}% confidence) and is pending your approval.`
      case "GOAL": return `I understand your goal: ${message.toLowerCase()}. This is stored as a goal (${confidence}% confidence) and is pending your approval.`
      case "CONTEXT": return `Got it. I'm storing this context: ${message.toLowerCase()} (${confidence}% confidence). It's pending your approval.`
      default: return `I've processed your message and created a memory candidate (${confidence}% confidence). Please review it in the approvals section.`
    }
  }

  async health(): Promise<JanetHealth> {
    try {
      const context = await this.contextProvider.build({ userId: "__health__", objective: "health" })
      const codebaseReady = context.readiness.codebase === "READY"
      const justiceReady = context.readiness.justice === "READY"
      const readiness: JanetReadiness = codebaseReady && justiceReady
        ? "READY"
        : codebaseReady || justiceReady
          ? "DEGRADED"
          : "NOT_READY"

      return {
        status: "ok",
        readiness,
        memory: "READY",
        codebase: context.readiness.codebase,
        justice: context.readiness.justice,
      }
    } catch {
      return {
        status: "error",
        readiness: "NOT_READY",
        memory: "READY",
        codebase: "UNAVAILABLE",
        justice: "JUSTICE_UNAVAILABLE",
      }
    }
  }

  async approveMemory(userId: string, candidateId: string): Promise<{ status: string; memoryId: string }> {
    const memory = await this.memoryRepo.approve(candidateId, userId)
    await this.timelineRepo.recordApproval({ userId, memoryId: memory.id, memoryType: memory.type, memoryContent: memory.content })
    return { status: "APPROVED", memoryId: memory.id }
  }

  async rejectMemory(userId: string, candidateId: string): Promise<void> {
    await this.memoryRepo.reject(candidateId, userId)
    const candidate = await this.memoryRepo["storage"]?.getCandidate?.(candidateId)
    if (candidate) await this.timelineRepo.recordRejection({ userId, memoryId: candidateId, memoryType: candidate.type, memoryContent: candidate.content })
  }

  dump(): string {
    return [
      "JanetService",
      "═".repeat(40),
      "",
      "Readiness: derived from live context providers",
      "Memory Context: ✓ APPROVED-only",
      "Codebase Context: ✓ GitHub graph provider when configured",
      "Justice Context: ✓ governed provider when configured",
      "Classifier Status: ⏳ Temporary (replaceable)",
    ].join("\n")
  }
}
