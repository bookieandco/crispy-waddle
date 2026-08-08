/**
 * POST /api/memory/reject
 * 
 * Reject a memory candidate.
 * Removes PENDING candidate without creating memory.
 * Updates timeline with rejection event.
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
 *       "status": "REJECTED"
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { handleRejectMemory } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handleRejectMemory(req)
}
