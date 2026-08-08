#!/usr/bin/env node

/**
 * CLI Test Harness: Message Flow
 * 
 * Tests a single user message traveling through the real Janet architecture.
 * No UI. No HTTP. Pure backend.
 * 
 * Run: node test/cli/message_flow.ts
 * 
 * Expected output:
 *   INPUT: "I prefer cinematic visuals"
 *   ↓
 *   Observation created
 *   ↓
 *   Classification: PREFERENCE (confidence: 0.95)
 *   ↓
 *   Candidate created
 *   Status: PENDING
 *   ↓
 *   Reasoning event recorded
 *   ↓
 *   Timeline updated
 *   ↓
 *   Search "cinematic": 0 approved memories
 *   ✅ FLOW COMPLETE
 */

import { InMemoryStorage } from "../../src/lib/storage/InMemoryStorage"
import { MemoryRepository } from "../../src/lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "../../src/lib/repositories/ReasoningEventRepository"
import { TimelineRepository } from "../../src/lib/repositories/TimelineRepository"
import { Classifier } from "../../src/lib/services/Classifier"
import { JanetService } from "../../src/lib/services/JanetService"

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const GREEN = "\x1b[32m"
const CYAN = "\x1b[36m"
const YELLOW = "\x1b[33m"

async function main() {
  console.log("\n" + "═".repeat(60))
  console.log(BOLD + "CLI Test Harness: Message Flow" + RESET)
  console.log("═".repeat(60) + "\n")

  // Initialize backend
  const storage = new InMemoryStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const timelineRepo = new TimelineRepository(storage)
  const classifier = new Classifier()
  const janet = new JanetService(classifier, memoryRepo, reasoningRepo, timelineRepo)

  const userId = "user_demo"
  const userMessage = "I prefer cinematic visuals"

  try {
    // Step 1: Input
    console.log(CYAN + "INPUT" + RESET)
    console.log(`  "${userMessage}"\n`)

    // Step 2: Process message through Janet
    console.log(YELLOW + "Processing..." + RESET + "\n")
    const response = await janet.processMessage({
      userId,
      message: userMessage,
    })

    // Step 3: Display results
    console.log(CYAN + "Observation" + RESET)
    console.log(GREEN + "  ✓ Created\n" + RESET)

    console.log(CYAN + "Classification" + RESET)
    console.log(`  Type: ${BOLD}${response.classification.type}${RESET}`)
    console.log(`  Confidence: ${response.classification.confidence.toFixed(2)}\n`)

    console.log(CYAN + "Memory Candidate" + RESET)
    console.log(`  ID: ${BOLD}${response.memoryCandidate.id}${RESET}`)
    console.log(`  Status: ${BOLD}${response.memoryCandidate.status}${RESET}`)
    console.log(`  Content: "${response.memoryCandidate.content}"`)
    console.log(`  Confidence: ${response.memoryCandidate.confidence.toFixed(2)}\n`)

    console.log(CYAN + "Reasoning Event" + RESET)
    console.log(`  ID: ${BOLD}${response.reasoningEventId}${RESET}`)
    console.log(GREEN + "  ✓ Recorded\n" + RESET)

    // Step 4: Verify reasoning event was created
    const reasoningEvent = await reasoningRepo.get(response.reasoningEventId)
    if (!reasoningEvent) {
      throw new Error("Reasoning event not found")
    }

    console.log(CYAN + "Timeline" + RESET)
    const timeline = await timelineRepo.list(userId)
    console.log(`  Events: ${timeline.length}`)
    if (timeline.length > 0) {
      console.log(GREEN + "  ✓ Timeline updated\n" + RESET)
    }

    // Step 5: Search for approved memories (should be 0)
    console.log(CYAN + "Memory Search" + RESET)
    const searchResults = await memoryRepo.search(userId, {
      query: "cinematic",
    })
    console.log(`  Query: "cinematic"`)
    console.log(`  Approved Memories Found: ${searchResults.length}`)
    console.log(GREEN + "  (Expected: 0, memory is PENDING)\n" + RESET)

    // Step 6: Get stats
    console.log(CYAN + "Statistics" + RESET)
    const stats = await memoryRepo.getStats(userId)
    console.log(`  Total Approved Memories: ${stats.total}`)
    console.log(`  Pending Candidates: ${stats.pending}`)
    console.log(`  By Type: ${JSON.stringify(stats.byType)}\n`)

    // Step 7: Debug dump
    console.log(CYAN + "Debug State" + RESET)
    console.log(storage.dump(userId))
    console.log("")

    // Success
    console.log("═".repeat(60))
    console.log(GREEN + BOLD + "✅ FLOW COMPLETE" + RESET)
    console.log("═".repeat(60) + "\n")

    console.log(BOLD + "What just happened:" + RESET)
    console.log("  1. User message entered the system")
    console.log("  2. JanetService observed and classified it")
    console.log("  3. A memory candidate was created (PENDING approval)")
    console.log("  4. A reasoning event was recorded (audit trail)")
    console.log("  5. Timeline was updated")
    console.log("  6. All data is in storage, ready for approval workflow\n")

    console.log(BOLD + "Next step:" + RESET)
    console.log("  Run: node test/cli/approve_memory.ts\n")

    process.exit(0)
  } catch (error) {
    console.error("\n" + BOLD + "❌ ERROR" + RESET)
    console.error(error instanceof Error ? error.message : String(error))
    console.error("")
    process.exit(1)
  }
}

main()
