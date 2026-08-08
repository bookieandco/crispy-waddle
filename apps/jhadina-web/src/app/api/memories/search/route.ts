/**
 * GET /api/memories/search?q=query
 * 
 * Search approved memories.
 * Full-text search across memory content.
 * 
 * Query Parameters:
 *   q: search query (required)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "results": [
 *         {
 *           "id": "mem_1",
 *           "content": "I prefer cinematic visuals",
 *           "type": "PREFERENCE",
 *           "confidence": 0.95
 *         }
 *       ],
 *       "count": 1
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { handleSearchMemories } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleSearchMemories(req)
}
