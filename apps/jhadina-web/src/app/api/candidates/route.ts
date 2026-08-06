/**
 * GET /api/candidates
 * 
 * List all pending memory candidates for the user.
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "candidates": [
 *         {
 *           "id": "cand_1",
 *           "content": "I prefer cinematic visuals",
 *           "type": "PREFERENCE",
 *           "status": "PENDING",
 *           "confidence": 0.95,
 *           "createdAt": "2026-08-06T23:30:00Z"
 *         }
 *       ],
 *       "count": 1
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { handleListCandidates } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleListCandidates(req)
}
