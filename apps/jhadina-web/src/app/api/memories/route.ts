/**
 * GET /api/memories
 * 
 * List all approved memories for the user.
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "memories": [
 *         {
 *           "id": "mem_1",
 *           "content": "I prefer cinematic visuals",
 *           "type": "PREFERENCE",
 *           "status": "APPROVED",
 *           "confidence": 0.95,
 *           "createdAt": "2026-08-06T23:30:00Z",
 *           "approvedAt": "2026-08-06T23:31:00Z"
 *         }
 *       ],
 *       "count": 1
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { handleListMemories } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleListMemories(req)
}
