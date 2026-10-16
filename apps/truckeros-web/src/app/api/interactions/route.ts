import { NextRequest } from "next/server"
import { handlePostInteraction } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handlePostInteraction(req)
}
