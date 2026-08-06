/**
 * GET /api/health
 * 
 * Health check endpoint.
 * Verifies backend is operational.
 * 
 * Response:
 *   {
 *     "success": true,
 *     "status": "ok",
 *     "timestamp": "2026-08-06T23:30:00Z"
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { handleHealth } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleHealth(req)
}
