/**
 * POST /api/memory/approve
 * 
 * Approve a memory candidate.
 * Converts PENDING candidate to APPROVED memory.
 * Updates timeline with approval event.
 * 
 * Request:
 *   {
 *     "candidateId": "cand_xyz"
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "status": "APPROVED",
 *       "memoryId": "mem_abc"
 *     }
 *   }
 */

import { NextRequest } from "next/server"
import { handleApproveMemory } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handleApproveMemory(req)
}
