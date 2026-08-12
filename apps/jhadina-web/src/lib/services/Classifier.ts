/**
 * Classifier
 * 
 * Replaceable component for classifying user input into memory types.
 * 
 * Current: Rule-based (hard-coded patterns)
 * Future: Replace with Decision Engine + Context Builder
 * 
 * This is the ONLY temporary component in Sprint 1.
 * Everything else is production-ready.
 */

import { Classification } from "../storage/InMemoryStorage"

export class Classifier {
  /**
   * Classify user input into a memory type
   * 
   * Current implementation: Simple pattern matching
   * Future: Replace with Decision Engine.classify()
   * 
   * The interface stays the same. Only the implementation changes.
   */
  classify(text: string): Classification {
    const lower = text.toLowerCase()

    // PREFERENCE: "I prefer", "I like", "I enjoy", "I love"
    if (
      lower.includes("i prefer") ||
      lower.includes("i like") ||
      lower.includes("i enjoy") ||
      lower.includes("i love") ||
      lower.includes("i'd rather")
    ) {
      return {
        type: "PREFERENCE",
        confidence: 0.95,
        reasoning: "Contains preference indicator",
      }
    }

    // IDENTITY: "I'm", "I am", "I have", "I was", "I will be"
    if (
      lower.includes("i'm ") ||
      lower.includes("i am ") ||
      lower.includes("i was ") ||
      lower.includes("i will be ") ||
      lower.includes("my role") ||
      lower.includes("i'm a")
    ) {
      return {
        type: "IDENTITY",
        confidence: 0.90,
        reasoning: "Contains identity indicator",
      }
    }

    // GOAL: "I want", "I need", "I aim", "I'm trying", "goal", "objective"
    if (
      lower.includes("i want") ||
      lower.includes("i need") ||
      lower.includes("i aim") ||
      lower.includes("i'm trying") ||
      lower.includes("my goal") ||
      lower.includes("objective") ||
      lower.includes("i should") ||
      lower.includes("i must")
    ) {
      return {
        type: "GOAL",
        confidence: 0.90,
        reasoning: "Contains goal indicator",
      }
    }

    // CONTEXT: "Remember", "Note that", "FYI", "Also", "Additionally"
    if (
      lower.includes("remember") ||
      lower.includes("note that") ||
      lower.includes("fyi") ||
      lower.includes("also") ||
      lower.includes("additionally") ||
      lower.includes("context") ||
      lower.includes("background")
    ) {
      return {
        type: "CONTEXT",
        confidence: 0.85,
        reasoning: "Contains context indicator",
      }
    }

    // Default to CONTEXT with low confidence
    return {
      type: "CONTEXT",
      confidence: 0.5,
      reasoning: "No strong classification pattern matched",
    }
  }

  /**
   * Batch classify multiple texts
   */
  classifyBatch(texts: string[]): Classification[] {
    return texts.map(text => this.classify(text))
  }

  /**
   * Get classification with explanation (for debugging)
   */
  classifyWithExplanation(text: string): Classification & { patterns: string[] } {
    const classification = this.classify(text)
    const lower = text.toLowerCase()

    const patterns: string[] = []

    if (classification.type === "PREFERENCE") {
      if (lower.includes("i prefer")) patterns.push("'I prefer'")
      if (lower.includes("i like")) patterns.push("'I like'")
      if (lower.includes("i enjoy")) patterns.push("'I enjoy'")
      if (lower.includes("i love")) patterns.push("'I love'")
    } else if (classification.type === "IDENTITY") {
      if (lower.includes("i'm ")) patterns.push("'I'm'")
      if (lower.includes("i am ")) patterns.push("'I am'")
      if (lower.includes("i was ")) patterns.push("'I was'")
    } else if (classification.type === "GOAL") {
      if (lower.includes("i want")) patterns.push("'I want'")
      if (lower.includes("i need")) patterns.push("'I need'")
      if (lower.includes("i aim")) patterns.push("'I aim'")
      if (lower.includes("my goal")) patterns.push("'my goal'")
    } else if (classification.type === "CONTEXT") {
      if (lower.includes("remember")) patterns.push("'remember'")
      if (lower.includes("note that")) patterns.push("'note that'")
      if (lower.includes("context")) patterns.push("'context'")
    }

    return {
      ...classification,
      patterns,
    }
  }
}

/**
 * Global singleton classifier instance
 */
export const classifier = new Classifier()
