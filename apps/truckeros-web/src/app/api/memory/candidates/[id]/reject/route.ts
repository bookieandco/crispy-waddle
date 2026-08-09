import { NextRequest } from "next/server"
import { handleRejectMemoryCandidate } from "@/lib/routes/handlers"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleRejectMemoryCandidate(req, params.id)
}
