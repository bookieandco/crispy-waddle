import { NextRequest } from "next/server"
import { handleApproveMemoryCandidate } from "@/lib/routes/handlers"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleApproveMemoryCandidate(req, params.id)
}
