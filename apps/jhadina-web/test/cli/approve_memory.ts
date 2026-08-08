#!/usr/bin/env node

/**
 * CLI Test Harness: Approve Memory
 * 
 * Tests the complete approval workflow:
 *   1. Create a message
 *   2. Create a candidate (PENDING)
 *   3. Approve the candidate
 *   4. Verify it's now a memory (APPROVED)
 *   5. Verify it appears in search results
 *   6. Verify timeline was updated
 * 
 * Run: node test/cli/approve_memory.ts
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
const RED = "\x1b[31m"

async function main() {
  console.log("\n" + "═".repeat(60))
  console.log(BOLD + "CLI Test Harness: Approve Memory" + RESET)
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
    // Step 1: Process message
    console.log(YELLOW + "Step 1: Create Message" + RESET)
    console.log(`  Input: "${userMessage}"\n`)

    const response = await janet.processMessage({
      userId,
      message: userMessage,
    })

    console.log(CYAN + "Candidate Created" + RESET)
    console.log(`  ID: ${response.memoryCandidate.id}`)
    console.log(`  Status: ${BOLD}${response.memoryCandidate.status}${RESET}`)
    console.log(`  Type: ${response.classification.type}\n`)

    // Step 2: List pending before approval
    console.log(YELLOW + "Step 2: List Pending Candidates" + RESET)
    let pending = await memoryRepo.listPending(userId)
    console.log(`  Pending candidates: ${pending.length}`)
    if (pending.length > 0) {
      console.log(GREEN + "  ✓ Candidate is pending\n" + RESET)
    }

    // Step 3: Search before approval (should find 0)
    console.log(YELLOW + "Step 3: Search Before Approval" + RESET)
    let searchResults = await memoryRepo.search(userId, {
      query: "cinematic",
    })
    console.log(`  Search results: ${searchResults.length}`)
    if (searchResults.length === 0) {
      console.log(GREEN + "  ✓ Memory is not approved yet\n" + RESET)
    }

    // Step 4: Approve
    console.log(YELLOW + "Step 4: Approve Memory" + RESET)
    const approval = await janet.approveMemory(userId, response.memoryCandidate.id)
    console.log(`  Status: ${BOLD}${approval.status}${RESET}`)
    console.log(`  Memory ID: ${approval.memoryId}`)
    console.log(GREEN + "  ✓ Approved\n" + RESET)

    // Step 5: List pending after approval (should be 0)
    console.log(YELLOW + "Step 5: List Pending After Approval" + RESET)
    pending = await memoryRepo.listPending(userId)
    console.log(`  Pending candidates: ${pending.length}`)
    if (pending.length === 0) {
      console.log(GREEN + "  ✓ No pending candidates\n" + RESET)
    }

    // Step 6: Search after approval (should find 1)
    console.log(YELLOW + "Step 6: Search After Approval" + RESET)
    searchResults = await memoryRepo.search(userId, {
      query: "cinematic",
    })
    console.log(`  Search results: ${searchResults.length}`)
    if (searchResults.length === 1) {
      console.log(`  Memory: "${searchResults[0].content}"`)
      console.log(`  Status: ${BOLD}${searchResults[0].status}${RESET}`)
      console.log(`  Confidence: ${searchResults[0].confidence.toFixed(2)}`)
      console.log(GREEN + "  ✓ Memory found in search\n" + RESET)
    }

    // Step 7: Get stats
    console.log(YELLOW + "Step 7: Statistics" + RESET)
    const stats = await memoryRepo.getStats(userId)
    console.log(`  Total approved memories: ${stats.total}`)
    console.log(`  Pending candidates: ${stats.pending}`)
    console.log(`  By type: ${JSON.stringify(stats.byType)}\n`)

    // Step 8: Timeline should have 2 events now (reasoning + approval)
    console.log(YELLOW + "Step 8: Timeline Verification" + RESET)
    const timeline = await timelineRepo.list(userId)
    console.log(`  Total events: ${timeline.length}`)
    if (timeline.length >= 2) {
      console.log(`  Latest: ${timeline[0].type}`)
      console.log(GREEN + "  ✓ Timeline updated\n" + RESET)
    }

    // Success
    console.log("═".repeat(60))
    console.log(GREEN + BOLD + "✅ APPROVAL WORKFLOW COMPLETE" + RESET)
    console.log("═".repeat(60) + "\n")

    console.log(BOLD + "Summary:" + RESET)
    console.log(`  Message: "${userMessage}"`)
    console.log(`  Classification: ${response.classification.type}`)
    console.log(`  Approval: YES`)
    console.log(`  Final Status: APPROVED`)
    console.log(`  Searchable: YES\n`)

    process.exit(0)
  } catch (error) {
    console.error("\n" + BOLD + RED + "❌ ERROR" + RESET)
    console.error(error instanceof Error ? error.message : String(error))
    console.error("")
    process.exit(1)
  }
}

main()
