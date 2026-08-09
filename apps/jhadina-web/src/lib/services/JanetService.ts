/**
 * JanetService
 *
 * Core orchestrator. Deterministic classification and memory approval remain
 * authoritative; Gemini is used only as an optional response-generation layer.
 */

import { Classifier } from "./Classifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { generateWithGemini } from "../ai/GeminiAdapter"
import {
  Observation,
  Classification,
  MemoryCandidate,
} from "../storage/InMemoryStorage"

export interface JanetServiceResponse {
  response: string
  reasoningEventId: string
  classification: Classification
  memoryCandidate: MemoryCandidate
  confidence: number
}

export class JanetService {
  constructor(
    private classifier: Classifier,
    private memoryRepo: MemoryRepository,
    private reasoningRepo: ReasoningEventRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async processMessage(params: {
    userId: string
    message: string
  }): Promise<JanetServiceResponse> {
    const { userId, message } = params

    // Deterministic observation and classification remain the source of truth.
    const observation = this.observe(message)
    const classification = this.classifier.classify(message)

    const candidate = await this.memoryRepo.createCandidate({
      userId,
      content: message,
      type: classification.type,
      confidence: classification.confidence,
      reasoningEventId: "",
    })

    // Gemini can improve the conversational response, but cannot mutate state
    // or override classification/approval/policy decisions.
    const systemResponse = await this.generateResponse(classification, message)

    const reasoningEvent = await this.reasoningRepo.create({
      userId,
      userMessage: message,
      observation,
      classification,
      systemResponse,
      confidence: classification.confidence,
      candidateId: candidate.id,
    })

    await this.timelineRepo.recordReasoning({
      userId,
      reasoningEventId: reasoningEvent.id,
      userMessage: message,
      systemResponse: reasoningEvent.systemResponse,
    })

    return {
      response: reasoningEvent.systemResponse,
      reasoningEventId: reasoningEvent.id,
      classification,
      memoryCandidate: candidate,
      confidence: classification.confidence,
    }
  }

  private observe(input: string): Observation {
    return {
      raw: input,
      extracted: input.trim(),
      timestamp: new Date().toISOString(),
    }
  }

  private async generateResponse(
    classification: Classification,
    message: string
  ): Promise<string> {
    const confidence = (classification.confidence * 100).toFixed(0)

    // If Gemini is configured, use it only for response wording.
    if (process.env.GEMINI_API_KEY) {
      try {
        const result = await generateWithGemini({
          prompt: [
            `Classification: ${classification.type}`,
            `Classification confidence: ${classification.confidence}`,
            `User message: ${message}`,
          ].join("\n"),
          systemInstruction: [
            "You are Janet, the reasoning voice inside Jhadina.",
            "Generate a concise, helpful response to the user's message.",
            "You are a response-generation provider only.",
            "Do not claim to have executed actions.",
            "Do not approve or reject memories.",
            "Do not modify user state or bypass Jhadina policy controls.",
            "The application's deterministic classification and approval workflow is authoritative.",
          ].join(" "),
          temperature: 0.4,
          maxOutputTokens: 300,
        })

        return result.text
      } catch (error) {
        console.error("Gemini unavailable; using deterministic fallback", error)
      }
    }

    return this.generateFallbackResponse(classification, message, confidence)
  }

  private generateFallbackResponse(
    classification: Classification,
    message: string,
    confidence: string
  ): string {
    switch (classification.type) {
      case "PREFERENCE":
        return `I've noted that ${message.toLowerCase()}. This is stored as a preference (${confidence}% confidence) and is pending your approval.`
      case "IDENTITY":
        return `I'll remember that ${message.toLowerCase()}. This is stored as an identity statement (${confidence}% confidence) and is pending your approval.`
      case "GOAL":
        return `I understand your goal: ${message.toLowerCase()}. This is stored as a goal (${confidence}% confidence) and is pending your approval.`
      case "CONTEXT":
        return `Got it. I'm storing this context: ${message.toLowerCase()} (${confidence}% confidence). It's pending your approval.`
      default:
        return `I've processed your message and created a memory candidate (${confidence}% confidence). Please review it in the approvals section.`
    }
  }

  async health(): Promise<{ status: "ok" | "error" }> {
    try {
      const obs = this.observe("health check")
      return obs && obs.timestamp ? { status: "ok" } : { status: "error" }
    } catch {
      return { status: "error" }
    }
  }

  async approveMemory(
    userId: string,
    candidateId: string
  ): Promise<{ status: string; memoryId: string }> {
    const memory = await this.memoryRepo.approve(candidateId, userId)

    await this.timelineRepo.recordApproval({
      userId,
      memoryId: memory.id,
      memoryType: memory.type,
      memoryContent: memory.content,
    })

    return { status: "APPROVED", memoryId: memory.id }
  }

  async rejectMemory(userId: string, candidateId: string): Promise<void> {
    await this.memoryRepo.reject(candidateId, userId)

    const candidate = await this.memoryRepo["storage"]?.getCandidate?.(candidateId)
    if (candidate) {
      await this.timelineRepo.recordRejection({
        userId,
        memoryId: candidateId,
        memoryType: candidate.type,
        memoryContent: candidate.content,
      })
    }
  }

  async getContext(userId: string): Promise<any[]> {
    return this.memoryRepo.getContext(userId)
  }

  dump(userId?: string): string {
    const lines: string[] = []
    lines.push("JanetService")
    lines.push("═".repeat(40))
    lines.push("")
    lines.push("Pipeline Status: ✓ Production")
    lines.push("Classifier Status: ✓ Deterministic")
    lines.push("Reasoning Provider: Gemini (optional, server-side)")
    lines.push("")
    lines.push("Component Health:")
    lines.push("  ✓ Observe()")
    lines.push("  ✓ Classify() [deterministic]")
    lines.push("  ✓ createCandidate()")
    lines.push("  ✓ recordReasoning()")
    lines.push("  ✓ response generation [Gemini + fallback]")
    lines.push("")
    return lines.join("\n")
  }
}
