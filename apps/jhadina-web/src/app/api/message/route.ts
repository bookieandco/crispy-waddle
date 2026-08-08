/**
 * POST /api/message
 * 
 * Process user message through Janet.
 * 
 * Request:
 *   {
 *     "message": "I prefer cinematic visuals"
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "reasoningEventId": "reason_xyz",
 *       "candidateId": "cand_abc",
 *       "classification": {
 *         "type": "PREFERENCE",
 *         "confidence": 0.95
 *       },
 *       "systemResponse": "I've noted that...",
 *       "confidence": 0.95
 *     }
 *   }
 */

import { NextRequest } from "next/server"
import { handleMessage } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handleMessage(req)
}
